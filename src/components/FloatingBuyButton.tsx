import { ShoppingCart, Coins, QrCode } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PixPaymentModal } from './PixPaymentModal';

interface FloatingBuyButtonProps {
  onBuyCredits: (amount: number) => Promise<void>;
}

export const FloatingBuyButton = ({ onBuyCredits }: FloatingBuyButtonProps) => {
  const isMobile = useIsMobile();
  const [isOpen, setIsOpen] = useState(false);
  const [customAmount, setCustomAmount] = useState("");
  const [isPixModalOpen, setIsPixModalOpen] = useState(false);
  const [pixCredits, setPixCredits] = useState(0);

  const predefinedAmounts = [4];

  const handleBuyCredits = async (amount: number) => {
    await onBuyCredits(amount);
    setIsOpen(false);
    setCustomAmount("");
  };

  const handleCustomBuy = async () => {
    const amount = parseInt(customAmount);
    if (amount > 0) {
      await handleBuyCredits(amount);
    }
  };

  const handlePixPayment = (amount: number) => {
    setPixCredits(amount);
    setIsPixModalOpen(true);
  };

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50" data-tutorial="buy-credits-final">
        <Button 
          size="lg"
          className="rounded-full w-16 h-16 p-0 floating-buy-button bg-gradient-to-r from-primary to-secondary hover:from-primary/90 hover:to-secondary/90 shadow-lg border-2 border-white/20"
          onClick={() => setIsOpen(true)}
        >
          <ShoppingCart className="w-6 h-6 cart-icon" />
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-[600px] w-[95%] max-w-md mx-auto sm:max-w-[600px]">
          <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Coins className="w-6 h-6 text-primary" />
            Comprar Créditos
          </DialogTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Use seus créditos para investir em sprites e participar de sorteios
          </p>
          </DialogHeader>
          
          <div className="space-y-6">
            {/* Predefined amounts */}
            <div className="grid grid-cols-1 gap-4">
              {predefinedAmounts.map((amount) => (
                <Card key={amount} className="border-primary/20 hover:border-primary/40 transition-all duration-300 cursor-pointer" onClick={() => handleBuyCredits(amount)}>
                  <CardContent className="p-4 text-center">
                  <Coins className="w-8 h-8 mx-auto mb-2 text-primary" />
                  <h3 className="text-lg font-bold mb-1">{amount} Créditos</h3>
                  <p className="text-xs text-muted-foreground mb-2">Para investir em sprites</p>
                  <p className="text-sm font-semibold text-accent mb-3">R$ {amount},00</p>
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleBuyCredits(amount);
                      }}
                      className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80"
                      size="sm"
                    >
                      Comprar via Stripe
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Custom amount */}
            <Card className="border-secondary/20">
              <CardHeader>
                <CardTitle className="text-base">Quantidade Personalizada</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="custom-amount">Quantidade de créditos</Label>
                  <Input
                    id="custom-amount"
                    type="number"
                    placeholder="Digite a quantidade..."
                    value={customAmount}
                    onChange={(e) => setCustomAmount(e.target.value)}
                    min="1"
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
                {customAmount && parseInt(customAmount) > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Total: R$ {parseInt(customAmount)},00
                  </p>
                )}
                <div className="flex gap-2">
                  <Button 
                    onClick={handleCustomBuy}
                    disabled={!customAmount || parseInt(customAmount) <= 0}
                    className="flex-1 bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80"
                  >
                    Comprar via Stripe
                  </Button>
                  <Button 
                    onClick={() => {
                      const amount = parseInt(customAmount);
                      if (amount > 0) {
                        handlePixPayment(amount);
                      }
                    }}
                    disabled={!customAmount || parseInt(customAmount) <= 0}
                    variant="outline" 
                    className="flex-1 border-primary text-primary hover:bg-primary/10"
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    PIX
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </DialogContent>
      </Dialog>

      <PixPaymentModal
        isOpen={isPixModalOpen}
        onClose={() => setIsPixModalOpen(false)}
        credits={pixCredits}
      />
    </>
  );
};