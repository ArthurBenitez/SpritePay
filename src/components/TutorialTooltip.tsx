import { ReactNode, useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, X } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

interface TutorialTooltipProps {
  isVisible: boolean;
  targetSelector?: string | null;
  title: string;
  description: string;
  position?: 'top' | 'bottom' | 'left' | 'right' | 'auto';
  onNext?: () => void;
  onSkip?: () => void;
  nextButtonText?: string;
  showSkip?: boolean;
}

export const TutorialTooltip = ({
  isVisible,
  targetSelector,
  title,
  description,
  position = 'auto',
  onNext,
  onSkip,
  nextButtonText = 'Próximo',
  showSkip = true
}: TutorialTooltipProps) => {
  const isMobile = useIsMobile();

  const { tooltipStyle, arrowDirection } = useMemo(() => {
    if (!isVisible || !targetSelector) {
      return { tooltipStyle: {}, arrowDirection: 'up' as const };
    }

    console.log('Tutorial tooltip for selector:', targetSelector);
    const targetElement = document.querySelector(targetSelector);
    console.log('Target element found:', targetElement);
    
    if (!targetElement) {
      return { tooltipStyle: {}, arrowDirection: 'up' as const };
    }

    const targetRect = targetElement.getBoundingClientRect();
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;
    const tooltipWidth = isMobile ? Math.min(280, windowWidth - 24) : 320;
    const tooltipHeight = isMobile ? 180 : 160; // Adjust for mobile content
    
    console.log('Target rect:', targetRect);
    console.log('Window dimensions:', { windowWidth, windowHeight });

    let calculatedPosition = position;
    
    // Enhanced auto positioning logic for mobile
    if (position === 'auto') {
      const spaceAbove = targetRect.top;
      const spaceBelow = windowHeight - targetRect.bottom;
      const spaceLeft = targetRect.left;
      const spaceRight = windowWidth - targetRect.right;
      
      // Check if it's a small element like a badge
      const isSmallElement = targetRect.width < 100 || targetRect.height < 50;
      console.log('Element is small:', isSmallElement, 'Size:', { width: targetRect.width, height: targetRect.height });

      if (isMobile) {
        // Special handling for floating button (bottom-right)
        if (targetSelector.includes('buy-credits-final')) {
          // For floating button, always show tooltip above and to the left
          calculatedPosition = spaceAbove >= tooltipHeight ? 'top' : 'left';
        } 
        // CONSISTENT POSITIONING: Force both credits and points badges to show below with arrow-up
        else if (targetSelector.includes('credits-badge') || targetSelector.includes('points-badge')) {
          console.log('Handling badge positioning with forced consistency...');
          // Always position badges below for consistency
          calculatedPosition = 'bottom';
        } 
        // General handling for other small elements like badges
        else if (isSmallElement && targetSelector.includes('badge')) {
          console.log('Handling other badge positioning...');
          // For other badges, prefer positions that don't obstruct the badge
          if (spaceBelow >= tooltipHeight + 30) {
            calculatedPosition = 'bottom';
          } else if (spaceAbove >= tooltipHeight + 30) {
            calculatedPosition = 'top';
          } else if (spaceRight >= tooltipWidth + 20) {
            calculatedPosition = 'right';
          } else if (spaceLeft >= tooltipWidth + 20) {
            calculatedPosition = 'left';
          } else {
            calculatedPosition = 'bottom'; // Fallback
          }
        } else {
          // For other elements, prefer positions that don't cover content
          if (spaceBelow >= tooltipHeight + 20) calculatedPosition = 'bottom';
          else if (spaceAbove >= tooltipHeight + 20) calculatedPosition = 'top';
          else calculatedPosition = 'bottom'; // Fallback with scroll
        }
      } else {
        // Desktop positioning
        if (spaceBelow >= tooltipHeight) calculatedPosition = 'bottom';
        else if (spaceAbove >= tooltipHeight) calculatedPosition = 'top';
        else if (spaceRight >= tooltipWidth) calculatedPosition = 'right';
        else if (spaceLeft >= tooltipWidth) calculatedPosition = 'left';
        else calculatedPosition = 'bottom';
      }
    }

    console.log('Calculated position:', calculatedPosition);

    let top = 0;
    let left = 0;
    let arrowDir: 'up' | 'down' | 'left' | 'right' = 'up';

    switch (calculatedPosition) {
      case 'top':
        top = targetRect.top - tooltipHeight - 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        arrowDir = 'down';
        // Special adjustment for floating button
        if (targetSelector.includes('buy-credits-final') && isMobile) {
          left = targetRect.left - tooltipWidth + 20;
        }
        break;
      case 'bottom':
        top = targetRect.bottom + 20;
        left = targetRect.left + (targetRect.width / 2) - (tooltipWidth / 2);
        arrowDir = 'up';
        // Enhanced adjustment for mobile badges to ensure consistency and visibility
        if (isMobile && targetSelector.includes('badge')) {
          top = targetRect.bottom + 35; // Extra space for mobile badges
          // Center better for small badges
          if (targetSelector.includes('credits-badge') || targetSelector.includes('points-badge')) {
            // Ensure tooltip doesn't go off-screen on mobile
            const minLeft = 12;
            const maxLeft = windowWidth - tooltipWidth - 12;
            left = Math.max(minLeft, Math.min(left, maxLeft));
          }
        }
        break;
      case 'left':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.left - tooltipWidth - 20;
        arrowDir = 'right';
        // Special adjustment for floating button
        if (targetSelector.includes('buy-credits-final') && isMobile) {
          top = targetRect.top - tooltipHeight + targetRect.height;
        }
        break;
      case 'right':
        top = targetRect.top + (targetRect.height / 2) - (tooltipHeight / 2);
        left = targetRect.right + 20;
        arrowDir = 'left';
        // Special adjustment for badges
        if (targetSelector.includes('badge') && isMobile) {
          left = targetRect.right + 30; // More space for badges
        }
        break;
    }

    // Enhanced viewport constraints for mobile
    const padding = isMobile ? 12 : 16;
    left = Math.max(padding, Math.min(left, windowWidth - tooltipWidth - padding));
    top = Math.max(padding, Math.min(top, windowHeight - tooltipHeight - padding));

    console.log('Final tooltip position:', { top, left, arrowDir });

    return {
      tooltipStyle: {
        position: 'fixed' as const,
        top,
        left,
        width: tooltipWidth,
        zIndex: 10000,
      },
      arrowDirection: arrowDir
    };
  }, [isVisible, targetSelector, position, isMobile]);

  if (!isVisible) return null;

  const ArrowIcon = {
    up: ArrowUp,
    down: ArrowDown, 
    left: ArrowLeft,
    right: ArrowRight
  }[arrowDirection];

  return (
    <Card 
      className="shadow-2xl border-primary/50 bg-background/95 backdrop-blur-sm"
      style={tooltipStyle}
    >
      <CardContent className={`${isMobile ? 'p-3' : 'p-4'}`}>
        <div className={`space-y-${isMobile ? '3' : '4'}`}>
          {/* Header with arrow and title */}
          <div className="flex items-center gap-2">
            <div className={`flex-shrink-0 ${isMobile ? 'w-6 h-6' : 'w-8 h-8'} bg-primary/10 rounded-full flex items-center justify-center`}>
              <ArrowIcon className={`${isMobile ? 'w-3 h-3' : 'w-4 h-4'} text-primary animate-bounce`} />
            </div>
            <h3 className={`font-semibold ${isMobile ? 'text-base' : 'text-lg'}`}>{title}</h3>
          </div>

          {/* Description */}
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>

          {/* Action buttons */}
          <div className={`flex gap-2 ${isMobile ? 'flex-col' : ''}`}>
            {showSkip && (
              <Button
                variant="outline"
                onClick={onSkip}
                size="sm"
                className={`${isMobile ? 'w-full h-9 text-xs' : 'flex-1'}`}
              >
                <X className="w-3 h-3 mr-1" />
                Pular
              </Button>
            )}
            
            <Button
              onClick={onNext}
              size="sm"
              className={`${isMobile ? 'w-full h-9 text-xs' : 'flex-1'} ${!showSkip ? 'w-full' : ''}`}
            >
              {nextButtonText}
              <ArrowRight className="w-3 h-3 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};