import { ReactNode } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';

interface MobileOptimizedModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  className?: string;
}

export const MobileOptimizedModal = ({ 
  isOpen, 
  onClose, 
  title, 
  children, 
  className = "" 
}: MobileOptimizedModalProps) => {
  const isMobile = useIsMobile();

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className={`
          ${isMobile 
            ? 'w-[95vw] h-[90vh] max-w-none max-h-none m-0 rounded-lg border border-primary/20' 
            : 'max-w-md'
          } 
          ${className}
        `}
      >
        <DialogHeader className={isMobile ? 'px-4 py-3 border-b border-border/50' : ''}>
          <DialogTitle className={`${isMobile ? 'text-lg text-center' : 'text-xl'}`}>
            {title}
          </DialogTitle>
        </DialogHeader>
        
        <div className={`
          ${isMobile 
            ? 'flex-1 overflow-y-auto px-4 py-3' 
            : 'max-h-[80vh] overflow-y-auto'
          }
        `}>
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
};