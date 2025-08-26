import { useTutorial, TutorialStep } from '@/hooks/useTutorial';
import { TutorialOverlay } from '@/components/TutorialOverlay';
import { TutorialTooltip } from '@/components/TutorialTooltip';
import { MobileOptimizedModal } from '@/components/MobileOptimizedModal';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

const TUTORIAL_CONTENT: Record<TutorialStep, {
  type: 'modal' | 'tooltip';
  title: string;
  description: string;
  targetSelector?: string;
  nextButtonText?: string;
}> = {
  welcome: {
    type: 'modal',
    title: 'Bem vindo(a) à SpritePay!',
    description: 'Esse é seu guia para você começar a investir e ganhar!',
    nextButtonText: 'Começar tutorial'
  },
  'navigation-tabs': {
    type: 'tooltip',
    title: 'Navegação Principal',
    description: 'Aqui é onde você pode investir, trocar seus pontos por dinheiro e ganhar indicando amigos!',
    targetSelector: '[data-tutorial="navigation-tabs"]',
    nextButtonText: 'Entendi'
  },
  'credits-badge': {
    type: 'tooltip',
    title: 'Seus Créditos',
    description: 'Aqui você pode ver quantos créditos tem',
    targetSelector: '[data-tutorial="credits-badge"]',
    nextButtonText: 'Próximo'
  },
  'buy-credits-button': {
    type: 'tooltip',
    title: 'Comprar Créditos',
    description: 'Use este botão flutuante para comprar créditos quando precisar',
    targetSelector: '[data-tutorial="buy-credits-final"]',
    nextButtonText: 'Entendi'
  },
  'buy-sprite': {
    type: 'tooltip',
    title: 'Comprar Sprites',
    description: 'Você pode usar esses créditos para comprar sprites',
    targetSelector: '[data-tutorial="yamal-sprite"]',
    nextButtonText: 'Entendi'
  },
  'points-explanation': {
    type: 'modal',
    title: 'Sistema de Pontos',
    description: 'Quando você investe em sprites, ganha pontos automaticamente. Esses pontos podem ser trocados por dinheiro real!',
    nextButtonText: 'Próximo'
  },
  complete: {
    type: 'modal',
    title: 'Parabéns!',
    description: 'Agora você já sabe como usar a plataforma. Comece a investir e ganhar dinheiro!',
    nextButtonText: 'Começar a investir'
  }
};

export const InteractiveTutorial = () => {
  const {
    isActive,
    isVisible,
    currentStep,
    nextStep,
    skipTutorial,
    completeTutorial
  } = useTutorial();

  const isMobile = useIsMobile();

  if (!isActive || !isVisible) return null;

  const stepContent = TUTORIAL_CONTENT[currentStep];

  if (stepContent.type === 'modal') {
    return (
      <MobileOptimizedModal
        isOpen={true}
        onClose={skipTutorial}
        title=""
        className={isMobile ? "p-0" : "max-w-lg"}
      >
        <Card className="border-0 shadow-none bg-transparent">
          <CardHeader className="text-center space-y-4 pb-4">
            {/* Welcome emoji */}
            <div className="text-6xl mb-4">
              {currentStep === 'welcome' ? '🎉' : '✨'}
            </div>

            {/* Title */}
            <CardTitle className="text-2xl font-bold text-primary">
              {stepContent.title}
            </CardTitle>
          </CardHeader>

          <CardContent className="space-y-6 text-center">
            {/* Description */}
            <p className="text-muted-foreground leading-relaxed text-lg">
              {stepContent.description}
            </p>

            {/* Action button */}
            <div className="flex gap-3 pt-4">
              {currentStep !== 'complete' && (
                <Button
                  variant="outline"
                  onClick={skipTutorial}
                  className="flex-1"
                >
                  Pular tutorial
                </Button>
              )}
              
              <Button
                onClick={currentStep === 'complete' ? completeTutorial : nextStep}
                className="flex-1"
              >
                <ArrowRight className="w-4 h-4 mr-2" />
                {stepContent.nextButtonText || 'Próximo'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </MobileOptimizedModal>
    );
  }

  // Tooltip step
  return (
    <>
      <TutorialOverlay
        isVisible={true}
        targetSelector={stepContent.targetSelector}
        onClick={nextStep}
      />
      
      <TutorialTooltip
        isVisible={true}
        targetSelector={stepContent.targetSelector}
        title={stepContent.title}
        description={stepContent.description}
        onNext={nextStep}
        onSkip={skipTutorial}
        nextButtonText={stepContent.nextButtonText}
        showSkip={true}
      />
    </>
  );
};