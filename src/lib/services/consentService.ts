/**
 * consentService — gravação e leitura de consentimentos legais versionados.
 *
 * Tabela: `public.legal_consents` (RLS por `auth.uid()`).
 * Documentos exigidos: ver `REQUIRED_CONSENTS` em `src/lib/consent/versions.ts`.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import {
  CONSENT_VERSIONS,
  REQUIRED_CONSENTS,
  type ConsentType,
} from "@/lib/consent/versions";

export interface ConsentRecord {
  consent_type: ConsentType;
  version: string;
  accepted_at: string;
}

export interface ConsentStatus {
  /** True quando todos os REQUIRED_CONSENTS estão aceitos na versão atual. */
  allAccepted: boolean;
  /** Lista de documentos ainda pendentes (versão atual não aceita). */
  pending: ConsentType[];
  /** Registros existentes na versão atual. */
  accepted: ConsentRecord[];
}

/** Verifica quais consentimentos da versão atual ainda faltam para o usuário. */
export async function fetchConsentStatus(
  userId: string,
): Promise<ConsentStatus> {
  const empty: ConsentStatus = { allAccepted: false, pending: [...REQUIRED_CONSENTS], accepted: [] };
  if (!userId) return empty;

  const { data, error } = await supabase
    .from("legal_consents")
    .select("consent_type, version, accepted_at")
    .eq("user_id", userId);

  if (error) {
    logger.warn("consent.fetch.fail", { userId }, error.message);
    return empty;
  }

  const rows = (data ?? []) as ConsentRecord[];
  const accepted = rows.filter(
    (r) => CONSENT_VERSIONS[r.consent_type as ConsentType] === r.version,
  );
  const acceptedTypes = new Set(accepted.map((r) => r.consent_type));
  const pending = REQUIRED_CONSENTS.filter((t) => !acceptedTypes.has(t));

  return { allAccepted: pending.length === 0, pending, accepted };
}

export interface RecordConsentInput {
  userId: string;
  types: ConsentType[];
  metadata?: Record<string, unknown>;
}

/** Grava múltiplos consentimentos na versão oficial atual. */
export async function recordConsents(
  input: RecordConsentInput,
): Promise<{ ok: boolean; error?: string }> {
  if (!input.userId) return { ok: false, error: "missing_user" };
  if (!input.types.length) return { ok: true };

  const rows = input.types.map((t) => ({
    user_id: input.userId,
    consent_type: t,
    version: CONSENT_VERSIONS[t],
    metadata: input.metadata ?? {},
  }));

  const { error } = await supabase
    .from("legal_consents")
    .upsert(rows as never, { onConflict: "user_id,consent_type,version" });

  if (error) {
    logger.error("consent.record.fail", { userId: input.userId }, error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}