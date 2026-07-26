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
  HelpCircle,
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

/** Motivos possíveis para o assistente retornar sem dados. */
const EMPTY_DATA_REASONS: readonly string[] = [
  "O assistente foi autorizado com outro e-mail.",
  "O plano oficial ainda não foi criado.",
  "O onboarding ou o Wizard não foi concluído.",
  "Não existem ativos cadastrados.",
  "Não existe histórico mensal.",
  "A consulta realizada realmente não possui registros.",
  "Ocorreu falha temporária de leitura.",
] as const;

/** Passos práticos para diagnosticar retorno vazio. */
const EMPTY_DATA_STEPS: readonly string[] = [
  "Confirme o e-mail da conta ativa.",
  "Confirme que o mesmo e-mail foi usado na autorização do assistente.",
  "Verifique se o plano e a meta estão concluídos.",
  "Verifique se existem registros para a consulta realizada.",
  "Revogue o grant antigo.",
  "Remova ou desconecte o app na plataforma externa, quando necessário.",
  "Autorize novamente com a conta correta.",
] as const;

const DIAGNOSTIC_PROMPT = "Mostre a visão geral do meu plano.";

/**
 * McpConnectionPanel — controle do usuário sobre a integração MCP.
 *
 * Toda cópia de erro é curta, humana e mapeada a partir de códigos seguros;
 * nenhuma mensagem crua do provedor OAuth chega ao usuário. Escopos são
 * traduzidos para pt-BR e o `clientId` técnico nunca aparece na UI.
 *
 * A ação "Sair e conectar outra conta" recebe um callback dedicado
 * (`onSwitchAccount`) — logout genérico e troca de conta MCP são intenções
 * distintas e não compartilham handler.
 */
export function McpConnectionPanel({
  onSwitchAccount,
}: {
  onSwitchAccount: () => void | Promise<void>;
}) {
  const { user } = useAuth();
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<McpGrantSummary | null>(null);
  const [revoking, setRevoking] = useState(false);
  const [reloading, setReloading] = useState(false);
  const [pendingSignOut, setPendingSignOut] = useState(false);
  const { state, grants, errorCode, reload, revoke } = useMcpConnections(user?.id ?? null);

  const errorText = errorCode ? ERROR_MESSAGES[errorCode] : null;
  const anyOpInProgress = revoking || reloading || busy;

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

  async function runSwitchAccount() {
    setBusy(true);
    try {
      await onSwitchAccount();
    } finally {
      setBusy(false);
      setPendingSignOut(false);
    }
  }

  async function runReload() {
    setReloading(true);
    try {
      await reload();
    } finally {
      setReloading(false);
    }
  }

  async function confirmRevoke() {
    if (!pendingRevoke) return;
    const target = pendingRevoke;
    setRevoking(true);
    const { error } = await revoke(target.clientId);
    if (error) {
      // Falha real: mantém o item na lista e não trata como sucesso.
      // Também não força reload — reload não é etapa obrigatória de uma
      // revogação que não aconteceu.
      setRevoking(false);
      toast.error(ERROR_MESSAGES[error]);
      return;
    }
    // Sucesso: revogação já é considerada efetiva. Só então tentamos
    // atualizar a lista — se o reload falhar, isso NÃO cria um falso
    // erro de revogação.
    toast.success("Acesso revogado. Atualize a lista novamente em alguns instantes.");
    setPendingRevoke(null);
    setRevoking(false);
    try {
      await runReload();
    } catch (err) {
      logger.warn("mcp.panel.reload_after_revoke_failed", { clientId: target.clientId }, err);
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
            O servidor MCP do Plano do Milhão disponibiliza somente ferramentas
            de consulta e não cria, altera ou apaga dados financeiros.{" "}
            {MCP_READONLY_DESCRIPTION} Ferramenta educacional — não é
            recomendação de investimento.
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
            <div className="font-medium">Aplicativos autorizados</div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-2"
              onClick={() => void runReload()}
              disabled={state === "loading" || anyOpInProgress}
              aria-label="Atualizar lista de conexões"
            >
              <RefreshCw
                className={`w-4 h-4 ${state === "loading" || reloading ? "animate-spin" : ""}`}
              />
            </Button>
          </div>

          <div className="sr-only" aria-live="polite" role="status">
            {state === "loading"
              ? "Carregando conexões."
              : state === "ready"
              ? `${grants.length} aplicativo(s) autorizado(s).`
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
                    onClick={() => void runReload()}
                    disabled={anyOpInProgress}
                  >
                    Tentar novamente
                  </Button>
                )}
              </div>
            )}

          {state === "ready" && grants.length === 0 && (
            <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground space-y-1">
              <p>Nenhum aplicativo autorizado ainda.</p>
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
                      Autorizado em {formatGrantDate(g.grantedAt)}
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
                    disabled={anyOpInProgress}
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

        <div className="rounded-md border border-border p-3 space-y-3 text-sm">
          <div className="flex items-center gap-2">
            <HelpCircle className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium">Dados retornando vazio?</span>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground">
            Um retorno vazio nem sempre indica conta errada. Ele pode acontecer
            por diferentes motivos:
          </p>
          <ul className="list-disc pl-5 text-xs sm:text-sm text-muted-foreground space-y-0.5">
            {EMPTY_DATA_REASONS.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
          <div className="text-[11px] uppercase tracking-wide text-muted-foreground pt-1">
            Como investigar
          </div>
          <ol className="list-decimal pl-5 text-xs sm:text-sm space-y-0.5">
            {EMPTY_DATA_STEPS.map((step) => (
              <li key={step}>{step}</li>
            ))}
            <li>
              Teste no assistente:{" "}
              <span className="font-mono text-[11px] sm:text-xs bg-muted px-1.5 py-0.5 rounded">
                {DIAGNOSTIC_PROMPT}
              </span>
            </li>
          </ol>
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
            Sair troca a conta deste navegador, mas não revoga acessos OAuth já
            autorizados. Para encerrar uma autorização específica, use a lista
            acima. Para remover também o app na plataforma externa, ajuste as
            configurações do ChatGPT ou do Claude.
          </p>
          <Button
            variant="outline"
            size="sm"
            className="rounded-lg"
            disabled={anyOpInProgress}
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
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  Revogar o grant encerra a autorização atual desse aplicativo.
                  Ele perde o acesso aos seus dados assim que a revogação é
                  confirmada e pode pedir para reautorizar na próxima vez.
                </p>
                <p>
                  Para remover também o app da interface do ChatGPT ou do
                  Claude, use as configurações da respectiva plataforma.
                </p>
                <p>
                  Sair da conta apenas troca a sessão deste navegador — não é
                  o mesmo que revogar. Esta ação não apaga nada do seu plano.
                </p>
              </div>
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
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-left">
                <p>
                  A sessão atual ({user?.email ?? "conta atual"}) será encerrada
                  neste navegador.
                </p>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  <li>Seu plano e seus dados financeiros serão mantidos.</li>
                  <li>Os grants OAuth já concedidos não serão revogados.</li>
                  <li>
                    Você poderá entrar com outra conta e retornar à Central MCP.
                  </li>
                </ul>
                <p>
                  Sair troca a conta deste navegador, mas não revoga acessos
                  OAuth já autorizados.
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={busy}
              onClick={(e) => {
                e.preventDefault();
                void runSwitchAccount();
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