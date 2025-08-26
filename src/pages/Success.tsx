import { useEffect, useState } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const Success = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [verified, setVerified] = useState(false);
  const [credits, setCredits] = useState(0);

  useEffect(() => {
    const verifyPayment = async () => {
      const sessionId = searchParams.get("session_id");
      
      if (!sessionId) {
        toast({
          title: "Erro",
          description: "ID da sessão não encontrado",
          variant: "destructive",
        });
        navigate("/");
        return;
      }

      try {
        const { data, error } = await supabase.functions.invoke('verify-payment', {
          body: { sessionId }
        });

        if (error) {
          throw error;
        }

        if (data?.success) {
          setVerified(true);
          setCredits(data.credits || 0);
          toast({
            title: "Pagamento confirmado!",
            description: `${data.credits} créditos adicionados à sua conta!`,
          });
        } else {
          toast({
            title: "Pagamento não confirmado",
            description: "Aguarde alguns instantes ou entre em contato com o suporte",
            variant: "destructive",
          });
        }
      } catch (error: any) {
        console.error("Error verifying payment:", error);
        toast({
          title: "Erro na verificação",
          description: "Falha ao verificar pagamento. Entre em contato com o suporte.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    verifyPayment();
  }, [searchParams, navigate, toast]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5"></div>
      
      <Card className="w-full max-w-md backdrop-blur border-primary/20 shadow-2xl relative z-10">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-bold text-center">
            {loading ? (
              <div className="flex items-center justify-center gap-2">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                Verificando pagamento...
              </div>
            ) : verified ? (
              <div className="flex items-center justify-center gap-2 text-green-600">
                <CheckCircle className="w-6 h-6" />
                Pagamento confirmado!
              </div>
            ) : (
              <div className="text-destructive">
                Erro na verificação
              </div>
            )}
          </CardTitle>
        </CardHeader>
        
        <CardContent className="space-y-4 text-center">
          {!loading && verified && (
            <div className="space-y-2">
              <p className="text-lg">
                <span className="font-bold text-primary">{credits} créditos</span> foram adicionados à sua conta!
              </p>
              <p className="text-muted-foreground">
                Agora você pode usar seus créditos para comprar sprites de jogadores.
              </p>
            </div>
          )}
          
          {!loading && (
            <Button 
              onClick={() => navigate("/")}
              className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80"
            >
              Voltar ao SpritePay
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Success;