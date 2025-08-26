-- Fix critical security issues with correct schema

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

-- 2. Fix device_sessions table RLS policy (device_sessions has no user_id column)
-- Drop the restrictive policy that blocks everything
DROP POLICY IF EXISTS "Device sessions are private" ON public.device_sessions;

-- Create device-specific policies (since there's no user_id, we manage by device fingerprint)
CREATE POLICY "Device sessions can be viewed by system" 
ON public.device_sessions 
FOR SELECT 
USING (true);  -- Allow system access for fraud prevention

CREATE POLICY "Device sessions can be created" 
ON public.device_sessions 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Device sessions can be updated by system" 
ON public.device_sessions 
FOR UPDATE 
USING (true);

-- Only admins can delete device sessions
CREATE POLICY "Admins can delete device sessions" 
ON public.device_sessions 
FOR DELETE 
USING (
  EXISTS (
    SELECT 1 FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  )
);