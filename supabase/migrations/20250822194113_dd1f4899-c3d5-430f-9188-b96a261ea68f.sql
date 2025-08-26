-- Update the referral_rewards table constraint to include 'signup' as a valid milestone type
ALTER TABLE referral_rewards 
DROP CONSTRAINT IF EXISTS referral_rewards_milestone_type_check;

-- Add the updated constraint that includes 'signup'
ALTER TABLE referral_rewards 
ADD CONSTRAINT referral_rewards_milestone_type_check 
CHECK (milestone_type IN ('signup', 'first_withdrawal', 'withdrawal_50', 'withdrawal_250', 'withdrawal_500'));