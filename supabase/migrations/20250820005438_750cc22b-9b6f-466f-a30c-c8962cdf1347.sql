-- Create a secure function to update user credits after payment verification
CREATE OR REPLACE FUNCTION public.update_credits_after_payment(
  p_user_id UUID,
  p_credits INTEGER,
  p_description TEXT DEFAULT 'Compra de créditos via Stripe'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  credits_updated BOOLEAN := FALSE;
BEGIN
  -- Update user credits
  UPDATE profiles 
  SET credits = credits + p_credits,
      updated_at = now()
  WHERE user_id = p_user_id;
  
  GET DIAGNOSTICS credits_updated = ROW_COUNT;
  
  IF credits_updated THEN
    -- Add transaction record
    INSERT INTO transaction_history (user_id, type, amount, description)
    VALUES (p_user_id, 'credit_purchase', p_credits, p_description);
    
    -- Send notification
    INSERT INTO notifications (user_id, message, type)
    VALUES (
      p_user_id,
      'Compra realizada com sucesso! ' || p_credits || ' créditos adicionados à sua conta! 💳',
      'success'
    );
  END IF;
  
  RETURN credits_updated;
END;
$$;

-- Create RLS policies to allow service role operations for payment verification
CREATE POLICY "Service role can update profiles for payments" 
ON public.profiles 
FOR UPDATE 
USING (true);

CREATE POLICY "Service role can insert transaction history" 
ON public.transaction_history 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Service role can insert notifications" 
ON public.notifications 
FOR INSERT 
WITH CHECK (true);