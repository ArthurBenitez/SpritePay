import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { TestTube, Users } from "lucide-react";

export const ReferralTestPanel = () => {
  const [testUserId, setTestUserId] = useState("");
  const [testAmount, setTestAmount] = useState("");
  const [milestoneType, setMilestoneType] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const testReferralReward = async () => {
    if (!testUserId || !testAmount || !milestoneType) {
      toast({
        title: "❌ Campos obrigatórios",
        description: "Preencha todos os campos para testar.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('process_referral_reward', {
        p_referred_user_id: testUserId,
        p_milestone_type: milestoneType,
        p_withdrawal_amount: parseFloat(testAmount)
      });

      if (error) throw error;

      toast({
        title: data ? "✅ Teste bem-sucedido!" : "ℹ️ Teste executado",
        description: data 
          ? "Recompensa de referral processada com sucesso!" 
          : "Teste executado - pode já ter sido processado antes ou usuário não tem referral.",
      });

    } catch (error: any) {
      console.error('Erro no teste de referral:', error);
      toast({
        title: "❌ Erro no teste",
        description: error.message || "Erro ao processar teste de referral",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-orange-500/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-500">
          <TestTube className="w-5 h-5" />
          Teste do Sistema de Referral
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="test-user-id">ID do Usuário (indicado)</Label>
          <Input
            id="test-user-id"
            placeholder="c487181a-d024-43f0-948a-cb560e816a0e"
            value={testUserId}
            onChange={(e) => setTestUserId(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="test-amount">Valor do Saque (R$)</Label>
          <Input
            id="test-amount"
            type="number"
            placeholder="50.00"
            value={testAmount}
            onChange={(e) => setTestAmount(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="milestone-type">Tipo de Marco</Label>
          <Select value={milestoneType} onValueChange={setMilestoneType}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o marco" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="first_withdrawal">Primeiro Saque</SelectItem>
              <SelectItem value="withdrawal_50">Saque R$ 50</SelectItem>
              <SelectItem value="withdrawal_250">Saque R$ 250</SelectItem>
              <SelectItem value="withdrawal_500">Saque R$ 500</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button 
          onClick={testReferralReward}
          disabled={loading}
          className="w-full bg-orange-500 hover:bg-orange-600"
        >
          <TestTube className="w-4 h-4 mr-2" />
          {loading ? "Testando..." : "Testar Processamento de Referral"}
        </Button>

        <div className="text-sm text-muted-foreground bg-muted/30 p-3 rounded-lg">
          <strong>Como testar:</strong>
          <ul className="mt-2 space-y-1">
            <li>• Use o ID de um usuário que foi cadastrado com código de referral</li>
            <li>• O valor deve corresponder ao marco (≥50 para withdrawal_50, etc.)</li>
            <li>• O sistema só processa cada marco uma vez por usuário</li>
            <li>• Verifique as tabelas referral_rewards e transaction_history após o teste</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};