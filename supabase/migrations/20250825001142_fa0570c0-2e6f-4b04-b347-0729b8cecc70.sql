-- Criar tabela para progresso de anúncios dos usuários
CREATE TABLE public.ad_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  views_today INTEGER NOT NULL DEFAULT 0,
  total_credits_earned INTEGER NOT NULL DEFAULT 0,
  last_view_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Criar tabela para estatísticas de anúncios e revenue
CREATE TABLE public.ad_statistics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placement_id TEXT,
  ad_impressions INTEGER NOT NULL DEFAULT 0,
  ad_clicks INTEGER NOT NULL DEFAULT 0,
  revenue_earned DECIMAL(10,4) NOT NULL DEFAULT 0,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, placement_id, date)
);

-- Habilitar RLS nas tabelas
ALTER TABLE public.ad_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_statistics ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para ad_progress
CREATE POLICY "Users can view their own ad progress" 
ON public.ad_progress 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own ad progress" 
ON public.ad_progress 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own ad progress" 
ON public.ad_progress 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage ad progress" 
ON public.ad_progress 
FOR ALL 
USING (true);

-- Políticas RLS para ad_statistics
CREATE POLICY "Users can view their own ad statistics" 
ON public.ad_statistics 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "System can manage ad statistics" 
ON public.ad_statistics 
FOR ALL 
USING (true);

-- Função para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar updated_at
CREATE TRIGGER update_ad_progress_updated_at
BEFORE UPDATE ON public.ad_progress
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ad_statistics_updated_at
BEFORE UPDATE ON public.ad_statistics
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Função para processar view de anúncio e ganhar créditos
CREATE OR REPLACE FUNCTION public.process_ad_view(p_user_id UUID, p_placement_id TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_progress RECORD;
  credits_to_earn INTEGER := 1;
  views_for_credit INTEGER := 3;
  new_credits INTEGER := 0;
BEGIN
  -- Buscar ou criar progresso do usuário para hoje
  INSERT INTO ad_progress (user_id, views_today, total_credits_earned, last_view_date)
  VALUES (p_user_id, 0, 0, CURRENT_DATE)
  ON CONFLICT (user_id) 
  DO UPDATE SET 
    last_view_date = CASE 
      WHEN ad_progress.last_view_date < CURRENT_DATE THEN CURRENT_DATE
      ELSE ad_progress.last_view_date
    END,
    views_today = CASE 
      WHEN ad_progress.last_view_date < CURRENT_DATE THEN 0
      ELSE ad_progress.views_today
    END;

  -- Buscar progresso atual
  SELECT * INTO current_progress
  FROM ad_progress
  WHERE user_id = p_user_id;

  -- Incrementar views
  UPDATE ad_progress
  SET views_today = views_today + 1,
      updated_at = now()
  WHERE user_id = p_user_id;

  -- Verificar se deve ganhar créditos
  IF (current_progress.views_today + 1) % views_for_credit = 0 THEN
    new_credits := credits_to_earn;
    
    -- Atualizar créditos do usuário
    UPDATE profiles
    SET credits = credits + new_credits,
        updated_at = now()
    WHERE user_id = p_user_id;
    
    -- Atualizar total de créditos ganhos com anúncios
    UPDATE ad_progress
    SET total_credits_earned = total_credits_earned + new_credits
    WHERE user_id = p_user_id;
    
    -- Registrar transação
    INSERT INTO transaction_history (user_id, type, amount, description)
    VALUES (p_user_id, 'ad_view_credits', new_credits, 'Créditos ganhos assistindo anúncios');
    
    -- Notificação
    INSERT INTO notifications (user_id, message, type)
    VALUES (
      p_user_id,
      'Parabéns! Você ganhou ' || new_credits || ' crédito(s) assistindo anúncios! 🎬',
      'success'
    );
  END IF;

  -- Registrar estatísticas
  INSERT INTO ad_statistics (user_id, placement_id, ad_impressions)
  VALUES (p_user_id, p_placement_id, 1)
  ON CONFLICT (user_id, placement_id, date)
  DO UPDATE SET 
    ad_impressions = ad_statistics.ad_impressions + 1,
    updated_at = now();

  RETURN jsonb_build_object(
    'success', true,
    'views_today', current_progress.views_today + 1,
    'credits_earned', new_credits,
    'next_credit_in', views_for_credit - ((current_progress.views_today + 1) % views_for_credit)
  );
END;
$$;

-- Adicionar índices para performance
CREATE INDEX idx_ad_progress_user_date ON ad_progress(user_id, last_view_date);
CREATE INDEX idx_ad_statistics_user_date ON ad_statistics(user_id, date);
CREATE INDEX idx_ad_statistics_placement ON ad_statistics(placement_id, date);