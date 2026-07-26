import { useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Plug, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { McpConnectionPanel } from "@/components/integrations/McpConnectionPanel";
import { performMcpSwitchAccount } from "@/lib/mcp/switchAccount";

/**
 * Connect — Central MCP consolidada.
 *
 * A URL do endpoint, escopo somente leitura, dados acessíveis, lista de
 * grants, revogação e logout ficam exclusivamente no `McpConnectionPanel`.
 * Esta página apenas orienta o passo a passo em ChatGPT/Claude — nenhum
 * bloco duplicado do painel é renderizado aqui.
 *
 * Usuários deslogados são redirecionados para `/login?redirect=/connect`
 * para que voltem à Central após autenticar.
 */
export default function Connect() {
  const navigate = useNavigate();
  const { user, loading: authLoading, signOut } = useAuth();

  useEffect(() => {
    if (!authLoading && !user) {
      navigate("/login?redirect=%2Fconnect", { replace: true });
    }
  }, [authLoading, user, navigate]);

  async function handleSwitchAccount() {
    await performMcpSwitchAccount({
      userId: user?.id,
      signOut,
      navigate: (to) => navigate(to, { replace: true }),
    });
  }

  if (authLoading || !user) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <Helmet>
          <title>Conectar assistente de IA · Plano do Milhão</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-14">
      <Helmet>
        <title>Conectar assistente de IA · Plano do Milhão</title>
        <meta
          name="description"
          content="Conecte o ChatGPT ou o Claude ao Plano do Milhão para conversar com seu plano financeiro usando o servidor MCP do app."
        />
        <meta name="robots" content="noindex, nofollow" />
        <meta property="og:title" content="Conectar assistente de IA · Plano do Milhão" />
        <meta
          property="og:description"
          content="Passo a passo para conectar ChatGPT ou Claude ao seu Plano do Milhão."
        />
      </Helmet>

      <div className="mx-auto max-w-2xl space-y-8">
        <header className="space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <Plug className="h-5 w-5" />
            <span className="text-xs uppercase tracking-wide font-medium">Integração com IA</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Conecte um assistente de IA ao seu Plano do Milhão
          </h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Adicionando esta conexão, você pode pedir ao ChatGPT ou ao Claude para consultar
            seu plano, seus aportes e seu patrimônio, respondendo pela sua conta e respeitando
            as suas permissões.
          </p>
        </header>

        <McpConnectionPanel onSwitchAccount={handleSwitchAccount} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">ChatGPT</CardTitle>
            <CardDescription>
              Requer conta com acesso a conectores personalizados (Developer mode).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>
                Abra{" "}
                <a
                  href="https://chatgpt.com/#settings/Connectors/Advanced"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Configurações → Conectores → Avançado
                </a>{" "}
                e ative o Developer mode (leia o aviso de risco exibido lá).
              </li>
              <li>No menu "+" do campo de mensagem, ative o Developer mode.</li>
              <li>Clique em "Add sources" e depois em "Connect more".</li>
              <li>Dê um nome ao conector (por exemplo, "Plano do Milhão") e cole o endpoint copiado no painel acima.</li>
              <li>Peça ao ChatGPT para usar o Plano do Milhão. Ele vai pedir para você entrar na sua conta na primeira vez.</li>
            </ol>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Claude</CardTitle>
            <CardDescription>
              Requer plano Claude compatível com conectores personalizados.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal pl-5 space-y-2 text-sm">
              <li>
                Abra{" "}
                <a
                  href="https://claude.ai/customize/connectors?modal=add-custom-connector"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  Claude → Conectores → Adicionar conector personalizado
                </a>
                .
              </li>
              <li>Dê um nome ao conector (por exemplo, "Plano do Milhão") e cole o endpoint copiado no painel acima.</li>
              <li>
                Ative o conector no menu do campo de mensagem e peça ao Claude para consultar
                seu plano. Ele vai pedir para você entrar na sua conta na primeira vez.
              </li>
            </ol>
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          A conexão acessa apenas os seus dados no Plano do Milhão. Você pode revogar o acesso a
          qualquer momento nas configurações do ChatGPT ou do Claude.
        </p>
      </div>
    </main>
  );
}