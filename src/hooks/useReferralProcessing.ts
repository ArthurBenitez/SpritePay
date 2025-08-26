import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { extractReferralCode, isValidReferralCode } from '@/lib/url';

export const useReferralProcessing = () => {
  const { toast } = useToast();

  const processReferralCode = useCallback(async (referralCode: string) => {
    try {
      console.log('🔄 Processing referral code:', referralCode);

      if (!isValidReferralCode(referralCode)) {
        console.error('❌ Invalid referral code format:', referralCode);
        return;
      }

      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        console.log('⚠️ User not authenticated, skipping referral processing');
        return;
      }

      console.log('✅ User authenticated, processing referral for:', user.id);

      // Store referral code in user metadata immediately for robustness
      const { error: updateError } = await supabase.auth.updateUser({
        data: { ref: referralCode }
      });

      if (updateError) {
        console.error('⚠️ Failed to store referral code in metadata:', updateError);
      } else {
        console.log('✅ Referral code stored in user metadata immediately');
      }

      // Check if user was already referred
      const { data: existingReferral } = await supabase
        .from('referral_rewards')
        .select('id')
        .eq('referred_user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (existingReferral) {
        console.log('⚠️ User was already referred, skipping');
        return;
      }

      // Find the referrer
      const { data: referralCodeData, error: codeError } = await supabase
        .from('referral_codes')
        .select('user_id')
        .eq('code', referralCode)
        .eq('is_active', true)
        .maybeSingle();

      if (codeError || !referralCodeData) {
        console.error('❌ Referral code not found or inactive:', referralCode, codeError);
        return;
      }

      if (referralCodeData.user_id === user.id) {
        console.log('⚠️ User cannot refer themselves, skipping');
        return;
      }

      console.log('🎯 Found valid referrer:', referralCodeData.user_id);

      // Get user's name for notification
      const { data: userProfile } = await supabase
        .from('profiles')
        .select('name')
        .eq('user_id', user.id)
        .maybeSingle();

      const userName = userProfile?.name || 'Novo usuário';
      console.log('👤 Processing referral for user:', userName);

      // Create initial referral reward entry (signup milestone)
      const { data: insertedReward, error: referralError } = await supabase
        .from('referral_rewards')
        .insert({
          referrer_user_id: referralCodeData.user_id,
          referred_user_id: user.id,
          referral_code: referralCode,
          milestone_type: 'signup',
          credits_earned: 0,
          referred_user_name: userName
        })
        .select()
        .single();

      if (referralError) {
        console.error('❌ Error creating referral relationship:', referralError);
        return;
      }

      console.log('✅ Referral reward record created:', insertedReward);

      // Send notification to referrer about new signup
      const { error: notificationError } = await supabase
        .from('notifications')
        .insert({
          user_id: referralCodeData.user_id,
          message: `🎉 ${userName} criou uma conta usando seu link de convite! Aguarde para ganhar créditos quando ele fizer seu primeiro saque.`,
          type: 'info'
        });

      if (notificationError) {
        console.error('⚠️ Error sending signup notification:', notificationError);
      } else {
        console.log('✅ Signup notification sent to referrer');
      }

      console.log('🎉 Referral relationship created successfully');
      
      toast({
        title: "🎉 Bem-vindo!",
        description: "Você foi convidado por um amigo! Ganhe pontos e comece a jogar!",
      });

      // Clear the referral code from URL
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());

    } catch (error) {
      console.error('💥 Error processing referral code:', error);
      toast({
        title: "⚠️ Aviso",
        description: "Houve um problema ao processar o convite, mas você pode continuar normalmente.",
        variant: "destructive"
      });
    }
  }, [toast]);

  const initializeReferralProcessing = useCallback(() => {
    const referralCode = extractReferralCode();
    if (referralCode) {
      console.log('🔗 Referral code found in URL:', referralCode);
      
      // Store referral code in localStorage for processing after login
      localStorage.setItem('pending_referral_code', referralCode);
      
      // Clear URL immediately to avoid repeated processing
      const url = new URL(window.location.href);
      url.searchParams.delete('ref');
      window.history.replaceState({}, '', url.toString());
      
      console.log('📝 Referral code stored in localStorage for post-login processing');
    }
  }, []);

  // Process referral on authentication state change
  const processStoredReferral = useCallback(async () => {
    const pendingCode = localStorage.getItem('pending_referral_code');
    if (pendingCode) {
      console.log('🔄 Processing stored referral code after authentication:', pendingCode);
      
      // Small delay to ensure profile is created
      setTimeout(async () => {
        await processReferralCode(pendingCode);
        localStorage.removeItem('pending_referral_code');
      }, 2000);
    }
  }, [processReferralCode]);

  useEffect(() => {
    initializeReferralProcessing();
  }, [initializeReferralProcessing]);

  useEffect(() => {
    // Check for authentication and process stored referral
    const checkAuthAndProcess = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await processStoredReferral();
      }
    };

    checkAuthAndProcess();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        processStoredReferral();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [processStoredReferral]);

  return {
    processReferralCode,
    initializeReferralProcessing,
    processStoredReferral
  };
};