/**
 * Contratos e parsers estritos para troca de modo do plano.
 *
 * Substitui o antigo retorno `{ plan: PlanRow; members: PlanMemberRow[] }`
 * artificial (que devolvia um `PlanRow` fabricado com apenas `id` e `mode`).
 * A camada de escrita agora expõe **somente o que a RPC confirmou**; qualquer
 * consumidor que precise da linha completa do plano deve reidratar via
 * `refreshCloudPlan()`.
 */
import type { CanonicalPlanMode } from "@/lib/services/dataMigrationService";

export type ModeChangeOutcome =
  | "changed" // RPC efetivou a troca (parceiro criado/removido)
  | "noop"; // Estado já era o pedido — confirmado via normalize_plan_mode_v1

export interface ModeChangeResult {
  outcome: ModeChangeOutcome;
  planId: string;
  mode: CanonicalPlanMode;
  partnerId: string | null;
  removedPartnerId: string | null;
}

export type ParseResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

const isCanonicalMode = (m: unknown): m is CanonicalPlanMode =>
  m === "individual" || m === "casal";

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0;

/**
 * Parser estrito para `add_plan_partner_v1`.
 * Aceita:
 *   { plan_id: string, mode: 'casal'|'individual', partner_id: string, partner?: {...} }
 * Rejeita: null/undefined, chaves ausentes, tipos incorretos.
 */
export function parseAddPartnerPayload(
  raw: unknown
): ParseResult<{ planId: string; mode: CanonicalPlanMode; partnerId: string }> {
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return { ok: false, error: "invalid_rpc_payload" };
  }
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.plan_id)) return { ok: false, error: "invalid_rpc_payload" };
  if (!isCanonicalMode(obj.mode)) return { ok: false, error: "invalid_rpc_payload" };
  if (!isNonEmptyString(obj.partner_id)) return { ok: false, error: "invalid_rpc_payload" };
  return {
    ok: true,
    value: { planId: obj.plan_id, mode: obj.mode, partnerId: obj.partner_id },
  };
}

/**
 * Parser estrito para `remove_plan_partner_v1`.
 * Aceita:
 *   { plan_id: string, mode: 'individual'|'casal', removed_partner_id: string|null }
 */
export function parseRemovePartnerPayload(
  raw: unknown
): ParseResult<{ planId: string; mode: CanonicalPlanMode; removedPartnerId: string | null }> {
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return { ok: false, error: "invalid_rpc_payload" };
  }
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.plan_id)) return { ok: false, error: "invalid_rpc_payload" };
  if (!isCanonicalMode(obj.mode)) return { ok: false, error: "invalid_rpc_payload" };
  const removed = obj.removed_partner_id;
  if (removed !== null && removed !== undefined && !isNonEmptyString(removed)) {
    return { ok: false, error: "invalid_rpc_payload" };
  }
  return {
    ok: true,
    value: {
      planId: obj.plan_id,
      mode: obj.mode,
      removedPartnerId: isNonEmptyString(removed) ? removed : null,
    },
  };
}

/** Parser estrito para `normalize_plan_mode_v1`. */
export function parseNormalizePayload(
  raw: unknown
): ParseResult<{ mode: CanonicalPlanMode }> {
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return { ok: false, error: "invalid_rpc_payload" };
  }
  const obj = raw as Record<string, unknown>;
  if (!isCanonicalMode(obj.mode)) return { ok: false, error: "invalid_rpc_payload" };
  return { ok: true, value: { mode: obj.mode } };
}
