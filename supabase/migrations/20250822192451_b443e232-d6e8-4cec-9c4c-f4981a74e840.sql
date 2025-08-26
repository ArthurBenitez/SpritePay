-- Fix function search path issues by updating functions without explicit search_path
-- This fixes the WARN: Function Search Path Mutable warning

-- Update track_referral_signup function
CREATE OR REPLACE FUNCTION public.track_referral_signup()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- If user has referral_code in metadata, we'll track it in the user's metadata
  -- The referral processing will happen when they make their first withdrawal
  RETURN NEW;
END;
$function$;