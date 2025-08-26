-- Fix remaining functions without proper search_path

-- Fix remaining functions that need search_path set
CREATE OR REPLACE FUNCTION public.store_encrypted_pix_key(p_withdraw_request_id uuid, p_pix_key text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  encrypted_id UUID;
BEGIN
  -- For now, we'll store a hash of the PIX key for security
  -- In production, this should use Supabase vault extension
  INSERT INTO encrypted_pix_data (withdraw_request_id, encrypted_pix_key)
  VALUES (p_withdraw_request_id, encode(digest(p_pix_key, 'sha256'), 'hex'))
  RETURNING id INTO encrypted_id;
  
  RETURN encrypted_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal_and_return_points(withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal(withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  
  -- Create notification for user (fixed format)
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    withdrawal_record.user_id,
    'Sua solicitação de saque de R$ ' || withdrawal_record.amount::text || ' foi aprovada! O pagamento será processado em breve.',
    'success'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.approve_withdrawal_secure(withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  withdrawal_record withdraw_requests%ROWTYPE;
BEGIN
  -- Only admins can approve withdrawals
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can approve withdrawals';
  END IF;
  
  -- Get withdrawal details
  SELECT * INTO withdrawal_record
  FROM withdraw_requests
  WHERE id = withdrawal_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;
  
  -- Update withdrawal status
  UPDATE withdraw_requests
  SET status = 'approved', processed_at = now()
  WHERE id = withdrawal_id;
  
  -- Log admin action
  PERFORM log_admin_action(
    'WITHDRAWAL_APPROVED',
    'withdraw_requests',
    withdrawal_id,
    jsonb_build_object(
      'amount', withdrawal_record.amount,
      'points', withdrawal_record.points,
      'user_id', withdrawal_record.user_id
    )
  );
  
  -- Create notification for user
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    withdrawal_record.user_id,
    'Sua solicitação de saque de R$ ' || withdrawal_record.amount::text || ' foi aprovada! O pagamento será processado em breve.',
    'success'
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.reject_withdrawal_secure(withdrawal_id uuid, rejection_reason text DEFAULT NULL::text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  withdrawal_record withdraw_requests%ROWTYPE;
BEGIN
  -- Only admins can reject withdrawals
  IF NOT is_current_user_admin() THEN
    RAISE EXCEPTION 'Unauthorized: Only admins can reject withdrawals';
  END IF;
  
  -- Get withdrawal details
  SELECT * INTO withdrawal_record
  FROM withdraw_requests
  WHERE id = withdrawal_id AND status = 'pending';
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Withdrawal request not found or already processed';
  END IF;
  
  -- Update withdrawal status
  UPDATE withdraw_requests
  SET status = 'rejected', processed_at = now()
  WHERE id = withdrawal_id;
  
  -- Return points to user
  UPDATE profiles
  SET points = points + withdrawal_record.points
  WHERE user_id = withdrawal_record.user_id;
  
  -- Log admin action
  PERFORM log_admin_action(
    'WITHDRAWAL_REJECTED',
    'withdraw_requests',
    withdrawal_id,
    jsonb_build_object(
      'amount', withdrawal_record.amount,
      'points', withdrawal_record.points,
      'user_id', withdrawal_record.user_id,
      'reason', rejection_reason
    )
  );
  
  -- Create notification for user
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    withdrawal_record.user_id,
    CASE 
      WHEN rejection_reason IS NOT NULL THEN
        'Sua solicitação de saque foi rejeitada. Motivo: ' || rejection_reason || '. Os pontos foram devolvidos à sua conta.'
      ELSE
        'Sua solicitação de saque foi rejeitada. Os pontos foram devolvidos à sua conta.'
    END,
    'error'
  );
END;
$function$;