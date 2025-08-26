-- Create referral codes table
CREATE TABLE public.referral_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true
);

-- Create referral rewards table
CREATE TABLE public.referral_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  referrer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referred_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  milestone_type TEXT NOT NULL CHECK (milestone_type IN ('first_withdrawal', 'withdrawal_50', 'withdrawal_250', 'withdrawal_500')),
  credits_earned INTEGER NOT NULL DEFAULT 2,
  milestone_completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.referral_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.referral_rewards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for referral_codes
CREATE POLICY "Users can view their own referral codes"
  ON public.referral_codes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own referral codes"
  ON public.referral_codes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own referral codes"
  ON public.referral_codes
  FOR UPDATE
  USING (auth.uid() = user_id);

-- RLS Policies for referral_rewards
CREATE POLICY "Users can view rewards they earned or gave"
  ON public.referral_rewards
  FOR SELECT
  USING (auth.uid() = referrer_user_id OR auth.uid() = referred_user_id);

CREATE POLICY "System can insert referral rewards"
  ON public.referral_rewards
  FOR INSERT
  WITH CHECK (true);

-- Function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  -- Check if user already has an active referral code
  SELECT code INTO new_code
  FROM referral_codes
  WHERE user_id = p_user_id AND is_active = true
  LIMIT 1;
  
  IF new_code IS NOT NULL THEN
    RETURN new_code;
  END IF;
  
  -- Generate new unique code
  LOOP
    new_code := upper(substring(md5(random()::text) from 1 for 8));
    
    SELECT EXISTS(
      SELECT 1 FROM referral_codes WHERE code = new_code
    ) INTO code_exists;
    
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  -- Insert new code
  INSERT INTO referral_codes (user_id, code)
  VALUES (p_user_id, new_code);
  
  RETURN new_code;
END;
$$;

-- Function to process referral rewards
CREATE OR REPLACE FUNCTION public.process_referral_reward(p_referred_user_id UUID, p_milestone_type TEXT, p_withdrawal_amount NUMERIC)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  referrer_id UUID;
  referral_code_val TEXT;
  milestone_valid BOOLEAN := false;
  reward_exists BOOLEAN;
BEGIN
  -- Validate milestone type
  IF p_milestone_type NOT IN ('first_withdrawal', 'withdrawal_50', 'withdrawal_250', 'withdrawal_500') THEN
    RETURN false;
  END IF;
  
  -- Check if milestone is valid based on withdrawal amount
  CASE p_milestone_type
    WHEN 'first_withdrawal' THEN milestone_valid := true;
    WHEN 'withdrawal_50' THEN milestone_valid := p_withdrawal_amount >= 50;
    WHEN 'withdrawal_250' THEN milestone_valid := p_withdrawal_amount >= 250;
    WHEN 'withdrawal_500' THEN milestone_valid := p_withdrawal_amount >= 500;
  END CASE;
  
  IF NOT milestone_valid THEN
    RETURN false;
  END IF;
  
  -- Get referrer information from user metadata
  SELECT 
    raw_user_meta_data ->> 'referral_code'
  INTO referral_code_val
  FROM auth.users
  WHERE id = p_referred_user_id;
  
  IF referral_code_val IS NULL THEN
    RETURN false;
  END IF;
  
  -- Get referrer user_id from referral code
  SELECT user_id INTO referrer_id
  FROM referral_codes
  WHERE code = referral_code_val AND is_active = true;
  
  IF referrer_id IS NULL THEN
    RETURN false;
  END IF;
  
  -- Check if reward already exists
  SELECT EXISTS(
    SELECT 1 FROM referral_rewards
    WHERE referred_user_id = p_referred_user_id
    AND referrer_user_id = referrer_id
    AND milestone_type = p_milestone_type
  ) INTO reward_exists;
  
  IF reward_exists THEN
    RETURN false;
  END IF;
  
  -- Add credits to referrer
  UPDATE profiles
  SET credits = credits + 2,
      updated_at = now()
  WHERE user_id = referrer_id;
  
  -- Record the reward
  INSERT INTO referral_rewards (
    referrer_user_id,
    referred_user_id,
    referral_code,
    milestone_type,
    credits_earned
  ) VALUES (
    referrer_id,
    p_referred_user_id,
    referral_code_val,
    p_milestone_type,
    2
  );
  
  -- Create notification for referrer
  INSERT INTO notifications (user_id, message, type)
  VALUES (
    referrer_id,
    'Parabéns! Você ganhou 2 créditos por indicação! 💰',
    'success'
  );
  
  -- Create transaction record
  INSERT INTO transaction_history (user_id, type, amount, description)
  VALUES (
    referrer_id,
    'referral_reward',
    2,
    'Recompensa por indicação - ' || p_milestone_type
  );
  
  RETURN true;
END;
$$;

-- Add trigger to update referral code tracking
CREATE OR REPLACE FUNCTION public.track_referral_signup()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If user has referral_code in metadata, we'll track it in the user's metadata
  -- The referral processing will happen when they make their first withdrawal
  RETURN NEW;
END;
$$;

-- Create indexes for performance
CREATE INDEX idx_referral_codes_user_id ON public.referral_codes(user_id);
CREATE INDEX idx_referral_codes_code ON public.referral_codes(code);
CREATE INDEX idx_referral_rewards_referrer ON public.referral_rewards(referrer_user_id);
CREATE INDEX idx_referral_rewards_referred ON public.referral_rewards(referred_user_id);