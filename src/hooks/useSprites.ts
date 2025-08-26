import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Sprite {
  id: string;
  name: string;
  image: string;
  price: number;
  points: number;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
}

export interface SpriteWithQuantity extends Sprite {
  quantity: number;
  last_acquired: string;
}

export const useSprites = () => {
  const [sprites, setSprites] = useState<Sprite[]>([]);
  const [userSprites, setUserSprites] = useState<(Sprite & { acquired_at: string })[]>([]);
  const [userSpriteQuantities, setUserSpriteQuantities] = useState<SpriteWithQuantity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadSprites = async () => {
    try {
      const { data, error } = await supabase
        .from('sprites')
        .select('id, name, image, price, points, rarity')
        .order('price', { ascending: true });

      if (error) throw error;
      setSprites((data || []) as Sprite[]);
    } catch (error: any) {
      console.error('Error loading sprites:', error);
      toast({
        title: "❌ Erro",
        description: "Erro ao carregar sprites",
        variant: "destructive"
      });
    }
  };

  const loadUserSprites = async () => {
    if (!user) return;

    try {
      // Verificar se é admin
      const isUserAdmin = user.email === 'admin@imperium.com';
      setIsAdmin(isUserAdmin);

      // Carregar sprites tradicionais (para usuários normais)
      const { data, error } = await supabase
        .from('user_sprites')
        .select(`
          id,
          acquired_at,
          sprites (
            id,
            name,
            image,
            price,
            points,
            rarity
          )
        `)
        .eq('user_id', user.id);

      if (error) throw error;
      
      const userSpritesData = data?.map(item => {
        const sprite = item.sprites as any;
        return {
          id: sprite.id,
          name: sprite.name,
          image: sprite.image,
          price: sprite.price,
          points: sprite.points,
          rarity: sprite.rarity,
          acquired_at: item.acquired_at
        };
      }) || [];
      
      setUserSprites(userSpritesData);

      // Para admin, carregar também as quantidades de sprites
      if (isUserAdmin) {
        await loadUserSpriteQuantities();
      }
    } catch (error: any) {
      console.error('Error loading user sprites:', error);
    }
  };

  const loadUserSpriteQuantities = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase.rpc('get_user_sprite_quantities', {
        p_user_id: user.id
      });

      if (error) {
        console.error('Error loading sprite quantities:', error);
        return;
      }

      if (data && Array.isArray(data)) {
        const quantities = data.map((item: any) => ({
          id: item.sprite_id,
          name: item.sprite_name,
          image: item.sprite_image,
          price: item.sprite_price,
          points: item.sprite_points,
          rarity: item.sprite_rarity,
          quantity: item.quantity,
          last_acquired: item.last_acquired
        }));
        
        setUserSpriteQuantities(quantities);
      }
    } catch (error: any) {
      console.error('Error loading sprite quantities:', error);
    }
  };

  const buySprite = async (sprite: Sprite, quantity: number = 1) => {
    if (!user) return { success: false, error: 'Not authenticated' };

    try {
      // Verificar se é admin
      const isUserAdmin = user.email === 'admin@imperium.com';
      
      if (isUserAdmin) {
        // Modo admin: comprar múltiplas vezes se necessário
        let totalPointsEarned = 0;
        let successCount = 0;
        let errors: string[] = [];
        
        console.log(`[ADMIN] Iniciando compra de ${quantity}x ${sprite.name}`);
        
        for (let i = 0; i < quantity; i++) {
          console.log(`[ADMIN] Tentativa ${i + 1}/${quantity} para sprite ${sprite.id}`);
          
          const { data: result, error } = await supabase.rpc(
            'purchase_sprite_admin_mode', 
            {
              p_sprite_id: sprite.id,
              p_buyer_user_id: user.id
            }
          );

          if (error) {
            console.error(`[ADMIN] Erro RPC na tentativa ${i + 1}:`, error);
            errors.push(`Tentativa ${i + 1}: ${error.message}`);
            continue;
          }

          console.log(`[ADMIN] Resultado da tentativa ${i + 1}:`, result);

          const purchaseResult = result as {
            success: boolean;
            error?: string;
            admin_purchase?: boolean;
            no_lottery?: boolean;
            points_earned?: number;
            sprite_name?: string;
          };

          if (purchaseResult.success) {
            successCount++;
            totalPointsEarned += purchaseResult.points_earned || 0;
            console.log(`[ADMIN] Sucesso na tentativa ${i + 1}, total sucessos: ${successCount}`);
          } else {
            const errorMsg = purchaseResult.error || 'Erro desconhecido';
            console.error(`[ADMIN] Falha na tentativa ${i + 1}:`, errorMsg);
            errors.push(`Tentativa ${i + 1}: ${errorMsg}`);
          }
        }

        console.log(`[ADMIN] Resultado final: ${successCount}/${quantity} sucessos, erros:`, errors);

        if (successCount === 0) {
          const firstError = errors[0] || 'Erro desconhecido na compra admin';
          toast({
            title: "❌ Erro Admin",
            description: `Todas as compras falharam. ${firstError}`,
            variant: "destructive"
          });
          return { success: false, error: firstError };
        }

        if (successCount < quantity) {
          toast({
            title: "⚠️ Compra Parcial",
            description: `${successCount}/${quantity} ${sprite.name} adquiridos! +${totalPointsEarned} pontos! Alguns falharam: ${errors[0]}`,
            variant: "default"
          });
        } else {
          toast({
            title: "👑 ADMIN - Sprites Adquiridos!",
            description: `${successCount}x ${sprite.name} adquiridos! +${totalPointsEarned} pontos! (Sem sorteio, créditos ilimitados)`,
            variant: "default"
          });
        }

      } else {
        // Modo usuário normal: usar função com sorteio
        const { data: result, error } = await supabase.rpc(
          'purchase_sprite_with_lottery', 
          {
            p_sprite_id: sprite.id,
            p_buyer_user_id: user.id
          }
        );

        if (error) throw error;

        const purchaseResult = result as {
          success: boolean;
          error?: string;
          final_owner_id?: string;
          won_lottery?: boolean;
          points_earned?: number;
          sprite_name?: string;
        };

        if (!purchaseResult.success) {
          if (purchaseResult.error === 'Insufficient credits') {
            toast({
              title: "❌ Créditos insuficientes",
              description: "Compre mais créditos para adquirir este sprite.",
              variant: "destructive"
            });
          } else {
            toast({
              title: "❌ Erro",
              description: purchaseResult.error || "Erro ao comprar sprite",
              variant: "destructive"
            });
          }
          return { success: false, error: purchaseResult.error || 'Purchase failed' };
        }

        // Show success toast
        const wonLottery = purchaseResult.won_lottery;
        const pointsEarned = purchaseResult.points_earned || 0;
        
        toast({
          title: wonLottery ? "🎮 Sprite adquirido!" : "😔 Sprite perdido!",
          description: `${sprite.name} - ${wonLottery ? 'Você ganhou!' : 'Perdeu no sorteio'} +${pointsEarned} pontos!`,
          variant: wonLottery ? "default" : "destructive"
        });
      }

      // Reload user sprites and trigger profile reload
      await loadUserSprites();
      
      // Force profile reload to update points and credits
      window.dispatchEvent(new CustomEvent('profile-update'));

      return { success: true, error: null };
    } catch (error: any) {
      console.error('Error buying sprite:', error);
      toast({
        title: "❌ Erro",
        description: "Erro ao comprar sprite",
        variant: "destructive"
      });
      return { success: false, error: error.message };
    }
  };

  useEffect(() => {
    loadSprites().finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (user) {
      loadUserSprites();
    }
  }, [user]);

  return {
    sprites,
    userSprites,
    userSpriteQuantities,
    loading,
    buySprite,
    loadSprites,
    loadUserSprites,
    loadUserSpriteQuantities,
    isAdmin
  };
};
