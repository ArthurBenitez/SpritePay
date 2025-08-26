import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DollarSign, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { validatePixKey, sanitizeInput, validatePaymentAmount, createRateLimiter } from "@/lib/security";

interface WithdrawModalProps {
  userPoints: number;
  onWithdrawSuccess: () => void;
}

// Rate limiter for withdrawal requests (max 3 per minute)
const withdrawRateLimit = createRateLimiter(60000, 3);

export const WithdrawModal = ({ userPoints, onWithdrawSuccess }: WithdrawModalProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [pointsToWithdraw, setPointsToWithdraw] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [loading, setLoading] = useState(false);
  const [pixKeyError, setPixKeyError] = useState("");
  const { toast } = useToast();
  const { user } = useAuth();

  const maxAmount = userPoints * 0.5; // 1 ponto = R$ 0,50

  // PIX key validation with debounce
  const validatePixKeyInput = useCallback((value: string) => {
    const sanitized = sanitizeInput(value);
    if (!sanitized) {
      setPixKeyError("");
      return;
    }
    
    if (!validatePixKey(sanitized)) {
      setPixKeyError("Chave PIX inválida. Use CPF, CNPJ, email, telefone ou chave aleatória.");
    } else {
      setPixKeyError("");
    }
  }, []);

  const handleSubmit = async () => {
    if (!user) return;

    // Rate limiting check
    if (!withdrawRateLimit(user.id)) {
      toast({
        title: "❌ Muitas tentativas",
        description: "Aguarde um momento antes de fazer outro saque",
        variant: "destructive"
      });
      return;
    }

    const points = parseInt(pointsToWithdraw);
    
    // Enhanced validation
    if (!validatePaymentAmount(points, 1, userPoints)) {
      toast({
        title: "❌ Erro",
        description: "Quantidade de pontos inválida",
        variant: "destructive"
      });
      return;
    }

    const sanitizedPixKey = sanitizeInput(pixKey.trim());
    if (!sanitizedPixKey || !validatePixKey(sanitizedPixKey)) {
      toast({
        title: "❌ Erro", 
        description: "Chave PIX inválida ou obrigatória",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);

    try {
      const amount = points * 0.5;

      // Create withdraw request with sanitized data
      const { error } = await supabase
        .from('withdraw_requests')
        .insert({
          user_id: user.id,
          points: points,
          amount: amount,
          pix_key: sanitizedPixKey, // Use sanitized PIX key
          status: 'pending'
        });

      if (error) throw error;

      // Deduct points from user profile
      const { error: updateError } = await supabase
        .from('profiles')
        .update({
          points: userPoints - points
        })
        .eq('user_id', user.id);

      if (updateError) throw updateError;

      // Add notification
      await supabase
        .from('notifications')
        .insert({
          user_id: user.id,
          message: `Solicitação de saque de ${points} pontos (R$ ${amount.toFixed(2)}) criada! Aguardando aprovação. 💰`,
          type: 'info'
        });

      // Note: Referral rewards are now processed automatically when admin approves the withdrawal

      toast({
        title: "✅ Solicitação enviada!",
        description: `Saque de R$ ${amount.toFixed(2)} solicitado com sucesso!`,
      });

      setIsOpen(false);
      setPointsToWithdraw("");
      setPixKey("");
      onWithdrawSuccess();
    } catch (error: any) {
      console.error('Error creating withdraw request:', error);
      toast({
        title: "❌ Erro",
        description: "Erro ao criar solicitação de saque",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button 
          className="w-full bg-gradient-to-r from-accent to-primary hover:from-accent/80 hover:to-primary/80"
          disabled={userPoints === 0}
        >
          <DollarSign className="w-4 h-4 mr-2" />
          Trocar Pontos
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]" data-tutorial="withdraw-form">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="w-6 h-6 text-accent" />
            Trocar Pontos por Dinheiro
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <Card className="border-accent/20 bg-accent/5">
            <CardContent className="p-4">
              <div className="text-center space-y-2">
                <p className="text-sm text-muted-foreground">Seus pontos disponíveis:</p>
                <p className="text-2xl font-bold text-accent">{userPoints} pontos</p>
                <p className="text-lg font-semibold text-primary">= R$ {maxAmount.toFixed(2)}</p>
                <p className="text-xs text-muted-foreground">Taxa: 1 ponto = R$ 0,50</p>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="points">Pontos para trocar</Label>
              <Input
                id="points"
                type="number"
                placeholder="Digite a quantidade de pontos..."
                value={pointsToWithdraw}
                onChange={(e) => setPointsToWithdraw(e.target.value)}
                min="1"
                max={userPoints}
                className="border-primary/20 focus:border-primary"
                data-tutorial="points-input"
              />
              {pointsToWithdraw && parseInt(pointsToWithdraw) > 0 && (
                <p className="text-sm text-muted-foreground">
                  Valor a receber: R$ {(parseInt(pointsToWithdraw) * 0.5).toFixed(2)}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="pix">Chave PIX</Label>
              <Input
                id="pix"
                placeholder="Sua chave PIX (CPF, email, telefone ou chave aleatória)"
                value={pixKey}
                onChange={(e) => {
                  setPixKey(e.target.value);
                  validatePixKeyInput(e.target.value);
                }}
                className={`border-primary/20 focus:border-primary ${pixKeyError ? 'border-destructive' : ''}`}
                data-tutorial="pix-input"
              />
              {pixKeyError && (
                <div className="flex items-center gap-1 text-sm text-destructive">
                  <AlertTriangle className="w-4 h-4" />
                  {pixKeyError}
                </div>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              className="flex-1"
              disabled={loading}
            >
              Talvez Mais Tarde
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!pointsToWithdraw || !pixKey || parseInt(pointsToWithdraw) <= 0 || parseInt(pointsToWithdraw) > userPoints || loading || !!pixKeyError}
              className="flex-1 bg-gradient-to-r from-accent to-primary hover:from-accent/80 hover:to-primary/80"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <DollarSign className="w-4 h-4 mr-2" />
                  Solicitar Saque
                </>
              )}
            </Button>
          </div>

          <div className="text-xs text-muted-foreground bg-muted/20 p-3 rounded-lg">
            <p className="font-semibold mb-1">⚠️ Importante:</p>
            <p>• O processamento pode levar até 24h</p>
            <p>• Verificar se a chave PIX está correta</p>
            <p>• Valor mínimo: 1 ponto (R$ 0,50)</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};