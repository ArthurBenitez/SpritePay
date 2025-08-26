import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Crown, Zap, Minus, Plus } from "lucide-react";
import type { Sprite } from "@/hooks/useSprites";

interface AdminSpriteControlsProps {
  sprite: Sprite;
  onBuy: (sprite: Sprite, quantity: number) => Promise<void>;
}

export const AdminSpriteControls = ({ sprite, onBuy }: AdminSpriteControlsProps) => {
  const [quantity, setQuantity] = useState(1);
  const [isLoading, setIsLoading] = useState(false);

  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1 && newQuantity <= 99) {
      setQuantity(newQuantity);
    }
  };

  const handleBuy = async () => {
    setIsLoading(true);
    try {
      await onBuy(sprite, quantity);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Admin Badge */}
      <Badge className="w-full justify-center bg-gradient-to-r from-yellow-500 to-orange-500 text-background font-bold">
        <Crown className="w-3 h-3 mr-1" />
        ADMIN MODE
      </Badge>

      {/* Quantity Controls */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuantityChange(quantity - 1)}
          disabled={quantity <= 1}
          className="w-8 h-8 p-0"
        >
          <Minus className="w-3 h-3" />
        </Button>
        
        <Input
          type="number"
          min="1"
          max="99"
          value={quantity}
          onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
          className="text-center h-8 w-16"
        />
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => handleQuantityChange(quantity + 1)}
          disabled={quantity >= 99}
          className="w-8 h-8 p-0"
        >
          <Plus className="w-3 h-3" />
        </Button>
      </div>

      {/* Buy Button */}
      <Button 
        onClick={handleBuy}
        disabled={isLoading}
        className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-background font-bold h-10"
      >
        {isLoading ? (
          "Comprando..."
        ) : (
          <>
            <Zap className="w-4 h-4 mr-2" />
            Comprar {quantity}x (ADMIN)
          </>
        )}
      </Button>

      <div className="text-xs text-center text-muted-foreground">
        Créditos ilimitados • Sem sorteio • {quantity}x {sprite.points} = {quantity * sprite.points} pontos
      </div>
    </div>
  );
};