-- Corrigir security warnings - atualizar funções com search_path seguro
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Corrigir função process_ad_view com search_path já definido (sem alteração)
-- A função já está correta com SET search_path TO 'public'