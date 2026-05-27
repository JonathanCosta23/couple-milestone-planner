/**
 * auditService — Camada mínima de auditoria e eventos de produto.
 *
 * Responsabilidades:
 *  1. `logProductEvent`  → grava na tabela `product_events`.
 *  2. `logAudit`         → grava na tabela `audit_log`.
 *
 * Regras:
 *  - Não bloqueia UX: por padrão é fire-and-forget. Falhas viram `logger.warn`.
 *  - Para ações destrutivas (reset, delete), use `{ critical: true }` para
 *    propagar o erro e permitir que o chamador alerte o usuário.
 *  - RLS garante que cada usuário só lê/grava registros próprios; este
 *    serviço apenas envia `user_id` explícito para passar pelos checks.
 *  - Não usa service_role no frontend.
 */

import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

/** Eventos mínimos rastreados pelo produto. Lista fechada para evitar typos. */
export type ProductEventName =
  | "plan_created"
  | "plan_updated"
  | "plan_reset"
  | "member_added"
  | "member_updated"
  | "asset_created"
  | "asset_updated"
  | "asset_deleted"
  | "income_created"
  | "income_updated"
  | "income_deleted"
  | "expense_created"
  | "expense_updated"
  | "expense_deleted"
  | "debt_created"
  | "debt_updated"
  | "debt_deleted"
  | "monthly_deposit_registered"
  | "month_completed"
  | "milestone_reached"
  | "projection_updated"
  | "backup_exported";

/** Entidades auditáveis (alinhadas aos writers principais). */
export type AuditEntity =
  | "plan"
  | "plan_member"
  | "asset"
  | "income"
  | "expense"
  | "debt"
  | "monthly_tracking"
  | "milestone"
  | "user_data";

export type AuditAction = "create" | "update" | "delete" | "reset" | "complete";

export interface LogProductEventInput {
  userId: string;
  planId?: string | null;
  event: ProductEventName;
  properties?: Record<string, unknown>;
  critical?: boolean;
}

export interface LogAuditInput {
  userId: string;
  planId?: string | null;
  entity: AuditEntity;
  entityId?: string | null;
  action: AuditAction;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  critical?: boolean;
}

/** JSON-safe: remove undefined e funções/Date (preserva tipos primitivos). */
function jsonSafe<T>(value: T | null | undefined): T | null {
  if (value === null || value === undefined) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as T;
  } catch {
    return null;
  }
}

export async function logProductEvent(input: LogProductEventInput): Promise<{ ok: boolean; error?: string }> {
  if (!input.userId) return { ok: false, error: "missing_user" };

  const payload = {
    user_id: input.userId,
    plan_id: input.planId ?? null,
    event_name: input.event,
    properties: jsonSafe(input.properties ?? {}) ?? {},
  };

  try {
    const { error } = await supabase.from("product_events").insert(payload as never);
    if (error) {
      logger.warn("audit.event.fail", { event: input.event }, error.message);
      if (input.critical) return { ok: false, error: error.message };
    }
    return { ok: !error, error: error?.message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    logger.warn("audit.event.exception", { event: input.event }, msg);
    if (input.critical) return { ok: false, error: msg };
    return { ok: false, error: msg };
  }
}

export async function logAudit(input: LogAuditInput): Promise<{ ok: boolean; error?: string }> {
  if (!input.userId) return { ok: false, error: "missing_user" };

  const payload = {
    user_id: input.userId,
    plan_id: input.planId ?? null,
    entity: input.entity,
    entity_id: input.entityId ?? null,
    action: input.action,
    old_value: jsonSafe(input.oldValue),
    new_value: jsonSafe(input.newValue),
  };

  try {
    const { error } = await supabase.from("audit_log").insert(payload as never);
    if (error) {
      logger.warn("audit.log.fail", { entity: input.entity, action: input.action }, error.message);
      if (input.critical) return { ok: false, error: error.message };
    }
    return { ok: !error, error: error?.message };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "unknown";
    logger.warn("audit.log.exception", { entity: input.entity, action: input.action }, msg);
    if (input.critical) return { ok: false, error: msg };
    return { ok: false, error: msg };
  }
}

/**
 * Helper combinado para uso nos writers: registra audit_log + product_event
 * em paralelo. Não bloqueia chamadas críticas (sucesso silencioso suficiente
 * para evitar regressão de UX em queda de rede).
 */
export function trackWriterChange(args: {
  userId: string;
  planId?: string | null;
  entity: AuditEntity;
  entityId?: string | null;
  action: AuditAction;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
  event?: ProductEventName;
  eventProperties?: Record<string, unknown>;
}): Promise<void> {
  const auditP = logAudit({
    userId: args.userId,
    planId: args.planId,
    entity: args.entity,
    entityId: args.entityId,
    action: args.action,
    oldValue: args.oldValue,
    newValue: args.newValue,
  });
  const eventP = args.event
    ? logProductEvent({
        userId: args.userId,
        planId: args.planId,
        event: args.event,
        properties: args.eventProperties,
      })
    : Promise.resolve({ ok: true });
  return Promise.allSettled([auditP, eventP]).then(() => undefined);
}
