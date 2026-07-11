import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Check,
  Copy,
  Plug,
  ShieldCheck,
  ExternalLink,
  LogOut,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "";
const MCP_URL = `https://${projectRef}.supabase.co/functions/v1/mcp`;

/**
 * McpConnectionPanel — controle do usuário sobre a integração MCP.
 *
 * Exibe endpoint, escopo somente leitura, dados acessíveis e permite
 * "limpar sessão neste navegador" (signOut + storage local). A revogação
 * definitiva do conector precisa ser feita no ChatGPT/Claude — isso é
 * dito abertamente para não induzir falsa sensação de revogação completa.
 */
export function McpConnectionPanel({
  onSignOut,
}: {
  onSignOut: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  async function copyUrl() {
    try {
      await navigator.clipboard.writeText(MCP_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch (err) {
      logger.warn("mcp.panel.copy_failed", {}, err);
      toast.error("Não foi possível copiar o endereço. Copie manualmente.");
    }
  }

  async function clearLocalSession() {
    setBusy(true);
    try {
      try {
        const keysToClear = [
          "sb-mcp-authorization",
          "sb-mcp-authorization-id",
          "mcp:last-authorization",
          "mcp:last-client",
        ];
        for (const k of keysToClear) window.localStorage.removeItem(k);
      } catch (err) {
        logger.warn("mcp.panel.local_clear_failed", {}, err);
      }
      await onSignOut();
      toast.success(
        "Sessão limpa neste navegador. Se ainda quiser desvincular o conector, remova-o no ChatGPT ou no Claude.",
        { duration: 8000 },
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center gap-2 text-primary">
          <Plug className="h-5 w-5" />
          <CardTitle className="text-base">Conexão com assistentes</CardTitle>
        </div>
        <CardDescription>
          Conecte o ChatGPT ou o Claude para consultar seu plano em linguagem natural. Integração{" "}
          <strong>somente leitura</strong>.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Endpoint MCP
          </div>
          <div className="font-mono text-xs sm:text-sm break-all">{MCP_URL}</div>
          <div>
            <Button variant="outline" size="sm" onClick={copyUrl} className="rounded-lg">
              {copied ? (
                <>
                  <Check className="w-4 h-4 mr-2" /> Copiado
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-2" /> Copiar endpoint
                </>
              )}
            </Button>
          </div>
        </div>

        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-medium">Somente leitura</span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            O assistente vê apenas os seus dados e <strong>não cria, altera ou apaga</strong> nada.
            Ferramenta educacional — não é recomendação de investimento.
          </p>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground pt-1">
            Dados acessíveis
          </div>
          <ul className="list-disc pl-5 text-xs sm:text-sm space-y-0.5">
            <li>Plano atual e meta</li>
            <li>Participantes ativos</li>
            <li>Ativos e investimentos</li>
            <li>Histórico mensal de aportes</li>
          </ul>
        </div>

        <div className="rounded-md border border-border p-3 space-y-2 text-sm">
          <div className="font-medium">Como conectar</div>
          <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
            <li>
              ChatGPT: Configurações → Conectores → Avançado → Developer mode → Adicionar conector,
              colando o endpoint acima.
            </li>
            <li>
              Claude: Conectores → Adicionar conector personalizado, colando o endpoint acima.
            </li>
          </ul>
          <Link to="/connect">
            <Button variant="outline" size="sm" className="rounded-lg mt-1">
              Ver passo a passo <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            </Button>
          </Link>
        </div>

        <div className="rounded-md border border-border p-3 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="font-medium">Desvincular / trocar de conta</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {user?.email ? (
              <>
                Você está conectado como <strong>{user.email}</strong>. Se o assistente estiver
                conectado a uma conta diferente, os dados podem aparecer vazios.
              </>
            ) : (
              <>Você não está autenticado neste navegador.</>
            )}
          </p>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Para desvincular completamente, remova o conector nas configurações do{" "}
            <strong>ChatGPT</strong> ou <strong>Claude</strong>. O botão abaixo limpa sua sessão
            local e ajuda a iniciar uma nova vinculação com a conta certa.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={busy}
            onClick={() => void clearLocalSession()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {busy ? "Limpando…" : "Limpar sessão neste navegador"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}