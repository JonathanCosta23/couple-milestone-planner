/**
 * useOfflineQueue — Provider/hook que orquestra a fila persistente de writes.
 *
 * Responsabilidades:
 *  1. Disponibiliza `enqueue(...)` para os actions de domínio quando offline.
 *  2. Detecta `online` e dispara `flush()` automaticamente.
 *  3. Para cada write, antes de aplicar `update`, busca a versão atual no
 *     servidor; se `updated_at(servidor) > enqueuedAt(local)` → CONFLITO.
 *  4. Conflito abre dialog modal (uma vez por write); usuário decide.
 *  5. Notifica via toast: "Sincronizando N alterações…" / "Tudo salvo".
 *  6. Expõe `count` e `syncing` para o `OfflineBanner` mostrar badge.
 *
 * O dispatcher é simples (best effort, sequencial):
 *  - Erro permanente (validação, RLS) → remove da fila + log.
 *  - Erro transitório (rede) → mantém na fila, retry no próximo flush.
 *  - Conflito → pausa o write, abre dialog, espera decisão.
 *
 * Decisão arquitetural: o dispatcher importa Supabase diretamente em vez
 * de chamar os writers (hooks) para evitar problemas com closures sobre
 * `user` e poder rodar em qualquer contexto. Mantém a mesma forma de
 * payload já exportada pelos writers.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { logger } from "@/lib/logger";
import { toFriendlyError } from "@/lib/errors/friendlyError";
import {
  enqueueWrite,
  listWrites,
  deadLetterWrite,
  quarantineExpiredWrites,
  removeWrite,
  rebindEntityId,
  updateWriteAttempt,
  countWrites,
  countDeadLetters,
  MAX_WRITE_ATTEMPTS,
  type QueuedWrite,
  type WriteEntity,
  type WriteOp,
} from "@/lib/offlineQueue";
import {
  ConflictResolutionDialog,
  type ConflictDescriptor,
} from "@/components/system/ConflictResolutionDialog";

// ---- Mapeamento entity → tabela do Supabase ----
const ENTITY_TO_TABLE: Record<WriteEntity, string> = {
  income: "income",
  expense: "expenses",
  debt: "debts",
  asset: "assets",
  plan: "plans",
  plan_member: "plan_members",
  monthly_tracking: "monthly_tracking",
};

const ENTITY_LABEL: Record<WriteEntity, string> = {
  income: "renda",
  expense: "gasto",
  debt: "dívida",
  asset: "investimento",
  plan: "plano",
  plan_member: "participante",
  monthly_tracking: "registro mensal",
};

// Padrões de erro que NÃO devem ser retentados.
const PERMANENT_ERROR = /violates|invalid|constraint|not found|permission|forbidden|unauthorized/i;

// ---- Conflict resolution state ----
interface PendingConflict {
  write: QueuedWrite;
  cloudRow: Record<string, unknown>;
  resolve: (decision: "mine" | "cloud" | "postpone") => void;
}

interface OfflineQueueAPI {
  /** Conta de writes pendentes (atualiza com pollinglight ao reconectar). */
  count: number;
  /** True enquanto está executando o flush. */
  syncing: boolean;
  /** Writes que excederam tentativas/TTL e precisam de ação manual. */
  stuckCount: number;
  /** Empurra um write para a fila. Use quando offline ou quando writer real falhou por rede. */
  enqueue: (input: {
    entity: WriteEntity;
    op: WriteOp;
    entityId: string;
    planId: string | null;
    payload: Record<string, unknown>;
    memberId?: string | null;
  }) => Promise<{ enqueued: boolean; coalesced: boolean }>;
  /** Força um flush manual (útil para retry pelo usuário). */
  flush: () => Promise<void>;
}

const OfflineQueueContext = createContext<OfflineQueueAPI | null>(null);

