-- Create table for ad settings configuration
CREATE TABLE public.ad_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ads_per_credit integer NOT NULL DEFAULT 200,
  ad_credit_value numeric NOT NULL DEFAULT 0.5,
  max_daily_views integer NOT NULL DEFAULT 1000,
  cooldown_minutes integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Create table for tracking ad impressions and views
CREATE TABLE public.ad_impressions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  device_fingerprint text NOT NULL,
  ip_address inet NOT NULL,
  user_agent text,
  view_timestamp timestamp with time zone DEFAULT now(),
  credits_earned integer DEFAULT 0,
  is_valid boolean DEFAULT true
);

-- Enable RLS on both tables
ALTER TABLE public.ad_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ad_impressions ENABLE ROW LEVEL SECURITY;

-- RLS policies for ad_settings (only admins can modify, everyone can read active settings)
CREATE POLICY "Everyone can view active ad settings"
ON public.ad_settings
FOR SELECT
USING (is_active = true);

CREATE POLICY "Only admins can manage ad settings"
ON public.ad_settings
FOR ALL
USING (is_current_user_admin())
WITH CHECK (is_current_user_admin());

-- RLS policies for ad_impressions
CREATE POLICY "Users can view their own ad impressions"
ON public.ad_impressions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert ad impressions"
ON public.ad_impressions
FOR INSERT
WITH CHECK (true);

CREATE POLICY "Admins can view all ad impressions"
ON public.ad_impressions
FOR SELECT
USING (is_current_user_admin());

-- Insert default ad settings
INSERT INTO public.ad_settings (ads_per_credit, ad_credit_value, max_daily_views, cooldown_minutes, is_active)
VALUES (200, 0.5, 1000, 1, true);

-- Function to securely claim ad view and award credits
CREATE OR REPLACE FUNCTION public.secure_claim_ad_view(
  p_device_fingerprint text,
  p_ip_address inet,
  p_user_agent text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  current_user_id uuid;
  ads_per_credit integer;
  max_daily_views integer;
  cooldown_minutes integer;
  daily_views_count integer;
  recent_views_count integer;
  credits_to_award integer := 0;
  views_needed integer;
BEGIN
  current_user_id := auth.uid();
  
  -- Must be authenticated
  IF current_user_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Authentication required'
    );
  END IF;
  
  -- Get active ad configuration
  SELECT s.ads_per_credit, s.max_daily_views, s.cooldown_minutes
  INTO ads_per_credit, max_daily_views, cooldown_minutes
  FROM ad_settings s
  WHERE s.is_active = true
  LIMIT 1;
  
  IF ads_per_credit IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Ad system not configured'
    );
  END IF;
  
  -- Check daily view limit
  SELECT COUNT(*) INTO daily_views_count
  FROM ad_impressions
  WHERE user_id = current_user_id
  AND view_timestamp::date = current_date;
  
  IF daily_views_count >= max_daily_views THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Daily view limit reached'
    );
  END IF;
  
  -- Check cooldown (prevent spam)
  SELECT COUNT(*) INTO recent_views_count
  FROM ad_impressions
  WHERE user_id = current_user_id
  AND device_fingerprint = p_device_fingerprint
  AND view_timestamp > now() - INTERVAL '1 minute' * cooldown_minutes;
  
  IF recent_views_count > 0 THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Please wait before viewing another ad'
    );
  END IF;
  
  -- Record the ad view
  INSERT INTO ad_impressions (user_id, device_fingerprint, ip_address, user_agent)
  VALUES (current_user_id, p_device_fingerprint, p_ip_address, p_user_agent);
  
  -- Recount daily views after insert
  SELECT COUNT(*) INTO daily_views_count
  FROM ad_impressions
  WHERE user_id = current_user_id
  AND view_timestamp::date = current_date;
  
  -- Award credits if reached the threshold
  IF daily_views_count % ads_per_credit = 0 THEN
    credits_to_award := 1;
    
    -- Update user credits
    UPDATE profiles
    SET credits = credits + credits_to_award,
        updated_at = now()
    WHERE user_id = current_user_id;
    
    -- Update the impression record with credits earned
    UPDATE ad_impressions
    SET credits_earned = credits_to_award
    WHERE user_id = current_user_id
    AND view_timestamp::date = current_date
    AND credits_earned = 0
    ORDER BY view_timestamp DESC
    LIMIT 1;
    
    -- Add transaction record
    INSERT INTO transaction_history (user_id, type, amount, description)
    VALUES (
      current_user_id,
      'ad_reward',
      credits_to_award,
      'Crédito por visualização de anúncios (' || daily_views_count || ' views)'
    );
    
    -- Send notification
    INSERT INTO notifications (user_id, message, type)
    VALUES (
      current_user_id,
      '🎬 Parabéns! Você ganhou ' || credits_to_award || ' crédito por assistir anúncios! Total de views hoje: ' || daily_views_count,
      'success'
    );
  END IF;
  
  -- Calculate how many more views needed for next credit
  views_needed := ads_per_credit - (daily_views_count % ads_per_credit);
  IF views_needed = ads_per_credit THEN
    views_needed := 0;
  END IF;
  
  RETURN jsonb_build_object(
    'success', true,
    'credits_earned', credits_to_award,
    'daily_views', daily_views_count,
    'views_needed_for_next_credit', views_needed,
    'ads_per_credit', ads_per_credit,
    'max_daily_views', max_daily_views
  );
  
EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false,
    'error', 'Unexpected error: ' || SQLERRM
  );
END;
$$;