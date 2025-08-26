import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Zap, Coins, Package, Bell, Settings, Crown, Eye, EyeOff, DollarSign, Loader2, Menu } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { ForgotPasswordModal } from "@/components/ForgotPasswordModal";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSprites, type Sprite } from "@/hooks/useSprites";
import { useReferralProcessing } from "@/hooks/useReferralProcessing";
import { extractReferralCode } from "@/lib/url";

import { WithdrawModal } from "@/components/WithdrawModal";
import { AdminDashboard } from "@/components/AdminDashboard";
import { InteractiveTutorial } from "@/components/InteractiveTutorial";
import { FloatingBuyButton } from "@/components/FloatingBuyButton";
import { ReferralSection } from "@/components/ReferralSection";
import { ReferralDebugPanel } from "@/components/ReferralDebugPanel";
import { AdminSpriteControls } from "@/components/AdminSpriteControls";
import { useIsMobile } from "@/hooks/use-mobile";

// Import cyberpunk player images
import ronaldoImage from "@/assets/ronaldo-cyberpunk.jpg";
import neymarImage from "@/assets/neymar-cyberpunk.jpg";
import messiImage from "@/assets/messi-cyberpunk.jpg";
import mbappeImage from "@/assets/mbappe-cyberpunk.jpg";
import haalandImage from "@/assets/haaland-cyberpunk.jpg";
import lewandowskiImage from "@/assets/lewandowski-cyberpunk.jpg";
import viniciusImage from "@/assets/vinicius-cyberpunk.jpg";
import yamalImage from "@/assets/yamal-cyberpunk.jpg";
import logoMark from "@/assets/logo-mark.svg";

