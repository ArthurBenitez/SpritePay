import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, Users, Gift, Copy, ExternalLink, Banknote, Coins, Bug } from "lucide-react";
import { useReferrals } from "@/hooks/useReferrals";
import { ReferralNotifications } from "@/components/ReferralNotifications";
import { ReferralDebugPanel } from "@/components/ReferralDebugPanel";

export const ReferralSection = () => {
  const {
    referralCode,
    referralRewards,
    referralStats,
    loading,
    generateReferralCode,
    getReferralLink,
    copyReferralLink,
    getMilestoneText
  } = useReferrals();

  const milestones = [
    { type: 'first_withdrawal', label: 'Primeiro saque', description: 'Qualquer valor', reward: 2, icon: DollarSign },
    { type: 'withdrawal_50', label: 'Saque R$ 50', description: '100 pontos', reward: 2, icon: Banknote },
    { type: 'withdrawal_250', label: 'Saque R$ 250', description: '500 pontos', reward: 2, icon: Banknote },
    { type: 'withdrawal_500', label: 'Saque R$ 500', description: '1000 pontos', reward: 2, icon: Banknote }
  ];

  const totalEarned = referralStats?.total_credits_earned || referralRewards.reduce((sum, reward) => sum + reward.credits_earned, 0);
  const totalReferredUsers = referralStats?.total_referred_users || 0;
  const activeUsers = referralStats?.active_users || 0;
  const completedMilestones = referralRewards.map(r => r.milestone_type);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="flex items-center justify-center gap-3">
          <div className="p-3 rounded-full bg-gradient-to-r from-green-500/20 to-emerald-500/20">
            <Users className="w-8 h-8 text-green-500" />
          </div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-green-500 to-emerald-500 bg-clip-text text-transparent">
            Indique e Ganhe
          </h2>
        </div>
        <p className="text-muted-foreground max-w-2xl mx-auto">
          Convide seus amigos e ganhe <strong>2 créditos</strong> a cada marco que eles conquistarem! 
          Quanto mais eles sacam, mais você ganha! 💰
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-green-500/20 bg-gradient-to-br from-green-500/5 to-transparent">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Coins className="w-5 h-5 text-green-500" />
              <span className="text-2xl font-bold text-green-500">{totalEarned}</span>
            </div>
            <p className="text-sm text-muted-foreground">Créditos Ganhos</p>
          </CardContent>
        </Card>

        <Card className="border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-transparent">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Users className="w-5 h-5 text-blue-500" />
              <span className="text-2xl font-bold text-blue-500">{totalReferredUsers}</span>
            </div>
            <p className="text-sm text-muted-foreground">Usuários Indicados</p>
          </CardContent>
        </Card>

        <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
          <CardContent className="p-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-2">
              <DollarSign className="w-5 h-5 text-purple-500" />
              <span className="text-2xl font-bold text-purple-500">{activeUsers}</span>
            </div>
            <p className="text-sm text-muted-foreground">Usuários Ativos</p>
          </CardContent>
        </Card>
      </div>

      {/* Generate Link Section */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="w-5 h-5" />
            Seu Link de Convite
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {referralCode ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Input 
                  value={getReferralLink() || ''} 
                  readOnly 
                  className="font-mono text-sm"
                />
                <Button onClick={copyReferralLink} variant="outline" size="sm">
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground">
                Compartilhe este link com seus amigos para começar a ganhar créditos!
              </p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <Button 
                onClick={generateReferralCode}
                disabled={loading}
                className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white px-8 py-3 text-lg font-semibold"
              >
                <DollarSign className="w-5 h-5 mr-2" />
                {loading ? 'Gerando...' : 'Gerar Link de Convite'}
              </Button>
              <p className="text-sm text-muted-foreground">
                Clique para gerar seu link único de convite
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* How it Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gift className="w-5 h-5" />
            Como Funciona
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {milestones.map((milestone, index) => {
              const Icon = milestone.icon;
              const isCompleted = completedMilestones.includes(milestone.type);
              
              return (
                <Card 
                  key={milestone.type}
                  className={`relative transition-all ${
                    isCompleted 
                      ? 'border-green-500/50 bg-gradient-to-br from-green-500/10 to-transparent' 
                      : 'border-border/50 hover:border-primary/30'
                  }`}
                >
                  {isCompleted && (
                    <div className="absolute -top-2 -right-2">
                      <Badge className="bg-green-500 text-white">✓</Badge>
                    </div>
                  )}
                  <CardContent className="p-4 text-center space-y-2">
                    <div className={`p-3 rounded-full mx-auto w-fit ${
                      isCompleted ? 'bg-green-500/20' : 'bg-primary/20'
                    }`}>
                      <Icon className={`w-6 h-6 ${
                        isCompleted ? 'text-green-500' : 'text-primary'
                      }`} />
                    </div>
                    <div>
                      <h4 className="font-semibold text-sm">{milestone.label}</h4>
                      <p className="text-xs text-muted-foreground">{milestone.description}</p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      +{milestone.reward} créditos
                    </Badge>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Separator />

          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Regras Importantes
            </h4>
            <ul className="text-sm text-muted-foreground space-y-1">
              <li>• Você ganha <strong>2 créditos</strong> a cada marco que seu indicado conquista</li>
              <li>• O indicado precisa usar seu link para se cadastrar</li>
              <li>• Recompensas são creditadas automaticamente após cada saque aprovado</li>
              <li>• Não há limite de indicações - quanto mais, melhor!</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Recent Rewards + Notifications + Debug Panel */}
      <Tabs defaultValue="rewards" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="rewards">Recompensas Recentes</TabsTrigger>
          <TabsTrigger value="notifications">Atividade em Tempo Real</TabsTrigger>
          <TabsTrigger value="debug">
            <Bug className="w-4 h-4 mr-2" />
            Debug
          </TabsTrigger>
        </TabsList>
        
        <TabsContent value="rewards">
          {referralRewards.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Gift className="w-5 h-5 text-green-500" />
                  Suas Recompensas
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {referralRewards.slice(0, 5).map((reward) => (
                    <div 
                      key={reward.id}
                      className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-full bg-green-500/20">
                          <DollarSign className="w-4 h-4 text-green-500" />
                        </div>
                       <div>
                          <p className="font-medium text-sm">
                            {reward.referred_user_name || 'Usuário'} - {getMilestoneText(reward.milestone_type)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(reward.milestone_completed_at).toLocaleDateString('pt-BR')}
                          </p>
                        </div>
                      </div>
                      <Badge className="bg-green-500/20 text-green-500 border-green-500/30">
                        +{reward.credits_earned} créditos
                      </Badge>
                    </div>
                  ))}
                  {referralRewards.length > 5 && (
                    <p className="text-center text-sm text-muted-foreground">
                      E mais {referralRewards.length - 5} recompensas...
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <div className="text-muted-foreground">
                  <Gift className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhuma recompensa ainda</p>
                  <p className="text-sm">Compartilhe seu link para começar!</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
        
        <TabsContent value="notifications">
          <ReferralNotifications />
        </TabsContent>
        
        <TabsContent value="debug">
          <ReferralDebugPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
};