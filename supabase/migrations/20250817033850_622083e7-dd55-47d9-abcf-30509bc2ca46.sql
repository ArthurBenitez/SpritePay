-- Fix linter: set search_path for existing functions
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  INSERT INTO public.profiles (user_id, name, credits, points)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', 'User'), 10, 0);
  
  INSERT INTO public.notifications (user_id, message, type)
  VALUES (NEW.id, 'Bem-vindo ao SpritePay! Você ganhou 10 créditos de bônus! 🎁', 'success');
  
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;