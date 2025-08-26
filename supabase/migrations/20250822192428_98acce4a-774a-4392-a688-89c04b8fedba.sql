-- Update handle_new_user function to be more robust and handle referral processing
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
BEGIN
  -- Read flags from signup metadata
  claimed_flag := COALESCE(NEW.raw_user_meta_data ->> 'claimed_free_credits', 'false');
  referral_code := NEW.raw_user_meta_data ->> 'ref';
  user_name := COALESCE(NEW.raw_user_meta_data ->> 'name', 'Novo usuário');

  initial_credits := CASE 
    WHEN claimed_flag = 'true' THEN 0
    ELSE 4
  END;

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

  -- Process referral if code exists
  IF referral_code IS NOT NULL AND LENGTH(referral_code) = 8 THEN
    -- Find referrer
    SELECT user_id INTO referrer_id
    FROM referral_codes
    WHERE code = referral_code AND is_active = true;
    
    IF referrer_id IS NOT NULL AND referrer_id != NEW.id THEN
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
      
      -- Notify referrer immediately about new signup
      INSERT INTO notifications (user_id, message, type)
      VALUES (
        referrer_id,
        '🎉 ' || user_name || ' criou uma conta usando seu link de convite! Aguarde para ganhar créditos quando ele fizer seu primeiro saque.',
        'info'
      );
      
      RAISE NOTICE 'Referral processed for user % with code % by referrer %', NEW.id, referral_code, referrer_id;
    ELSE
      RAISE NOTICE 'Invalid referral: code=%, referrer_id=%, new_user=%', referral_code, referrer_id, NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Improve the approve_withdrawal_secure function to better handle first withdrawal detection
CREATE OR REPLACE FUNCTION public.approve_withdrawal_secure(withdrawal_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  withdrawal_record withdraw_requests%ROWTYPE;
  is_first_withdrawal BOOLEAN := false;
  previous_approved_count INTEGER := 0;
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
  
  -- Count previous approved withdrawals for this user (excluding current one)
  SELECT COUNT(*) INTO previous_approved_count
  FROM withdraw_requests 
  WHERE user_id = withdrawal_record.user_id 
  AND status = 'approved' 
  AND id != withdrawal_id;
  
  -- This is the first withdrawal if no previous approved withdrawals exist
  is_first_withdrawal := (previous_approved_count = 0);
  
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
      'user_id', withdrawal_record.user_id,
      'is_first_withdrawal', is_first_withdrawal,
      'previous_approved_count', previous_approved_count
    )
  );
  
  -- Create notification for user
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    withdrawal_record.user_id,
    'Sua solicitação de saque de R$ ' || withdrawal_record.amount::text || ' foi aprovada! O pagamento será processado em breve.',
    'success'
  );

  -- Process referral rewards AFTER approval
  BEGIN
    -- First withdrawal milestone (only if this is actually their first)
    IF is_first_withdrawal THEN
      PERFORM process_referral_reward(
        withdrawal_record.user_id,
        'first_withdrawal', 
        withdrawal_record.amount
      );
      RAISE NOTICE 'Processed first_withdrawal milestone for user %', withdrawal_record.user_id;
    ELSE
      RAISE NOTICE 'Skipping first_withdrawal milestone for user % (previous approved: %)', withdrawal_record.user_id, previous_approved_count;
    END IF;

    -- Amount-based milestones (process each milestone only once)
    IF withdrawal_record.amount >= 50 THEN
      PERFORM process_referral_reward(
        withdrawal_record.user_id,
        'withdrawal_50',
        withdrawal_record.amount
      );
      RAISE NOTICE 'Processed withdrawal_50 milestone for user %', withdrawal_record.user_id;
    END IF;

    IF withdrawal_record.amount >= 250 THEN
      PERFORM process_referral_reward(
        withdrawal_record.user_id,
        'withdrawal_250',
        withdrawal_record.amount
      );
      RAISE NOTICE 'Processed withdrawal_250 milestone for user %', withdrawal_record.user_id;
    END IF;

    IF withdrawal_record.amount >= 500 THEN
      PERFORM process_referral_reward(
        withdrawal_record.user_id,
        'withdrawal_500',
        withdrawal_record.amount
      );
      RAISE NOTICE 'Processed withdrawal_500 milestone for user %', withdrawal_record.user_id;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log referral processing errors but don't block withdrawal approval
    PERFORM log_admin_action(
      'REFERRAL_PROCESSING_ERROR',
      'referral_rewards',
      NULL,
      jsonb_build_object(
        'withdrawal_id', withdrawal_id,
        'user_id', withdrawal_record.user_id,
        'error', SQLERRM,
        'is_first_withdrawal', is_first_withdrawal
      )
    );
    RAISE NOTICE 'Error in referral processing for withdrawal %: %', withdrawal_id, SQLERRM;
  END;
END;
$function$;