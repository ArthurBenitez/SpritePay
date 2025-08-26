-- Update handle_new_user function to always give only 4 credits
-- regardless of referral code, but maintain referral tracking
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  initial_credits integer := 4; -- Always 4 credits for everyone
  referral_code text;
  referrer_id uuid;
  user_name text;
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

  -- Create profile with always 4 credits
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
    initial_credits, -- Always 4 credits
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

  -- Regular signup transaction record for all users
  INSERT INTO transaction_history (user_id, type, amount, description)
  VALUES (
    NEW.id,
    'free_credits_secure',
    initial_credits,
    'Créditos gratuitos de boas-vindas'
  );

  RETURN NEW;
END;
$$;