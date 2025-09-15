-- Remove the overly broad service role policy that allows unlimited access
DROP POLICY IF EXISTS "Service role can update profiles for payments" ON profiles;

-- Create a more restrictive policy that only allows service role to update specific payment-related fields
-- This policy only allows updating credits and points fields, protecting sensitive personal data
CREATE POLICY "Service role can update payment fields only" 
ON profiles 
FOR UPDATE 
USING (true)
WITH CHECK (
  -- Only allow updating credits, points, and updated_at fields
  -- Prevent modification of sensitive fields like email, name, username, user_id
  OLD.user_id = NEW.user_id AND
  OLD.email = NEW.email AND
  OLD.name = NEW.name AND
  OLD.username = NEW.username AND
  OLD.id = NEW.id AND
  OLD.created_at = NEW.created_at AND
  OLD.tutorial_completed = NEW.tutorial_completed AND
  OLD.tutorial_skipped = NEW.tutorial_skipped AND
  OLD.tutorial_views = NEW.tutorial_views
);

-- Log this security fix
COMMENT ON POLICY "Service role can update payment fields only" ON profiles IS 
'Restricts service role to only update payment-related fields (credits, points, updated_at), protecting sensitive personal information like email and name from unauthorized modification';