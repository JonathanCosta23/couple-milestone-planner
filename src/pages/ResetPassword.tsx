import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Helmet } from "react-helmet-async";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Lock, Eye, EyeOff, Loader2, CheckCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { updatePassword } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (password.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }

    setLoading(true);
    const { error } = await updatePassword(password);
    setLoading(false);

    if (error) {
      toast.error("Erro ao redefinir senha. Tente novamente.");
    } else {
      setSuccess(true);
      toast.success("Senha redefinida com sucesso!");
      setTimeout(() => navigate("/"), 2000);
    }
  };

  if (success) {
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-8 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h2 className="text-lg font-bold">Senha redefinida!</h2>
            <p className="text-sm text-muted-foreground">Redirecionando para o app...</p>
          </CardContent>
        </Card>
      </main>
    );
  }

  return (
    <>
      <Helmet>
        <title>Redefinir senha · Plano do Milhão</title>
        <meta
          name="description"
          content="Defina uma nova senha para acessar seu plano financeiro no Plano do Milhão."
        />
        <meta name="robots" content="noindex, follow" />
        <link
          rel="canonical"
          href="https://couple-milestone-planner.lovable.app/reset-password"
        />
        <meta property="og:title" content="Redefinir senha · Plano do Milhão" />
        <meta
          property="og:description"
          content="Defina uma nova senha para acessar sua conta no Plano do Milhão."
        />
        <meta
          property="og:url"
          content="https://couple-milestone-planner.lovable.app/reset-password"
        />
      </Helmet>
      <main className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-2xl font-bold text-gradient">
            Plano do Milhão — Redefinir senha
          </h1>
          <p className="text-sm text-muted-foreground">Defina sua nova senha</p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Nova senha</CardTitle>
            <CardDescription>Escolha uma senha segura para proteger seus dados.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="password" className="text-xs">Nova senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mínimo 8 caracteres"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10 h-11 rounded-xl"
                    required
                    minLength={8}
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="confirm" className="text-xs">Confirme a senha</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="confirm"
                    type={showPassword ? "text" : "password"}
                    placeholder="Repita a senha"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full h-11 rounded-xl font-semibold" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Redefinir senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
      </main>
    </>
  );
}
