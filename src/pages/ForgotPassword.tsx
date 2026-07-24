import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Mail } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) {
      logger.warn("auth.forgot.fail", { email }, error.message);
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("60 seconds")) {
        toast.error("Aguarde 60 segundos antes de solicitar novamente.");
      } else {
        toast.error("Não foi possível enviar o e-mail agora. Tente novamente em instantes.");
      }
      return;
    }
    setSent(true);
    toast.success("Se este e-mail existir, você receberá um link em instantes.");
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Helmet>
        <title>Recuperar senha · Plano do Milhão</title>
        <meta
          name="description"
          content="Recupere o acesso à sua conta no Plano do Milhão: enviamos um link seguro por e-mail para redefinir sua senha."
        />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Recuperar senha · Plano do Milhão" />
        <meta
          property="og:description"
          content="Enviamos um link seguro por e-mail para você redefinir sua senha e voltar ao Plano do Milhão."
        />
        <meta property="og:url" content="https://couple-milestone-planner.lovable.app/forgot-password" />
      </Helmet>
      <div className="w-full max-w-md space-y-4">
        <Link
          to="/login"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> Voltar para entrar
        </Link>
        <Card>
          <CardHeader>
            <CardTitle>Recuperar senha</CardTitle>
            <CardDescription>
              Enviaremos um link seguro para redefinir sua senha, se este e-mail estiver cadastrado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {sent ? (
              <div className="space-y-3 text-sm">
                <p>
                  Se houver uma conta com <strong>{email}</strong>, você vai receber um link em
                  poucos minutos. Verifique também a caixa de spam.
                </p>
                <Link to="/login">
                  <Button variant="outline" className="w-full rounded-xl h-11">
                    Voltar para entrar
                  </Button>
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-3">
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
                <Button
                  type="submit"
                  className="w-full h-11 rounded-xl font-semibold"
                  disabled={loading}
                >
                  {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Enviar link de recuperação
                </Button>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}