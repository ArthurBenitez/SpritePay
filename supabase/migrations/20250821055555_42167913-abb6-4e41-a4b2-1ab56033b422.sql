-- Security Enhancement Migration
-- Phase 1: Critical Financial Data Protection

-- Create encrypted storage for sensitive PIX data
CREATE TABLE public.encrypted_pix_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  withdraw_request_id UUID NOT NULL REFERENCES withdraw_requests(id) ON DELETE CASCADE,
  encrypted_pix_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on encrypted PIX data
ALTER TABLE public.encrypted_pix_data ENABLE ROW LEVEL SECURITY;

-- Only admins can access encrypted PIX data
CREATE POLICY "Only admins can access encrypted PIX data"
ON public.encrypted_pix_data
FOR ALL
USING (is_current_user_admin());

-- Create audit log table for admin actions
CREATE TABLE public.admin_audit_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_user_id UUID NOT NULL,
  action TEXT NOT NULL,
  target_table TEXT NOT NULL,
  target_id UUID,
  details JSONB,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on audit log
ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs"
ON public.admin_audit_log
FOR SELECT
USING (is_current_user_admin());

-- Create function to log admin actions
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action TEXT,
  p_target_table TEXT,
  p_target_id UUID DEFAULT NULL,
  p_details JSONB DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only log if current user is admin
  IF is_current_user_admin() THEN
    INSERT INTO admin_audit_log (
      admin_user_id,
      action,
      target_table,
      target_id,
      details
    ) VALUES (
      auth.uid(),
      p_action,
      p_target_table,
      p_target_id,
      p_details
    );
  END IF;
END;
$$;

-- Enhanced role management with audit trail
CREATE OR REPLACE FUNCTION public.assign_user_role(
  p_user_id UUID,
  p_role app_role
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  role_assigned BOOLEAN := FALSE;
BEGIN
  -- Only admins can assign roles
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can assign roles';
  END IF;
  
  -- Check if role already exists
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = p_role) THEN
    RETURN FALSE;
  END IF;
  
  -- Insert new role
  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, p_role);
  
  GET DIAGNOSTICS role_assigned = ROW_COUNT;
  
  -- Log the action
  IF role_assigned THEN
    PERFORM log_admin_action(
      'ROLE_ASSIGNED',
      'user_roles',
      p_user_id,
      jsonb_build_object('role', p_role)
    );
  END IF;
  
  RETURN role_assigned;
END;
$$;

