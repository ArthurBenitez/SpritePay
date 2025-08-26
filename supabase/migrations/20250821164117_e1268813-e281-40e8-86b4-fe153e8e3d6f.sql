-- Strengthen security on withdraw_requests without changing app behavior
-- 1) Ensure RLS is enabled (harmless if already enabled)
ALTER TABLE public.withdraw_requests ENABLE ROW LEVEL SECURITY;

-- 2) Guard updates so only admins can modify sensitive fields; users can only edit pix_key while pending
CREATE OR REPLACE FUNCTION public.enforce_withdraw_update_restrictions()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow admins full control
  IF is_current_user_admin() THEN
    RETURN NEW;
  END IF;

  -- Non-admins (regular users) may only modify their own PENDING requests (RLS already limits row access)
  IF OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'Only pending withdrawal requests can be modified by users';
  END IF;

  -- Lock sensitive fields for non-admins (preserve original values)
  NEW.user_id := OLD.user_id;
  NEW.amount := OLD.amount;
  NEW.points := OLD.points;
  NEW.status := OLD.status;
  NEW.processed_at := OLD.processed_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_withdraw_update_restrictions ON public.withdraw_requests;
CREATE TRIGGER trg_enforce_withdraw_update_restrictions
BEFORE UPDATE ON public.withdraw_requests
FOR EACH ROW
EXECUTE FUNCTION public.enforce_withdraw_update_restrictions();

-- 3) Sanitize PIX key server-side on INSERT/UPDATE to reduce risk of malicious content and normalize format
CREATE OR REPLACE FUNCTION public.sanitize_withdraw_pix_key()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Normalize: trim, remove spaces/newlines, cap length to 140 chars to avoid abuse
  IF NEW.pix_key IS NOT NULL THEN
    NEW.pix_key := regexp_replace(NEW.pix_key, '[\s\r\n]+', '', 'g');
    NEW.pix_key := btrim(NEW.pix_key);
    IF length(NEW.pix_key) > 140 THEN
      NEW.pix_key := substring(NEW.pix_key FROM 1 FOR 140);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sanitize_withdraw_pix_key ON public.withdraw_requests;
CREATE TRIGGER trg_sanitize_withdraw_pix_key
BEFORE INSERT OR UPDATE ON public.withdraw_requests
FOR EACH ROW
EXECUTE FUNCTION public.sanitize_withdraw_pix_key();

-- Note: Existing RLS already restricts SELECT to owners and admins, INSERT to owners, and UPDATE to owners while pending + admins.
-- These triggers add server-side protections against tampering and ensure consistent PIX key handling without changing client code.