function summarizePayload(entity: WriteEntity, payload: Record<string, unknown>): string {
  const parts: string[] = [];
  const grab = (k: string) => {
    const v = payload[k];
    if (v !== undefined && v !== null && v !== "") parts.push(`${k}: ${String(v)}`);
  };
  if (entity === "income") { grab("source"); grab("amount"); }
  else if (entity === "expense") { grab("category"); grab("subcategory"); grab("amount"); }
  else if (entity === "debt") { grab("institution"); grab("total_balance"); }
  else if (entity === "asset") { grab("ticker_or_name"); grab("current_amount"); }
  else if (entity === "plan_member") { grab("name"); grab("age"); }
  else if (entity === "monthly_tracking") { grab("month_key"); grab("actual_total"); }
  return parts.length > 0 ? parts.join(" · ") : "Atualização sem campos comparáveis";
}

function summarizeRow(entity: WriteEntity, row: Record<string, unknown>): string {
  return summarizePayload(entity, row);
}

async function dispatchMonthlyTrackingWrite(
  write: QueuedWrite,
  askUserForConflict: (write: QueuedWrite, cloudRow: Record<string, unknown>) => Promise<"mine" | "cloud" | "postpone">,
): Promise<"done" | "conflict_postponed"> {
  const monthKey = String(write.payload.month_key ?? "");
  if (!write.planId || !monthKey) throw new Error("Registro mensal incompleto.");

  const { data: current } = await supabase
    .from("monthly_tracking")
    .select("*")
    .eq("plan_id", write.planId)
    .eq("user_id", write.userId)
    .eq("month_key", monthKey)
    .maybeSingle();

  if (current) {
    const cloudUpdatedAt = (current as { updated_at?: string }).updated_at;
    if (cloudUpdatedAt && cloudUpdatedAt > write.enqueuedAt) {
      const decision = await askUserForConflict(write, current as Record<string, unknown>);
      if (decision === "postpone") return "conflict_postponed";
      if (decision === "cloud") {
        await removeWrite(write.id);
        return "done";
      }
    }
  }

  const memberInputs = (write.payload.member_inputs ?? []) as Array<Record<string, unknown>>;
  const trackingPayload = { ...write.payload } as Record<string, unknown>;
  delete trackingPayload.member_inputs;
  delete trackingPayload.id;

  let trackingId = (current as { id?: string } | null)?.id ?? null;
  if (trackingId) {
    const { data, error } = await supabase
      .from("monthly_tracking")
      .update(trackingPayload as never)
      .eq("id", trackingId)
      .eq("user_id", write.userId)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Falha ao atualizar mês.");
  } else {
    const { data, error } = await supabase
      .from("monthly_tracking")
      .insert(trackingPayload as never)
      .select("id")
      .single();
    if (error || !data) throw new Error(error?.message ?? "Falha ao criar mês.");
    trackingId = (data as { id: string }).id;
  }

  await supabase
    .from("monthly_member_tracking")
    .delete()
    .eq("monthly_tracking_id", trackingId)
    .eq("user_id", write.userId);

  const rows = memberInputs
    .filter((m) => m.plan_member_id)
    .map((m) => ({ ...m, user_id: write.userId, monthly_tracking_id: trackingId }));
  if (rows.length > 0) {
    const { error } = await supabase.from("monthly_member_tracking").insert(rows as never);
    if (error) throw new Error(error.message);
  }

  await removeWrite(write.id);
  return "done";
}

interface ProviderProps {
  children: ReactNode;
}

