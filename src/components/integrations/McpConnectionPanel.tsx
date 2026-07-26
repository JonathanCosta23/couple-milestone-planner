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
import {
  useMcpConnections,
  type McpErrorCode,
  type McpGrantSummary,
} from "@/hooks/useMcpConnections";
import {
  MCP_DATA_ACCESSED,
  MCP_ENDPOINT_UNAVAILABLE_MESSAGE,
  MCP_READONLY_DESCRIPTION,
  endpointAvailable,
  mcpEndpoint,
} from "@/lib/mcp/mcpConnectionConfig";
import { formatGrantDate, translateScopes } from "@/lib/mcp/friendlyScopes";

/** Mapa códigos → mensagens seguras/humanas (nunca vaza erro cru do provedor). */
const ERROR_MESSAGES: Record<McpErrorCode, string> = {
  oauth_unavailable:
    "Gestão automática de conexões indisponível neste momento. Para revogar, remova o conector nas configurações do ChatGPT ou Claude.",
  unauthenticated: "Entre na sua conta para ver e revogar conexões.",
  grants_load_failed:
    "Não conseguimos carregar suas conexões agora. Tente novamente em instantes.",
  grant_revoke_failed:
    "Não conseguimos revogar essa conexão agora. Tente novamente em instantes.",
  invalid_grant_response:
    "A resposta do servidor veio em um formato inesperado. Tente atualizar a lista.",
};

/**
 * McpConnectionPanel — controle do usuário sobre a integração MCP.
 *
 * Toda cópia de erro é curta, humana e mapeada a partir de códigos seguros;
 * nenhuma mensagem crua do provedor OAuth chega ao usuário. Escopos são
 * traduzidos para pt-BR e o `clientId` técnico nunca aparece na UI.
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
  const [pendingSignOut, setPendingSignOut] = useState(false);
  const { state, grants, errorCode, reload, revoke } = useMcpConnections(user?.id ?? null);

  const errorText = errorCode ? ERROR_MESSAGES[errorCode] : null;

  async function copyUrl() {
    if (!mcpEndpoint) {
      toast.error(MCP_ENDPOINT_UNAVAILABLE_MESSAGE);
      return;
    }
    try {
      await navigator.clipboard.writeText(mcpEndpoint);
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
        "Sessão encerrada neste navegador. Entre com a outra conta e reautorize o assistente.",
        { duration: 8000 },
      );
    } finally {
      setBusy(false);
      setPendingSignOut(false);
    }
  }

  async function confirmRevoke() {
    if (!pendingRevoke) return;
    setRevoking(true);
    const { error } = await revoke(pendingRevoke.clientId);
    // Confirmação: recarrega a lista para refletir estado real do servidor.
    await reload();
    setRevoking(false);
    if (error) {
      toast.error(ERROR_MESSAGES[error]);
      return;
    }
    toast.success(`Acesso de ${pendingRevoke.name} revogado.`);
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

        {endpointAvailable && mcpEndpoint ? (
          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Endpoint MCP
            </div>
            <div className="font-mono text-xs sm:text-sm break-all">{mcpEndpoint}</div>
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
        ) : (
          <div
            className="rounded-md border border-destructive/40 bg-destructive/5 p-3 text-xs text-destructive"
            role="alert"
          >
            {MCP_ENDPOINT_UNAVAILABLE_MESSAGE}
          </div>
        )}

        <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2 text-sm">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-4 w-4" />
            <span className="font-medium">Somente leitura</span>
          </div>
          <p className="text-muted-foreground text-xs sm:text-sm">
            {MCP_READONLY_DESCRIPTION} Ferramenta educacional — não é recomendação
            de investimento.
          </p>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground pt-1">
            Dados acessíveis
          </div>
          <ul className="list-disc pl-5 text-xs sm:text-sm space-y-0.5">
            {MCP_DATA_ACCESSED.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>

        <div
          className="rounded-md border border-border p-3 space-y-3 text-sm"
          aria-busy={state === "loading"}
        >
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

          <div className="sr-only" aria-live="polite" role="status">
            {state === "loading"
              ? "Carregando conexões."
              : state === "ready"
              ? `${grants.length} assistente(s) autorizado(s).`
              : ""}
          </div>

          {state === "loading" && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="w-3.5 h-3.5 animate-spin" /> Carregando conexões…
            </div>
          )}

          {(state === "unauthenticated" ||
            state === "unavailable" ||
            state === "error") &&
            errorText && (
              <div className="space-y-2" role="alert" aria-live="assertive">
                <p
                  className={
                    state === "error"
                      ? "text-xs text-destructive"
                      : "text-xs text-muted-foreground"
                  }
                >
                  {errorText}
                </p>
                {state === "error" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    onClick={() => void reload()}
                  >
                    Tentar novamente
                  </Button>
                )}
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
              {grants.map((g) => {
                const scopeLabels = translateScopes(g.scopes);
                return (
                <li
                  key={g.clientId}
                  className="flex items-center justify-between gap-3 rounded-md border border-border p-2.5"
                >
                  <div className="min-w-0">
                    <div className="text-sm font-medium truncate">{g.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">
                      Autorizado em {formatGrantDate(g.grantedAt)} · somente leitura
                    </div>
                    {scopeLabels.length > 0 && (
                      <div className="text-[11px] text-muted-foreground truncate">
                        Permissões: {scopeLabels.join(", ")}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-lg shrink-0"
                    onClick={() => setPendingRevoke(g)}
                    aria-label={`Revogar acesso de ${g.name}`}
                  >
                    <XCircle className="w-4 h-4 mr-1.5" /> Revogar
                  </Button>
                </li>
                );
              })}
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
          <Button variant="outline" size="sm" className="rounded-lg mt-1" asChild>
            <Link to="/connect">
              Ver passo a passo <ExternalLink className="w-3.5 h-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>

        <div className="rounded-md border border-border p-3 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="font-medium">Sair e conectar outra conta</span>
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
            onClick={() => setPendingSignOut(true)}
          >
            <LogOut className="w-4 h-4 mr-2" />
            {busy ? "Saindo…" : "Sair e conectar outra conta"}
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
              O assistente perde o acesso aos seus dados assim que a revogação
              for confirmada pelo servidor. Ele pode pedir para reautorizar na
              próxima vez que você usar. Esta ação não apaga nada do seu plano.
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

      <AlertDialog
        open={pendingSignOut}
        onOpenChange={(open) => {
          if (!open && !busy) setPendingSignOut(false);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sair e conectar outra conta?</AlertDialogTitle>
            <AlertDialogDescription>
              A sessão desta conta ({user?.email ?? "conta atual"}) será encerrada
              neste navegador. Você poderá entrar com outra conta e reautorizar o
              assistente em seguida.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void clearLocalSession();
              }}
            >
              {busy ? "Saindo…" : "Sair agora"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}