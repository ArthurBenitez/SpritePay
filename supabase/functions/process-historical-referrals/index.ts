import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[PROCESS-HISTORICAL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Starting historical referral processing");

    // Create Supabase client using the service role key
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const results = {
      signup_rewards_created: 0,
      withdrawal_rewards_processed: 0,
      errors: []
    };

    // Step 1: Process users with referral codes in metadata but no signup rewards
    logStep("Processing users with missing signup rewards");
    
    const { data: usersWithReferrals, error: usersError } = await supabaseClient
      .from('auth.users')
      .select('id, raw_user_meta_data')
      .not('raw_user_meta_data->ref', 'is', null);

    if (usersError) {
      logStep("Error fetching users with referrals", usersError);
    } else {
      for (const user of usersWithReferrals || []) {
        const referralCode = user.raw_user_meta_data?.ref;
        if (!referralCode) continue;

        // Check if signup reward already exists
        const { data: existingReward } = await supabaseClient
          .from('referral_rewards')
          .select('id')
          .eq('referred_user_id', user.id)
          .eq('milestone_type', 'signup')
          .maybeSingle();

        if (existingReward) continue;

        // Find referrer
        const { data: referralCodeData } = await supabaseClient
          .from('referral_codes')
          .select('user_id')
          .eq('code', referralCode)
          .eq('is_active', true)
          .maybeSingle();

        if (!referralCodeData || referralCodeData.user_id === user.id) continue;

        // Get user profile for name
        const { data: userProfile } = await supabaseClient
          .from('profiles')
          .select('name')
          .eq('user_id', user.id)
          .maybeSingle();

        const userName = userProfile?.name || 'Usuário histórico';

        // Create signup reward
        const { error: insertError } = await supabaseClient
          .from('referral_rewards')
          .insert({
            referrer_user_id: referralCodeData.user_id,
            referred_user_id: user.id,
            referral_code: referralCode,
            milestone_type: 'signup',
            credits_earned: 0,
            referred_user_name: userName
          });

        if (insertError) {
          logStep("Error creating signup reward", { userId: user.id, error: insertError });
          results.errors.push(`Signup reward for ${user.id}: ${insertError.message}`);
        } else {
          results.signup_rewards_created++;
          logStep("Created signup reward", { userId: user.id, referrer: referralCodeData.user_id });
        }
      }
    }

    // Step 2: Process approved withdrawals that should have triggered referral rewards
    logStep("Processing approved withdrawals for missing rewards");

    const { data: approvedWithdrawals, error: withdrawalsError } = await supabaseClient
      .from('withdraw_requests')
      .select('id, user_id, amount, processed_at')
      .eq('status', 'approved')
      .order('processed_at', { ascending: true });

    if (withdrawalsError) {
      logStep("Error fetching approved withdrawals", withdrawalsError);
    } else {
      for (const withdrawal of approvedWithdrawals || []) {
        // Check if user has referral relationship
        const { data: signupReward } = await supabaseClient
          .from('referral_rewards')
          .select('referrer_user_id, referral_code, referred_user_name')
          .eq('referred_user_id', withdrawal.user_id)
          .eq('milestone_type', 'signup')
          .maybeSingle();

        if (!signupReward) continue;

        // Check if this is the first approved withdrawal for this user
        const { data: previousWithdrawals } = await supabaseClient
          .from('withdraw_requests')
          .select('id')
          .eq('user_id', withdrawal.user_id)
          .eq('status', 'approved')
          .lt('processed_at', withdrawal.processed_at);

        const isFirstWithdrawal = !previousWithdrawals || previousWithdrawals.length === 0;

        // Process milestones
        const milestones = [
          { type: 'first_withdrawal', condition: isFirstWithdrawal },
          { type: 'withdrawal_50', condition: withdrawal.amount >= 50 },
          { type: 'withdrawal_250', condition: withdrawal.amount >= 250 },
          { type: 'withdrawal_500', condition: withdrawal.amount >= 500 }
        ];

        for (const milestone of milestones) {
          if (!milestone.condition) continue;

          // Check if reward already exists
          const { data: existingReward } = await supabaseClient
            .from('referral_rewards')
            .select('id')
            .eq('referred_user_id', withdrawal.user_id)
            .eq('referrer_user_id', signupReward.referrer_user_id)
            .eq('milestone_type', milestone.type)
            .maybeSingle();

          if (existingReward) continue;

          // Create reward
          const { error: rewardError } = await supabaseClient
            .from('referral_rewards')
            .insert({
              referrer_user_id: signupReward.referrer_user_id,
              referred_user_id: withdrawal.user_id,
              referral_code: signupReward.referral_code,
              milestone_type: milestone.type,
              credits_earned: 2,
              referred_user_name: signupReward.referred_user_name,
              milestone_completed_at: withdrawal.processed_at
            });

          if (rewardError) {
            logStep("Error creating withdrawal reward", { 
              userId: withdrawal.user_id, 
              milestone: milestone.type, 
              error: rewardError 
            });
            results.errors.push(`${milestone.type} reward for ${withdrawal.user_id}: ${rewardError.message}`);
          } else {
            // Add credits to referrer
            await supabaseClient
              .from('profiles')
              .update({ credits: supabaseClient.raw('credits + 2') })
              .eq('user_id', signupReward.referrer_user_id);

            // Create transaction record
            await supabaseClient
              .from('transaction_history')
              .insert({
                user_id: signupReward.referrer_user_id,
                type: 'referral_reward',
                amount: 2,
                description: `Recompensa histórica - ${signupReward.referred_user_name} - ${milestone.type}`
              });

            results.withdrawal_rewards_processed++;
            logStep("Created withdrawal reward", { 
              userId: withdrawal.user_id, 
              milestone: milestone.type,
              referrer: signupReward.referrer_user_id
            });
          }
        }
      }
    }

    logStep("Historical processing completed", results);

    return new Response(JSON.stringify({
      success: true,
      message: "Historical referral processing completed",
      results
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in historical processing", { message: errorMessage });
    return new Response(JSON.stringify({ 
      success: false,
      error: errorMessage 
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});