import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Zap, Eye, EyeOff, Users, Gift } from "lucide-react";
import { ForgotPasswordModal } from "@/components/ForgotPasswordModal";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { isValidReferralCode } from "@/lib/url";
import logoMark from "@/assets/logo-mark.svg";

const Signup = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [isLogin, setIsLogin] = useState(false);
  const [emailOrUsername, setEmailOrUsername] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { user, signUp, signIn, signInWithGoogle, checkUsernameAvailable } = useAuth();
  const { toast } = useToast();
  
  // Extract referral code from URL
  const referralCode = searchParams.get('ref');
  const isValidReferral = referralCode ? isValidReferralCode(referralCode) : false;
  
  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const checkUsername = async (usernameValue: string) => {
    if (usernameValue.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    
    const available = await checkUsernameAvailable(usernameValue);
    setUsernameAvailable(available);
  };

  const handleSignUp = async () => {
    // Basic validation before attempting signup
    if (!name.trim()) {
      toast({
        title: "❌ Erro",
        description: "Por favor, insira seu nome completo.",
        variant: "destructive"
      });
      return;
    }
    
    if (!email.trim()) {
      toast({
        title: "❌ Erro", 
        description: "Por favor, insira seu email.",
        variant: "destructive"
      });
      return;
    }
    
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      toast({
        title: "❌ Erro",
        description: "Por favor, insira um email válido.",
        variant: "destructive"
      });
      return;
    }

    if (!username.trim()) {
      toast({
        title: "❌ Erro",
        description: "Por favor, escolha um nome de usuário.",
        variant: "destructive"
      });
      return;
    }

    if (username.length < 3) {
      toast({
        title: "❌ Erro",
        description: "O nome de usuário deve ter pelo menos 3 caracteres.",
        variant: "destructive"
      });
      return;
    }

    if (usernameAvailable === false) {
      toast({
        title: "❌ Erro",
        description: "Este nome de usuário já está em uso.",
        variant: "destructive"
      });
      return;
    }
    
    if (password.length < 6) {
      toast({
        title: "❌ Erro",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive"
      });
      return;
    }
    
    const result = await signUp(email, password, name, username, referralCode || undefined);
    if (!result.error) {
      navigate('/');
    }
  };

  const handleSignIn = async () => {
    if (!emailOrUsername.trim()) {
      toast({
        title: "❌ Erro",
        description: "Por favor, insira seu email ou nome de usuário.",
        variant: "destructive"
      });
      return;
    }

    if (password.length < 6) {
      toast({
        title: "❌ Erro",
        description: "A senha deve ter pelo menos 6 caracteres.",
        variant: "destructive"
      });
      return;
    }

    const result = await signIn(emailOrUsername, password);
    if (!result.error) {
      navigate('/');
    }
  };

  const handleGoogleSignUp = async () => {
    // Store referral code for after OAuth
    if (referralCode && isValidReferral) {
      localStorage.setItem('pending_referral_code', referralCode);
    }
    await signInWithGoogle();
  };

  const toggleMode = () => {
    setIsLogin(!isLogin);
    // Clear form fields when switching modes
    setEmail("");
    setEmailOrUsername("");
    setPassword("");
    setName("");
    setUsername("");
    setUsernameAvailable(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5"></div>
      
      <Card className="w-full max-w-md backdrop-blur border-primary/20 shadow-2xl relative z-10">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent flex items-center justify-center">
            <img src={logoMark} alt="SpritePay Logo" className="inline-block w-8 h-8 mr-2" />
            SpritePay
          </CardTitle>
          <p className="text-muted-foreground">
            {isLogin ? 'Entre em sua conta' : 'Compre, invista, indique, lucre'}
          </p>
          
          {/* Referral invitation banner */}
          {referralCode && isValidReferral && (
            <Alert className="border-green-500/50 bg-green-500/10 text-green-700 dark:text-green-300">
              <Gift className="h-4 w-4" />
              <AlertDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span>Você foi convidado por um amigo! Ganhe créditos extras ao se cadastrar!</span>
              </AlertDescription>
            </Alert>
          )}
        </CardHeader>
        
        <CardContent className="space-y-4">
          {!isLogin ? (
            // Signup Form
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome completo</Label>
                <Input
                  id="name"
                  placeholder="Seu nome completo"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="border-primary/20 focus:border-primary"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="border-primary/20 focus:border-primary"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Nome de usuário</Label>
                <Input
                  id="username"
                  placeholder="Escolha um nome único"
                  value={username}
                  onChange={(e) => {
                    setUsername(e.target.value);
                    checkUsername(e.target.value);
                  }}
                  className={`border-primary/20 focus:border-primary ${
                    usernameAvailable === false ? 'border-red-500' : 
                    usernameAvailable === true ? 'border-green-500' : ''
                  }`}
                  required
                />
                {username.length >= 3 && (
                  <p className={`text-sm ${
                    usernameAvailable === false ? 'text-red-500' : 
                    usernameAvailable === true ? 'text-green-500' : 'text-muted-foreground'
                  }`}>
                    {usernameAvailable === false ? '❌ Nome de usuário já está em uso' : 
                     usernameAvailable === true ? '✅ Nome de usuário disponível' : 
                     'Verificando disponibilidade...'}
                  </p>
                )}
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Crie uma senha segura"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-primary/20 focus:border-primary pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            // Login Form
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emailOrUsername">Usuário ou email</Label>
                <Input
                  id="emailOrUsername"
                  placeholder="Digite seu usuário ou email"
                  value={emailOrUsername}
                  onChange={(e) => setEmailOrUsername(e.target.value)}
                  className="border-primary/20 focus:border-primary"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="loginPassword">Senha</Label>
                <div className="relative">
                  <Input
                    id="loginPassword"
                    type={showPassword ? "text" : "password"}
                    placeholder="Digite sua senha"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="border-primary/20 focus:border-primary pr-10"
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}
          
          <Button 
            onClick={isLogin ? handleSignIn : handleSignUp} 
            className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-primary-foreground font-semibold py-3 transition-all duration-300 transform hover:scale-105"
            disabled={isLogin ? 
              (!emailOrUsername.trim() || password.length < 6) : 
              (!name.trim() || !email.trim() || !username.trim() || password.length < 6 || usernameAvailable === false)
            }
          >
            <Zap className="w-4 h-4 mr-2" />
            {isLogin ? 'Entrar' : 'Criar Conta'}
          </Button>

          <div className="flex items-center gap-4 my-4">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">OU</span>
            <Separator className="flex-1" />
          </div>

          <Button
            onClick={handleGoogleSignUp}
            variant="outline"
            className="w-full border-primary/20 hover:bg-primary/5 py-3"
          >
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continuar com Google
          </Button>
          
          <div className="text-center mt-6">
            <Button
              type="button"
              variant="link"
              className="text-sm text-primary hover:underline"
              onClick={toggleMode}
            >
              {isLogin ? 'Não tem conta? Cadastre-se' : 'Já tem uma conta? Faça login'}
            </Button>
            
            {isLogin && (
              <Button
                type="button"
                variant="link"
                className="text-sm text-muted-foreground hover:underline block mx-auto mt-2"
                onClick={() => setShowForgotPassword(true)}
              >
                Esqueceu a senha?
              </Button>
            )}
          </div>
          
          <ForgotPasswordModal
            isOpen={showForgotPassword}
            onClose={() => setShowForgotPassword(false)}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;