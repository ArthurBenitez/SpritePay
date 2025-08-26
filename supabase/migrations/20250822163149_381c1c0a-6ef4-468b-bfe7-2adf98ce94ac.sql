-- Fix referral system: Move referral processing from withdrawal creation to approval

-- Update the withdrawal approval function to include referral processing
CREATE OR REPLACE FUNCTION public.approve_withdrawal_secure(withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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

  -- Process referral rewards AFTER approval
  BEGIN
    -- First withdrawal milestone
    PERFORM process_referral_reward(
      withdrawal_record.user_id,
      'first_withdrawal', 
      withdrawal_record.amount
    );

    -- Amount-based milestones
    IF withdrawal_record.amount >= 50 THEN
      PERFORM process_referral_reward(
        withdrawal_record.user_id,
        'withdrawal_50',
        withdrawal_record.amount
      );
    END IF;

    IF withdrawal_record.amount >= 250 THEN
      PERFORM process_referral_reward(
        withdrawal_record.user_id,
        'withdrawal_250',
        withdrawal_record.amount
      );
    END IF;

    IF withdrawal_record.amount >= 500 THEN
      PERFORM process_referral_reward(
        withdrawal_record.user_id,
        'withdrawal_500',
        withdrawal_record.amount
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Log referral processing errors but don't block withdrawal approval
    PERFORM log_admin_action(
      'REFERRAL_PROCESSING_ERROR',
      'referral_rewards',
      NULL,
      jsonb_build_object(
        'withdrawal_id', withdrawal_id,
        'user_id', withdrawal_record.user_id,
        'error', SQLERRM
      )
    );
  END;
END;
$$;

-- Also update the non-secure version for consistency
CREATE OR REPLACE FUNCTION public.approve_withdrawal(withdrawal_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
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
    'Sua solicitação de saque de R$ ' || withdrawal_record.amount::text || ' foi aprovada! O pagamento será processado em breve.',
    'success'
  );

  -- Process referral rewards AFTER approval
  BEGIN
    -- First withdrawal milestone
    PERFORM process_referral_reward(
      withdrawal_record.user_id,
      'first_withdrawal', 
      withdrawal_record.amount
    );

    -- Amount-based milestones
    IF withdrawal_record.amount >= 50 THEN
      PERFORM process_referral_reward(
        withdrawal_record.user_id,
        'withdrawal_50',
        withdrawal_record.amount
      );
    END IF;

    IF withdrawal_record.amount >= 250 THEN
      PERFORM process_referral_reward(
        withdrawal_record.user_id,
        'withdrawal_250',
        withdrawal_record.amount
      );
    END IF;

    IF withdrawal_record.amount >= 500 THEN
      PERFORM process_referral_reward(
        withdrawal_record.user_id,
        'withdrawal_500',
        withdrawal_record.amount
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- Silently handle referral processing errors to not block withdrawal approval
    NULL;
  END;
END;
$$;