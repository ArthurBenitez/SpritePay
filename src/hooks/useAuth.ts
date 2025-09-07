import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useSecureAuth } from '@/hooks/useSecureAuth';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const { toast } = useToast();
  const { canClaimFreeCredits, markCreditsAsClaimed, isAdmin: isSecureAdmin } = useSecureAuth();

  const cleanupAuthState = () => {
    // Remove all Supabase auth keys from localStorage
    Object.keys(localStorage).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        localStorage.removeItem(key);
      }
    });
    // Remove from sessionStorage if in use
    Object.keys(sessionStorage || {}).forEach((key) => {
      if (key.startsWith('supabase.auth.') || key.includes('sb-')) {
        sessionStorage.removeItem(key);
      }
    });
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        if (event === 'SIGNED_IN') {
          // Defer data fetching to prevent deadlocks
          setTimeout(() => {
            // Any additional user data fetching can be done here
          }, 0);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) { 
        setIsAdmin(false); 
        return; 
      }
      
      // Verificar por email primeiro (admin@imperium.com)
      if (user.email === 'admin@imperium.com') {
        setIsAdmin(true);
        return;
      }
      
      // Verificar por role no banco
      const { data } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id);
      setIsAdmin(!!data?.some((r: { role: string }) => r.role === 'admin'));
    };
    checkAdmin();
  }, [user]);

  const signUp = async (email: string, password: string, name: string, username?: string, referralCode?: string) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      // Check if there's already a session (user is logged in)
      const { data: currentSession } = await supabase.auth.getSession();
      if (currentSession.session) {
        toast({
          title: "❌ Erro",
          description: "Você já está logado. Faça logout antes de criar uma nova conta.",
          variant: "destructive"
        });
        return { error: new Error("User already logged in") };
      }

      const userData: any = {
        name,
        claimed_free_credits: canClaimFreeCredits ? 'false' : 'true'
      };

      // Add username to user metadata if provided
      if (username) {
        userData.username = username;
      }

      // Add referral code to user metadata if provided (using 'ref' key)
      if (referralCode) {
        userData.ref = referralCode;
      }

      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: userData
        }
      });

      if (error) {
        console.error('Error signing up:', error);
        
        // Provide more specific error messages
        let errorMessage = error.message;
        if (error.message.includes('User already registered') || error.message.includes('already exists')) {
          errorMessage = "Este email já está cadastrado. Tente fazer login ou use outro email.";
        } else if (error.message.includes('Password') || error.message.includes('password')) {
          errorMessage = "A senha deve ter pelo menos 6 caracteres.";
        } else if (error.message.includes('Email') || error.message.includes('email')) {
          errorMessage = "Por favor, insira um email válido.";
        } else if (error.message.includes('weak')) {
          errorMessage = "A senha é muito fraca. Use pelo menos 6 caracteres.";
        }
        
        toast({
          title: "❌ Erro ao cadastrar",  
          description: errorMessage,
          variant: "destructive"
        });
        return { error };
      }

      // Use secure device-based credit tracking
      if (canClaimFreeCredits && data.user) {
        // Credits will be granted after user confirmation via the secure hook
        setTimeout(() => {
          markCreditsAsClaimed();
        }, 1000);
      }

      toast({
        title: "✅ Conta criada!",
        description: canClaimFreeCredits 
          ? "Conta criada com sucesso! 4 créditos gratuitos foram adicionados!"
          : "Conta criada com sucesso! Você já utilizou seus créditos gratuitos neste dispositivo.",
      });

      return { data, error: null };
    } catch (error: any) {
      console.error('Error signing up:', error);
      toast({
        title: "❌ Erro no cadastro",
        description: error.message || "Erro inesperado ao processar cadastro. Tente novamente.",
        variant: "destructive"
      });
      return { error };
    }
  };

  const signIn = async (emailOrUsername: string, password: string) => {
    try {
      cleanupAuthState();
      
      // Attempt global sign out
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Continue even if this fails
      }

      // Lookup user identity to get email if username was provided
      const { data: lookupData, error: lookupError } = await supabase.rpc('lookup_login_identity', {
        identifier: emailOrUsername
      });

      if (lookupError) throw lookupError;

      const lookupResult = lookupData as { exists: boolean; email: string | null } | null;
      const emailToUse = lookupResult?.exists ? lookupResult.email || emailOrUsername : emailOrUsername;

      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password,
      });

      if (error) throw error;

      toast({
        title: "🎮 Login realizado!",
        description: emailToUse === 'admin@imperium.com' ? "Bem-vindo, Admin!" : "Bem-vindo ao SpritePay!",
      });

      return { data, error: null };
    } catch (error: any) {
      let errorMessage = "Erro no login";
      
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = "Usuário/email ou senha incorretos";
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = "Confirme seu email antes de fazer login";
      }

      toast({
        title: "❌ Erro no login",
        description: errorMessage,
        variant: "destructive"
      });
      return { data: null, error };
    }
  };

  const checkUsernameAvailable = async (username: string) => {
    try {
      const { data, error } = await supabase.rpc('check_username_available', {
        username_input: username
      });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Error checking username availability:', error);
      return false;
    }
  };

  const signOut = async () => {
    try {
      cleanupAuthState();
      
      try {
        await supabase.auth.signOut({ scope: 'global' });
      } catch (err) {
        // Ignore errors
      }

      toast({
        title: "👋 Logout realizado",
        description: "Até logo!",
      });

      // Force page reload for a clean state
      window.location.href = '/';
    } catch (error: any) {
      toast({
        title: "❌ Erro no logout",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const resetPassword = async (email: string) => {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;

      toast({
        title: "📧 Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });

      return { error: null };
    } catch (error: any) {
      console.error('Error resetting password:', error);
      toast({
        title: "❌ Erro ao enviar email",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast({
        title: "✅ Senha atualizada!",
        description: "Sua senha foi alterada com sucesso.",
      });

      return { error: null };
    } catch (error: any) {
      console.error('Error updating password:', error);
      toast({
        title: "❌ Erro ao alterar senha",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`
        }
      });

      if (error) throw error;

      return { error: null };
    } catch (error: any) {
      console.error('Error signing in with Google:', error);
      toast({
        title: "❌ Erro no login com Google",
        description: error.message,
        variant: "destructive"
      });
      return { error };
    }
  };

  return {
    user,
    session,
    loading,
    isAdmin,
    signUp,
    signIn,
    signOut,
    resetPassword,
    updatePassword,
    signInWithGoogle,
    checkUsernameAvailable,
    canClaimFreeCredits
  };
};