export function OfflineQueueProvider({ children }: ProviderProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [count, setCount] = useState(0);
  const [stuckCount, setStuckCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [conflict, setConflict] = useState<PendingConflict | null>(null);
  const flushingRef = useRef(false);

  // Atualiza contador (chamado após enqueue, flush, etc.)
  const refreshCount = useCallback(async () => {
    if (!userId) {
      setCount(0);
      setStuckCount(0);
      return;
    }
    const expired = await quarantineExpiredWrites(userId);
    if (expired > 0) {
      logger.warn("offlineQueue.ttl.dead_letter", { userId, count: expired });
    }
    const [pending, dead] = await Promise.all([countWrites(userId), countDeadLetters(userId)]);
    setCount(pending);
    setStuckCount(dead);
  }, [userId]);

  useEffect(() => {
    void refreshCount();
  }, [refreshCount]);

  // --- Conflict resolution: bloqueia até o usuário decidir ---
  const askUserForConflict = useCallback(
    (write: QueuedWrite, cloudRow: Record<string, unknown>): Promise<"mine" | "cloud" | "postpone"> => {
      return new Promise((resolve) => {
        setConflict({ write, cloudRow, resolve });
      });
    },
    [],
  );

  // --- Dispatcher de um único write ---
  const dispatchWrite = useCallback(
    async (write: QueuedWrite): Promise<"done" | "kept" | "conflict_postponed"> => {
      const table = ENTITY_TO_TABLE[write.entity];
      if (!table) {
        await removeWrite(write.id);
        return "done";
      }

      try {
        if (write.attempts >= MAX_WRITE_ATTEMPTS) {
          await deadLetterWrite(write.id, "Limite de tentativas de sincronização excedido.");
          toast.error(`Uma ${ENTITY_LABEL[write.entity]} precisa de revisão em Dados.`);
          return "done";
        }
        if (write.entity === "monthly_tracking") {
          return await dispatchMonthlyTrackingWrite(write, askUserForConflict);
        }
        if (write.op === "create") {
          const payload = { ...write.payload, user_id: write.userId };
          if (write.planId) (payload as Record<string, unknown>).plan_id = write.planId;
          if (write.memberId) (payload as Record<string, unknown>).member_id = write.memberId;
          const { data, error } = await supabase
            .from(table as never)
            .insert(payload as never)
            .select()
            .single();
          if (error || !data) throw new Error(error?.message ?? "Falha ao criar.");
          // Rebind id local → real para writes pendentes desta entidade.
          const newId = (data as { id: string }).id;
          await rebindEntityId(write.userId, write.entity, write.entityId, newId);
          await removeWrite(write.id);
          return "done";
        }

        if (write.op === "update") {
          // Detecção de conflito: lê updated_at atual do servidor.
          const { data: current } = await supabase
            .from(table as never)
            .select("*")
            .eq("id", write.entityId)
            .eq("user_id", write.userId)
            .maybeSingle();

          if (current) {
            const cloudUpdatedAt = (current as { updated_at?: string }).updated_at;
            if (cloudUpdatedAt && cloudUpdatedAt > write.enqueuedAt) {
              const decision = await askUserForConflict(write, current as Record<string, unknown>);
              if (decision === "postpone") return "conflict_postponed";
              if (decision === "cloud") {
                await removeWrite(write.id);
                return "done";
              }
              // "mine" → segue o update normalmente.
            }
          }

          const updatePayload = { ...write.payload };
          delete (updatePayload as Record<string, unknown>).user_id;
          delete (updatePayload as Record<string, unknown>).plan_id;
          if (write.memberId !== null) (updatePayload as Record<string, unknown>).member_id = write.memberId;
          const { error } = await supabase
            .from(table as never)
            .update(updatePayload as never)
            .eq("id", write.entityId)
            .eq("user_id", write.userId);
          if (error) throw new Error(error.message);
          await removeWrite(write.id);
          return "done";
        }

        if (write.op === "delete") {
          const { error } = await supabase
            .from(table as never)
            .delete()
            .eq("id", write.entityId)
            .eq("user_id", write.userId);
          if (error) throw new Error(error.message);
          await removeWrite(write.id);
          return "done";
        }

        return "done";
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const isPermanent = PERMANENT_ERROR.test(message);
        if (isPermanent) {
          logger.error("offlineQueue.dispatch.permanent_fail", {
            entity: write.entity, op: write.op, entityId: write.entityId,
          }, err);
          await removeWrite(write.id);
          toast.error(
            `Não conseguimos sincronizar uma ${ENTITY_LABEL[write.entity]}: ${toFriendlyError(message)}`,
          );
          return "done";
        }
        // Transitório: mantém na fila para próximo flush.
        await updateWriteAttempt(write.id, {
          attempts: write.attempts + 1,
          lastError: message,
        });
        logger.warn("offlineQueue.dispatch.transient_fail", {
          entity: write.entity, op: write.op, attempts: write.attempts + 1,
        }, err);
        return "kept";
      }
    },
    [askUserForConflict],
  );

  // --- Flush completo da fila ---
  const flush = useCallback(async () => {
    if (!userId) return;
    if (flushingRef.current) return;
    flushingRef.current = true;
    setSyncing(true);
    try {
      const writes = await listWrites(userId);
      if (writes.length === 0) {
        await refreshCount();
        return;
      }
      const initialCount = writes.length;
      let processed = 0;
      let postponed = 0;

      for (const w of writes) {
        const result = await dispatchWrite(w);
        if (result === "done") processed++;
        else if (result === "conflict_postponed") postponed++;
        else break; // erro transitório: para o flush; tenta de novo depois.
      }

      await refreshCount();
      if (processed > 0) {
        toast.success(
          processed === initialCount
            ? `${processed} ${processed === 1 ? "alteração sincronizada" : "alterações sincronizadas"}.`
            : `${processed} de ${initialCount} sincronizadas. ${postponed > 0 ? `${postponed} aguardando sua decisão.` : "Vamos tentar o restante em instantes."}`,
        );
      }
    } finally {
      flushingRef.current = false;
      setSyncing(false);
    }
  }, [userId, dispatchWrite, refreshCount]);

  // --- Auto-flush ao reconectar ---
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onOnline = () => { void flush(); };
    window.addEventListener("online", onOnline);
    // Tenta um flush inicial ao montar (caso já esteja online com fila pendente).
    if (typeof navigator === "undefined" || navigator.onLine !== false) {
      void flush();
    }
    return () => window.removeEventListener("online", onOnline);
  }, [flush]);

  // --- API pública ---
  const enqueue = useCallback<OfflineQueueAPI["enqueue"]>(
    async (input) => {
      if (!userId) return { enqueued: false, coalesced: false };
      const r = await enqueueWrite({
        userId,
        entity: input.entity,
        op: input.op,
        entityId: input.entityId,
        planId: input.planId,
        payload: input.payload,
        memberId: input.memberId ?? null,
      });
      await refreshCount();
      return { enqueued: r.enqueuedId !== null, coalesced: r.coalesced };
    },
    [userId, refreshCount],
  );

  const value = useMemo<OfflineQueueAPI>(
    () => ({ count, syncing, stuckCount, enqueue, flush }),
    [count, syncing, stuckCount, enqueue, flush],
  );

  // --- Conflict UI binding ---
  const conflictDescriptor: ConflictDescriptor | null = conflict
    ? {
        entityLabel: ENTITY_LABEL[conflict.write.entity],
        mineSummary: summarizePayload(conflict.write.entity, conflict.write.payload),
        cloudSummary: summarizeRow(conflict.write.entity, conflict.cloudRow),
        mineAt: conflict.write.enqueuedAt,
        cloudAt: (conflict.cloudRow.updated_at as string) ?? new Date().toISOString(),
      }
    : null;

  return (
    <OfflineQueueContext.Provider value={value}>
      {children}
      <ConflictResolutionDialog
        open={conflict !== null}
        conflict={conflictDescriptor}
        onKeepMine={() => {
          conflict?.resolve("mine");
          setConflict(null);
        }}
        onKeepCloud={() => {
          conflict?.resolve("cloud");
          setConflict(null);
        }}
        onPostpone={() => {
          conflict?.resolve("postpone");
          setConflict(null);
        }}
      />
    </OfflineQueueContext.Provider>
  );
}

export function useOfflineQueue(): OfflineQueueAPI {
  const ctx = useContext(OfflineQueueContext);
  if (!ctx) {
    // Fallback no-op: permite uso em testes/contextos sem provider.
    return {
      count: 0,
      syncing: false,
      stuckCount: 0,
      enqueue: async () => ({ enqueued: false, coalesced: false }),
      flush: async () => {},
    };
  }
  return ctx;
}
