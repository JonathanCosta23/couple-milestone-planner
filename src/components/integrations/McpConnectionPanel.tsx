import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Check,
  Copy,
  Plug,
  ShieldCheck,
  ExternalLink,
  LogOut,
  AlertTriangle,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { useMcpConnections, type McpGrantSummary } from "@/hooks/useMcpConnections";

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
  const [pendingRevoke, setPendingRevoke] = useState<McpGrantSummary | null>(null);
  const [revoking, setRevoking] = useState(false);
  const { state, grants, errorMessage, reload, revoke } = useMcpConnections(user?.id ?? null);

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
        "Sessão encerrada. Entre novamente com a conta correta e reautorize o assistente para trocar de vínculo.",
        { duration: 8000 },
      );
    } finally {
      setBusy(false);
    }
  }

  async function confirmRevoke() {
    if (!pendingRevoke) return;
    setRevoking(true);
    const { error } = await revoke(pendingRevoke.clientId);
    setRevoking(false);
    if (error) {
      toast.error(`Falha ao revogar: ${error}`);
      return;
    }
    toast.success(`Acesso de "${pendingRevoke.name}" revogado.`);
    setPendingRevoke(null);
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
        <div className="rounded-md border border-border p-3 space-y-1 text-sm">
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
            Conta ativa neste navegador
          </div>
          <div className="font-medium break-all">
            {user?.email ?? "Não autenticado"}
          </div>
          <p className="text-xs text-muted-foreground">
            Assistentes verão os dados desta conta. Se estiver na conta errada, saia
            antes de autorizar.
          </p>
        </div>

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

        <div className="rounded-md border border-border p-3 space-y-3 text-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="font-medium">Assistentes autorizados</div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => void reload()}
              disabled={state === "loading"}
              aria-label="Atualizar lista de conexões"
            >
              <RefreshCw className={`w-4 h-4 ${state === "loading" ? "animate-spin" : ""}`} />
            </Button>
          </div>

          {state === "loading" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando conexões…
            </div>
          )}

          {state === "unauthenticated" && (
            <p className="text-xs text-muted-foreground">
              Entre na sua conta para ver e revogar conexões.
            </p>
          )}

          {state === "unavailable" && (
            <p className="text-xs text-muted-foreground">
              Gestão automática de conexões indisponível. Para revogar, remova o
              conector nas configurações do <strong>ChatGPT</strong> ou <strong>Claude</strong>.
            </p>
          )}

          {state === "error" && (
            <div className="space-y-2">
              <p className="text-xs text-destructive">
                Não foi possível carregar suas conexões{errorMessage ? `: ${errorMessage}` : "."}
              </p>
              <Button variant="outline" size="sm" className="rounded-lg" onClick={() => void reload()}>
                Tentar novamente
              </Button>
            </div>
          )}

          {state === "ready" && grants.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground space-y-1">
              <p>Nenhum assistente conectado ainda.</p>
              <p>
                Se você acabou de conectar e a lista aparece vazia, verifique se
                autorizou com este e-mail (<strong>{user?.email}</strong>) e clique
                em atualizar.
              </p>
            </div>
          )}

          {state === "ready" && grants.length > 0 && (
            <ul className="space-y-2">
              {grants.map((g) => (
                <li
                  key={g.clientId}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{g.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Autorizado em {new Date(g.grantedAt).toLocaleDateString("pt-BR")} · somente leitura
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg shrink-0"
                    onClick={() => setPendingRevoke(g)}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" /> Revogar
                  </Button>
                </li>
              ))}
            </ul>
          )}
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
            <span className="font-medium">Trocar de conta neste navegador</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Sair encerra a sessão aqui e permite entrar com outra conta antes de
            reautorizar o assistente. Para revogar acesso já concedido, use a lista
            acima ou remova o conector no ChatGPT/Claude.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={busy}
            onClick={() => void clearLocalSession()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {busy ? "Saindo…" : "Sair desta conta"}
          </Button>
        </div>
      </CardContent>

      <AlertDialog
        open={pendingRevoke !== null}
        onOpenChange={(open) => {
          if (!open && !revoking) setPendingRevoke(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Revogar acesso de {pendingRevoke?.name}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              O assistente perde imediatamente o acesso aos seus dados. Ele pode
              pedir para reautorizar na próxima vez que você usar. Esta ação não
              apaga nada do seu plano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={revoking}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={revoking}
              onClick={(e) => {
                e.preventDefault();
                void confirmRevoke();
              }}
            >
              {revoking ? "Revogando…" : "Revogar acesso"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}