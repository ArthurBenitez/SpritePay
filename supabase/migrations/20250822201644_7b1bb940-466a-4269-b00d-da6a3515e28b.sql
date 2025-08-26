-- Manually process the missing first withdrawal milestone for the referred user
-- The referred user (fsfsinfsdaf@imperium.com) made a withdrawal that was approved
-- but the referral reward was not processed

-- Create the first withdrawal reward
INSERT INTO referral_rewards (
  referrer_user_id,
  referred_user_id,
  referral_code,
  milestone_type,
  credits_earned,
  referred_user_name,
  milestone_completed_at
) VALUES (
  '212319f5-628b-41c5-a999-613f15a2cb28'::uuid,
  'cce87992-31e8-4c98-bfbb-9c9a09cd15fb'::uuid,
  'C61A28F0',
  'first_withdrawal',
  2,
  'sofia-kiepper@tuamaeaquelaursa.com''s Org',
  '2025-08-22 19:43:58.083667+00'::timestamp
);

-- Update referrer credits
UPDATE profiles 
SET credits = credits + 2
WHERE user_id = '212319f5-628b-41c5-a999-613f15a2cb28'::uuid;

-- Create transaction record
INSERT INTO transaction_history (user_id, type, amount, description)
VALUES (
  '212319f5-628b-41c5-a999-613f15a2cb28'::uuid,
  'referral_reward',
  2,
  'Recompensa por indicação - sofia-kiepper@tuamaeaquelaursa.com''s Org - first_withdrawal'
);

-- Create notification
INSERT INTO notifications (user_id, message, type)
VALUES (
  '212319f5-628b-41c5-a999-613f15a2cb28'::uuid,
  '🎉 Parabéns! sofia-kiepper@tuamaeaquelaursa.com''s Org, que criou conta pelo seu link de convite, fez seu primeiro saque! Você ganhou 2 créditos! 💰',
  'success'
);