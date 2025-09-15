-- Fix security warning: Add search_path to the new function
CREATE OR REPLACE FUNCTION validate_payment_update()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only allow updating credits, points, and updated_at fields
  -- Prevent modification of sensitive fields like email, name, username, user_id
  IF OLD.user_id != NEW.user_id OR
     OLD.email != NEW.email OR
     OLD.name != NEW.name OR
     (OLD.username IS DISTINCT FROM NEW.username) OR
     OLD.id != NEW.id OR
     OLD.created_at != NEW.created_at OR
     OLD.tutorial_completed != NEW.tutorial_completed OR
     OLD.tutorial_skipped != NEW.tutorial_skipped OR
     OLD.tutorial_views != NEW.tutorial_views THEN
    RAISE EXCEPTION 'Service role can only update payment-related fields (credits, points, updated_at)';
  END IF;
  
  RETURN NEW;
END;
$$;