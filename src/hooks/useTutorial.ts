import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { supabase } from '@/integrations/supabase/client';

export type TutorialStep = 
  | 'welcome'
  | 'navigation-tabs'
  | 'credits-badge'
  | 'buy-credits-button'
  | 'buy-sprite'
  | 'points-explanation'
  | 'complete';

export const useTutorial = () => {
  const [isActive, setIsActive] = useState(false);
  const [currentStep, setCurrentStep] = useState<TutorialStep>('welcome');
  const [isVisible, setIsVisible] = useState(false);
  
  const { user } = useAuth();
  const { profile } = useProfile();

  // Tutorial steps configuration
  const steps: TutorialStep[] = [
    'welcome',
    'navigation-tabs',
    'credits-badge',
    'buy-credits-button', 
    'buy-sprite',
    'points-explanation',
    'complete'
  ];

  // Check if tutorial should be shown
  useEffect(() => {
    if (!user || !profile) return;
    
    // Show tutorial if user has seen it less than 2 times
    if (profile.tutorial_views < 2) {
      setTimeout(() => {
        setIsActive(true);
        setIsVisible(true);
        setCurrentStep('welcome');
      }, 2000);
    }
  }, [user, profile]);

  // Move to next step
  const nextStep = useCallback(() => {
    const currentIndex = steps.indexOf(currentStep);
    const nextStepIndex = currentIndex + 1;
    
    if (nextStepIndex < steps.length) {
      const nextStepName = steps[nextStepIndex];
      setCurrentStep(nextStepName);
      
      // Auto-scroll for Yamal sprite step
      if (nextStepName === 'buy-sprite') {
        setTimeout(() => {
          const yamalElement = document.querySelector('[data-tutorial="yamal-sprite"]');
          if (yamalElement) {
            yamalElement.scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center',
              inline: 'center'
            });
          }
        }, 300);
      }
    } else {
      completeTutorial();
    }
  }, [currentStep, steps]);

  // Complete tutorial
  const completeTutorial = useCallback(async () => {
    if (profile && user) {
      await supabase
        .from('profiles')
        .update({ tutorial_views: profile.tutorial_views + 1 })
        .eq('user_id', user.id);
      
      window.dispatchEvent(new CustomEvent('profile-update'));
    }
    
    setIsActive(false);
    setIsVisible(false);
    setCurrentStep('welcome');
  }, [profile, user]);

  // Skip tutorial
  const skipTutorial = useCallback(() => {
    completeTutorial();
  }, [completeTutorial]);

  return {
    isActive,
    isVisible,
    currentStep,
    nextStep,
    skipTutorial,
    completeTutorial,
    stepIndex: steps.indexOf(currentStep),
    totalSteps: steps.length
  };
};