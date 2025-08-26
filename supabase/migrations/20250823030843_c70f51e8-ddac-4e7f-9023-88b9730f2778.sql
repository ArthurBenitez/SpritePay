-- Implementação do sistema de segurança anti-abuso e privilégios de admin

-- Função aprimorada de validação de dispositivo com múltiplas camadas de segurança
CREATE OR REPLACE FUNCTION public.validate_device_ultra_secure(
  p_device_fingerprint text,
  p_ip_address inet,
  p_user_agent text DEFAULT NULL,
  p_localStorage_hash text DEFAULT NULL,
  p_browser_fingerprint text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  device_record device_sessions%ROWTYPE;
  can_claim BOOLEAN := FALSE;
  risk_score INTEGER := 0;
  validation_result JSONB;
  accounts_from_ip INTEGER := 0;
  recent_accounts INTEGER := 0;
  browser_pattern_count INTEGER := 0;
BEGIN
  -- Validação básica de entrada
  IF p_device_fingerprint IS NULL OR length(p_device_fingerprint) < 8 THEN
    RETURN jsonb_build_object(
      'valid', false,
      'can_claim_credits', false,
      'error', 'Device fingerprint inválido',
      'risk_score', 100
    );
  END IF;

  -- Inserir ou atualizar sessão do dispositivo
  INSERT INTO device_sessions (
    device_fingerprint,
    ip_address,
    user_agent,
    free_credits_claimed
  ) VALUES (
    p_device_fingerprint,
    p_ip_address,
    p_user_agent,
    FALSE
  )
  ON CONFLICT (device_fingerprint) 
  DO UPDATE SET 
    last_seen = now(),
    user_agent = COALESCE(EXCLUDED.user_agent, device_sessions.user_agent)
  RETURNING * INTO device_record;

  -- Verificar se já pode reivindicar créditos
  can_claim := NOT device_record.free_credits_claimed;

  -- ANÁLISE DE RISCO - Múltiplas verificações
  
  -- 1. Verificar múltiplas contas do mesmo IP nas últimas 24h
  SELECT COUNT(DISTINCT device_fingerprint) INTO accounts_from_ip
  FROM device_sessions
  WHERE ip_address = p_ip_address
  AND free_credits_claimed = TRUE
  AND created_at > now() - INTERVAL '24 hours';
  
  IF accounts_from_ip >= 3 THEN
    risk_score := risk_score + 40;
  ELSIF accounts_from_ip >= 2 THEN
    risk_score := risk_score + 25;
  END IF;

  -- 2. Verificar criação muito rápida de contas
  SELECT COUNT(*) INTO recent_accounts
  FROM device_sessions
  WHERE ip_address = p_ip_address
  AND created_at > now() - INTERVAL '1 hour';
  
  IF recent_accounts >= 5 THEN
    risk_score := risk_score + 35;
  ELSIF recent_accounts >= 3 THEN
    risk_score := risk_score + 20;
  END IF;

  -- 3. Análise de padrões suspeitos de user agent
  IF p_user_agent IS NOT NULL THEN
    -- Verificar user agents muito similares
    SELECT COUNT(*) INTO browser_pattern_count
    FROM device_sessions
    WHERE ip_address = p_ip_address
    AND user_agent = p_user_agent
    AND device_fingerprint != p_device_fingerprint
    AND created_at > now() - INTERVAL '7 days';
    
    IF browser_pattern_count >= 2 THEN
      risk_score := risk_score + 30;
    END IF;
    
    -- Detectar user agents suspeitos (headless browsers, bots)
    IF p_user_agent ~* '(headless|phantom|selenium|webdriver|bot|crawler)' THEN
      risk_score := risk_score + 50;
    END IF;
  END IF;

  -- 4. Verificar localStorage hash para detecção de múltiplas contas
  IF p_localStorage_hash IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM device_sessions
      WHERE ip_address = p_ip_address
      AND device_fingerprint != p_device_fingerprint
      AND free_credits_claimed = TRUE
      AND created_at > now() - INTERVAL '30 days'
    ) THEN
      risk_score := risk_score + 25;
    END IF;
  END IF;

  -- 5. Verificar fingerprint do navegador muito similar
  IF p_browser_fingerprint IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM device_sessions
      WHERE device_fingerprint != p_device_fingerprint
      AND user_agent = p_user_agent
      AND ip_address = p_ip_address
      AND created_at > now() - INTERVAL '7 days'
    ) THEN
      risk_score := risk_score + 20;
    END IF;
  END IF;

  -- Alto risco bloqueia créditos
  IF risk_score >= 50 THEN
    can_claim := FALSE;
    
    -- Log da tentativa suspeita
    INSERT INTO admin_audit_log (
      admin_user_id, action, target_table, details
    ) VALUES (
      NULL, 'SUSPICIOUS_CREDIT_ATTEMPT', 'device_sessions',
      jsonb_build_object(
        'device_fingerprint', p_device_fingerprint,
        'ip_address', p_ip_address,
        'risk_score', risk_score,
        'user_agent', p_user_agent,
        'accounts_from_ip', accounts_from_ip,
        'recent_accounts', recent_accounts
      )
    );
  END IF;

  validation_result := jsonb_build_object(
    'valid', true,
    'can_claim_credits', can_claim,
    'risk_score', risk_score,
    'device_id', device_record.id,
    'accounts_from_ip', accounts_from_ip,
    'recent_accounts', recent_accounts
  );

  RETURN validation_result;
