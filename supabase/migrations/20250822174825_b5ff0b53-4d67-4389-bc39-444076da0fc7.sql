-- Fix the referral system by updating metadata storage and processing

-- First, let's check the current process_referral_reward function and improve it
CREATE OR REPLACE FUNCTION public.process_referral_reward(p_referred_user_id uuid, p_milestone_type text, p_withdrawal_amount numeric)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  referrer_id UUID;
  referral_code_val TEXT;
  milestone_valid BOOLEAN := false;
  reward_exists BOOLEAN;
  referred_user_name TEXT;
  signup_reward_exists BOOLEAN;
BEGIN
  -- Validate milestone type
  IF p_milestone_type NOT IN ('first_withdrawal', 'withdrawal_50', 'withdrawal_250', 'withdrawal_500') THEN
    RAISE NOTICE 'Invalid milestone type: %', p_milestone_type;
    RETURN false;
  END IF;
  
  -- Check if milestone is valid based on withdrawal amount
  CASE p_milestone_type
    WHEN 'first_withdrawal' THEN milestone_valid := true;
    WHEN 'withdrawal_50' THEN milestone_valid := p_withdrawal_amount >= 50;
    WHEN 'withdrawal_250' THEN milestone_valid := p_withdrawal_amount >= 250;
    WHEN 'withdrawal_500' THEN milestone_valid := p_withdrawal_amount >= 500;
  END CASE;
  
  IF NOT milestone_valid THEN
    RAISE NOTICE 'Milestone not valid for amount: % with type: %', p_withdrawal_amount, p_milestone_type;
    RETURN false;
  END IF;
  
  -- Try to get referral code from user metadata first
  SELECT 
    raw_user_meta_data ->> 'ref'
  INTO referral_code_val
  FROM auth.users
  WHERE id = p_referred_user_id;
  
  -- If no referral code in metadata, try to find existing signup reward
  IF referral_code_val IS NULL THEN
    SELECT referral_code INTO referral_code_val
    FROM referral_rewards
    WHERE referred_user_id = p_referred_user_id 
    AND milestone_type = 'signup'
    LIMIT 1;
  END IF;
  
  IF referral_code_val IS NULL THEN
    RAISE NOTICE 'No referral code found for user: %', p_referred_user_id;
    RETURN false;
  END IF;
  
  -- Get referrer user_id from referral code
  SELECT user_id INTO referrer_id
  FROM referral_codes
  WHERE code = referral_code_val AND is_active = true;
  
  IF referrer_id IS NULL THEN
    RAISE NOTICE 'Referrer not found for code: %', referral_code_val;
    RETURN false;
  END IF;
  
  -- Get referred user name
  SELECT name INTO referred_user_name
  FROM profiles
  WHERE user_id = p_referred_user_id;
  
  -- Ensure signup reward exists first
  SELECT EXISTS(
    SELECT 1 FROM referral_rewards
    WHERE referred_user_id = p_referred_user_id
    AND referrer_user_id = referrer_id
    AND milestone_type = 'signup'
  ) INTO signup_reward_exists;
  
  IF NOT signup_reward_exists THEN
    -- Create signup reward first
    INSERT INTO referral_rewards (
      referrer_user_id,
      referred_user_id,
      referral_code,
      milestone_type,
      credits_earned,
      referred_user_name
    ) VALUES (
      referrer_id,
      p_referred_user_id,
      referral_code_val,
      'signup',
      0,
      COALESCE(referred_user_name, 'Usuário')
    );
    
    RAISE NOTICE 'Created missing signup reward for user: %', p_referred_user_id;
  END IF;
  
  -- Check if withdrawal reward already exists
  SELECT EXISTS(
    SELECT 1 FROM referral_rewards
    WHERE referred_user_id = p_referred_user_id
    AND referrer_user_id = referrer_id
    AND milestone_type = p_milestone_type
  ) INTO reward_exists;
  
  IF reward_exists THEN
    RAISE NOTICE 'Reward already exists for milestone: % user: %', p_milestone_type, p_referred_user_id;
    RETURN false;
  END IF;
  
  -- Add credits to referrer
  UPDATE profiles
  SET credits = credits + 2,
      updated_at = now()
  WHERE user_id = referrer_id;
  
  -- Record the reward with user name
  INSERT INTO referral_rewards (
    referrer_user_id,
    referred_user_id,
    referral_code,
    milestone_type,
    credits_earned,
    referred_user_name
  ) VALUES (
    referrer_id,
    p_referred_user_id,
    referral_code_val,
    p_milestone_type,
    2,
    COALESCE(referred_user_name, 'Usuário')
  );
  
  -- Create personalized notification for referrer
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    referrer_id,
    '🎉 Parabéns! ' || COALESCE(referred_user_name, 'Um usuário') || ', que criou conta pelo seu link de convite, ' ||
    CASE p_milestone_type
      WHEN 'first_withdrawal' THEN 'fez seu primeiro saque!'
      WHEN 'withdrawal_50' THEN 'fez um saque de R$ 50!'
      WHEN 'withdrawal_250' THEN 'fez um saque de R$ 250!'
      WHEN 'withdrawal_500' THEN 'fez um saque de R$ 500!'
    END || ' Você ganhou 2 créditos! 💰',
    'success'
  );
  
  -- Create transaction record
  INSERT INTO transaction_history (user_id, type, amount, description)
  VALUES (
    referrer_id,
    'referral_reward',
    2,
    'Recompensa por indicação - ' || COALESCE(referred_user_name, 'Usuário') || ' - ' || p_milestone_type
  );
  
  RAISE NOTICE 'Successfully processed referral reward: % for user: %', p_milestone_type, p_referred_user_id;
  RETURN true;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error processing referral reward: %', SQLERRM;
  RETURN false;
END;
$function$;

-- Update the handle_new_user trigger to store referral code in metadata if present
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
BEGIN
  -- Lê o flag do metadata do signup. Se vier "true", não concede créditos.
  claimed_flag := COALESCE(NEW.raw_user_meta_data ->> 'claimed_free_credits', 'false');
  referral_code := NEW.raw_user_meta_data ->> 'ref';

  initial_credits := CASE 
    WHEN claimed_flag = 'true' THEN 0
    ELSE 4
  END;

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
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''),
    initial_credits,
    0,
    false,
    false
  );

  -- Log referral information for debugging
  IF referral_code IS NOT NULL THEN
    RAISE NOTICE 'New user % signed up with referral code: %', NEW.id, referral_code;
  END IF;

  RETURN NEW;
END;
$function$;