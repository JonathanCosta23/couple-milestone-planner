import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AuthPage } from "@/components/auth/AuthPage";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ShieldCheck } from "lucide-react";
import { logger } from "@/lib/logger";

const GENERIC_LOAD_ERROR =
  "Não foi possível carregar esta solicitação de autorização. Tente novamente.";
const GENERIC_DECIDE_ERROR =
  "Não foi possível concluir esta autorização. Tente novamente.";
const GENERIC_INVALID_AUTHZ =
  "Solicitação de autorização inválida. Volte ao aplicativo que iniciou a conexão e tente novamente.";
const GENERIC_MISSING_REDIRECT =
  "Não foi possível concluir esta autorização. Tente novamente.";

type OAuthClientLike = { name?: string; client_name?: string; redirect_uri?: string };
type AuthorizationDetails = {
  client?: OAuthClientLike;
  scope?: string;
  scopes?: string[];
  redirect_url?: string;
  redirect_to?: string;
};

type SupabaseAuthOauth = {
  getAuthorizationDetails: (
    id: string,
  ) => Promise<{ data: AuthorizationDetails | null; error: { message: string } | null }>;
  approveAuthorization: (
    id: string,
  ) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
  denyAuthorization: (
    id: string,
  ) => Promise<{ data: { redirect_url?: string; redirect_to?: string } | null; error: { message: string } | null }>;
};

function oauthApi(): SupabaseAuthOauth {
  return (supabase.auth as unknown as { oauth: SupabaseAuthOauth }).oauth;
}

export default function OAuthConsent() {
  const [params] = useSearchParams();
  const authorizationId = params.get("authorization_id") ?? "";
  const { user, loading: authLoading } = useAuth();
  const [details, setDetails] = useState<AuthorizationDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setLoading(false);
      return;
    }
    if (!authorizationId) {
      setError(GENERIC_INVALID_AUTHZ);
      setLoading(false);
      return;
    }
    let active = true;
    (async () => {
      const { data, error } = await oauthApi().getAuthorizationDetails(authorizationId);
      if (!active) return;
      if (error) {
        logger.warn("oauth.consent.get_details_failed", { authorizationId }, error);
        setError(GENERIC_LOAD_ERROR);
        setLoading(false);
        return;
      }
      const immediate = data?.redirect_url ?? data?.redirect_to;
      if (immediate && !data?.client) {
        window.location.href = immediate;
        return;
      }
      setDetails(data);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [authLoading, user, authorizationId]);

  async function decide(approve: boolean) {
    setBusy(true);
    const { data, error } = approve
      ? await oauthApi().approveAuthorization(authorizationId)
      : await oauthApi().denyAuthorization(authorizationId);
    if (error) {
      logger.warn(
        approve ? "oauth.consent.approve_failed" : "oauth.consent.deny_failed",
        { authorizationId },
        error,
      );
      setBusy(false);
      setError(GENERIC_DECIDE_ERROR);
      return;
    }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) {
      setBusy(false);
      logger.warn("oauth.consent.missing_redirect", { authorizationId });
      setError(GENERIC_MISSING_REDIRECT);
      return;
    }
    window.location.href = target;
  }

  if (authLoading || loading) {
    return (
      <main className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-screen bg-background">
        <div className="mx-auto max-w-md pt-6 px-4 pb-2">
          <p className="text-sm text-muted-foreground text-center">
            Entre na sua conta para autorizar esta conexão.
          </p>
        </div>
        <AuthPage />
      </main>
    );
  }

  if (error) {
    return (
      <main className="min-h-screen grid place-items-center bg-background p-6">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Não foi possível carregar a autorização</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      </main>
    );
  }

  const clientName = details?.client?.name ?? details?.client?.client_name ?? "um aplicativo";
  const scopeList =
    details?.scopes && details.scopes.length > 0
      ? details.scopes
      : details?.scope?.split(/\s+/).filter(Boolean) ?? [];

  return (
    <main className="min-h-screen grid place-items-center bg-background p-6">
      <Helmet>
        <title>Autorizar conexão · Plano do Milhão</title>
        <meta
          name="description"
          content="Revise e aprove o acesso de um aplicativo externo à sua conta do Plano do Milhão."
        />
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://couple-milestone-planner.lovable.app/.lovable/oauth/consent" />
        <meta property="og:title" content="Autorizar conexão · Plano do Milhão" />
        <meta
          property="og:description"
          content="Página de consentimento OAuth para conectar um aplicativo externo ao Plano do Milhão."
        />
        <meta property="og:url" content="https://couple-milestone-planner.lovable.app/.lovable/oauth/consent" />
      </Helmet>
      <Card className="max-w-md w-full">
        <CardHeader className="space-y-2">
          <div className="flex items-center gap-2 text-primary">
            <ShieldCheck className="h-5 w-5" />
            <span className="text-xs uppercase tracking-wide font-medium">Autorização</span>
          </div>
          <h1 className="text-lg font-semibold leading-none tracking-tight">
            Conectar {clientName} à sua conta
          </h1>
          <CardDescription>
            Isso permite que {clientName} acesse o Plano do Milhão como você. As regras de acesso do
            app continuam valendo — a conexão vê apenas os seus dados.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md border border-border bg-muted/40 p-3 text-sm">
            <div className="text-muted-foreground text-xs">Conta</div>
            <div className="font-medium">{user.email}</div>
          </div>
          {/* Redirect URI omitido intencionalmente: informação técnica sem valor
              para o usuário final e potencialmente confusa. O nome do cliente já
              identifica quem está solicitando acesso. */}
          {scopeList.length > 0 ? (
            <div className="text-sm">
              <div className="text-muted-foreground text-xs mb-1">Permissões solicitadas</div>
              <ul className="list-disc pl-5 space-y-1">
                {scopeList.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:justify-end">
            <Button variant="ghost" disabled={busy} onClick={() => decide(false)}>
              Cancelar conexão
            </Button>
            <Button disabled={busy} onClick={() => decide(true)}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Aprovar"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