END;
$$;

-- Função para verificar se usuário é admin por email
CREATE OR REPLACE FUNCTION public.is_admin_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_email text;
BEGIN
  -- Obter email do usuário
  SELECT email INTO user_email
  FROM auth.users
  WHERE id = p_user_id;
  
  -- Verificar se é admin por email ou por role
  RETURN (user_email = 'admin@imperium.com') OR is_current_user_admin();
END;
$$;

-- Função para compra de sprite modo admin (sem sorteio)
CREATE OR REPLACE FUNCTION public.purchase_sprite_admin_mode(
  p_sprite_id uuid,
  p_buyer_user_id uuid
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sprite_record sprites%ROWTYPE;
  buyer_profile profiles%ROWTYPE;
  points_earned integer;
  is_admin boolean := false;
BEGIN
  -- Verificar se é admin
  SELECT is_admin_user(p_buyer_user_id) INTO is_admin;
  
  IF NOT is_admin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: Admin only function');
  END IF;

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

  -- Admin tem créditos ilimitados, mas ainda ganha pontos
  points_earned := sprite_record.points;

  -- Creditar pontos do comprador (admin não perde créditos)
  UPDATE profiles
  SET 
    points = points + points_earned,
    updated_at = now()
  WHERE user_id = p_buyer_user_id;

  -- Registrar a transação de compra admin
  INSERT INTO transaction_history (user_id, type, amount, description)
  VALUES (
    p_buyer_user_id,
    'admin_sprite_purchase',
    0, -- Admin não paga créditos
    'Compra admin do sprite ' || sprite_record.name
  );

  -- Adicionar sprite ao inventário (permite múltiplos do mesmo sprite)
  INSERT INTO user_sprites (user_id, sprite_id)
  VALUES (p_buyer_user_id, p_sprite_id);

  -- Notificação de compra bem-sucedida
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    p_buyer_user_id,
    '👑 ADMIN: Sprite ' || sprite_record.name || ' adquirido! +' || points_earned || ' pontos! (Sem sorteio)',
    'success'
  );

  RETURN jsonb_build_object(
    'success', true,
    'admin_purchase', true,
    'no_lottery', true,
    'points_earned', points_earned,
    'sprite_name', sprite_record.name
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

-- Função para obter quantidades de sprites por usuário
CREATE OR REPLACE FUNCTION public.get_user_sprite_quantities(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sprite_quantities jsonb;
BEGIN
  -- Verificar autorização
  IF auth.uid() != p_user_id AND NOT is_admin_user(auth.uid()) THEN
    RETURN jsonb_build_object('error', 'Unauthorized');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'sprite_id', sprite_id,
      'sprite_name', s.name,
      'sprite_image', s.image,
      'sprite_rarity', s.rarity,
      'sprite_price', s.price,
      'sprite_points', s.points,
      'quantity', quantity,
      'last_acquired', last_acquired
    )
    ORDER BY s.rarity DESC, quantity DESC
  ) INTO sprite_quantities
  FROM (
    SELECT 
      us.sprite_id,
      COUNT(*) as quantity,
      MAX(us.acquired_at) as last_acquired
    FROM user_sprites us
    WHERE us.user_id = p_user_id
    GROUP BY us.sprite_id
  ) grouped
  JOIN sprites s ON s.id = grouped.sprite_id;

  RETURN COALESCE(sprite_quantities, '[]'::jsonb);
