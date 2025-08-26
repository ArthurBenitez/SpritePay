import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { 
  generateDeviceFingerprint, 
  generateAdvancedBrowserFingerprint,
  generateLocalStorageHash,
  checkCreditsAlreadyClaimed,
  markCreditsAsClaimed as markLocalCreditsAsClaimed,
  detectLocalStorageAbuse
} from '@/lib/security';
import { useToast } from '@/hooks/use-toast';

interface SecureAuthResult {
  canClaimFreeCredits: boolean;
  markCreditsAsClaimed: () => Promise<void>;
  deviceFingerprint: string;
  isAdmin: boolean;
  riskScore: number;
}

export const useSecureAuth = (): SecureAuthResult => {
  const [canClaimFreeCredits, setCanClaimFreeCredits] = useState(false);
  const [deviceFingerprint, setDeviceFingerprint] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);
  const [riskScore, setRiskScore] = useState(0);
  const { toast } = useToast();

  const markCreditsAsClaimed = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Usar o novo sistema de avaliação de créditos
      const { data, error } = await supabase.rpc('evaluate_initial_credits', {
        p_user_id: user.id,
        p_device_fingerprint: deviceFingerprint,
        p_ip_address: '127.0.0.1', // Será substituído por IP real em produção
        p_user_agent: navigator.userAgent
      });

      if (error) {
        console.error('Erro na avaliação de créditos:', error);
        toast({
          title: "❌ Erro de Segurança",
          description: "Erro na validação de segurança. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      const result = data as any;
      
      if (!result.success) {
        toast({
          title: "❌ Erro na Avaliação",
          description: result.reason || "Erro na avaliação de créditos",
          variant: "destructive"
        });
        return;
      }

      // Marcar no localStorage se créditos foram concedidos
      if (result.credits_granted) {
        markLocalCreditsAsClaimed();
      }
      setCanClaimFreeCredits(false);
      
      // Mostrar resultado da avaliação
      if (result.credits_granted) {
        toast({
          title: "🎉 Créditos Concedidos!",
          description: result.reason,
        });
      } else {
        toast({
          title: result.is_eligible ? "📋 Conta Válida" : "🛡️ Verificação de Segurança",
          description: result.reason,
          variant: result.is_eligible ? "default" : "destructive"
        });
      }

    } catch (error) {
      console.error('Erro na avaliação de créditos:', error);
      toast({
        title: "❌ Erro Inesperado",
        description: "Erro inesperado no sistema de avaliação",
        variant: "destructive"
      });
    }
  }, [deviceFingerprint, toast]);

  useEffect(() => {
    const initializeUltraSecureDevice = async () => {
      try {
        // Check if user is authenticated first
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          console.log('User not authenticated, skipping security validation');
          setCanClaimFreeCredits(false);
          return;
        }

        // Verificação prévia do localStorage
        const localStorageCheck = checkCreditsAlreadyClaimed();
        const abuseDetection = detectLocalStorageAbuse();
        
        if (localStorageCheck && !abuseDetection.suspicious) {
          console.log('Créditos já foram reivindicados neste dispositivo (localStorage)');
          setCanClaimFreeCredits(false);
          return;
        }

        // Gerar múltiplos fingerprints
        const fingerprint = generateDeviceFingerprint();
        const browserFingerprint = generateAdvancedBrowserFingerprint();
        const localStorageHash = generateLocalStorageHash();
        
        setDeviceFingerprint(fingerprint);

        // Verificar se é admin
        if (user?.email === 'admin@imperium.com') {
          setIsAdmin(true);
          setCanClaimFreeCredits(true); // Admin sempre pode obter créditos para testes
          return;
        }

        // For new system, we just set up the device fingerprint
        // Credits will be evaluated after tutorial completion
        setCanClaimFreeCredits(true);

      } catch (error) {
        console.error('Erro na inicialização ultra segura:', error);
        setCanClaimFreeCredits(false);
      }
    };

    initializeUltraSecureDevice();

    // Listen for credit evaluation trigger
    const handleEvaluateCredits = () => {
      if (deviceFingerprint) {
        markCreditsAsClaimed();
      }
    };

    window.addEventListener('evaluate-initial-credits', handleEvaluateCredits);

    return () => {
      window.removeEventListener('evaluate-initial-credits', handleEvaluateCredits);
    };
  }, [toast, deviceFingerprint, markCreditsAsClaimed]);

  return {
    canClaimFreeCredits,
    markCreditsAsClaimed,
    deviceFingerprint,
    isAdmin,
    riskScore
  };
};