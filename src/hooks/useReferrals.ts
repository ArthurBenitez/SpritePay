import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { createReferralLink, isValidReferralCode } from '@/lib/url';

export interface ReferralCode {
  id: string;
  code: string;
  created_at: string;
  is_active: boolean;
}

export interface ReferralReward {
  id: string;
  referred_user_id: string;
  milestone_type: string;
  credits_earned: number;
  milestone_completed_at: string;
  created_at: string;
  referred_user_name?: string;
}

export interface ReferralStatistics {
  total_credits_earned: number;
  total_referred_users: number;
  active_users: number;
  completed_milestones: number;
  referred_users: Array<{
    name: string;
    milestone_type: string;
    credits_earned: number;
    completed_at: string;
    is_active: boolean;
  }>;
}

export const useReferrals = () => {
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [referralRewards, setReferralRewards] = useState<ReferralReward[]>([]);
  const [referralStats, setReferralStats] = useState<ReferralStatistics | null>(null);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const generateReferralCode = async () => {
    setLoading(true);
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) {
        throw new Error('Usuário não autenticado');
      }

      console.log('Generating referral code for user:', user.id);

      const { data, error } = await supabase.rpc('generate_referral_code', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error from generate_referral_code RPC:', error);
        throw error;
      }

      if (!data || !isValidReferralCode(data)) {
        throw new Error('Código de referência inválido gerado');
      }

      console.log('Generated referral code:', data);
      setReferralCode(data);
      
      // Create referral link with dynamic URL
      const referralLink = createReferralLink(data);
      console.log('Created referral link:', referralLink);
      
      // Copy to clipboard
      await navigator.clipboard.writeText(referralLink);
      
      toast({
        title: "🎉 Link gerado!",
        description: "Link de convite copiado para área de transferência!",
      });

      return referralLink;
    } catch (error: any) {
      console.error('Error generating referral code:', error);
      toast({
        title: "❌ Erro",
        description: "Erro ao gerar link de convite.",
        variant: "destructive"
      });
      return null;
    } finally {
      setLoading(false);
    }
  };

  const loadReferralData = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      // Load existing referral code
      const { data: codeData } = await supabase
        .from('referral_codes')
        .select('code')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (codeData) {
        setReferralCode(codeData.code);
      }

      // Load referral rewards
      const { data: rewardsData } = await supabase
        .from('referral_rewards')
        .select('*')
        .eq('referrer_user_id', user.id)
        .order('created_at', { ascending: false });

      if (rewardsData) {
        setReferralRewards(rewardsData);
      }

      // Load detailed referral statistics
      const { data: statsData } = await supabase.rpc('get_referral_statistics', {
        p_user_id: user.id
      });

      if (statsData) {
        setReferralStats(statsData as unknown as ReferralStatistics);
      }
    } catch (error) {
      console.error('Error loading referral data:', error);
    }
  };

  useEffect(() => {
    loadReferralData();

    // Set up real-time listener for referral updates
    const user = supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const channel = supabase
          .channel('referral-updates')
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'referral_rewards',
              filter: `referrer_user_id=eq.${data.user.id}`
            },
            () => {
              loadReferralData();
            }
          )
          .subscribe();

        return () => {
          supabase.removeChannel(channel);
        };
      }
    });

    return () => {
      user.then(cleanup => cleanup && cleanup());
    };
  }, []);

  const getReferralLink = () => {
    if (!referralCode) return null;
    return createReferralLink(referralCode);
  };

  const copyReferralLink = async () => {
    const link = getReferralLink();
    if (!link) return;
    
    try {
      await navigator.clipboard.writeText(link);
      toast({
        title: "📋 Copiado!",
        description: "Link de convite copiado para área de transferência!",
      });
    } catch (error) {
      toast({
        title: "❌ Erro",
        description: "Erro ao copiar link.",
        variant: "destructive"
      });
    }
  };

  const getMilestoneText = (milestoneType: string) => {
    switch (milestoneType) {
      case 'first_withdrawal':
        return 'Primeiro saque';
      case 'withdrawal_25':
        return '25 pontos em saques';
      case 'withdrawal_100':
        return '100 pontos em saques';
      case 'withdrawal_500':
        return '500 pontos em saques';
      case 'withdrawal_1000':
        return '1000 pontos em saques';
      default:
        return milestoneType;
    }
  };

  return {
    referralCode,
    referralRewards,
    referralStats,
    loading,
    generateReferralCode,
    getReferralLink,
    copyReferralLink,
    getMilestoneText,
    loadReferralData
  };
};