END;
$$;

-- Modificar função de validação segura de dispositivo para usar a nova função
CREATE OR REPLACE FUNCTION public.validate_device_securely(
  p_device_fingerprint text,
  p_ip_address inet,
  p_user_agent text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Usar a nova função ultra segura
  RETURN validate_device_ultra_secure(
    p_device_fingerprint,
    p_ip_address,
    p_user_agent,
    NULL,
    NULL
  );
END;
$$;

-- Função para claims seguros com verificação aprimorada
CREATE OR REPLACE FUNCTION public.claim_free_credits_ultra_secure(
  p_device_fingerprint text,
  p_ip_address inet,
  p_user_agent text DEFAULT NULL,
  p_localStorage_hash text DEFAULT NULL,
  p_browser_fingerprint text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  user_record profiles%ROWTYPE;
  validation_result JSONB;
  current_user_id UUID;
  credits_granted INTEGER := 4;
  is_admin boolean := false;
BEGIN
  current_user_id := auth.uid();
  
  -- Verificar autenticação
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;
  
  -- Verificar se é admin
  SELECT is_admin_user(current_user_id) INTO is_admin;
  
  -- Admin sempre pode obter créditos (para testes)
  IF is_admin THEN
    UPDATE profiles
    SET credits = credits + credits_granted
    WHERE user_id = current_user_id;
    
    INSERT INTO transaction_history (user_id, type, amount, description)
    VALUES (
      current_user_id,
      'admin_free_credits',
      credits_granted,
      'Créditos gratuitos admin'
    );
    
    RETURN jsonb_build_object(
      'success', true,
      'credits_granted', credits_granted,
      'admin_override', true,
      'risk_score', 0
    );
  END IF;
  
  -- Validar dispositivo com segurança aprimorada
  validation_result := validate_device_ultra_secure(
    p_device_fingerprint,
    p_ip_address,
    p_user_agent,
    p_localStorage_hash,
    p_browser_fingerprint
  );
  
  -- Verificar resultado da validação
  IF NOT (validation_result->>'valid')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', validation_result->>'error',
      'risk_score', validation_result->>'risk_score'
    );
  END IF;
  
  IF NOT (validation_result->>'can_claim_credits')::BOOLEAN THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Créditos gratuitos já foram reivindicados neste dispositivo ou detectada atividade suspeita',
      'risk_score', validation_result->>'risk_score'
    );
  END IF;
  
  -- Obter perfil do usuário
  SELECT * INTO user_record
  FROM profiles
  WHERE user_id = current_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'User profile not found'
    );
  END IF;
  
  -- Conceder créditos
  UPDATE profiles
  SET credits = credits + credits_granted
  WHERE user_id = current_user_id;
  
  -- Marcar dispositivo como usado
  UPDATE device_sessions
  SET free_credits_claimed = TRUE
  WHERE device_fingerprint = p_device_fingerprint;
  
  -- Log da transação
  INSERT INTO transaction_history (user_id, type, amount, description)
  VALUES (
    current_user_id,
    'free_credits_ultra_secure',
    credits_granted,
    'Créditos gratuitos ultra seguros concedidos'
  );
  
  -- Enviar notificação
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    current_user_id,
    'Créditos gratuitos concedidos com máxima segurança! +' || credits_granted || ' créditos! 🛡️',
    'success'
  );
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_granted', credits_granted,
    'risk_score', validation_result->>'risk_score'
  );
END;
$$;