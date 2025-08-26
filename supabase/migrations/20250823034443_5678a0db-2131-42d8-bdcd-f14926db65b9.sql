-- Fix constraint to allow admin_sprite_purchase transaction type
ALTER TABLE transaction_history DROP CONSTRAINT IF EXISTS transaction_history_type_check;

-- Add updated constraint with admin_sprite_purchase type
ALTER TABLE transaction_history ADD CONSTRAINT transaction_history_type_check CHECK (
  type IN (
    'credit_purchase',
    'sprite_purchase', 
    'admin_sprite_purchase',
    'withdrawal',
    'referral_reward',
    'free_credits',
    'free_credits_secure',
    'admin_free_credits'
  )
);