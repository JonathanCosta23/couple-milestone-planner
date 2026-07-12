/**
 * Persistência do estado das ações (Supabase) + registro de eventos.
 * Não guarda descrição/valores derivados — apenas chave, status, motivo, timestamps.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  NBA_ENGINE_VERSION,
  NBA_SIGNATURE_VERSION,
  type UserActionState,
  type UserActionStatus,
} from "../types/nextAction";

export async function loadActionStates(
  userId: string,
  planId: string,
): Promise<Map<string, UserActionState>> {
  const map = new Map<string, UserActionState>();
  if (!userId || !planId) return map;
  const { data, error } = await supabase
    .from("user_action_state")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_id", planId);
  if (error || !data) return map;
  data.forEach((row) => {
    map.set(row.action_key, {
      actionKey: row.action_key,
      status: row.status as UserActionStatus,
      snoozedUntil: row.snoozed_until,
      dismissedUntil: row.dismissed_until,
      dismissedReason: row.dismissed_reason,
      completedAt: row.completed_at,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
      conditionSignature: row.condition_signature,
      conditionVersion: row.condition_version,
      lastValidatedAt: row.last_validated_at,
    });
  });
  return map;
}

export interface UpsertActionInput {
  userId: string;
  planId: string;
  actionKey: string;
  actionCategory: string;
  status: UserActionStatus;
  snoozedUntil?: string | null;
  dismissedUntil?: string | null;
  dismissedReason?: string | null;
  conditionSignature?: string | null;
}

export async function upsertActionState(input: UpsertActionInput) {
  const now = new Date().toISOString();
  const payload = {
    user_id: input.userId,
    plan_id: input.planId,
    action_key: input.actionKey,
    action_category: input.actionCategory,
    status: input.status,
    snoozed_until: input.snoozedUntil ?? null,
    dismissed_until: input.dismissedUntil ?? null,
    dismissed_reason: input.dismissedReason ?? null,
    completed_at: input.status === "completed" ? now : null,
    last_seen_at: now,
    engine_version: NBA_ENGINE_VERSION,
    condition_signature: input.conditionSignature ?? null,
    condition_version: NBA_SIGNATURE_VERSION,
    last_validated_at: now,
  };
  return supabase
    .from("user_action_state")
    .upsert(payload, { onConflict: "user_id,plan_id,action_key" });
}

/**
 * Marca que a ação foi efetivamente exibida ao usuário.
 *
 * - `first_seen_at` só é gravado se ainda não existir registro
 *   (garantido pelo default do banco na primeira inserção).
 * - `last_seen_at` é atualizado APENAS quando esta função é chamada,
 *   nunca em fluxos de mudança de status.
 * - `condition_signature` e `last_validated_at` são atualizados aqui
 *   para refletir que a condição atual foi validada e exibida.
 * - Não altera `status`, `snoozed_until`, `dismissed_until` nem `completed_at`.
 * - Idempotência de evento é responsabilidade do chamador (hook).
 */
export async function markActionShown(input: {
  userId: string;
  planId: string;
  actionKey: string;
  actionCategory: string;
  conditionSignature: string;
}) {
  if (!input.userId || !input.planId) return;
  const now = new Date().toISOString();
  // Preserva status/snooze/dismiss/first_seen_at existentes.
  // Estratégia: tenta UPDATE apenas dos campos de exibição;
  // se não houver linha, faz INSERT com defaults do banco.
  const { data: updated, error: updateError } = await supabase
    .from("user_action_state")
    .update({
      last_seen_at: now,
      engine_version: NBA_ENGINE_VERSION,
      condition_signature: input.conditionSignature,
      condition_version: NBA_SIGNATURE_VERSION,
      last_validated_at: now,
      action_category: input.actionCategory,
    })
    .eq("user_id", input.userId)
    .eq("plan_id", input.planId)
    .eq("action_key", input.actionKey)
    .select("id");
  if (updateError) return { error: updateError };
  if (updated && updated.length > 0) return { data: updated };
  return supabase.from("user_action_state").insert({
    user_id: input.userId,
    plan_id: input.planId,
    action_key: input.actionKey,
    action_category: input.actionCategory,
    status: "active",
    first_seen_at: now,
    last_seen_at: now,
    engine_version: NBA_ENGINE_VERSION,
    condition_signature: input.conditionSignature,
    condition_version: NBA_SIGNATURE_VERSION,
    last_validated_at: now,
  });
}

export type NextActionEventType =
  | "action_shown"
  | "action_opened"
  | "action_snoozed"
  | "action_dismissed"
  | "action_completed"
  | "action_invalidated"
  | "related_content_opened";

export async function logActionEvent(input: {
  userId: string;
  planId: string;
  actionKey: string;
  actionCategory: string;
  eventType: NextActionEventType;
}) {
  if (!input.userId || !input.planId) return;
  return supabase.from("user_action_events").insert({
    user_id: input.userId,
    plan_id: input.planId,
    action_key: input.actionKey,
    action_category: input.actionCategory,
    event_type: input.eventType,
    engine_version: NBA_ENGINE_VERSION,
  });
}