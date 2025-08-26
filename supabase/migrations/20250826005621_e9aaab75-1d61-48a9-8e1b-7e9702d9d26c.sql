-- Create signup eligibility tracking table
CREATE TABLE public.signup_eligibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  device_fingerprint TEXT NOT NULL,
  ip_address INET NOT NULL,
  user_agent TEXT,
  is_eligible BOOLEAN NOT NULL DEFAULT false,
  credits_granted BOOLEAN NOT NULL DEFAULT false,
  credits_amount INTEGER DEFAULT 0,
  risk_score INTEGER DEFAULT 0,
  eligible_user_position INTEGER,
  block_number INTEGER,
  block_position INTEGER,
  evaluation_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.signup_eligibility ENABLE ROW LEVEL SECURITY;

-- Users can view their own eligibility
CREATE POLICY "Users can view their own eligibility" 
ON public.signup_eligibility 
FOR SELECT 
USING (auth.uid() = user_id);

-- Admins can view all eligibility records
CREATE POLICY "Admins can view all eligibility" 
ON public.signup_eligibility 
FOR SELECT 
USING (is_current_user_admin());

-- System can insert eligibility records
CREATE POLICY "System can insert eligibility" 
ON public.signup_eligibility 
FOR INSERT 
WITH CHECK (true);

-- Create function to evaluate initial credits for new users
CREATE OR REPLACE FUNCTION public.evaluate_initial_credits(
  p_user_id UUID,
  p_device_fingerprint TEXT,
  p_ip_address INET,
  p_user_agent TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  validation_result JSONB;
  risk_score INTEGER := 0;
  is_eligible BOOLEAN := false;
  should_grant_credits BOOLEAN := false;
  eligible_count INTEGER := 0;
  block_number INTEGER;
  block_position INTEGER;
  credits_amount INTEGER := 4;
  evaluation_reason TEXT;
  existing_record RECORD;
BEGIN
  -- Check if already evaluated
  SELECT * INTO existing_record
  FROM signup_eligibility
  WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RETURN jsonb_build_object(
      'success', true,
      'already_evaluated', true,
      'credits_granted', existing_record.credits_granted,
      'credits_amount', existing_record.credits_amount,
      'reason', existing_record.evaluation_reason
    );
  END IF;

  -- Validate device security
  validation_result := validate_device_ultra_secure(
    p_device_fingerprint,
    p_ip_address,
    p_user_agent,
    NULL,
    NULL
  );
  
  risk_score := COALESCE((validation_result->>'risk_score')::INTEGER, 0);
  
  -- High risk or invalid device = not eligible
  IF NOT (validation_result->>'valid')::BOOLEAN OR risk_score >= 50 THEN
    is_eligible := false;
    should_grant_credits := false;
    evaluation_reason := 'Account flagged as secondary/abusive (risk score: ' || risk_score || ')';
  ELSE
    -- Count eligible users so far
    SELECT COUNT(*) INTO eligible_count
    FROM signup_eligibility
    WHERE is_eligible = true;
    
    is_eligible := true;
    eligible_count := eligible_count + 1; -- Include current user
    
    -- Calculate block number and position (1-based)
    block_number := ((eligible_count - 1) / 3) + 1;
    block_position := ((eligible_count - 1) % 3) + 1;
    
    -- Grant credits if block number is odd (1st, 3rd, 5th block, etc.)
    should_grant_credits := (block_number % 2 = 1);
    
    IF should_grant_credits THEN
      evaluation_reason := 'Conta elegível! Você é o usuário ' || eligible_count || ' (Bloco ' || block_number || ', posição ' || block_position || ')';
    ELSE
      evaluation_reason := 'Conta válida, mas sem créditos neste momento. Você é o usuário ' || eligible_count || ' (Bloco ' || block_number || ', posição ' || block_position || ')';
      credits_amount := 0;
    END IF;
  END IF;

  -- Record the evaluation
  INSERT INTO signup_eligibility (
    user_id,
    device_fingerprint,
    ip_address,
    user_agent,
    is_eligible,
    credits_granted,
    credits_amount,
    risk_score,
    eligible_user_position,
    block_number,
    block_position,
    evaluation_reason
  ) VALUES (
    p_user_id,
    p_device_fingerprint,
    p_ip_address,
    p_user_agent,
    is_eligible,
    should_grant_credits,
    credits_amount,
    risk_score,
    CASE WHEN is_eligible THEN eligible_count ELSE NULL END,
    CASE WHEN is_eligible THEN block_number ELSE NULL END,
    CASE WHEN is_eligible THEN block_position ELSE NULL END,
    evaluation_reason
  );

  -- Grant credits if eligible
  IF should_grant_credits THEN
    -- Update user profile
    UPDATE profiles
    SET credits = credits + credits_amount,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    -- Mark device as claimed
    UPDATE device_sessions
    SET free_credits_claimed = true
    WHERE device_fingerprint = p_device_fingerprint;
    
    -- Log transaction
    INSERT INTO transaction_history (user_id, type, amount, description)
    VALUES (
      p_user_id,
      'free_credits_lottery',
      credits_amount,
      'Créditos gratuitos do sistema de sorteio'
    );
    
    -- Success notification
    INSERT INTO notifications (user_id, message, type)
    VALUES (
      p_user_id,
      '🎉 Parabéns! Sua conta foi sorteada para receber ' || credits_amount || ' créditos gratuitos!',
      'success'
    );
  ELSE
    -- No credits notification
    INSERT INTO notifications (user_id, message, type)
    VALUES (
      p_user_id,
      CASE 
        WHEN is_eligible THEN '📋 Sua conta é válida, mas não foi sorteada para créditos gratuitos neste momento.'
        ELSE '🛡️ Conta identificada como secundária ou suspeita. Créditos gratuitos não disponíveis.'
      END,
      CASE WHEN is_eligible THEN 'info' ELSE 'warning' END
    );
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'credits_granted', should_grant_credits,
    'credits_amount', credits_amount,
    'is_eligible', is_eligible,
    'eligible_position', CASE WHEN is_eligible THEN eligible_count ELSE NULL END,
    'block_number', CASE WHEN is_eligible THEN block_number ELSE NULL END,
    'block_position', CASE WHEN is_eligible THEN block_position ELSE NULL END,
    'risk_score', risk_score,
    'reason', evaluation_reason
  );
END;
$$;

-- Update handle_new_user to not grant credits automatically
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_name text;
  referral_code text;
  referrer_id uuid;
  has_referral_code boolean := false;
BEGIN
  -- Read data from signup metadata
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

  -- Create profile WITHOUT credits (credits will be evaluated later)
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
    0, -- No initial credits
    0,
    false,
    false
  );

  -- If user has referral code, process referral tracking only
  IF has_referral_code THEN
    -- Create signup referral reward (tracking only, no extra credits)
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
      0, -- No credits for signup anymore
      user_name
    );
    
    -- Notify referrer about new signup
    INSERT INTO notifications (user_id, message, type)
    VALUES (
      referrer_id,
      '🎉 ' || user_name || ' criou uma conta usando seu link de convite! Aguarde para ganhar créditos quando ele fizer seu primeiro saque.',
      'info'
    );
    
    RAISE NOTICE 'Referral tracked for user % with code % by referrer % - no bonus credits', NEW.id, referral_code, referrer_id;
  ELSE
    RAISE NOTICE 'Regular signup for user % - no referral code', NEW.id;
  END IF;

  RETURN NEW;
END;
$$;