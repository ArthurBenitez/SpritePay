-- Update referral_rewards milestone types to include the correct point thresholds
-- First drop the existing constraint
ALTER TABLE referral_rewards 
DROP CONSTRAINT IF EXISTS referral_rewards_milestone_type_check;

-- Add the updated constraint with correct point thresholds (25, 50, 250, 500 points)
ALTER TABLE referral_rewards 
ADD CONSTRAINT referral_rewards_milestone_type_check 
CHECK (milestone_type IN ('signup', 'first_withdrawal', 'withdrawal_25', 'withdrawal_50', 'withdrawal_250', 'withdrawal_500'));

-- Update the process_referral_reward function to handle the new milestones
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
  credits_to_award INTEGER := 2;
  withdrawal_points INTEGER;
BEGIN
  -- Convert withdrawal amount to points (assuming 1 point = 0.5 BRL)
  withdrawal_points := (p_withdrawal_amount * 2)::INTEGER;
  
  -- Validate milestone type
  IF p_milestone_type NOT IN ('first_withdrawal', 'withdrawal_25', 'withdrawal_50', 'withdrawal_250', 'withdrawal_500') THEN
    RAISE NOTICE 'Invalid milestone type: %', p_milestone_type;
    RETURN false;
  END IF;
  
  -- Check if milestone is valid based on withdrawal points
  CASE p_milestone_type
    WHEN 'first_withdrawal' THEN milestone_valid := true;
    WHEN 'withdrawal_25' THEN milestone_valid := withdrawal_points >= 25;
    WHEN 'withdrawal_50' THEN milestone_valid := withdrawal_points >= 50;
    WHEN 'withdrawal_250' THEN milestone_valid := withdrawal_points >= 250;
    WHEN 'withdrawal_500' THEN milestone_valid := withdrawal_points >= 500;
  END CASE;
  
  IF NOT milestone_valid THEN
    RAISE NOTICE 'Milestone not valid for points: % with type: %', withdrawal_points, p_milestone_type;
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
  SET credits = credits + credits_to_award,
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
    credits_to_award,
    COALESCE(referred_user_name, 'Usuário')
  );
  
  -- Create personalized notification for referrer
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    referrer_id,
    '🎉 Parabéns! ' || COALESCE(referred_user_name, 'Um usuário') || ', que criou conta pelo seu link de convite, ' ||
    CASE p_milestone_type
      WHEN 'first_withdrawal' THEN 'fez seu primeiro saque!'
      WHEN 'withdrawal_25' THEN 'atingiu 25 pontos em saques!'
      WHEN 'withdrawal_50' THEN 'atingiu 50 pontos em saques!'
      WHEN 'withdrawal_250' THEN 'atingiu 250 pontos em saques!'
      WHEN 'withdrawal_500' THEN 'atingiu 500 pontos em saques!'
    END || ' Você ganhou ' || credits_to_award || ' créditos! 💰',
    'success'
  );
  
  -- Create transaction record
  INSERT INTO transaction_history (user_id, type, amount, description)
  VALUES (
    referrer_id,
    'referral_reward',
    credits_to_award,
    'Recompensa por indicação - ' || COALESCE(referred_user_name, 'Usuário') || ' - ' || p_milestone_type
  );
  
  RAISE NOTICE 'Successfully processed referral reward: % for user: %', p_milestone_type, p_referred_user_id;
  RETURN true;
  
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Error processing referral reward: %', SQLERRM;
  RETURN false;
END;
$function$;

-- Update the approve_withdrawal_secure function to use correct point thresholds
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
  withdrawal_points INTEGER;
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
  
  -- Convert amount to points for milestone checking
  withdrawal_points := withdrawal_record.points;
  
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

    -- Point-based milestones (process each milestone only once)
    IF withdrawal_points >= 25 THEN
      PERFORM process_referral_reward(
        withdrawal_record.user_id,
        'withdrawal_25',
        withdrawal_record.amount
      );
      RAISE NOTICE 'Processed withdrawal_25 milestone for user %', withdrawal_record.user_id;
    END IF;

    IF withdrawal_points >= 50 THEN
      PERFORM process_referral_reward(
        withdrawal_record.user_id,
        'withdrawal_50',
        withdrawal_record.amount
      );
      RAISE NOTICE 'Processed withdrawal_50 milestone for user %', withdrawal_record.user_id;
    END IF;

    IF withdrawal_points >= 250 THEN
      PERFORM process_referral_reward(
        withdrawal_record.user_id,
        'withdrawal_250',
        withdrawal_record.amount
      );
      RAISE NOTICE 'Processed withdrawal_250 milestone for user %', withdrawal_record.user_id;
    END IF;

    IF withdrawal_points >= 500 THEN
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

-- Process the retroactive referral reward for the already approved withdrawal
-- User fsfsinfsdaf@imperium.com made a 5-point withdrawal that was approved but referral wasn't processed
SELECT process_referral_reward(
  'cce87992-31e8-4c98-bfbb-9c9a09cd15fb'::uuid, -- fsfsinfsdaf@imperium.com user_id
  'first_withdrawal',
  2.50 -- the withdrawal amount was 2.50 BRL
);