/**
 * ConsentGate — bloqueia o acesso ao app autenticado até que o usuário aceite
 * a versão vigente dos Termos e do Aviso Educacional.
 *
 * Sem aceite, oferece apenas: (a) revisar os documentos, (b) aceitar, ou
 * (c) sair da conta. Não é possível usar o app sem aceitar.
 */
import { useEffect, useState, useCallback, type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck, FileText, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { LegalFooter } from "@/components/plan/LegalDialogs";
import {
  fetchConsentStatus,
  recordConsents,
} from "@/lib/services/consentService";
import {
  CONSENT_VERSIONS,
  REQUIRED_CONSENTS,
  type ConsentType,
} from "@/lib/consent/versions";

interface ConsentGateProps {
  userId: string;
  onSignOut: () => Promise<void> | void;
  children: ReactNode;
}

export function ConsentGate({ userId, onSignOut, children }: ConsentGateProps) {
  const [loading, setLoading] = useState(true);
  const [allAccepted, setAllAccepted] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [acceptedDisclaimer, setAcceptedDisclaimer] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const status = await fetchConsentStatus(userId);
    setAllAccepted(status.allAccepted);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const canSubmit = acceptedTerms && acceptedDisclaimer && !submitting;

  const handleAccept = async () => {
    setSubmitting(true);
    const metadata = {
      ua: typeof navigator !== "undefined" ? navigator.userAgent : null,
      versions: REQUIRED_CONSENTS.reduce<Record<string, string>>((acc, t) => {
        acc[t] = CONSENT_VERSIONS[t as ConsentType];
        return acc;
      }, {}),
    };
    const result = await recordConsents({
      userId,
      types: REQUIRED_CONSENTS,
      metadata,
    });
    setSubmitting(false);
    if (!result.ok) {
      toast.error("Não foi possível registrar o aceite", {
        description: result.error ?? "Tente novamente em instantes.",
      });
      return;
    }
    toast.success("Aceite registrado");
    setAllAccepted(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" aria-label="Carregando" />
      </div>
    );
  }

  if (allAccepted) return <>{children}</>;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <Card className="glass-card-strong p-6 sm:p-8 max-w-md w-full space-y-5 animate-fade-in-up">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-5 h-5 text-primary" aria-hidden />
          <h1 className="text-lg font-semibold">Antes de continuar</h1>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">
          Para usar o Plano do Milhão você precisa concordar com os Termos de Uso e
          confirmar que entende o caráter educacional do produto. O aceite é
          registrado de forma versionada na sua conta.
        </p>

        <div className="space-y-3 rounded-md border border-border/60 p-3">
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox
              checked={acceptedTerms}
              onCheckedChange={(v) => setAcceptedTerms(v === true)}
              aria-label="Aceitar Termos de Uso e Política de Privacidade"
            />
            <span className="leading-relaxed">
              Li e concordo com os <strong>Termos de Uso</strong> e com a{" "}
              <strong>Política de Privacidade</strong>.
              <span className="inline-flex items-center gap-1 ml-1 text-xs text-muted-foreground">
                <FileText className="w-3 h-3" aria-hidden />
                {CONSENT_VERSIONS.terms}
              </span>
            </span>
          </label>
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <Checkbox
              checked={acceptedDisclaimer}
              onCheckedChange={(v) => setAcceptedDisclaimer(v === true)}
              aria-label="Aceitar aviso educacional"
            />
            <span className="leading-relaxed">
              Entendo que o app tem <strong>finalidade educacional</strong> e que as
              projeções são estimativas — não constituem recomendação de
              investimento.
              <span className="inline-flex items-center gap-1 ml-1 text-xs text-muted-foreground">
                <ShieldAlert className="w-3 h-3" aria-hidden />
                {CONSENT_VERSIONS.educational_disclaimer}
              </span>
            </span>
          </label>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <Button
            className="w-full sm:flex-1 h-11"
            disabled={!canSubmit}
            onClick={() => void handleAccept()}
          >
            {submitting ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Registrando…</>
            ) : (
              "Aceitar e continuar"
            )}
          </Button>
          <Button
            variant="ghost"
            className="w-full sm:w-auto h-11"
            onClick={() => void onSignOut()}
            disabled={submitting}
          >
            Sair da conta
          </Button>
        </div>

        <LegalFooter />
      </Card>
    </div>
  );
}