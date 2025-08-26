-- Add referred_user_name column to referral_rewards table
ALTER TABLE referral_rewards 
ADD COLUMN referred_user_name TEXT;

-- Update process_referral_reward function to include user name in notifications
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
BEGIN
  -- Validate milestone type
  IF p_milestone_type NOT IN ('first_withdrawal', 'withdrawal_50', 'withdrawal_250', 'withdrawal_500') THEN
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
    RETURN false;
  END IF;
  
  -- Get referrer information from user metadata
  SELECT 
    raw_user_meta_data ->> 'referral_code'
  INTO referral_code_val
  FROM auth.users
  WHERE id = p_referred_user_id;
  
  IF referral_code_val IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get referrer user_id from referral code
  SELECT user_id INTO referrer_id
  FROM referral_codes
  WHERE code = referral_code_val AND is_active = true;
  
  IF referrer_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get referred user name
  SELECT name INTO referred_user_name
  FROM profiles
  WHERE user_id = p_referred_user_id;
  
  -- Check if reward already exists
  SELECT EXISTS(
    SELECT 1 FROM referral_rewards
    WHERE referred_user_id = p_referred_user_id
    AND referrer_user_id = referrer_id
    AND milestone_type = p_milestone_type
  ) INTO reward_exists;
  
  IF reward_exists THEN
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
    'Parabéns! ' || COALESCE(referred_user_name, 'Um usuário') || ', que criou conta pelo seu link de convite, ' ||
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
  
  RETURN true;
END;
$function$;

-- Create function to get detailed referral statistics
CREATE OR REPLACE FUNCTION public.get_referral_statistics(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  total_credits_earned INTEGER := 0;
  total_referred_users INTEGER := 0;
  active_users INTEGER := 0;
  completed_milestones INTEGER := 0;
  referred_users_list jsonb;
BEGIN
  -- Get total credits earned from referrals
  SELECT COALESCE(SUM(credits_earned), 0) INTO total_credits_earned
  FROM referral_rewards
  WHERE referrer_user_id = p_user_id;
  
  -- Get total referred users
  SELECT COUNT(DISTINCT referred_user_id) INTO total_referred_users
  FROM referral_rewards
  WHERE referrer_user_id = p_user_id;
  
  -- Get active users (users who made at least one withdrawal)
  SELECT COUNT(DISTINCT rr.referred_user_id) INTO active_users
  FROM referral_rewards rr
  WHERE rr.referrer_user_id = p_user_id
  AND rr.milestone_type IN ('first_withdrawal', 'withdrawal_50', 'withdrawal_250', 'withdrawal_500');
  
  -- Get completed milestones
  SELECT COUNT(*) INTO completed_milestones
  FROM referral_rewards
  WHERE referrer_user_id = p_user_id;
  
  -- Get list of referred users with their status
  SELECT jsonb_agg(
    jsonb_build_object(
      'name', COALESCE(referred_user_name, 'Usuário'),
      'milestone_type', milestone_type,
      'credits_earned', credits_earned,
      'completed_at', milestone_completed_at,
      'is_active', CASE WHEN milestone_type IN ('first_withdrawal', 'withdrawal_50', 'withdrawal_250', 'withdrawal_500') THEN true ELSE false END
    )
  ) INTO referred_users_list
  FROM referral_rewards
  WHERE referrer_user_id = p_user_id
  ORDER BY milestone_completed_at DESC;
  
  RETURN jsonb_build_object(
    'total_credits_earned', total_credits_earned,
    'total_referred_users', total_referred_users,
    'active_users', active_users,
    'completed_milestones', completed_milestones,
    'referred_users', COALESCE(referred_users_list, '[]'::jsonb)
  );
END;
$function$;