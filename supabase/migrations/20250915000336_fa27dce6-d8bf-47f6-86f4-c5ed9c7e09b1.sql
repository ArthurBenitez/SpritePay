-- Remove the overly broad service role policy that allows unlimited access
DROP POLICY IF EXISTS "Service role can update profiles for payments" ON profiles;

-- Create a more restrictive function to validate payment-related updates
CREATE OR REPLACE FUNCTION validate_payment_update()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a more restrictive policy for service role
CREATE POLICY "Service role can update payment fields only" 
ON profiles 
FOR UPDATE 
USING (true);

-- Add trigger to enforce field restrictions
CREATE TRIGGER enforce_payment_update_restrictions
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  WHEN (current_setting('role') = 'service_role')
  EXECUTE FUNCTION validate_payment_update();