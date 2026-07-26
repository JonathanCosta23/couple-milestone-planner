import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { Eye, EyeOff, Mail, Lock, User, ArrowLeft, Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";

interface AuthPageProps {
  onClose?: () => void;
  onSuccess?: () => void;
  mode?: "login" | "signup";
  showBackButton?: boolean;
}

export function AuthPage({ onClose, onSuccess, mode: initialMode = "login", showBackButton = false }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup" | "forgot">(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const { signUp, signIn, resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (mode === "forgot") {
        const { error } = await resetPassword(email);
        if (error) {
          toast.error(error.message === "For security purposes, you can only request this once every 60 seconds"
            ? "Aguarde 60 segundos antes de solicitar novamente."
            : "Erro ao enviar e-mail de recuperação.");
        } else {
          toast.success("E-mail de recuperação enviado! Verifique sua caixa de entrada.");
          setMode("login");
        }
      } else if (mode === "signup") {
        const { error } = await signUp(email, password, name);
        if (error) {
          const msg = error.message || "";
          const code = (error as { code?: string }).code;
          if (code === "weak_password" || msg.toLowerCase().includes("pwned") || msg.toLowerCase().includes("weak")) {
            toast.error("Essa senha é muito comum ou apareceu em vazamentos. Use uma senha mais forte (misture letras, números e símbolos).", { duration: 7000 });
          } else if (msg.includes("already registered") || msg.toLowerCase().includes("already")) {
            toast.error("Este e-mail já está cadastrado. Tente entrar.");
          } else if (msg.toLowerCase().includes("password")) {
            toast.error("Senha inválida. Use pelo menos 8 caracteres, com letras e números.");
          } else if (msg.toLowerCase().includes("email")) {
            toast.error("E-mail inválido. Verifique e tente novamente.");
          } else {
            logger.warn("auth.signup.fallback", { code, message: msg });
            toast.error("Erro ao criar conta. Tente novamente.");
          }
        } else {
          toast.success("Conta criada! Verifique seu e-mail para confirmar.", { duration: 6000 });
          onSuccess?.();
        }
      } else {
        const { error } = await signIn(email, password);
        if (error) {
          if (error.message.includes("Invalid login")) {
            toast.error("E-mail ou senha incorretos.");
          } else if (error.message.includes("Email not confirmed")) {
            toast.error("Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.");
          } else {
            toast.error("Erro ao entrar. Tente novamente.");
          }
        } else {
          toast.success("Bem-vindo de volta! 🎉");
          onSuccess?.();
        }
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Erro ao entrar com Google.");
      } else if (result.redirected) {
        return;
      } else {
        toast.success("Bem-vindo! 🎉");
        onSuccess?.();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleAppleSignIn = async () => {
    setLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth("apple", {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error("Erro ao entrar com Apple.");
      } else if (result.redirected) {
        return;
      } else {
        toast.success("Bem-vindo! 🎉");
        onSuccess?.();
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {showBackButton && onClose && (
          <button onClick={onClose} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" /> Voltar ao app
          </button>
        )}

        <div className="text-center space-y-2">
          <div
            role="heading"
            aria-level={2}
            className="text-2xl font-bold text-gradient"
          >
            Plano do Milhão — Planejamento Financeiro
          </div>
          <p className="text-sm text-muted-foreground">
            {mode === "forgot"
              ? "Recupere o acesso à sua conta"
              : mode === "signup"
                ? "Crie sua conta e salve seu progresso"
                : "Entre e continue de onde parou"}
          </p>
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">
              {mode === "forgot" ? "Recuperar senha" : mode === "signup" ? "Criar conta" : "Entrar"}
            </CardTitle>
            <CardDescription>
              {mode === "forgot"
                ? "Enviaremos um link para redefinir sua senha."
                : mode === "signup"
                  ? "Seus dados ficam seguros e sincronizados."
                  : "Acesse seu plano de qualquer dispositivo."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode !== "forgot" && (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Button variant="outline" className="h-11 rounded-xl" onClick={handleGoogleSignIn} disabled={loading}>
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
                    Google
                  </Button>
                  <Button variant="outline" className="h-11 rounded-xl" onClick={handleAppleSignIn} disabled={loading}>
                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.32 2.32-1.55 4.3-3.74 4.25z"/></svg>
                    Apple
                  </Button>
                </div>

                <div className="relative">
                  <Separator />
                  <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-card px-3 text-xs text-muted-foreground">
                    ou com e-mail
                  </span>
                </div>
              </>
            )}

            <form onSubmit={handleSubmit} className="space-y-3">
              {mode === "signup" && (
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-xs">Como posso te chamar?</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="name"
                      type="text"
                      placeholder="Seu nome"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="pl-10 h-11 rounded-xl"
                      required
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="email" className="text-xs">E-mail</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-10 h-11 rounded-xl"
                    required
                  />
                </div>
              </div>

              {mode !== "forgot" && (
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs">Senha</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder={mode === "signup" ? "Mínimo 8 caracteres" : "Sua senha"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10 pr-10 h-11 rounded-xl"
                      required
                      minLength={mode === "signup" ? 8 : undefined}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              )}

              {mode === "login" && (
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="text-xs text-primary hover:underline"
                >
                  Esqueceu a senha?
                </button>
              )}

              <Button type="submit" className="w-full h-11 rounded-xl font-semibold" disabled={loading}>
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {mode === "forgot" ? "Enviar link de recuperação" : mode === "signup" ? "Criar conta" : "Entrar"}
              </Button>
            </form>

            <div className="text-center text-sm text-muted-foreground">
              {mode === "forgot" ? (
                <button onClick={() => setMode("login")} className="text-primary hover:underline">
                  Voltar para login
                </button>
              ) : mode === "signup" ? (
                <span>
                  Já tem conta?{" "}
                  <button onClick={() => setMode("login")} className="text-primary hover:underline font-medium">
                    Entrar
                  </button>
                </span>
              ) : (
                <span>
                  Não tem conta?{" "}
                  <button onClick={() => setMode("signup")} className="text-primary hover:underline font-medium">
                    Criar conta grátis
                  </button>
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        <p className="text-[11px] text-muted-foreground text-center leading-relaxed px-4">
          Ao criar conta, você concorda com nossos termos de uso. Seus dados são protegidos por
          autenticação, permissões por usuário e controles de acesso.
        </p>
      </div>
    </div>
  );
}
