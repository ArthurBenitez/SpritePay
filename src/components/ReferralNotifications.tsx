import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Bell, Gift, Users, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ReferralNotification {
  id: string;
  referred_user_name: string;
  credits_earned: number;
  created_at: string;
  milestone_type: string;
  referral_code: string;
  referred_user_id: string;
  referrer_user_id: string;
  milestone_completed_at: string;
}

export const ReferralNotifications = () => {
  const [notifications, setNotifications] = useState<ReferralNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadReferralNotifications = async () => {
    try {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;

      const { data, error } = await supabase
        .from('referral_rewards')
        .select('*')
        .eq('referrer_user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error loading referral notifications:', error);
        return;
      }

      setNotifications(data || []);
    } catch (error) {
      console.error('Error in loadReferralNotifications:', error);
    } finally {
      setLoading(false);
    }
  };

  const getMilestoneIcon = (type: string) => {
    switch (type) {
      case 'signup':
        return <Users className="h-4 w-4" />;
      case 'first_withdrawal':
        return <Gift className="h-4 w-4" />;
      default:
        return <TrendingUp className="h-4 w-4" />;
    }
  };

  const getMilestoneLabel = (type: string) => {
    switch (type) {
      case 'signup':
        return 'Cadastro';
      case 'first_withdrawal':
        return 'Primeiro Saque';
      case 'withdrawal_50':
        return 'Saque R$ 50';
      case 'withdrawal_250':
        return 'Saque R$ 250';
      case 'withdrawal_500':
        return 'Saque R$ 500';
      default:
        return type;
    }
  };

  const getMilestoneColor = (type: string) => {
    switch (type) {
      case 'signup':
        return 'secondary';
      case 'first_withdrawal':
        return 'default';
      case 'withdrawal_50':
        return 'outline';
      case 'withdrawal_250':
        return 'outline';
      case 'withdrawal_500':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  useEffect(() => {
    loadReferralNotifications();

    // Set up real-time subscription for new referral rewards
    const user = supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        const channel = supabase
          .channel('referral-notifications')
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'referral_rewards',
              filter: `referrer_user_id=eq.${data.user.id}`
            },
            (payload) => {
              const newReward = payload.new as ReferralNotification;
              
              // Add to notifications list
              setNotifications(prev => [newReward, ...prev.slice(0, 19)]);
              
              // Show toast notification
              if (newReward.milestone_type !== 'signup') {
                toast({
                  title: "🎉 Nova Recompensa!",
                  description: `${newReward.referred_user_name} atingiu o milestone "${getMilestoneLabel(newReward.milestone_type)}"! Você ganhou ${newReward.credits_earned} créditos!`,
                });
              }
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
  }, [toast]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Atividade de Referrals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5" />
          Atividade de Referrals
        </CardTitle>
        <CardDescription>
          Acompanhe os progressos dos seus indicados em tempo real
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhuma atividade de referral ainda</p>
              <p className="text-sm">Compartilhe seu link para começar!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-start space-x-3 p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">
                    {getMilestoneIcon(notification.milestone_type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm">
                        {notification.referred_user_name}
                      </p>
                      <Badge 
                        variant={getMilestoneColor(notification.milestone_type) as any}
                        className="text-xs"
                      >
                        {getMilestoneLabel(notification.milestone_type)}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {notification.credits_earned > 0 ? (
                        <>Você ganhou <strong>{notification.credits_earned} créditos</strong>!</>
                      ) : (
                        'Novo usuário cadastrado'
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(notification.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                  {notification.credits_earned > 0 && (
                    <div className="flex-shrink-0">
                      <div className="text-green-600 font-bold text-sm">
                        +{notification.credits_earned}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
};