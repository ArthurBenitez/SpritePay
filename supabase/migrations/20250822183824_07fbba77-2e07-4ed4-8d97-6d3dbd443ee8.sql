-- 1) Allow authenticated users to read active referral codes (fix RLS blocking)
CREATE POLICY "Authenticated can read active referral codes"
  ON public.referral_codes
  FOR SELECT
  TO authenticated
  USING (is_active = true);

-- 2) Fix get_referral_statistics function (was causing errors)
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
  WHERE referrer_user_id = p_user_id
  AND milestone_type != 'signup';
  
  -- Get list of referred users with their status
  SELECT jsonb_agg(
    jsonb_build_object(
      'name', COALESCE(referred_user_name, 'Usuário'),
      'milestone_type', milestone_type,
      'credits_earned', credits_earned,
      'completed_at', milestone_completed_at,
      'is_active', CASE WHEN milestone_type IN ('first_withdrawal', 'withdrawal_50', 'withdrawal_250', 'withdrawal_500') THEN true ELSE false END
    )
    ORDER BY milestone_completed_at DESC
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

-- 3) Update handle_new_user to process referrals server-side
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
  IF referral_code IS NOT NULL THEN
    -- Find referrer
    SELECT user_id INTO referrer_id
    FROM referral_codes
    WHERE code = referral_code AND is_active = true;
    
    IF referrer_id IS NOT NULL AND referrer_id != NEW.id THEN
      -- Create signup referral reward
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
      
      -- Notify referrer
      INSERT INTO notifications (user_id, message, type)
      VALUES (
        referrer_id,
        '🎉 ' || user_name || ' criou uma conta usando seu link de convite! Aguarde para ganhar créditos quando ele fizer seu primeiro saque.',
        'info'
      );
      
      RAISE NOTICE 'Referral processed for user % with code %', NEW.id, referral_code;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4) Ensure realtime for referral_rewards and notifications
ALTER TABLE public.referral_rewards REPLICA IDENTITY FULL;
ALTER TABLE public.notifications REPLICA IDENTITY FULL;

-- Add to realtime publication (safely)
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.referral_rewards;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Table already in publication
    WHEN OTHERS THEN
      NULL; -- Other errors, continue
  END;

  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
  EXCEPTION
    WHEN duplicate_object THEN
      NULL; -- Table already in publication
    WHEN OTHERS THEN
      NULL; -- Other errors, continue
  END;
END $$;