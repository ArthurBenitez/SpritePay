-- Fix security issue: set proper search_path for all functions

-- Update handle_new_user function to fix security warning
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