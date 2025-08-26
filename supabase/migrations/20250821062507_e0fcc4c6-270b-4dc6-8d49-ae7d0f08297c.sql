-- Fix critical security issues identified in the security scan

-- 1. Fix the withdraw_requests table RLS policies (CRITICAL ISSUE)
-- Remove existing policies and create secure ones
DROP POLICY IF EXISTS "Users can view their own withdraw requests" ON public.withdraw_requests;
DROP POLICY IF EXISTS "Users can create their own withdraw requests" ON public.withdraw_requests;
DROP POLICY IF EXISTS "Users can update their own withdraw requests" ON public.withdraw_requests;
DROP POLICY IF EXISTS "Admins can view all withdraw requests" ON public.withdraw_requests;
DROP POLICY IF EXISTS "Admins can update all withdraw requests" ON public.withdraw_requests;

-- Create secure RLS policies for withdraw_requests
CREATE POLICY "Users can view only their own withdraw requests" 
ON public.withdraw_requests 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own withdraw requests" 
ON public.withdraw_requests 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update only their pending requests" 
ON public.withdraw_requests 
FOR UPDATE 
USING (auth.uid() = user_id AND status = 'pending');

CREATE POLICY "Admins can view all withdraw requests" 
ON public.withdraw_requests 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

CREATE POLICY "Admins can update all withdraw requests" 
ON public.withdraw_requests 
FOR UPDATE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- 2. Fix device_sessions table RLS policy (currently blocks all access)
DROP POLICY IF EXISTS "Device sessions are private" ON public.device_sessions;

-- Create proper device_sessions policies
CREATE POLICY "Users can view their own device sessions" 
ON public.device_sessions 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own device sessions" 
ON public.device_sessions 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own device sessions" 
ON public.device_sessions 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Admins can view all device sessions for security monitoring
CREATE POLICY "Admins can view all device sessions" 
ON public.device_sessions 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);

-- 3. Fix function security by setting search_path on existing functions
-- Update the update_credits_after_payment function to be secure
CREATE OR REPLACE FUNCTION public.update_credits_after_payment(
  p_user_id UUID,
  p_credits INTEGER,
  p_description TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  user_exists BOOLEAN;
BEGIN
  -- Check if user exists
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE user_id = p_user_id
  ) INTO user_exists;
  
  IF NOT user_exists THEN
    RETURN FALSE;
  END IF;
  
  -- Update user credits
  UPDATE public.profiles 
  SET credits = credits + p_credits 
  WHERE user_id = p_user_id;
  
  -- Insert transaction record
  INSERT INTO public.transaction_history (
    user_id, 
    amount, 
    type, 
    description, 
    created_at
  ) VALUES (
    p_user_id, 
    p_credits, 
    'credit_purchase', 
    p_description, 
    NOW()
  );
  
  RETURN TRUE;
END;
$$;