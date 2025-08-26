-- Update handle_new_user function to properly set initial credits
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, user_id, name, credits, points, tutorial_completed, tutorial_skipped)
  VALUES (
    gen_random_uuid(), 
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''), 
    4, -- 4 initial credits for new users only
    0, 
    false,
    false
  );
  RETURN NEW;
END;
$function$;