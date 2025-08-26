-- Fix new critical device_sessions security issue and function security

-- 1. Fix device_sessions table - make it more restrictive while still allowing system operations
DROP POLICY IF EXISTS "Device sessions can be viewed by system" ON public.device_sessions;
DROP POLICY IF EXISTS "Device sessions can be created" ON public.device_sessions;
DROP POLICY IF EXISTS "Device sessions can be updated by system" ON public.device_sessions;

-- Create more restrictive policies for device_sessions
-- Only allow authenticated service-level operations (no direct user access)
CREATE POLICY "Service role can manage device sessions" 
ON public.device_sessions 
FOR ALL 
USING (false) -- Block all user access
WITH CHECK (false); -- Block all user inserts

-- 2. Fix all functions to have proper search_path (security requirement)
-- Update functions that don't have SET search_path

-- Fix has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;

-- Fix is_current_user_admin function  
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT public.has_role(auth.uid(), 'admin')
$function$;

-- Fix log_admin_action function
CREATE OR REPLACE FUNCTION public.log_admin_action(p_action text, p_target_table text, p_target_id uuid DEFAULT NULL::uuid, p_details jsonb DEFAULT NULL::jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Only log if current user is admin
  IF is_current_user_admin() THEN
    INSERT INTO admin_audit_log (
      admin_user_id,
      action,
      target_table,
      target_id,
      details
    ) VALUES (
      auth.uid(),
      p_action,
      p_target_table,
      p_target_id,
      p_details
    );
  END IF;
END;
$function$;

-- Fix assign_user_role function
CREATE OR REPLACE FUNCTION public.assign_user_role(p_user_id uuid, p_role app_role)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  role_assigned BOOLEAN := FALSE;
BEGIN
  -- Only admins can assign roles
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can assign roles';
  END IF;
  
  -- Check if role already exists
  IF EXISTS (SELECT 1 FROM user_roles WHERE user_id = p_user_id AND role = p_role) THEN
    RETURN FALSE;
  END IF;
  
  -- Insert new role
  INSERT INTO user_roles (user_id, role)
  VALUES (p_user_id, p_role);
  
  GET DIAGNOSTICS role_assigned = ROW_COUNT;
  
  -- Log the action
  IF role_assigned THEN
    PERFORM log_admin_action(
      'ROLE_ASSIGNED',
      'user_roles',
      p_user_id,
      jsonb_build_object('role', p_role)
    );
  END IF;
  
  RETURN role_assigned;
END;
$function$;