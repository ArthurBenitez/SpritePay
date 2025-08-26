-- Create user roles system to replace hardcoded admin check
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

-- Create user_roles table
CREATE TABLE public.user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    role app_role NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Enable RLS
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create security definer function to check roles (prevents RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to check if current user is admin
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(auth.uid(), 'admin')
$$;

-- Create function to safely return points on withdrawal rejection
CREATE OR REPLACE FUNCTION public.reject_withdrawal_and_return_points(
  withdrawal_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  withdrawal_record withdraw_requests%ROWTYPE;
BEGIN
  -- Get withdrawal details
  SELECT * INTO withdrawal_record
  FROM withdraw_requests
  WHERE id = withdrawal_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;
  
  -- Update withdrawal status to rejected
  UPDATE withdraw_requests
  SET status = 'rejected', processed_at = now()
  WHERE id = withdrawal_id;
  
  -- Return points to user
  UPDATE profiles
  SET points = points + withdrawal_record.points
  WHERE user_id = withdrawal_record.user_id;
  
  -- Create notification for user
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    withdrawal_record.user_id,
    'Sua solicitação de saque foi rejeitada. Os pontos foram devolvidos à sua conta.',
    'error'
  );
END;
$$;

-- Create function to approve withdrawal
CREATE OR REPLACE FUNCTION public.approve_withdrawal(
  withdrawal_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  withdrawal_record withdraw_requests%ROWTYPE;
BEGIN
  -- Get withdrawal details
  SELECT * INTO withdrawal_record
  FROM withdraw_requests
  WHERE id = withdrawal_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;
  
  -- Update withdrawal status to approved
  UPDATE withdraw_requests
  SET status = 'approved', processed_at = now()
  WHERE id = withdrawal_id;
  
  -- Create notification for user
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    withdrawal_record.user_id,
    FORMAT('Sua solicitação de saque de R$ %.2f foi aprovada! O pagamento será processado em breve.', withdrawal_record.amount),
    'success'
  );
END;
$$;

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
ON public.user_roles
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
ON public.user_roles
FOR SELECT
USING (public.is_current_user_admin());

-- Enhanced RLS policies for withdraw_requests (admin access)
CREATE POLICY "Admins can view all withdraw requests"
ON public.withdraw_requests
FOR SELECT
USING (public.is_current_user_admin());

CREATE POLICY "Admins can update withdraw requests"
ON public.withdraw_requests
FOR UPDATE
USING (public.is_current_user_admin());

-- Enhanced notifications policies
CREATE POLICY "Admins can create any notifications"
ON public.notifications
FOR INSERT
WITH CHECK (public.is_current_user_admin());

-- Prevent direct modifications to transaction_history (read-only after creation)
CREATE POLICY "No updates allowed on transaction history"
ON public.transaction_history
FOR UPDATE
USING (false);

CREATE POLICY "No deletes allowed on transaction history"
ON public.transaction_history
FOR DELETE
USING (false);

-- Insert admin user (replace existing admin check)
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'admin@imperium.com'
ON CONFLICT (user_id, role) DO NOTHING;