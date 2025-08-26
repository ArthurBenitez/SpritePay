import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useToast } from '@/hooks/use-toast';

export interface Profile {
  id: string;
  user_id: string;
  name: string;
  credits: number;
  points: number;
  tutorial_views: number;
  tutorial_skipped: boolean;
  created_at: string;
  updated_at: string;
  tutorial_completed: boolean;
}

export const useProfile = () => {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const loadProfile = async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', user.id)
        .single();

      if (error) throw error;
      setProfile(data);
    } catch (error: any) {
      console.error('Error loading profile:', error);
      
      // If profile doesn't exist, it might be created by the trigger
      // Let's wait a moment and try again
      setTimeout(async () => {
        try {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', user.id)
            .single();

          if (!error && data) {
            setProfile(data);
          }
        } catch (retryError) {
          console.error('Retry error loading profile:', retryError);
        }
      }, 1000);
    } finally {
      setLoading(false);
    }
  };

  const buyCredits = async (amount: number) => {
    try {
      if (!user) {
        toast({
          title: "Erro",
          description: "Usuário não autenticado",
          variant: "destructive",
        });
        return;
      }

      // Call Stripe payment function
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { credits: amount }
      });

      if (error) {
        throw error;
      }

      if (data?.url) {
        // Open Stripe checkout in a new tab
        window.open(data.url, '_blank');
        
        toast({
          title: "Redirecionando...",
          description: "Você será redirecionado para o pagamento no Stripe",
        });
      } else {
        throw new Error("No checkout URL received");
      }

    } catch (error: any) {
      console.error("Error creating payment:", error);
      toast({
        title: "Erro",
        description: "Falha ao processar pagamento. Tente novamente.",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    loadProfile();

    // Set up realtime subscription for profile changes
    if (user) {
      const channel = supabase
        .channel('profile_changes')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'profiles',
            filter: `user_id=eq.${user.id}`
          },
          (payload) => {
            console.log('Profile updated:', payload);
            if (payload.eventType === 'UPDATE' && payload.new) {
              setProfile(payload.new as Profile);
            }
          }
        )
        .subscribe();

      // Listen for custom profile update events
      const handleProfileUpdate = () => {
        loadProfile();
      };
      
      window.addEventListener('profile-update', handleProfileUpdate);

      return () => {
        supabase.removeChannel(channel);
        window.removeEventListener('profile-update', handleProfileUpdate);
      };
    }
  }, [user]);

  return {
    profile,
    loading,
    buyCredits,
    loadProfile
  };
};