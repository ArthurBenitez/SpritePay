-- PHASE 1: Fix RPC functions - Remove FORMAT() usage that's causing errors
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

-- PHASE 2: Create atomic sprite purchase function with proper lottery logic
CREATE OR REPLACE FUNCTION public.purchase_sprite_with_lottery(
  p_sprite_id uuid,
  p_buyer_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sprite_record sprites%ROWTYPE;
  buyer_profile profiles%ROWTYPE;
  existing_owners uuid[];
  final_owner_id uuid;
  lottery_participants uuid[];
  random_index integer;
  points_earned integer;
  notification_msg text;
  result jsonb;
BEGIN
  -- Get sprite details
  SELECT * INTO sprite_record
  FROM sprites
  WHERE id = p_sprite_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sprite not found');
  END IF;
  
  -- Get buyer profile
  SELECT * INTO buyer_profile
  FROM profiles
  WHERE user_id = p_buyer_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;
  
  -- Check if user has enough credits
  IF buyer_profile.credits < sprite_record.price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits');
  END IF;
  
  -- Get existing owners of this sprite
  SELECT array_agg(user_id) INTO existing_owners
  FROM user_sprites
  WHERE sprite_id = p_sprite_id;
  
  -- Calculate points earned (buyer always gets points regardless of lottery outcome)
  points_earned := sprite_record.price;
  
  -- Determine final owner through lottery
  IF existing_owners IS NOT NULL AND array_length(existing_owners, 1) > 0 THEN
    -- Add buyer to lottery participants
    lottery_participants := existing_owners || p_buyer_user_id;
    
    -- Random selection
    random_index := floor(random() * array_length(lottery_participants, 1)) + 1;
    final_owner_id := lottery_participants[random_index];
    
    -- Remove sprite from all current owners
    DELETE FROM user_sprites WHERE sprite_id = p_sprite_id;
    
    -- Give compensation points to users who lost the sprite (except the final owner)
    FOR i IN 1..array_length(existing_owners, 1) LOOP
      IF existing_owners[i] != final_owner_id THEN
        -- Give compensation points
        UPDATE profiles 
        SET points = points + sprite_record.price
        WHERE user_id = existing_owners[i];
        
        -- Notify about losing sprite but getting compensation
        INSERT INTO notifications (user_id, message, type)
        VALUES (
          existing_owners[i],
          'Você perdeu o sprite ' || sprite_record.name || ' em um sorteio, mas recebeu ' || sprite_record.price || ' pontos de compensação! 💰',
          'warning'
        );
      END IF;
    END LOOP;
  ELSE
    -- No existing owners, buyer gets the sprite
    final_owner_id := p_buyer_user_id;
  END IF;
  
  -- Add sprite to final owner
  INSERT INTO user_sprites (user_id, sprite_id)
  VALUES (final_owner_id, p_sprite_id);
  
  -- Update buyer's credits and points
  UPDATE profiles
  SET 
    credits = credits - sprite_record.price,
    points = points + points_earned
  WHERE user_id = p_buyer_user_id;
  
  -- Add transaction record
  INSERT INTO transaction_history (user_id, type, amount, description)
  VALUES (
    p_buyer_user_id,
    'sprite_purchase',
    -sprite_record.price,
    'Compra do sprite ' || sprite_record.name
  );
  
  -- Create appropriate notifications
  IF final_owner_id = p_buyer_user_id THEN
    notification_msg := 'Sprite ' || sprite_record.name || ' comprado! +' || points_earned || ' pontos! 🎮';
    IF existing_owners IS NOT NULL AND array_length(existing_owners, 1) > 0 THEN
      notification_msg := notification_msg || ' Você ganhou no sorteio! 🎉';
    END IF;
    
    INSERT INTO notifications (user_id, message, type)
    VALUES (p_buyer_user_id, notification_msg, 'success');
  ELSE
    -- Buyer lost the lottery but still gets points
    INSERT INTO notifications (user_id, message, type)
    VALUES (
      p_buyer_user_id,
      'Sprite ' || sprite_record.name || ' comprado! +' || points_earned || ' pontos! Infelizmente você perdeu no sorteio! 😔',
      'warning'
    );
    
    -- Notify the winner
    INSERT INTO notifications (user_id, message, type)
    VALUES (
      final_owner_id,
      'Você ganhou ' || sprite_record.name || ' em um sorteio! 🎉',
      'success'
    );
  END IF;
  
  -- Return result
  result := jsonb_build_object(
    'success', true,
    'final_owner_id', final_owner_id,
    'won_lottery', final_owner_id = p_buyer_user_id,
    'points_earned', points_earned,
    'sprite_name', sprite_record.name
  );
  
  RETURN result;
  
EXCEPTION WHEN OTHERS THEN
  -- Return error if anything goes wrong
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;

-- Fix notifications type constraint - allow more notification types
ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE notifications ADD CONSTRAINT notifications_type_check 
CHECK (type IN ('success', 'error', 'warning', 'info'));