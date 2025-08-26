import { useEffect, useState } from 'react';
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

        // Validação ultra segura do dispositivo
        const { data, error } = await supabase.rpc('validate_device_ultra_secure', {
          p_device_fingerprint: fingerprint,
          p_ip_address: '127.0.0.1', // Será substituído por IP real em produção
          p_user_agent: navigator.userAgent,
          p_localstorage_hash: localStorageHash,
          p_browser_fingerprint: browserFingerprint
        });

        if (error) {
          console.error('Erro na validação ultra segura:', error);
          setCanClaimFreeCredits(false);
          return;
        }

        const validationResult = data as any;
        setRiskScore(validationResult.risk_score || 0);
        
        if (abuseDetection.suspicious) {
          console.warn('Padrões de abuso detectados:', abuseDetection.reasons);
          setCanClaimFreeCredits(false);
          
          toast({
            title: "🛡️ Segurança",
            description: "Atividade suspeita detectada. Créditos gratuitos bloqueados por segurança.",
            variant: "destructive"
          });
          return;
        }

        const canClaim = validationResult.can_claim_credits && validationResult.risk_score < 50;
        setCanClaimFreeCredits(canClaim);

        if (!canClaim && validationResult.risk_score >= 50) {
          toast({
            title: "🛡️ Proteção Anti-Abuso",
            description: `Atividade suspeita detectada (Score: ${validationResult.risk_score}). Créditos bloqueados.`,
            variant: "destructive"
          });
        }

      } catch (error) {
        console.error('Erro na inicialização ultra segura:', error);
        setCanClaimFreeCredits(false);
      }
    };

    initializeUltraSecureDevice();
  }, [toast]);

  const markCreditsAsClaimed = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Gerar dados de segurança atualizados
      const browserFingerprint = generateAdvancedBrowserFingerprint();
      const localStorageHash = generateLocalStorageHash();

      // Usar função ultra segura de reivindicação
      const { data, error } = await supabase.rpc('claim_free_credits_ultra_secure', {
        p_device_fingerprint: deviceFingerprint,
        p_ip_address: '127.0.0.1', // Será substituído por IP real em produção
        p_user_agent: navigator.userAgent,
        p_localstorage_hash: localStorageHash,
        p_browser_fingerprint: browserFingerprint
      });

      if (error) {
        console.error('Erro ao reivindicar créditos ultra seguros:', error);
        toast({
          title: "❌ Erro de Segurança",
          description: "Erro na validação de segurança. Tente novamente.",
          variant: "destructive"
        });
        return;
      }

      const result = data as any;
      
      if (!result.success) {
        const errorMsg = result.error || "Não foi possível conceder créditos";
        const riskInfo = result.risk_score ? ` (Score de risco: ${result.risk_score})` : '';
        
        toast({
          title: "❌ Créditos Bloqueados",
          description: errorMsg + riskInfo,
          variant: "destructive"
        });
        return;
      }

      // Marcar no localStorage também
      markLocalCreditsAsClaimed();
      setCanClaimFreeCredits(false);
      
      const adminNote = result.admin_override ? " (Admin Override)" : "";
      const securityNote = result.risk_score < 20 ? " 🛡️ Segurança verificada!" : "";
      
      toast({
        title: "✅ Créditos Concedidos!" + adminNote,
        description: `${result.credits_granted} créditos adicionados com máxima segurança!${securityNote}`,
      });

    } catch (error) {
      console.error('Erro na reivindicação de créditos:', error);
      toast({
        title: "❌ Erro Inesperado",
        description: "Erro inesperado no sistema de segurança",
        variant: "destructive"
      });
    }
  };

  return {
    canClaimFreeCredits,
    markCreditsAsClaimed,
    deviceFingerprint,
    isAdmin,
    riskScore
  };
};