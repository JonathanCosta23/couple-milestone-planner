import { useState } from "react";
import { Helmet } from "react-helmet-async";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Check, Copy, Plug } from "lucide-react";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "";
const mcpUrl = `https://${projectRef}.supabase.co/functions/v1/mcp`;

export default function Connect() {
  const [copied, setCopied] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(mcpUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // ignore
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-10 sm:py-14">
      <Helmet>
        <title>Conectar assistente de IA · Plano do Milhão</title>
        <meta
          name="description"
          content="Conecte o ChatGPT ou o Claude ao Plano do Milhão para conversar com seu plano financeiro usando o servidor MCP do app."
        />
        <link rel="canonical" href="https://couple-milestone-planner.lovable.app/connect" />
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

        <Card>
          <CardHeader>
            <CardTitle className="text-base">URL do servidor</CardTitle>
            <CardDescription>
              Copie este endereço — você vai colar dentro do ChatGPT ou do Claude nos passos abaixo.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="rounded-md border border-border bg-muted/40 p-3 font-mono text-xs sm:text-sm break-all">
              {mcpUrl}
            </div>
            <Button onClick={copyUrl} className="w-full sm:w-auto">
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" /> Copiar URL
                </>
              )}
            </Button>
          </CardContent>
        </Card>

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
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  Configurações → Conectores → Avançado
                </a>{" "}
                e ative o Developer mode (leia o aviso de risco exibido lá).
              </li>
              <li>No menu "+" do campo de mensagem, ative o Developer mode.</li>
              <li>Clique em "Add sources" e depois em "Connect more".</li>
              <li>Dê um nome ao conector (por exemplo, "Plano do Milhão") e cole a URL acima.</li>
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
                  rel="noreferrer"
                  className="text-primary underline"
                >
                  Claude → Conectores → Adicionar conector personalizado
                </a>
                .
              </li>
              <li>Dê um nome ao conector (por exemplo, "Plano do Milhão") e cole a URL acima.</li>
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