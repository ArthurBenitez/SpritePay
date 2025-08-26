import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Settings, Users, DollarSign, Package, TrendingUp, CheckCircle, XCircle, Clock, Loader2, Shield, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ReferralTestPanel } from "@/components/ReferralTestPanel";


interface Stats {
  totalUsers: number;
  totalCredits: number;
  totalPoints: number;
  totalRevenue: number;
  pendingWithdraws: number;
}

interface WithdrawRequest {
  id: string;
  user_id: string;
  points: number;
  amount: number;
  pix_key: string;
  status: string;
  created_at: string;
  profiles: {
    name: string;
  };
}

interface User {
  id: string;
  name: string;
  credits: number;
  points: number;
  created_at: string;
}

export const AdminDashboard = () => {
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    totalCredits: 0,
    totalPoints: 0,
    totalRevenue: 0,
    pendingWithdraws: 0
  });
  const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectionReason, setRejectionReason] = useState("");
  const [selectedWithdrawal, setSelectedWithdrawal] = useState<string | null>(null);
  const { toast } = useToast();

  const loadStats = async () => {
    try {
      // Get total users
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get credits and points totals
      const { data: profiles } = await supabase
        .from('profiles')
        .select('credits, points');

      const totalCredits = profiles?.reduce((sum, p) => sum + (p.credits || 0), 0) || 0;
      const totalPoints = profiles?.reduce((sum, p) => sum + (p.points || 0), 0) || 0;

      // Get total revenue from transactions
      const { data: transactions } = await supabase
        .from('transaction_history')
        .select('amount')
        .eq('type', 'credit_purchase');

      const totalRevenue = transactions?.reduce((sum, t) => sum + t.amount, 0) || 0;

      // Get pending withdraws count
      const { count: pendingCount } = await supabase
        .from('withdraw_requests')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');

      setStats({
        totalUsers: userCount || 0,
        totalCredits,
        totalPoints,
        totalRevenue,
        pendingWithdraws: pendingCount || 0
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const loadWithdrawRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('withdraw_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get user names separately
      const requestsWithNames = await Promise.all(
        (data || []).map(async (request) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('name')
            .eq('user_id', request.user_id)
            .single();
          
          return {
            ...request,
            profiles: { name: profile?.name || 'Usuário desconhecido' }
          };
        })
      );

      setWithdrawRequests(requestsWithNames);
    } catch (error) {
      console.error('Error loading withdraw requests:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error loading users:', error);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_audit_log')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAuditLogs(data || []);
    } catch (error) {
      console.error('Error loading audit logs:', error);
    }
  };

  const handleApproval = async (withdrawalId: string) => {
    try {
      const { error } = await supabase.rpc('approve_withdrawal_secure', {
        withdrawal_id: withdrawalId
      });

      if (error) throw error;

      toast({
        title: "✅ Saque aprovado!",
        description: "O saque foi aprovado com sucesso. Ação registrada no log de auditoria.",
      });

      loadData();
    } catch (error: any) {
      console.error('Error approving withdrawal:', error);
      toast({
        title: "❌ Erro",
        description: error.message.includes('Unauthorized') ? 'Acesso negado' : "Erro ao aprovar saque",
        variant: "destructive"
      });
    }
  };

  const handleRejection = async (withdrawalId: string, reason?: string) => {
    try {
      const { error } = await supabase.rpc('reject_withdrawal_secure', {
        withdrawal_id: withdrawalId,
        rejection_reason: reason || null
      });

      if (error) throw error;

      toast({
        title: "✅ Saque rejeitado!",
        description: "O saque foi rejeitado e os pontos foram devolvidos. Ação registrada no log de auditoria.",
      });

      setSelectedWithdrawal(null);
      setRejectionReason("");
      loadData();
    } catch (error: any) {
      console.error('Error rejecting withdrawal:', error);
      toast({
        title: "❌ Erro",
        description: error.message.includes('Unauthorized') ? 'Acesso negado' : "Erro ao rejeitar saque",
        variant: "destructive"
      });
    }
  };

  const loadData = async () => {
    try {
      setLoading(true);
      await Promise.all([loadStats(), loadWithdrawRequests(), loadUsers(), loadAuditLogs()]);
    } catch (error) {
      console.error('Error loading admin data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-primary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              <div>
                <p className="text-2xl font-bold">{stats.totalUsers}</p>
                <p className="text-sm text-muted-foreground">Usuários</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-secondary/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-secondary" />
              <div>
                <p className="text-2xl font-bold">{stats.totalCredits}</p>
                <p className="text-sm text-muted-foreground">Créditos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-accent/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              <div>
                <p className="text-2xl font-bold">{stats.totalPoints}</p>
                <p className="text-sm text-muted-foreground">Pontos</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-green-500" />
              <div>
                <p className="text-2xl font-bold">R$ {stats.totalRevenue}</p>
                <p className="text-sm text-muted-foreground">Revenue</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-orange-500" />
              <div>
                <p className="text-2xl font-bold">{stats.pendingWithdraws}</p>
                <p className="text-sm text-muted-foreground">Saques pendentes</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs for different admin sections */}
      <Tabs defaultValue="withdraws" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="withdraws">Solicitações de Saque</TabsTrigger>
          <TabsTrigger value="users">Usuários</TabsTrigger>
          <TabsTrigger value="ads">Anúncios</TabsTrigger>
          <TabsTrigger value="audit">
            <Shield className="w-4 h-4 mr-2" />
            Auditoria
          </TabsTrigger>
          <TabsTrigger value="settings">Configurações</TabsTrigger>
        </TabsList>

        <TabsContent value="withdraws" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Solicitações de Saque
              </CardTitle>
            </CardHeader>
            <CardContent>
              {withdrawRequests.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Nenhuma solicitação de saque encontrada
                </p>
              ) : (
                <div className="space-y-4">
                  {withdrawRequests.map((request) => (
                    <div key={request.id} className="flex items-center justify-between p-4 border border-primary/20 rounded-lg">
                      <div className="space-y-1">
                        <p className="font-semibold">{request.profiles.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {request.points} pontos → R$ {request.amount.toFixed(2)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          PIX: {request.pix_key}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(request.created_at).toLocaleDateString('pt-BR')} às {new Date(request.created_at).toLocaleTimeString('pt-BR')}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge 
                          variant={
                            request.status === 'pending' ? 'outline' :
                            request.status === 'approved' ? 'default' : 'destructive'
                          }
                          className={
                            request.status === 'pending' ? 'border-orange-500 text-orange-500' :
                            request.status === 'approved' ? 'border-green-500 text-green-500 bg-green-500/10' :
                            'border-red-500 text-red-500 bg-red-500/10'
                          }
                        >
                          {request.status === 'pending' ? 'Pendente' :
                           request.status === 'approved' ? 'Aprovado' : 'Rejeitado'}
                        </Badge>
                        {request.status === 'pending' && (
                          <div className="flex gap-1">
                            <Button 
                              size="sm" 
                              variant="outline"
                              className="border-green-500 text-green-500 hover:bg-green-500/10"
                              onClick={() => handleApproval(request.id)}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </Button>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  className="border-red-500 text-red-500 hover:bg-red-500/10"
                                  onClick={() => setSelectedWithdrawal(request.id)}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Rejeitar Solicitação de Saque</DialogTitle>
                                </DialogHeader>
                                <div className="space-y-4">
                                  <div>
                                    <Label htmlFor="reason">Motivo da rejeição (opcional)</Label>
                                    <Textarea
                                      id="reason"
                                      placeholder="Descreva o motivo da rejeição..."
                                      value={rejectionReason}
                                      onChange={(e) => setRejectionReason(e.target.value)}
                                      className="mt-1"
                                    />
                                  </div>
                                  <div className="flex gap-2 justify-end">
                                    <Button variant="outline" onClick={() => {
                                      setSelectedWithdrawal(null);
                                      setRejectionReason("");
                                    }}>
                                      Cancelar
                                    </Button>
                                    <Button 
                                      variant="destructive"
                                      onClick={() => selectedWithdrawal && handleRejection(selectedWithdrawal, rejectionReason)}
                                    >
                                      Confirmar Rejeição
                                    </Button>
                                  </div>
                                </div>
                              </DialogContent>
                            </Dialog>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Gerenciar Usuários
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {users.map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-4 border border-primary/20 rounded-lg">
                    <div className="space-y-1">
                      <p className="font-semibold">{user.name}</p>
                      <div className="flex gap-4 text-sm text-muted-foreground">
                        <span>{user.credits} créditos</span>
                        <span>{user.points} pontos</span>
                        <span>Criado em {new Date(user.created_at).toLocaleDateString('pt-BR')}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ads" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Sistema de Anúncios (Removido)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center py-8">
              <p className="text-muted-foreground">
                O sistema de anúncios foi removido para melhorar a experiência do usuário.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5" />
                Log de Auditoria
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {auditLogs.map((log) => (
                  <div key={log.id} className="flex items-center justify-between p-4 border border-primary/20 rounded-lg">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant={
                          log.action.includes('APPROVED') ? 'default' : 
                          log.action.includes('REJECTED') ? 'destructive' : 
                          'secondary'
                        }>
                          {log.action}
                        </Badge>
                        <span className="text-sm text-muted-foreground">
                          {new Date(log.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      <p className="text-sm font-medium">Admin: {log.admin_user_id}</p>
                      <p className="text-sm text-muted-foreground">Tabela: {log.target_table}</p>
                      {log.details && (
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">Detalhes</summary>
                          <pre className="bg-muted p-2 rounded mt-1 overflow-auto">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
                {auditLogs.length === 0 && (
                  <p className="text-center text-muted-foreground py-8">
                    Nenhum log de auditoria encontrado
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Configurações do Sistema
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                      <AlertTriangle className="w-5 h-5 text-yellow-500" />
                      Status de Segurança
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        Sistema de auditoria ativo - todas as ações são registradas
                      </p>
                      <p className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        Validação de chaves PIX implementada
                      </p>
                      <p className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        Proteção contra fraude de créditos gratuitos ativa
                      </p>
                      <p className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        Rate limiting implementado em operações críticas
                      </p>
                      <p className="flex items-center gap-2">
                        <Shield className="w-4 h-4 text-green-500" />
                        Funções administrativas protegidas por RLS
                      </p>
                    </div>
                  </CardContent>
                </Card>

                <ReferralTestPanel />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};