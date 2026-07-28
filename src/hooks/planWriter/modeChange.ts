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

/**
 * Estado normalizado do plano confirmado por `normalize_plan_mode_v1`.
 * Inclui as contagens de participantes ativos para validar coerência
 * mode ↔ membros sem depender de outra RPC.
 */
export interface NormalizedModeState {
  mode: CanonicalPlanMode;
  primaryActiveCount: number;
  partnerActiveCount: number;
}

export interface ParseResult<T> {
  ok: boolean;
  value: T | null;
  error: string | null;
}

const okResult = <T>(value: T): ParseResult<T> => ({ ok: true, value, error: null });
const failResult = <T>(error: string): ParseResult<T> => ({ ok: false, value: null, error });

const isCanonicalMode = (m: unknown): m is CanonicalPlanMode =>
  m === "individual" || m === "casal";

const isNonEmptyString = (v: unknown): v is string =>
  typeof v === "string" && v.length > 0;

const isNonNegativeInt = (v: unknown): v is number =>
  typeof v === "number" && Number.isFinite(v) && Number.isInteger(v) && v >= 0;

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
    return failResult("invalid_rpc_payload");
  }
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.plan_id)) return failResult("invalid_rpc_payload");
  if (!isCanonicalMode(obj.mode)) return failResult("invalid_rpc_payload");
  if (!isNonEmptyString(obj.partner_id)) return failResult("invalid_rpc_payload");
  return okResult({ planId: obj.plan_id, mode: obj.mode, partnerId: obj.partner_id });
}

/**
 * Parser estrito para `remove_plan_partner_v1`.
 * Aceita apenas payloads com `removed_partner_id` como string não vazia —
 * o caminho de no-op sem parceiro removido é tratado pelo caller através
 * do erro `partner_not_active`, não por este parser.
 */
export function parseRemovePartnerPayload(
  raw: unknown
): ParseResult<{ planId: string; mode: CanonicalPlanMode; removedPartnerId: string }> {
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return failResult("invalid_rpc_payload");
  }
  const obj = raw as Record<string, unknown>;
  if (!isNonEmptyString(obj.plan_id)) return failResult("invalid_rpc_payload");
  if (!isCanonicalMode(obj.mode)) return failResult("invalid_rpc_payload");
  if (!isNonEmptyString(obj.removed_partner_id)) return failResult("invalid_rpc_payload");
  return okResult({
    planId: obj.plan_id,
    mode: obj.mode,
    removedPartnerId: obj.removed_partner_id,
  });
}

/**
 * Parser estrito para `normalize_plan_mode_v1`.
 * Exige `mode`, `primary_active` e `partner_active` e valida coerência:
 *  - individual ⇒ primary_active=1 e partner_active=0
 *  - casal      ⇒ primary_active=1 e partner_active=1
 * Qualquer outra combinação (tipos inválidos, negativos, fracionários,
 * ausência) retorna `invalid_rpc_payload`.
 */
export function parseNormalizePayload(
  raw: unknown
): ParseResult<NormalizedModeState> {
  if (raw === null || raw === undefined || typeof raw !== "object") {
    return failResult("invalid_rpc_payload");
  }
  const obj = raw as Record<string, unknown>;
  if (!isCanonicalMode(obj.mode)) return failResult("invalid_rpc_payload");
  if (!isNonNegativeInt(obj.primary_active)) return failResult("invalid_rpc_payload");
  if (!isNonNegativeInt(obj.partner_active)) return failResult("invalid_rpc_payload");
  const primary = obj.primary_active;
  const partner = obj.partner_active;
  if (obj.mode === "individual" && !(primary === 1 && partner === 0)) {
    return failResult("invalid_rpc_payload");
  }
  if (obj.mode === "casal" && !(primary === 1 && partner === 1)) {
    return failResult("invalid_rpc_payload");
  }
  return okResult({
    mode: obj.mode,
    primaryActiveCount: primary,
    partnerActiveCount: partner,
  });
}
