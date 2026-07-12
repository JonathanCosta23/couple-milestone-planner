/**
 * Persistência do estado das ações (Supabase) + registro de eventos.
 * Não guarda descrição/valores derivados — apenas chave, status, motivo, timestamps.
 */

import { supabase } from "@/integrations/supabase/client";
import { NBA_ENGINE_VERSION, type UserActionState, type UserActionStatus } from "../types/nextAction";

type Row = {
  action_key: string;
  status: UserActionStatus;
  snoozed_until: string | null;
  dismissed_reason: string | null;
  completed_at: string | null;
  first_seen_at: string;
  last_seen_at: string;
};

// Cast pontual: tipos gerados atualizam após aprovação da migration.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const client: any = supabase;

export async function loadActionStates(
  userId: string,
  planId: string | null,
): Promise<Map<string, UserActionState>> {
  const map = new Map<string, UserActionState>();
  if (!userId) return map;
  let query = client.from("user_action_state").select("*").eq("user_id", userId);
  if (planId) query = query.eq("plan_id", planId);
  const { data, error } = await query;
  if (error || !data) return map;
  (data as Row[]).forEach((row) => {
    map.set(row.action_key, {
      actionKey: row.action_key,
      status: row.status,
      snoozedUntil: row.snoozed_until,
      dismissedReason: row.dismissed_reason,
      completedAt: row.completed_at,
      firstSeenAt: row.first_seen_at,
      lastSeenAt: row.last_seen_at,
    });
  });
  return map;
}

export interface UpsertActionInput {
  userId: string;
  planId: string | null;
  actionKey: string;
  actionCategory: string;
  status: UserActionStatus;
  snoozedUntil?: string | null;
  dismissedReason?: string | null;
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
    dismissed_reason: input.dismissedReason ?? null,
    completed_at: input.status === "completed" ? now : null,
    last_seen_at: now,
    engine_version: NBA_ENGINE_VERSION,
  };
  return client
    .from("user_action_state")
    .upsert(payload, { onConflict: "user_id,plan_id,action_key" });
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
  planId: string | null;
  actionKey: string;
  actionCategory: string;
  eventType: NextActionEventType;
}) {
  if (!input.userId) return;
  return client.from("user_action_events").insert({
    user_id: input.userId,
    plan_id: input.planId,
    action_key: input.actionKey,
    action_category: input.actionCategory,
    event_type: input.eventType,
    engine_version: NBA_ENGINE_VERSION,
  });
}