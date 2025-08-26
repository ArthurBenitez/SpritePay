
-- Atualiza a função que cria o perfil no primeiro login,
-- concedendo 4 créditos apenas se o metadata NÃO sinalizar que o dispositivo já recebeu o bônus.

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  initial_credits integer;
  claimed_flag text;
BEGIN
  -- Lê o flag do metadata do signup. Se vier "true", não concede créditos.
  claimed_flag := COALESCE(NEW.raw_user_meta_data ->> 'claimed_free_credits', 'false');

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

  RETURN NEW;
END;
$function$;
