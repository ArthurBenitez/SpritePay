import { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface TutorialOverlayProps {
  isVisible: boolean;
  targetSelector?: string | null;
  children?: ReactNode;
  onClick?: () => void;
}

export const TutorialOverlay = ({ 
  isVisible, 
  targetSelector, 
  children, 
  onClick 
}: TutorialOverlayProps) => {
  if (!isVisible) return null;

  const getTargetElement = () => {
    if (!targetSelector) return null;
    return document.querySelector(targetSelector);
  };

  const targetElement = getTargetElement();
  let targetRect = null;

  if (targetElement) {
    targetRect = targetElement.getBoundingClientRect();
  }

  const overlayElement = (
    <div className="fixed inset-0 z-[9999] pointer-events-auto">
      {/* Dark overlay with cutout for highlighted element */}
      <div 
        className="absolute inset-0 bg-black/70"
        onClick={onClick}
        style={{
          clipPath: targetRect 
            ? `polygon(0% 0%, 0% 100%, ${targetRect.left}px 100%, ${targetRect.left}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.top}px, ${targetRect.right}px ${targetRect.bottom}px, ${targetRect.left}px ${targetRect.bottom}px, ${targetRect.left}px 100%, 100% 100%, 100% 0%)`
            : 'none'
        }}
      />
      
      {/* Highlighted element border */}
      {targetRect && (
        <div
          className="absolute border-4 border-primary rounded-lg shadow-lg pointer-events-none animate-pulse"
          style={{
            left: targetRect.left - 6,
            top: targetRect.top - 6,
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            boxShadow: '0 0 0 2px hsl(var(--primary) / 0.3), 0 0 20px hsl(var(--primary) / 0.5)',
            minWidth: '40px',
            minHeight: '32px'
          }}
        />
      )}
      
      {/* Children content (tooltips, etc.) */}
      {children}
    </div>
  );

  return createPortal(overlayElement, document.body);
};