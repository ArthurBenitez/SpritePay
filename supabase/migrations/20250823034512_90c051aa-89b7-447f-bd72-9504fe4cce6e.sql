-- Fix constraint to include all existing types plus admin_sprite_purchase
ALTER TABLE transaction_history DROP CONSTRAINT IF EXISTS transaction_history_type_check;

-- Add updated constraint with all existing types plus admin_sprite_purchase
ALTER TABLE transaction_history ADD CONSTRAINT transaction_history_type_check CHECK (
  type IN (
    'credit_purchase',
    'sprite_purchase', 
    'admin_sprite_purchase',
    'withdrawal',
    'referral_reward',
    'referral_signup_bonus', 
    'free_credits',
    'free_credits_secure',
    'admin_free_credits'
  )
);