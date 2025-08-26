import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, TestTube, Users, Award, AlertCircle } from 'lucide-react';

interface ReferralData {
  id: string;
  referrer_user_id: string;
  referred_user_id: string;
  referral_code: string;
  milestone_type: string;
  credits_earned: number;
  referred_user_name: string;
  created_at: string;
}

interface UserWithReferral {
  id: string;
  email: string;
  name: string;
  referral_code?: string;
  signup_reward?: boolean;
}

export const ReferralDebugPanel = () => {
  const [referralData, setReferralData] = useState<ReferralData[]>([]);
  const [usersWithReferrals, setUsersWithReferrals] = useState<UserWithReferral[]>([]);
  const [testUserId, setTestUserId] = useState('');
  const [testAmount, setTestAmount] = useState('100');
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const loadDebugData = async () => {
    setLoading(true);
    try {
      // Load referral rewards
      const { data: rewards, error: rewardsError } = await supabase
        .from('referral_rewards')
        .select('*')
        .order('created_at', { ascending: false });

      if (rewardsError) {
        console.error('Error loading referral rewards:', rewardsError);
      } else {
        setReferralData(rewards || []);
      }

      // Load basic user data since we don't have the RPC function
      const { data: profiles } = await supabase
        .from('profiles')
        .select('user_id, name')
        .limit(10);
      
      if (profiles) {
        setUsersWithReferrals(profiles.map(p => ({
          id: p.user_id,
          email: 'N/A',
          name: p.name || 'Unnamed',
          referral_code: undefined,
          signup_reward: false
        })));
      }

    } catch (error) {
      console.error('Error loading debug data:', error);
      toast({
        title: "❌ Erro",
        description: "Erro ao carregar dados de debug",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const testReferralReward = async () => {
    if (!testUserId || !testAmount) {
      toast({
        title: "⚠️ Aviso",
        description: "Preencha o ID do usuário e valor do saque",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('process_referral_reward', {
        p_referred_user_id: testUserId,
        p_milestone_type: 'first_withdrawal',
        p_withdrawal_amount: parseFloat(testAmount)
      });

      if (error) {
        throw error;
      }

      toast({
        title: data ? "✅ Sucesso" : "⚠️ Aviso",
        description: data 
          ? "Recompensa de referral processada com sucesso!" 
          : "Recompensa não foi processada (pode já existir ou não ter referral)",
      });

      // Reload data to see changes
      await loadDebugData();

    } catch (error: any) {
      console.error('Error testing referral reward:', error);
      toast({
        title: "❌ Erro",
        description: error.message || "Erro ao processar recompensa de referral",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const fixExistingUsers = async () => {
    setLoading(true);
    try {
      // This would identify users who signed up with referral codes but don't have signup rewards
      // For now, we'll just show a message
      toast({
        title: "🔧 Em desenvolvimento",
        description: "Funcionalidade de correção automática em desenvolvimento",
      });
    } catch (error) {
      console.error('Error fixing existing users:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDebugData();
  }, []);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TestTube className="h-5 w-5" />
            Painel de Debug - Sistema de Referral
          </CardTitle>
          <CardDescription>
            Monitore e teste o sistema "Indique e ganhe"
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Button 
              onClick={loadDebugData} 
              disabled={loading}
              variant="outline"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
              Recarregar Dados
            </Button>
            <Button 
              onClick={fixExistingUsers} 
              disabled={loading}
              variant="secondary"
            >
              🔧 Corrigir Usuários Existentes
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Test Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              Teste de Recompensa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="testUserId">ID do Usuário</Label>
              <Input
                id="testUserId"
                value={testUserId}
                onChange={(e) => setTestUserId(e.target.value)}
                placeholder="UUID do usuário que fez saque"
              />
            </div>
            <div>
              <Label htmlFor="testAmount">Valor do Saque (R$)</Label>
              <Input
                id="testAmount"
                type="number"
                value={testAmount}
                onChange={(e) => setTestAmount(e.target.value)}
                placeholder="100"
              />
            </div>
            <Button 
              onClick={testReferralReward} 
              disabled={loading}
              className="w-full"
            >
              🧪 Testar Processamento de Recompensa
            </Button>
          </CardContent>
        </Card>

        {/* Statistics */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Estatísticas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">
                  {referralData.length}
                </div>
                <div className="text-sm text-muted-foreground">Total de Recompensas</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {referralData.filter(r => r.milestone_type !== 'signup').length}
                </div>
                <div className="text-sm text-muted-foreground">Recompensas de Saque</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {referralData.reduce((sum, r) => sum + r.credits_earned, 0)}
                </div>
                <div className="text-sm text-muted-foreground">Créditos Distribuídos</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {usersWithReferrals.filter(u => u.referral_code).length}
                </div>
                <div className="text-sm text-muted-foreground">Usuários Referenciados</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Referral Data Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Recompensas de Referral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px]">
            {referralData.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <AlertCircle className="h-8 w-8 mr-2" />
                Nenhuma recompensa de referral encontrada
              </div>
            ) : (
              <div className="space-y-2">
                {referralData.map((reward) => (
                  <div key={reward.id} className="border rounded p-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <Badge variant={reward.milestone_type === 'signup' ? 'secondary' : 'default'}>
                          {reward.milestone_type}
                        </Badge>
                        <p className="text-sm mt-1">
                          <strong>{reward.referred_user_name}</strong> gerou <strong>{reward.credits_earned} créditos</strong>
                        </p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(reward.created_at).toLocaleString()}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Código: {reward.referral_code} | Referrer: {reward.referrer_user_id.slice(-8)}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Users with Referrals */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Usuários com Referral
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[200px]">
            {usersWithReferrals.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <AlertCircle className="h-8 w-8 mr-2" />
                Nenhum usuário com referral encontrado
              </div>
            ) : (
              <div className="space-y-2">
                {usersWithReferrals.map((user) => (
                  <div key={user.id} className="flex justify-between items-center p-2 border rounded">
                    <div>
                      <p className="font-medium">{user.name}</p>
                      <p className="text-xs text-muted-foreground">ID: {user.id.slice(-8)}</p>
                    </div>
                    <div className="text-right">
                      {user.referral_code && (
                        <Badge variant="outline" className="mb-1">
                          {user.referral_code}
                        </Badge>
                      )}
                      {user.signup_reward && (
                        <Badge variant="secondary">Signup OK</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};