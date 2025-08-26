import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { X, ArrowRight, Zap, TrendingUp, DollarSign } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { MobileOptimizedModal } from '@/components/MobileOptimizedModal';

interface QuickTourProps {
  onComplete?: () => void;
}

type TutorialStep = 'welcome' | 'how-it-works' | 'getting-started' | 'complete';

const TUTORIAL_CONTENT = {
  welcome: {
    icon: '🎮',
    title: 'Bem-vindo ao SpritePay!',
    description: 'A plataforma onde você investe em jogadores lendários e ganha dinheiro real.',
    buttonText: 'Começar Tutorial'
  },
  'how-it-works': {
    icon: '⚡',
    title: 'Como Funciona',
    description: 'Compre créditos, invista em sprites de jogadores famosos e acumule pontos que podem ser trocados por dinheiro via PIX.',
    features: [
      { icon: Zap, text: 'Compre créditos facilmente' },
      { icon: TrendingUp, text: 'Invista em jogadores' },
      { icon: DollarSign, text: 'Ganhe pontos e dinheiro' }
    ],
    buttonText: 'Entendi!'
  },
  'getting-started': {
    icon: '🎯',
    title: 'Onde Encontrar Tudo',
    description: 'Localize as funcionalidades principais da plataforma:',
    features: [
      { icon: Zap, text: '💰 COMPRAR CRÉDITOS: Botão flutuante azul no canto inferior direito (mobile) ou clique nos seus créditos no topo' },
      { icon: DollarSign, text: '💸 TROCAR PONTOS: Vá na aba "Inventário" e clique no botão "Trocar Pontos" para sacar via PIX' },
      { icon: TrendingUp, text: '🎮 INVESTIR: Clique em qualquer jogador na aba "Jogadores" para comprá-lo com seus créditos' }
    ],
    buttonText: 'Agora entendi!'
  },
  complete: {
    icon: '✨',
    title: 'Pronto para Começar!',
    description: 'Você já sabe onde encontrar tudo! Lembre-se: botão flutuante para comprar créditos e aba Inventário para trocar pontos.',
    buttonText: 'Entrar na plataforma'
  }
};

export const QuickTour = ({ onComplete }: QuickTourProps) => {
  const [currentStep, setCurrentStep] = useState<TutorialStep>('welcome');
  const [isVisible, setIsVisible] = useState(false);
  const { user } = useAuth();
  const { profile } = useProfile();
  const isMobile = useIsMobile();

  // Show tutorial only for users who haven't seen it much
  useEffect(() => {
    if (!user || !profile) return;
    
    if (profile.tutorial_views >= 2) {
      setIsVisible(false);
      return;
    }

    // Small delay to ensure page is loaded
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 1000);

    return () => clearTimeout(timer);
  }, [user, profile]);

  const handleClose = async () => {
    if (profile && user) {
      await supabase
        .from('profiles')
        .update({ tutorial_views: profile.tutorial_views + 1 })
        .eq('user_id', user.id);
      
      window.dispatchEvent(new CustomEvent('profile-update'));
    }
    setIsVisible(false);
    onComplete?.();
  };

  const handleNext = () => {
    const steps: TutorialStep[] = ['welcome', 'how-it-works', 'getting-started', 'complete'];
    const currentIndex = steps.indexOf(currentStep);
    const nextStep = steps[currentIndex + 1];
    
    if (nextStep) {
      setCurrentStep(nextStep);
    } else {
      handleClose();
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  if (!isVisible || !user) return null;

  const stepData = TUTORIAL_CONTENT[currentStep];
  const stepNumber = Object.keys(TUTORIAL_CONTENT).indexOf(currentStep) + 1;
  const totalSteps = Object.keys(TUTORIAL_CONTENT).length;

  return (
    <MobileOptimizedModal
      isOpen={isVisible}
      onClose={handleClose}
      title=""
      className={isMobile ? "p-0" : "max-w-lg"}
    >
      <Card className="border-0 shadow-none bg-transparent">
        <CardHeader className="text-center space-y-4 pb-4">
          {/* Close button */}
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClose}
              className="h-8 w-8 p-0"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-1 mb-4">
            {Array.from({ length: totalSteps }, (_, i) => (
              <div
                key={i}
                className={`h-2 w-8 rounded-full transition-colors ${
                  i < stepNumber ? 'bg-primary' : 'bg-muted'
                }`}
              />
            ))}
          </div>

          {/* Icon */}
          <div className="text-6xl mb-4">
            {stepData.icon}
          </div>

          {/* Title */}
          <CardTitle className="text-2xl font-bold text-primary">
            {stepData.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-6 text-center">
          {/* Description */}
          <p className="text-muted-foreground leading-relaxed">
            {stepData.description}
          </p>

          {/* Features list */}
          {'features' in stepData && stepData.features && (
            <div className="space-y-3">
              {stepData.features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <div key={index} className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="flex-shrink-0 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <span className="text-sm text-left flex-1">{feature.text}</span>
                  </div>
                );
              })}
            </div>
          )}

          {/* Navigation buttons */}
          <div className={`flex gap-3 pt-4 ${isMobile ? 'flex-col' : ''}`}>
            {currentStep !== 'welcome' && (
              <Button
                variant="outline"
                onClick={handleSkip}
                className={isMobile ? 'w-full' : 'flex-1'}
              >
                Pular tutorial
              </Button>
            )}
            
            <Button
              onClick={currentStep === 'complete' ? handleClose : handleNext}
              className={`${isMobile ? 'w-full' : 'flex-1'} ${
                currentStep === 'welcome' ? 'w-full' : ''
              }`}
            >
              {currentStep === 'complete' ? (
                <>
                  <ArrowRight className="w-4 h-4 mr-2" />
                  {stepData.buttonText}
                </>
              ) : (
                stepData.buttonText
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </MobileOptimizedModal>
  );
};