-- Create secure function for PIX key encryption (placeholder for vault integration)
CREATE OR REPLACE FUNCTION public.store_encrypted_pix_key(
  p_withdraw_request_id UUID,
  p_pix_key TEXT
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  encrypted_id UUID;
BEGIN
  -- For now, we'll store a hash of the PIX key for security
  -- In production, this should use Supabase vault extension
  INSERT INTO encrypted_pix_data (withdraw_request_id, encrypted_pix_key)
  VALUES (p_withdraw_request_id, encode(digest(p_pix_key, 'sha256'), 'hex'))
  RETURNING id INTO encrypted_id;
  
  RETURN encrypted_id;
END;
$$;

-- Enhanced withdrawal approval with audit
CREATE OR REPLACE FUNCTION public.approve_withdrawal_secure(withdrawal_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  withdrawal_record withdraw_requests%ROWTYPE;
BEGIN
  -- Only admins can approve withdrawals
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can approve withdrawals';
  END IF;
  
  -- Get withdrawal details
  SELECT * INTO withdrawal_record
  FROM withdraw_requests
  WHERE id = withdrawal_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;
  
  -- Update withdrawal status
  UPDATE withdraw_requests
  SET status = 'approved', processed_at = now()
  WHERE id = withdrawal_id;
  
  -- Log admin action
  PERFORM log_admin_action(
    'WITHDRAWAL_APPROVED',
    'withdraw_requests',
    withdrawal_id,
    jsonb_build_object(
      'amount', withdrawal_record.amount,
      'points', withdrawal_record.points,
      'user_id', withdrawal_record.user_id
    )
  );
  
  -- Create notification for user
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    withdrawal_record.user_id,
    'Sua solicitação de saque de R$ ' || withdrawal_record.amount::text || ' foi aprovada! O pagamento será processado em breve.',
    'success'
  );
END;
$$;

-- Enhanced withdrawal rejection with audit
CREATE OR REPLACE FUNCTION public.reject_withdrawal_secure(withdrawal_id UUID, rejection_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  withdrawal_record withdraw_requests%ROWTYPE;
BEGIN
  -- Only admins can reject withdrawals
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can reject withdrawals';
  END IF;
  
  -- Get withdrawal details
  SELECT * INTO withdrawal_record
  FROM withdraw_requests
  WHERE id = withdrawal_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;
  
  -- Update withdrawal status
  UPDATE withdraw_requests
  SET status = 'rejected', processed_at = now()
  WHERE id = withdrawal_id;
  
  -- Return points to user
  UPDATE profiles
  SET points = points + withdrawal_record.points
  WHERE user_id = withdrawal_record.user_id;
  
  -- Log admin action
  PERFORM log_admin_action(
    'WITHDRAWAL_REJECTED',
    'withdraw_requests',
    withdrawal_id,
    jsonb_build_object(
      'amount', withdrawal_record.amount,
      'points', withdrawal_record.points,
      'user_id', withdrawal_record.user_id,
      'reason', rejection_reason
    )
  );
  
  -- Create notification for user
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    withdrawal_record.user_id,
    CASE 
      WHEN rejection_reason IS NOT NULL THEN
        'Sua solicitação de saque foi rejeitada. Motivo: ' || rejection_reason || '. Os pontos foram devolvidos à sua conta.'
      ELSE
        'Sua solicitação de saque foi rejeitada. Os pontos foram devolvidos à sua conta.'
    END,
    'error'
  );
END;
$$;

-- Add constraints to prevent unauthorized role assignments
ALTER TABLE user_roles ADD CONSTRAINT valid_role_assignment 
CHECK (role IN ('admin', 'moderator', 'user'));

-- Create device tracking table for credit fraud prevention
CREATE TABLE public.device_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_fingerprint TEXT NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  free_credits_claimed BOOLEAN DEFAULT FALSE,
  first_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_seen TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(device_fingerprint)
);

-- Enable RLS on device sessions
ALTER TABLE public.device_sessions ENABLE ROW LEVEL SECURITY;

-- Create function to check and track device for free credits
CREATE OR REPLACE FUNCTION public.can_claim_free_credits(
  p_device_fingerprint TEXT,
  p_ip_address INET,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  device_exists BOOLEAN;
  credits_claimed BOOLEAN;
BEGIN
  -- Check if device exists and if credits were already claimed
  SELECT EXISTS(
    SELECT 1 FROM device_sessions 
    WHERE device_fingerprint = p_device_fingerprint
  ), COALESCE(
    (SELECT free_credits_claimed FROM device_sessions 
     WHERE device_fingerprint = p_device_fingerprint), 
    FALSE
  ) INTO device_exists, credits_claimed;
  
  -- If device doesn't exist, create it
  IF NOT device_exists THEN
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
    );
    RETURN TRUE;
  END IF;
  
  -- Update last seen
  UPDATE device_sessions 
  SET last_seen = now(),
      user_agent = COALESCE(p_user_agent, user_agent)
  WHERE device_fingerprint = p_device_fingerprint;
  
  -- Return whether credits can be claimed
  RETURN NOT credits_claimed;
END;
$$;

-- Function to mark free credits as claimed
CREATE OR REPLACE FUNCTION public.mark_free_credits_claimed(
  p_device_fingerprint TEXT,
  p_user_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Mark credits as claimed for this device
  UPDATE device_sessions 
  SET free_credits_claimed = TRUE,
      last_seen = now()
  WHERE device_fingerprint = p_device_fingerprint;
  
  -- Log the free credit claim
  INSERT INTO transaction_history (user_id, type, amount, description)
  VALUES (
    p_user_id,
    'free_credits',
    4,
    'Créditos gratuitos de boas-vindas'
  );
END;
$$;