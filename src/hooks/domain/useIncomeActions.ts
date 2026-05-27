/**
 * useIncomeActions — handler de domínio para Renda.
 * Encapsula: cache local otimista + persistência (Supabase) + toast + rebind de id.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Income } from "@/lib/models";
import { useIncomeWriter, incomeToPayload } from "@/hooks/useIncomeWriter";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { toFriendlyError } from "@/lib/errors/friendlyError";
import { withRetry, logger } from "@/lib/logger";

interface Deps {
  user: { id: string } | null;
  planId: string | null;
  resolveMemberId: (profileId?: string) => string | null;
  addIncomeLocal: (income: Income) => void;
  updateIncomeLocal: (id: string, updates: Partial<Income>) => void;
  deleteIncomeLocal: (id: string) => void;
  /** Necessário para rollback otimista em update/delete. */
  getIncomeById?: (id: string) => Income | undefined;
}

export interface IncomeActions {
  add: (income: Income) => Promise<void>;
  update: (id: string, updates: Partial<Income>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useIncomeActions(deps: Deps): IncomeActions {
  const { user, planId, resolveMemberId, addIncomeLocal, updateIncomeLocal, deleteIncomeLocal, getIncomeById } = deps;
  const writer = useIncomeWriter();
  const offlineQueue = useOfflineQueue();

  const add = useCallback(async (income: Income) => {
    addIncomeLocal(income);
    if (!user || !planId) return;
    const memberId = resolveMemberId(income.profileId);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = incomeToPayload(income, { userId: user.id, planId, memberId });
      const r = await offlineQueue.enqueue({
        entity: "income", op: "create", entityId: income.id, planId, payload, memberId,
      });
      if (r.enqueued) toast.success("Sem conexão — salvaremos quando a internet voltar.");
      logger.warn("writer.income.offline.enqueued", { userId: user.id, planId });
      return;
    }
    const r = await withRetry(
      () => writer.createIncome(planId, income, memberId),
      { event: "writer.income.create", context: { userId: user.id, planId } },
    );
    if (r.error) {
      deleteIncomeLocal(income.id);
      toast.error(`Falha ao salvar renda: ${toFriendlyError(r.error)}`);
    } else if (r.data) {
      updateIncomeLocal(income.id, { id: r.data.id } as Partial<Income>);
    }
  }, [user, planId, writer, resolveMemberId, addIncomeLocal, updateIncomeLocal, deleteIncomeLocal, offlineQueue]);

  const update = useCallback(async (id: string, updates: Partial<Income>) => {
    // Só resolve memberId quando o titular foi explicitamente alterado.
    const titularChanged = updates.profileId !== undefined;
    const memberId: string | null | undefined = titularChanged
      ? resolveMemberId(updates.profileId)
      : undefined;
    const prev = getIncomeById?.(id);
    updateIncomeLocal(id, updates);
    if (!user || !planId) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = incomeToPayload(updates, { userId: user.id, planId, memberId });
      await offlineQueue.enqueue({
        entity: "income", op: "update", entityId: id, planId, payload, memberId: memberId ?? null,
      });
      toast.success("Sem conexão — sua alteração ficou em fila.");
      return;
    }
    const r = await withRetry(
      () => writer.updateIncome(planId, id, updates, memberId),
      { event: "writer.income.update", context: { userId: user.id, planId } },
    );
    if (r.error) {
      if (prev) updateIncomeLocal(id, prev);
      toast.error(`Falha ao atualizar renda: ${toFriendlyError(r.error)}`);
    }
  }, [user, planId, writer, resolveMemberId, updateIncomeLocal, getIncomeById, offlineQueue]);

  const remove = useCallback(async (id: string) => {
    const prev = getIncomeById?.(id);
    deleteIncomeLocal(id);
    if (!user) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const r = await offlineQueue.enqueue({
        entity: "income", op: "delete", entityId: id, planId, payload: {}, memberId: null,
      });
      if (r.coalesced) {
        // create pendente foi cancelado: não precisa avisar nada além do toast padrão.
      }
      return;
    }
    const r = await withRetry(
      () => writer.deleteIncome(id),
      { event: "writer.income.delete", context: { userId: user.id } },
    );
    if (r.error) {
      if (prev) addIncomeLocal(prev);
      toast.error(`Falha ao remover renda: ${toFriendlyError(r.error)}`);
    }
  }, [user, planId, writer, deleteIncomeLocal, addIncomeLocal, getIncomeById, offlineQueue]);

  return { add, update, remove };
}