const Index = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [activeTab, setActiveTab] = useState("sprites");
  const [showWithdrawDialog, setShowWithdrawDialog] = useState(false);
  const [withdrawPoints, setWithdrawPoints] = useState("");
  const [pixKey, setPixKey] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);

  const { user, loading: authLoading, signUp, signIn, signOut, signInWithGoogle, isAdmin } = useAuth();
  const { profile, loading: profileLoading, buyCredits: handleBuyCredits, loadProfile } = useProfile();
  const { sprites, userSprites, userSpriteQuantities, loading: spritesLoading, buySprite: handleBuySprite, isAdmin: isSpriteAdmin } = useSprites();
  const isMobile = useIsMobile();
  
  // Initialize referral processing
  useReferralProcessing();

  // Image mapping for sprites
  const imageMap: Record<string, string> = {
    'Cristiano Ronaldo': ronaldoImage,
    'Neymar': neymarImage,
    'Lionel Messi': messiImage,
    'Kylian Mbappé': mbappeImage,
    'Erling Haaland': haalandImage,
    'Robert Lewandowski': lewandowskiImage,
    'Vinícius Jr': viniciusImage,
    'Lamine Yamal': yamalImage,
  };

  const handleAuth = async () => {
    if (isLogin) {
      await signIn(email, password);
    } else {
      // Extract referral code from URL for signUp
      const referralCode = extractReferralCode();
      await signUp(email, password, name, referralCode);
    }
  };

  const buyCredits = async (amount: number) => {
    await handleBuyCredits(amount);
  };

  const buySprite = async (sprite: Sprite, quantity: number = 1) => {
    await handleBuySprite(sprite, quantity);
  };

  if (authLoading || profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-background/50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="text-xl">Carregando...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-background/50 flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5"></div>
        
        <Card className="w-full max-w-md backdrop-blur border-primary/20 shadow-2xl relative z-10" data-tutorial="auth-form">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent flex items-center justify-center">
              <img src={logoMark} alt="SpritePay Logo" className="inline-block w-8 h-8 mr-2" />
              SpritePay
            </CardTitle>
            <p className="text-muted-foreground">Compre, invista, indique, lucre</p>
          </CardHeader>
          
          <CardContent className="space-y-4">
            <Tabs value={isLogin ? "login" : "register"} className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login" onClick={() => setIsLogin(true)}>
                  Login
                </TabsTrigger>
                 <TabsTrigger value="register" onClick={() => setIsLogin(false)} data-tutorial="register-tab">
                   Cadastro
                 </TabsTrigger>
              </TabsList>
              
              <TabsContent value="login" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-primary/20 focus:border-primary pr-10"
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
                   <div className="text-center">
                     <Button
                       type="button"
                       variant="link"
                       className="text-sm text-primary hover:underline"
                       onClick={() => setShowForgotPassword(true)}
                     >
                       Esqueci minha senha
                     </Button>
                   </div>
                 </div>
               </TabsContent>
              
              <TabsContent value="register" className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome</Label>
                  <Input
                    id="name"
                    placeholder="Seu nome"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email-reg">Email</Label>
                  <Input
                    id="email-reg"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="border-primary/20 focus:border-primary"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password-reg">Senha</Label>
                  <div className="relative">
                    <Input
                      id="password-reg"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="border-primary/20 focus:border-primary pr-10"
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
                  <div className="text-center">
                    <Button
                      type="button"
                      variant="link"
                      className="text-sm text-primary hover:underline"
                      onClick={() => setShowForgotPassword(true)}
                    >
                      Esqueci minha senha
                    </Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
            
            <Button 
              onClick={handleAuth} 
              className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-primary-foreground font-semibold py-3 transition-all duration-300 transform hover:scale-105"
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
              onClick={signInWithGoogle}
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
            
            <ForgotPasswordModal
              isOpen={showForgotPassword}
              onClose={() => setShowForgotPassword(false)}
            />
            
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/50">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5"></div>
      
      {/* Mobile-First Header */}
      <header className="relative z-10 border-b border-border/50 backdrop-blur-sm bg-background/80">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          {/* Top row - Logo and user actions */}
          <div className="flex items-center justify-between mb-3 sm:mb-0">
            <div className="flex items-center gap-2 sm:gap-3">
              <img 
                src={logoMark} 
                alt="SpritePay Logo" 
                className="w-6 h-6 sm:w-8 sm:h-8" 
              />
              <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
                SpritePay
              </h1>
            </div>
            
            {/* Desktop actions */}
            <div className="hidden sm:flex items-center gap-4">
            <div className="flex items-center gap-3">
                <Button
                  variant="secondary"
                  className="px-3 py-1 gap-2 hover:bg-primary/20 transition-colors"
                  onClick={() => buyCredits(4)}
                  data-tutorial="buy-credits-button"
                >
                  <Coins className="w-4 h-4" />
                  {isSpriteAdmin ? (
                    <span className="hidden md:inline">∞ créditos (ADMIN)</span>
                  ) : (
                    <>
                      <span className="hidden md:inline">{profile?.credits || 0} créditos</span>
                      <span className="md:hidden">{profile?.credits || 0}</span>
                    </>
                  )}
                  <Zap className="w-3 h-3 ml-1" />
                </Button>
                <Badge variant="outline" className="px-3 py-1 gap-2 border-accent/50" data-tutorial="points-badge">
                  <Package className="w-4 h-4" />
                  <span className="hidden md:inline">{profile?.points || 0} pontos</span>
                  <span className="md:hidden">{profile?.points || 0}</span>
                </Badge>
              </div>
              
              <div className="flex items-center gap-2">
                <NotificationBell />
              </div>
              
              <Button variant="outline" onClick={signOut} className="border-destructive/50 hover:bg-destructive/10">
                Sair
              </Button>
            </div>

            {/* Mobile stats and menu */}
            <div className="flex items-center gap-1 sm:hidden">
              {/* Mobile stats badges - compact */}
              <Badge variant="secondary" className="px-2 py-1 gap-1 text-xs" data-tutorial="credits-badge">
                <Coins className="w-3 h-3" />
                {isSpriteAdmin ? '∞' : (profile?.credits || 0)}
                {isSpriteAdmin && <Crown className="w-3 h-3 ml-1" />}
              </Badge>
              <Badge variant="outline" className="px-2 py-1 gap-1 border-accent/50 text-xs" data-tutorial="points-badge">
                <Package className="w-3 h-3" />
                {profile?.points || 0}
              </Badge>
              
              <div className="flex items-center gap-1">
                <NotificationBell />
                
                <Button 
                  variant="outline" 
                  onClick={signOut} 
                  className="h-8 px-2 text-xs border-destructive/50 hover:bg-destructive/10"
                >
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="relative z-10 container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Welcome message for tutorial - only visible during welcome step */}
        <div data-tutorial="welcome-message" className="sr-only">
          Tutorial Welcome Message
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
          <TabsList className={`grid w-full ${isAdmin ? 'grid-cols-4' : 'grid-cols-3'} bg-card/50 backdrop-blur border border-border/50 h-12 sm:h-10`} data-tutorial="navigation-tabs">
            <TabsTrigger value="sprites" className="text-xs sm:text-sm py-2 sm:py-3 px-2 sm:px-4 data-[state=active]:bg-primary/20">
              <Package className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Jogadores</span>
              <span className="sm:hidden">Jgrs</span>
            </TabsTrigger>
            <TabsTrigger value="inventory" className="text-xs sm:text-sm py-2 sm:py-3 px-2 sm:px-4 data-[state=active]:bg-secondary/20">
              <Package className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Inventário</span>
              <span className="sm:hidden">Inv</span>
            </TabsTrigger>
            <TabsTrigger value="referrals" className="text-xs sm:text-sm py-2 sm:py-3 px-2 sm:px-4 data-[state=active]:bg-accent/20">
              <Zap className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Indique e ganhe</span>
              <span className="sm:hidden">Ind</span>
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="admin" className="text-xs sm:text-sm py-2 sm:py-3 px-2 sm:px-4 data-[state=active]:bg-destructive/20">
                <Settings className="w-4 h-4 mr-1 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
                <span className="sm:hidden">Adm</span>
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent value="sprites" className="space-y-4 sm:space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Seção de Investimentos
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground px-4">
                Use seus créditos para investir em sprites abaixo e concorrer a sorteios
              </p>
            </div>

            {spritesLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
                {sprites.map((sprite) => {
                  const isOwned = userSprites.some(us => us.id === sprite.id);
                  const imageSrc = imageMap[sprite.name] || sprite.image;
                  
                  return (
                    <Card
                      key={sprite.id}
                      className="group hover:scale-105 transition-all duration-300 border-border/50 bg-card/50 backdrop-blur overflow-hidden"
                      data-tutorial={sprite.name === 'Lamine Yamal' ? 'yamal-sprite' : ''}
                    >
                    <div className="relative aspect-[3/4] overflow-hidden">
                      <img 
                        src={imageSrc}
                        alt={sprite.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                      
                      {/* Rarity badge */}
                      <Badge 
                        className={`absolute top-2 right-2 font-bold text-xs ${
                          sprite.rarity === 'legendary' ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-background' :
                          sprite.rarity === 'epic' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-background' :
                          sprite.rarity === 'rare' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-background' :
                          'bg-gradient-to-r from-gray-500 to-gray-600 text-background'
                        }`}
                      >
                        {sprite.rarity}
                      </Badge>
                      
                      {isOwned && (
                        <Badge className="absolute top-2 left-2 bg-green-500 text-background font-bold text-xs">
                          ✓ Possui
                        </Badge>
                      )}
                    </div>
                    
                    <CardHeader className="space-y-2 p-3 sm:p-6">
                      <CardTitle className="text-lg sm:text-xl bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                        {sprite.name}
                      </CardTitle>
                      <div className="flex items-center justify-between">
                        <Badge variant="secondary" className="gap-1 text-xs">
                          <Coins className="w-3 h-3" />
                          {sprite.price}
                        </Badge>
                        <Badge variant="outline" className="gap-1 border-accent/50 text-xs">
                          <Package className="w-3 h-3" />
                          +{sprite.points}
                        </Badge>
                      </div>
                    </CardHeader>
                    
                    <CardContent className="p-3 sm:p-6 pt-0">
                      {isSpriteAdmin ? (
                        <AdminSpriteControls sprite={sprite} onBuy={buySprite} />
                      ) : (
                        <Button 
                          onClick={() => buySprite(sprite)}
                          disabled={isOwned || !profile || profile.credits < sprite.price}
                          className={`w-full transition-all duration-300 h-10 sm:h-11 text-sm ${
                            isOwned 
                              ? 'bg-green-500 hover:bg-green-600' 
                              : 'bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80'
                          }`}
                          data-tutorial={sprite.name === 'Lamine Yamal' ? 'yamal-buy-button' : ''}
                        >
                          {isOwned ? (
                            <>
                              <Crown className="w-4 h-4 mr-2" />
                              <span className="hidden sm:inline">Adquirido</span>
                              <span className="sm:hidden">✓</span>
                            </>
                          ) : !profile || profile.credits < sprite.price ? (
                            <>
                              <Coins className="w-4 h-4 mr-1 sm:mr-2" />
                              <span className="hidden sm:inline">Créditos insuficientes</span>
                              <span className="sm:hidden">Sem créditos</span>
                            </>
                          ) : (
                            <>
                              <Zap className="w-4 h-4 mr-1 sm:mr-2" />
                              <span className="hidden sm:inline">Comprar Sprite</span>
                              <span className="sm:hidden">Comprar</span>
                            </>
                          )}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="inventory" className="space-y-4 sm:space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                Seu Inventário
              </h2>
              <p className="text-sm sm:text-base text-muted-foreground px-4">
                Sprites que você possui e seus pontos acumulados
              </p>
            </div>
            
            {/* Informative message about sprites conversion */}
            <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4 text-center">
              <p className="text-green-600 dark:text-green-400 font-medium text-sm">
                💰 Sprites que sumirem do seu inventário foram convertidos em pontos extras para saque, e você pode comprar o sprite novamente!
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
              {/* Points Section - MAIN FEATURE */}
              <div className="lg:col-span-1" data-tutorial="withdraw-section">
                <Card className="border-primary/50 bg-gradient-to-br from-primary/5 to-secondary/5 backdrop-blur relative">
                  <div className="absolute -top-2 -right-2 bg-primary text-primary-foreground text-xs font-bold px-2 py-1 rounded-full animate-pulse">
                    PRINCIPAL
                  </div>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                      <DollarSign className="w-5 h-5 text-green-500" />
                      💸 Troca de Pontos (PIX)
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">Funcionalidade principal para sacar dinheiro</p>
                  </CardHeader>
                  <CardContent className="space-y-4 p-4 sm:p-6 pt-0">
                    <div className="p-4 bg-gradient-to-r from-green-500/20 to-emerald-500/20 border-2 border-green-500/30 rounded-lg">
                      <div className="text-center">
                        <div className="text-2xl sm:text-3xl font-bold text-green-400">{profile?.points || 0}</div>
                        <div className="text-sm text-muted-foreground">Pontos disponíveis</div>
                        <div className="text-lg sm:text-xl font-semibold text-green-300 mt-2">
                          = R$ {((profile?.points || 0) * 0.5).toFixed(2)}
                        </div>
                      </div>
                    </div>
                    
                    <div className="bg-gradient-to-r from-primary/10 to-secondary/10 p-3 rounded-lg text-center">
                      <p className="text-xs font-medium text-primary">🎯 AQUI você troca pontos por dinheiro real!</p>
                      <p className="text-xs text-muted-foreground">1 ponto = R$ 0,50 • Saque via PIX</p>
                    </div>
                    
                    <WithdrawModal 
                      userPoints={profile?.points || 0} 
                      onWithdrawSuccess={() => {
                        loadProfile();
                      }}
                    />
                  </CardContent>
                </Card>
              </div>

              {/* Owned Sprites */}
              <div className="lg:col-span-2">
                <h3 className="text-lg sm:text-xl font-semibold mb-4 text-center lg:text-left flex items-center gap-2">
                  {isSpriteAdmin ? (
                    <>
                      <Crown className="w-5 h-5 text-yellow-500" />
                      Inventório Admin ({userSpriteQuantities.length} únicos)
                    </>
                  ) : (
                    `Sprites Adquiridos (${userSprites.length})`
                  )}
                </h3>
                
                {/* Show admin quantities or regular sprites */}
                {isSpriteAdmin ? (
                  userSpriteQuantities.length === 0 ? (
                    <Card className="border-border/50 bg-card/50 backdrop-blur">
                      <CardContent className="py-8 sm:py-12 text-center p-4 sm:p-6">
                        <Crown className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-yellow-500/50 mb-4" />
                        <p className="text-muted-foreground text-sm sm:text-base">Nenhum sprite no inventário admin</p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                          Use seus créditos ilimitados para adquirir sprites!
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {userSpriteQuantities.map((spriteQty) => {
                        const imageSrc = imageMap[spriteQty.name] || spriteQty.image;
                        
                        return (
                          <Card key={spriteQty.id} className="border-yellow-500/50 bg-gradient-to-br from-yellow-500/5 to-orange-500/5 backdrop-blur overflow-hidden">
                            <div className="relative aspect-[4/3] overflow-hidden">
                              <img 
                                src={imageSrc}
                                alt={spriteQty.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                              
                              <Badge className="absolute top-2 right-2 bg-yellow-500 text-background font-bold text-xs">
                                👑 ADMIN
                              </Badge>
                              
                              <Badge className="absolute top-2 left-2 bg-gradient-to-r from-purple-500 to-pink-500 text-background font-bold text-xs">
                                Qtd: {spriteQty.quantity}
                              </Badge>
                            </div>
                            
                            <CardHeader className="pb-2 p-3 sm:p-6">
                              <CardTitle className="text-base sm:text-lg bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
                                {spriteQty.name}
                              </CardTitle>
                              <div className="flex items-center justify-between">
                                <Badge 
                                  className={`text-xs ${
                                    spriteQty.rarity === 'legendary' ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-background' :
                                    spriteQty.rarity === 'epic' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-background' :
                                    spriteQty.rarity === 'rare' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-background' :
                                    'bg-gradient-to-r from-gray-500 to-gray-600 text-background'
                                  }`}
                                >
                                  {spriteQty.rarity}
                                </Badge>
                                <Badge variant="secondary" className="text-xs gap-1">
                                  <Package className="w-3 h-3" />
                                  {spriteQty.quantity}x
                                </Badge>
                              </div>
                            </CardHeader>
                            
                            <CardContent className="pt-0 p-3 sm:p-6">
                              <div className="text-xs sm:text-sm text-muted-foreground">
                                Última aquisição: {new Date(spriteQty.last_acquired).toLocaleDateString('pt-BR')}
                              </div>
                              <div className="text-xs text-yellow-600 font-medium mt-1">
                                💰 Valor total: {spriteQty.price * spriteQty.quantity} créditos
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )
                ) : (
                  // Regular user sprites
                  userSprites.length === 0 ? (
                    <Card className="border-border/50 bg-card/50 backdrop-blur">
                      <CardContent className="py-8 sm:py-12 text-center p-4 sm:p-6">
                        <Crown className="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-muted-foreground/50 mb-4" />
                        <p className="text-muted-foreground text-sm sm:text-base">Você ainda não possui nenhum sprite</p>
                        <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                          Compre sprites na aba "Jogadores" para começar sua coleção!
                        </p>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                      {userSprites.map((ownedSprite) => {
                        const imageSrc = imageMap[ownedSprite.name] || ownedSprite.image;
                        
                        return (
                          <Card key={ownedSprite.id} className="border-border/50 bg-card/50 backdrop-blur overflow-hidden">
                            <div className="relative aspect-[4/3] overflow-hidden">
                              <img 
                                src={imageSrc}
                                alt={ownedSprite.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-background/60 to-transparent" />
                              
                              <Badge className="absolute top-2 right-2 bg-green-500 text-background font-bold text-xs">
                                ✓ Possui
                              </Badge>
                            </div>
                            
                            <CardHeader className="pb-2 p-3 sm:p-6">
                              <CardTitle className="text-base sm:text-lg bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                                {ownedSprite.name}
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge 
                                  className={`text-xs ${
                                    ownedSprite.rarity === 'legendary' ? 'bg-gradient-to-r from-yellow-500 to-orange-500 text-background' :
                                    ownedSprite.rarity === 'epic' ? 'bg-gradient-to-r from-purple-500 to-indigo-500 text-background' :
                                    ownedSprite.rarity === 'rare' ? 'bg-gradient-to-r from-blue-500 to-cyan-500 text-background' :
                                    'bg-gradient-to-r from-gray-500 to-gray-600 text-background'
                                  }`}
                                >
                                  {ownedSprite.rarity}
                                </Badge>
                              </div>
                            </CardHeader>
                            
                            <CardContent className="pt-0 p-3 sm:p-6">
                              <div className="text-xs sm:text-sm text-muted-foreground">
                                Adquirido em {new Date(ownedSprite.acquired_at).toLocaleDateString('pt-BR')}
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="referrals" className="space-y-4 sm:space-y-6">
            <ReferralSection />
            
            {/* Debug Panel - Only show in development or for testing */}
            {process.env.NODE_ENV === 'development' && (
              <div className="mt-8 border-t pt-8">
                <ReferralDebugPanel />
              </div>
            )}
          </TabsContent>

          {isAdmin && (
            <TabsContent value="admin" className="space-y-6">
              <AdminDashboard />
            </TabsContent>
          )}
        </Tabs>
      </main>
      
      {/* Interactive Tutorial */}
      <InteractiveTutorial />
      
      {/* Floating Buy Button for Mobile */}
      <FloatingBuyButton onBuyCredits={buyCredits} data-tutorial="floating-buy-button" />
    </div>
  );
};

export default Index;