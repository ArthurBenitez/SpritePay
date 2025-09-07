-- Add username and email columns to profiles table
ALTER TABLE public.profiles 
ADD COLUMN username TEXT,
ADD COLUMN email TEXT;

-- Create unique index on username (case-insensitive)
CREATE UNIQUE INDEX idx_profiles_username_unique ON public.profiles (LOWER(username));

-- Backfill existing profiles with email from auth.users
UPDATE public.profiles 
SET email = au.email
FROM auth.users au
WHERE profiles.user_id = au.id;

-- Make email not null after backfill
ALTER TABLE public.profiles ALTER COLUMN email SET NOT NULL;

-- Update handle_new_user trigger to include username and email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public 
AS $$
DECLARE
  user_name text;
  user_username text;
  referral_code text;
  referrer_id uuid;
  has_referral_code boolean := false;
BEGIN
  -- Read data from signup metadata
  referral_code := NEW.raw_user_meta_data ->> 'ref';
  user_name := COALESCE(NEW.raw_user_meta_data ->> 'name', 'Novo usuário');
  user_username := NEW.raw_user_meta_data ->> 'username';

  -- Check if there's a valid referral code
  IF referral_code IS NOT NULL AND LENGTH(referral_code) = 8 THEN
    SELECT user_id INTO referrer_id
    FROM referral_codes
    WHERE code = referral_code AND is_active = true;
    
    IF referrer_id IS NOT NULL AND referrer_id != NEW.id THEN
      has_referral_code := true;
    END IF;
  END IF;

  -- Create profile with email and username
  INSERT INTO public.profiles (
    id, 
    user_id, 
    name, 
    email,
    username,
    credits, 
    points, 
    tutorial_completed, 
    tutorial_skipped
  )
  VALUES (
    gen_random_uuid(),
    NEW.id,
    user_name,
    NEW.email,
    user_username,
    0,
    0,
    false,
    false
  );

  -- Handle referral logic (same as before)
  IF has_referral_code THEN
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

-- Create RPC function to lookup user identity (username or email)
CREATE OR REPLACE FUNCTION public.lookup_login_identity(identifier text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_email text;
  user_exists boolean := false;
BEGIN
  -- Check if identifier is an email or username
  IF identifier LIKE '%@%' THEN
    -- It's an email
    SELECT email INTO user_email
    FROM profiles
    WHERE email = identifier;
  ELSE
    -- It's a username
    SELECT email INTO user_email
    FROM profiles
    WHERE LOWER(username) = LOWER(identifier);
  END IF;
  
  user_exists := user_email IS NOT NULL;
  
  RETURN jsonb_build_object(
    'exists', user_exists,
    'email', CASE WHEN user_exists THEN user_email ELSE null END,
    'login_method', CASE 
      WHEN identifier LIKE '%@%' THEN 'email'
      ELSE 'username'
    END
  );
END;
$$;

-- Create RPC function to check username availability
CREATE OR REPLACE FUNCTION public.check_username_available(username_input text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if username is available (case-insensitive)
  RETURN NOT EXISTS(
    SELECT 1 FROM profiles 
    WHERE LOWER(username) = LOWER(username_input)
  );
END;
$$;