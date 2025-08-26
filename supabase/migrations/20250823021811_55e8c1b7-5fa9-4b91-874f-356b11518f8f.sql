-- 1. Corrigir validate_device_securely para usar ON CONFLICT e evitar erros de duplicata
CREATE OR REPLACE FUNCTION public.validate_device_securely(p_device_fingerprint text, p_ip_address inet, p_user_agent text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Use ON CONFLICT to handle existing devices gracefully
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
  )
  ON CONFLICT (device_fingerprint) 
  DO UPDATE SET 
    last_seen = now(),
    user_agent = COALESCE(EXCLUDED.user_agent, device_sessions.user_agent)
  RETURNING * INTO device_record;

  -- Determine if credits can be claimed
  can_claim := NOT device_record.free_credits_claimed;

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
$function$;

-- 2. Adicionar novo tipo de transação para créditos de referência
ALTER TABLE public.transaction_history
  DROP CONSTRAINT IF EXISTS transaction_history_type_check;

ALTER TABLE public.transaction_history
  ADD CONSTRAINT transaction_history_type_check
  CHECK (
    type = ANY (
      ARRAY[
        'credit_purchase'::text,
        'sprite_purchase'::text,
        'sprite_loss'::text,
        'points_earned'::text,
        'withdraw_request'::text,
        'referral_reward'::text,
        'free_credits_secure'::text,
        'referral_signup_bonus'::text
      ]
    )
  );

-- 3. Atualizar handle_new_user para conceder créditos extras para indicações
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  initial_credits integer;
  claimed_flag text;
  referral_code text;
  referrer_id uuid;
  user_name text;
  has_referral_code boolean := false;
BEGIN
  -- Read flags from signup metadata
  claimed_flag := COALESCE(NEW.raw_user_meta_data ->> 'claimed_free_credits', 'false');
  referral_code := NEW.raw_user_meta_data ->> 'ref';
  user_name := COALESCE(NEW.raw_user_meta_data ->> 'name', 'Novo usuário');

  -- Check if there's a valid referral code
  IF referral_code IS NOT NULL AND LENGTH(referral_code) = 8 THEN
    SELECT user_id INTO referrer_id
    FROM referral_codes
    WHERE code = referral_code AND is_active = true;
    
    IF referrer_id IS NOT NULL AND referrer_id != NEW.id THEN
      has_referral_code := true;
    END IF;
  END IF;

  -- Determine initial credits based on referral and claim status
  IF claimed_flag = 'true' THEN
    -- If already claimed free credits, no additional credits
    initial_credits := 0;
  ELSIF has_referral_code THEN
    -- If has valid referral code, give 8 credits (4 normal + 4 bonus)
    initial_credits := 8;
  ELSE
    -- Normal signup gets 4 credits
    initial_credits := 4;
  END IF;

  -- Create profile
  INSERT INTO public.profiles (
    id, 
    user_id, 
    name, 
    credits, 
    points, 
    tutorial_completed, 
    tutorial_skipped
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    user_name,
    initial_credits,
    0,
    false,
    false
  );

  -- If user has referral code, process referral and bonus credits
  IF has_referral_code THEN
    -- Create signup referral reward immediately
    INSERT INTO referral_rewards (
      referrer_user_id,
      referred_user_id,
      referral_code,
      milestone_type,
      credits_earned,
      referred_user_name
    ) VALUES (
      referrer_id,
      NEW.id,
      referral_code,
      'signup',
      0,
      user_name
    );
    
    -- Record bonus credits transaction
    INSERT INTO transaction_history (user_id, type, amount, description)
    VALUES (
      NEW.id,
      'referral_signup_bonus',
      4,
      'Créditos extras por cadastro com código de indicação'
    );
    
    -- Notify referrer about new signup
    INSERT INTO notifications (user_id, message, type)
    VALUES (
      referrer_id,
      '🎉 ' || user_name || ' criou uma conta usando seu link de convite! Aguarde para ganhar créditos quando ele fizer seu primeiro saque.',
      'info'
    );
    
    -- Notify new user about bonus credits
    INSERT INTO notifications (user_id, message, type)
    VALUES (
      NEW.id,
      '🎁 Parabéns! Você ganhou 4 créditos extras por se cadastrar através de um link de indicação! Total: 8 créditos!',
      'success'
    );
    
    RAISE NOTICE 'Referral processed for user % with code % by referrer % - bonus credits granted', NEW.id, referral_code, referrer_id;
  ELSE
    -- Regular signup transaction record
    IF initial_credits > 0 THEN
      INSERT INTO transaction_history (user_id, type, amount, description)
      VALUES (
        NEW.id,
        'free_credits_secure',
        initial_credits,
        'Créditos gratuitos de boas-vindas'
      );
    END IF;
    
    RAISE NOTICE 'Regular signup for user % - no referral code', NEW.id;
  END IF;

  RETURN NEW;
END;
$function$;