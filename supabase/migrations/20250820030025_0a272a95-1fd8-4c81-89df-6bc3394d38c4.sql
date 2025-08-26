-- Add tutorial_completed flag to profiles table
ALTER TABLE public.profiles 
ADD COLUMN tutorial_completed boolean DEFAULT false;

-- Update the trigger to give 4 initial credits for tutorial
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY definer SET search_path = public 
AS $$
BEGIN
  INSERT INTO public.profiles (id, user_id, name, credits, points, tutorial_completed)
  VALUES (
    gen_random_uuid(), 
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data ->> 'name', ''), 
    4, -- 4 initial credits for tutorial
    0, 
    false
  );
  RETURN NEW;
END;
$$;