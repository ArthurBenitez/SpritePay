import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Copy, QrCode, Clock, CheckCircle2 } from "lucide-react";

interface PixPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  credits: number;
}

interface PixData {
  payment_id: string;
  qr_code_base64: string;
  qr_code: string;
  ticket_url: string;
  status: string;
  transaction_amount: number;
}

export const PixPaymentModal = ({ isOpen, onClose, credits }: PixPaymentModalProps) => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cpf: ""
  });
  const [pixData, setPixData] = useState<PixData | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const { toast } = useToast();

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3');
  };

  const handleInputChange = (field: string, value: string) => {
    let formattedValue = value;
    
    if (field === 'cpf') {
      formattedValue = formatCPF(value).slice(0, 14);
    } else if (field === 'phone') {
      formattedValue = formatPhone(value).slice(0, 15);
    }
    
    setFormData(prev => ({ ...prev, [field]: formattedValue }));
  };

  const validateForm = () => {
    const { name, email, phone, cpf } = formData;
    
    if (!name.trim()) return "Nome é obrigatório";
    if (!email.trim()) return "Email é obrigatório";
    if (!email.includes('@')) return "Email inválido";
    if (!phone.trim()) return "Telefone é obrigatório";
    if (phone.replace(/\D/g, '').length !== 11) return "Telefone deve ter 11 dígitos";
    if (!cpf.trim()) return "CPF é obrigatório";
    if (cpf.replace(/\D/g, '').length !== 11) return "CPF deve ter 11 dígitos";
    
    return null;
  };

  const generatePixPayment = async () => {
    const validationError = validateForm();
    if (validationError) {
      toast({
        title: "Erro de validação",
        description: validationError,
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-pix-payment', {
        body: {
          credits,
          payer_name: formData.name,
          payer_email: formData.email,
          payer_phone: formData.phone.replace(/\D/g, ''),
          payer_cpf: formData.cpf.replace(/\D/g, '')
        }
      });

      if (error) throw error;

      if (data?.success) {
        setPixData(data);
        toast({
          title: "PIX gerado com sucesso!",
          description: "Escaneie o QR Code ou copie o código PIX para pagar",
        });
        
        // Start verification polling
        startPaymentVerification(data.payment_id);
      } else {
        throw new Error(data?.error || "Erro ao gerar PIX");
      }
    } catch (error: any) {
      console.error("Error generating PIX:", error);
      const errorMessage = error?.message || "Falha ao gerar PIX. Tente novamente.";
      toast({
        title: "Erro",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const startPaymentVerification = (paymentId: string) => {
    setVerifying(true);
    
    const verifyPayment = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('verify-pix-payment', {
          body: { payment_id: paymentId }
        });

        if (error) throw error;

        if (data?.success) {
          toast({
            title: "Pagamento aprovado! 🎉",
            description: `${data.credits} créditos foram adicionados à sua conta!`,
          });
          
          // Trigger profile update
          window.dispatchEvent(new CustomEvent('profile-update'));
          
          handleClose();
          return true;
        }
        
        return false;
      } catch (error) {
        console.error("Error verifying payment:", error);
        return false;
      }
    };

    // Check every 5 seconds for up to 30 minutes
    const maxAttempts = 360; // 30 minutes / 5 seconds
    let attempts = 0;
    
    const intervalId = setInterval(async () => {
      attempts++;
      
      const isApproved = await verifyPayment();
      
      if (isApproved || attempts >= maxAttempts) {
        clearInterval(intervalId);
        setVerifying(false);
        
        if (attempts >= maxAttempts) {
          toast({
            title: "Tempo esgotado",
            description: "Verificação de pagamento encerrada. Se você pagou, os créditos serão adicionados em breve.",
            variant: "destructive",
          });
        }
      }
    }, 5000);
  };

  const copyPixCode = () => {
    if (pixData?.qr_code) {
      navigator.clipboard.writeText(pixData.qr_code);
      toast({
        title: "Copiado!",
        description: "Código PIX copiado para a área de transferência",
      });
    }
  };

  const handleClose = () => {
    setFormData({ name: "", email: "", phone: "", cpf: "" });
    setPixData(null);
    setLoading(false);
    setVerifying(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <QrCode className="w-6 h-6 text-primary" />
            Pagamento via PIX
          </DialogTitle>
          <DialogDescription>
            Complete os dados abaixo para gerar seu código PIX
          </DialogDescription>
        </DialogHeader>

        {!pixData ? (
          <div className="space-y-4">
            <Card className="border-primary/20">
              <CardHeader>
                <CardTitle className="text-base">
                  {credits} Créditos - R$ {credits},00
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome completo</Label>
                  <Input
                    id="name"
                    type="text"
                    placeholder="Digite seu nome completo"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="border-primary/20 focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={formData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="border-primary/20 focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone</Label>
                  <Input
                    id="phone"
                    type="text"
                    placeholder="(11) 99999-9999"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="border-primary/20 focus:border-primary"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpf">CPF</Label>
                  <Input
                    id="cpf"
                    type="text"
                    placeholder="000.000.000-00"
                    value={formData.cpf}
                    onChange={(e) => handleInputChange('cpf', e.target.value)}
                    className="border-primary/20 focus:border-primary"
                  />
                </div>

                <Button 
                  onClick={generatePixPayment}
                  disabled={loading}
                  className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80"
                >
                  {loading ? "Gerando PIX..." : "Gerar PIX"}
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="border-primary/20">
              <CardContent className="p-6 text-center space-y-4">
                {verifying && (
                  <div className="flex items-center justify-center gap-2 text-amber-600 mb-4">
                    <Clock className="w-4 h-4 animate-spin" />
                    <span className="text-sm">Aguardando pagamento...</span>
                  </div>
                )}

                {pixData.qr_code_base64 && (
                  <div className="flex justify-center">
                    <img 
                      src={`data:image/png;base64,${pixData.qr_code_base64}`}
                      alt="QR Code PIX"
                      className="border border-gray-300 rounded"
                    />
                  </div>
                )}

                <div className="space-y-2">
                  <Label>Código PIX (copie e cole no seu banco)</Label>
                  <div className="flex gap-2">
                    <Input
                      value={pixData.qr_code}
                      readOnly
                      className="text-xs font-mono"
                    />
                    <Button
                      onClick={copyPixCode}
                      variant="outline"
                      size="sm"
                      className="px-3"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• Abra o app do seu banco</p>
                  <p>• Vá em PIX → Pagar</p>
                  <p>• Escaneie o QR Code ou cole o código</p>
                  <p>• Confirme o pagamento</p>
                </div>

                <div className="bg-muted/50 p-3 rounded text-sm">
                  <strong>Valor: R$ {pixData.transaction_amount.toFixed(2)}</strong>
                </div>

                {verifying && (
                  <p className="text-xs text-muted-foreground">
                    Verificando pagamento automaticamente...
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};