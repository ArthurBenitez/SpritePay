-- Atualiza a função para que o comprador NUNCA perca no ato da própria compra
-- e o sorteio afete apenas donos anteriores (quando outro usuário investe).

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
  -- donos antes da compra atual
  previous_owners uuid[];
  -- lista de donos anteriores excluindo o comprador (se ele já fosse dono)
  lottery_pool uuid[];
  survivor_previous_owner uuid;
  random_index integer;
  points_earned integer;
  buyer_already_owns boolean := false;
  lottery_triggered boolean := false;
  i integer;
BEGIN
  -- Detalhes do sprite
  SELECT * INTO sprite_record
  FROM sprites
  WHERE id = p_sprite_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Sprite not found');
  END IF;

  -- Perfil do comprador
  SELECT * INTO buyer_profile
  FROM profiles
  WHERE user_id = p_buyer_user_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'User profile not found');
  END IF;

  -- Checar créditos
  IF buyer_profile.credits < sprite_record.price THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient credits');
  END IF;

  -- Capturar donos antes da compra
  SELECT array_agg(user_id) INTO previous_owners
  FROM user_sprites
  WHERE sprite_id = p_sprite_id;

  -- O comprador já era dono?
  SELECT EXISTS(
    SELECT 1 FROM user_sprites
    WHERE sprite_id = p_sprite_id AND user_id = p_buyer_user_id
  ) INTO buyer_already_owns;

  -- Pontos por compra (sempre ganha)
  points_earned := sprite_record.points;

  -- Debitar créditos e creditar pontos do comprador
  UPDATE profiles
  SET 
    credits = credits - sprite_record.price,
    points = points + points_earned,
    updated_at = now()
  WHERE user_id = p_buyer_user_id;

  -- Registrar a transação de compra
  INSERT INTO transaction_history (user_id, type, amount, description)
  VALUES (
    p_buyer_user_id,
    'sprite_purchase',
    -sprite_record.price,
    'Compra do sprite ' || sprite_record.name
  );

  -- Garantir que o comprador possui o sprite (se ainda não possuía)
  IF NOT buyer_already_owns THEN
    INSERT INTO user_sprites (user_id, sprite_id)
    VALUES (p_buyer_user_id, p_sprite_id);
  END IF;

  -- Notificação de compra bem-sucedida (sem perder no ato da compra)
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    p_buyer_user_id,
    'Sprite ' || sprite_record.name || ' comprado! +' || points_earned || ' pontos! 🎮',
    'success'
  );

  -- Caso existissem donos antes da compra, executa o sorteio APENAS entre esses donos,
  -- excluindo o comprador para garantir que ele não perca na própria compra.
  IF previous_owners IS NOT NULL AND array_length(previous_owners, 1) > 0 THEN
    -- Montar pool de sorteio removendo o comprador (se ele já fosse dono antes)
    lottery_pool := ARRAY(
      SELECT unnest(previous_owners)
      EXCEPT SELECT p_buyer_user_id
    );

    IF lottery_pool IS NOT NULL AND array_length(lottery_pool, 1) > 0 THEN
      lottery_triggered := true;

      -- Escolhe aleatoriamente 1 sobrevivente entre os donos anteriores
      random_index := floor(random() * array_length(lottery_pool, 1))::int + 1;
      survivor_previous_owner := lottery_pool[random_index];

      -- Todos os demais donos anteriores (exceto o sobrevivente) perdem o sprite e ganham compensação
      FOR i IN 1..array_length(lottery_pool, 1) LOOP
        IF lottery_pool[i] <> survivor_previous_owner THEN
          -- Remover posse
          DELETE FROM user_sprites 
          WHERE sprite_id = p_sprite_id AND user_id = lottery_pool[i];

          -- Compensação em pontos baseada no preço
          UPDATE profiles 
          SET points = points + sprite_record.price,
              updated_at = now()
          WHERE user_id = lottery_pool[i];

          -- Notificação animada para quem perdeu
          INSERT INTO notifications (user_id, message, type)
          VALUES (
            lottery_pool[i],
            'Seu sprite ' || sprite_record.name || ' foi convertido para ' || sprite_record.price || ' pontos! Você pode trocar esses pontos por dinheiro real 💸',
            'warning'
          );
        END IF;
      END LOOP;
    END IF;
  END IF;

  -- Retorno: comprador sempre "won_lottery" na compra (não perde no ato)
  RETURN jsonb_build_object(
    'success', true,
    'won_lottery', true,
    'lottery_triggered', lottery_triggered,
    'points_earned', points_earned,
    'sprite_name', sprite_record.name
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$function$;