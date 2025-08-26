import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Zap, Lock } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

const ResetPassword = () => {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { updatePassword, user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If user is not authenticated, redirect to home
    if (!user) {
      navigate("/");
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (password !== confirmPassword) {
      return;
    }

    if (password.length < 6) {
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (!error) {
      navigate("/");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-background/50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-secondary/5"></div>
      
      <Card className="w-full max-w-md backdrop-blur border-primary/20 shadow-2xl relative z-10">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold bg-gradient-to-r from-primary via-secondary to-accent bg-clip-text text-transparent">
            <Lock className="inline-block w-8 h-8 mr-2 text-primary" />
            Nova Senha
          </CardTitle>
          <p className="text-muted-foreground">Defina sua nova senha</p>
        </CardHeader>
        
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Nova Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="border-primary/20 focus:border-primary pr-10"
                  required
                  minLength={6}
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
            
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="border-primary/20 focus:border-primary"
                required
                minLength={6}
              />
            </div>

            {password && confirmPassword && password !== confirmPassword && (
              <p className="text-sm text-destructive">As senhas não coincidem</p>
            )}

            {password && password.length < 6 && (
              <p className="text-sm text-muted-foreground">A senha deve ter pelo menos 6 caracteres</p>
            )}
            
            <Button 
              type="submit"
              className="w-full bg-gradient-to-r from-primary to-secondary hover:from-primary/80 hover:to-secondary/80 text-primary-foreground font-semibold py-3"
              disabled={loading || password !== confirmPassword || password.length < 6}
            >
              <Zap className="w-4 h-4 mr-2" />
              {loading ? 'Alterando...' : 'Alterar Senha'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ResetPassword;