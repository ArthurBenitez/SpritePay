-- Security fixes: PIX encryption, device sessions RLS, enhanced validation

-- Enable vault extension for encrypted storage (if not already enabled)
CREATE EXTENSION IF NOT EXISTS "vault" WITH SCHEMA "pgsql_catalog";

-- Create secure PIX data storage with encryption
CREATE TABLE IF NOT EXISTS public.secure_pix_storage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  withdraw_request_id UUID NOT NULL UNIQUE,
  encrypted_pix_key_id UUID, -- Reference to vault encrypted data
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accessed_at TIMESTAMP WITH TIME ZONE,
  access_count INTEGER DEFAULT 0
);

-- Enable RLS on secure PIX storage
ALTER TABLE public.secure_pix_storage ENABLE ROW LEVEL SECURITY;

-- Only admins can access secure PIX storage
CREATE POLICY "Only admins can access secure PIX storage"
ON public.secure_pix_storage
FOR ALL
USING (is_current_user_admin());

-- Add RLS policies to device_sessions table
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

-- Only system functions can access device sessions (no user access)
CREATE POLICY "Only system can access device sessions"
ON public.device_sessions
FOR ALL
USING (false); -- No direct user access allowed

-- Create secure function to store encrypted PIX keys
CREATE OR REPLACE FUNCTION public.store_secure_pix_key(
  p_withdraw_request_id UUID,
  p_pix_key TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  encrypted_key_id UUID;
  storage_id UUID;
BEGIN
  -- Only admins can store PIX keys
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can store PIX keys';
  END IF;

  -- Store encrypted PIX key in vault
  INSERT INTO vault.secrets (secret)
  VALUES (p_pix_key)
  RETURNING id INTO encrypted_key_id;

  -- Store reference in secure storage
  INSERT INTO public.secure_pix_storage (
    withdraw_request_id,
    encrypted_pix_key_id
  ) VALUES (
    p_withdraw_request_id,
    encrypted_key_id
  ) RETURNING id INTO storage_id;

  -- Log admin action
  PERFORM log_admin_action(
    'PIX_KEY_STORED',
    'secure_pix_storage',
    storage_id,
    jsonb_build_object(
      'withdraw_request_id', p_withdraw_request_id
    )
  );

  RETURN storage_id;
END;
$$;

-- Create secure function to retrieve PIX keys
CREATE OR REPLACE FUNCTION public.get_secure_pix_key(
  p_withdraw_request_id UUID
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  encrypted_key_id UUID;
  pix_key TEXT;
  storage_id UUID;
BEGIN
  -- Only admins can retrieve PIX keys
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can retrieve PIX keys';
  END IF;

  -- Get encrypted key ID
  SELECT s.encrypted_pix_key_id, s.id
  INTO encrypted_key_id, storage_id
  FROM public.secure_pix_storage s
  WHERE s.withdraw_request_id = p_withdraw_request_id;

  IF encrypted_key_id IS NULL THEN
    RAISE EXCEPTION 'PIX key not found for withdrawal request';
  END IF;

  -- Retrieve decrypted PIX key from vault
  SELECT decrypted_secret
  INTO pix_key
  FROM vault.decrypted_secrets
  WHERE id = encrypted_key_id;

  -- Update access tracking
  UPDATE public.secure_pix_storage
  SET accessed_at = now(),
      access_count = access_count + 1
  WHERE id = storage_id;

  -- Log admin action
  PERFORM log_admin_action(
    'PIX_KEY_ACCESSED',
    'secure_pix_storage',
    storage_id,
    jsonb_build_object(
      'withdraw_request_id', p_withdraw_request_id
    )
  );

  RETURN pix_key;
END;
$$;

-- Enhanced Brazilian CNPJ validation function
CREATE OR REPLACE FUNCTION public.validate_cnpj(cnpj_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  clean_cnpj TEXT;
  sum_1 INTEGER := 0;
  sum_2 INTEGER := 0;
  digit_1 INTEGER;
  digit_2 INTEGER;
  weights_1 INTEGER[] := ARRAY[5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  weights_2 INTEGER[] := ARRAY[6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  i INTEGER;
BEGIN
  -- Remove all non-digit characters
  clean_cnpj := regexp_replace(cnpj_input, '[^0-9]', '', 'g');
  
  -- Check length
  IF char_length(clean_cnpj) != 14 THEN
    RETURN FALSE;
  END IF;
  
  -- Check for known invalid patterns (all same digits)
  IF clean_cnpj ~ '^(\d)\1{13}$' THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate first check digit
  FOR i IN 1..12 LOOP
    sum_1 := sum_1 + (substring(clean_cnpj, i, 1)::INTEGER * weights_1[i]);
  END LOOP;
  
  digit_1 := 11 - (sum_1 % 11);
  IF digit_1 >= 10 THEN
    digit_1 := 0;
  END IF;
  
  -- Check first digit
  IF substring(clean_cnpj, 13, 1)::INTEGER != digit_1 THEN
    RETURN FALSE;
  END IF;
  
  -- Calculate second check digit
  FOR i IN 1..13 LOOP
    sum_2 := sum_2 + (substring(clean_cnpj, i, 1)::INTEGER * weights_2[i]);
  END LOOP;
  
  digit_2 := 11 - (sum_2 % 11);
  IF digit_2 >= 10 THEN
    digit_2 := 0;
  END IF;
  
  -- Check second digit
  RETURN substring(clean_cnpj, 14, 1)::INTEGER = digit_2;
END;
$$;

-- Create secure device validation function
CREATE OR REPLACE FUNCTION public.validate_device_securely(
  p_device_fingerprint TEXT,
  p_ip_address INET,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  device_record device_sessions%ROWTYPE;
  can_claim BOOLEAN := FALSE;
  risk_score INTEGER := 0;
  validation_result JSONB;
BEGIN
  -- Basic input validation
  IF p_device_fingerprint IS NULL OR length(p_device_fingerprint) < 8 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'can_claim_credits', false,
      'error', 'Invalid device fingerprint'
    );
  END IF;

  -- Get or create device session
  SELECT * INTO device_record
  FROM device_sessions
  WHERE device_fingerprint = p_device_fingerprint;

  IF NOT FOUND THEN
    -- Create new device session
    INSERT INTO device_sessions (
      device_fingerprint,
      ip_address,
      user_agent,
      free_credits_claimed
    ) VALUES (
      p_device_fingerprint,
      p_ip_address,
      p_user_agent,
      FALSE
    ) RETURNING * INTO device_record;
    
    can_claim := TRUE;
  ELSE
    -- Update existing session
    UPDATE device_sessions
    SET last_seen = now(),
        user_agent = COALESCE(p_user_agent, user_agent)
    WHERE device_fingerprint = p_device_fingerprint;
    
    can_claim := NOT device_record.free_credits_claimed;
  END IF;

  -- Calculate risk score based on various factors
  -- Check for suspicious patterns
  IF EXISTS (
    SELECT 1 FROM device_sessions
    WHERE ip_address = p_ip_address
    AND free_credits_claimed = TRUE
    AND created_at > now() - INTERVAL '24 hours'
  ) THEN
    risk_score := risk_score + 30;
  END IF;

  -- Check device creation frequency from same IP
  IF (
    SELECT COUNT(*)
    FROM device_sessions
    WHERE ip_address = p_ip_address
    AND created_at > now() - INTERVAL '1 hour'
  ) > 3 THEN
    risk_score := risk_score + 40;
  END IF;

  -- High risk blocks credit claiming
  IF risk_score >= 50 THEN
    can_claim := FALSE;
  END IF;

  validation_result := jsonb_build_object(
    'valid', true,
    'can_claim_credits', can_claim,
    'risk_score', risk_score,
    'device_id', device_record.id
  );

  RETURN validation_result;
END;
$$;

-- Enhanced role security - prevent unauthorized role changes
CREATE OR REPLACE FUNCTION public.secure_role_assignment(
  p_target_user_id UUID,
  p_role app_role,
  p_action TEXT DEFAULT 'assign'
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_admin_id UUID;
  role_exists BOOLEAN;
  operation_success BOOLEAN := FALSE;
BEGIN
  current_admin_id := auth.uid();
  
  -- Only authenticated admins can manage roles
  IF current_admin_id IS NULL OR NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only authenticated admins can manage roles';
  END IF;
  
  -- Prevent self-role modification for security
  IF current_admin_id = p_target_user_id THEN
    RAISE EXCEPTION 'Security violation: Cannot modify your own roles';
  END IF;
  
  -- Check if role already exists
  SELECT EXISTS(
    SELECT 1 FROM user_roles
    WHERE user_id = p_target_user_id AND role = p_role
  ) INTO role_exists;
  
  IF p_action = 'assign' THEN
    IF role_exists THEN
      RETURN FALSE; -- Role already assigned
    END IF;
    
    INSERT INTO user_roles (user_id, role)
    VALUES (p_target_user_id, p_role);
    
    GET DIAGNOSTICS operation_success = ROW_COUNT;
    
    -- Log the assignment
    PERFORM log_admin_action(
      'SECURE_ROLE_ASSIGNED',
      'user_roles',
      p_target_user_id,
      jsonb_build_object(
        'role', p_role,
        'admin_id', current_admin_id
      )
    );
    
  ELSIF p_action = 'revoke' THEN
    IF NOT role_exists THEN
      RETURN FALSE; -- Role doesn't exist
    END IF;
    
    DELETE FROM user_roles
    WHERE user_id = p_target_user_id AND role = p_role;
    
    GET DIAGNOSTICS operation_success = ROW_COUNT;
    
    -- Log the revocation
    PERFORM log_admin_action(
      'SECURE_ROLE_REVOKED',
      'user_roles',
      p_target_user_id,
      jsonb_build_object(
        'role', p_role,
        'admin_id', current_admin_id
      )
    );
  END IF;
  
  RETURN operation_success;
END;
$$;

-- Secure free credits claiming with enhanced validation
CREATE OR REPLACE FUNCTION public.claim_free_credits_secure(
  p_device_fingerprint TEXT,
  p_ip_address INET,
  p_user_agent TEXT DEFAULT NULL
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_record profiles%ROWTYPE;
  validation_result JSONB;
  current_user_id UUID;
  credits_granted INTEGER := 4;
BEGIN
  current_user_id := auth.uid();
  
  -- Must be authenticated
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;
  
  -- Validate device securely
  validation_result := validate_device_securely(
    p_device_fingerprint,
    p_ip_address,
    p_user_agent
  );
  
  -- Check validation result
  IF NOT (validation_result->>'valid')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', validation_result->>'error'
    );
  END IF;
  
  IF NOT (validation_result->>'can_claim_credits')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Free credits already claimed or device flagged'
    );
  END IF;
  
  -- Get user profile
  SELECT * INTO user_record
  FROM profiles
  WHERE user_id = current_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;
  
  -- Grant credits
  UPDATE profiles
  SET credits = credits + credits_granted
  WHERE user_id = current_user_id;
  
  -- Mark device as claimed
  UPDATE device_sessions
  SET free_credits_claimed = TRUE
  WHERE device_fingerprint = p_device_fingerprint;
  
  -- Log transaction
  INSERT INTO transaction_history (user_id, type, amount, description)
  VALUES (
    current_user_id,
    'free_credits_secure',
    credits_granted,
    'Créditos gratuitos seguros concedidos'
  );
  
  -- Send notification
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    current_user_id,
    'Créditos gratuitos concedidos com segurança! +' || credits_granted || ' créditos! 🎉',
    'success'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_granted', credits_granted,
    'risk_score', validation_result->>'risk_score'
  );
END;
$$;