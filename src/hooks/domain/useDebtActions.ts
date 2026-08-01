/**
 * useDebtActions — handler de domínio para Dívidas.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Debt } from "@/lib/models";
import { useDebtWriter, debtToPayload } from "@/hooks/useDebtWriter";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { toFriendlyError } from "@/lib/errors/friendlyError";
import { withRetry, logger } from "@/lib/logger";

interface Deps {
  user: { id: string } | null;
  planId: string | null;
  resolveMemberId: (profileId?: string) => string | null;
  addDebtLocal: (debt: Debt) => void;
  updateDebtLocal: (id: string, updates: Partial<Debt>) => void;
  deleteDebtLocal: (id: string) => void;
  getDebtById?: (id: string) => Debt | undefined;
}

export interface DebtActions {
  add: (debt: Debt) => Promise<void>;
  update: (id: string, updates: Partial<Debt>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const NO_MEMBER_MSG =
  "Selecione um participante ativo para esta dívida antes de salvar.";

export function useDebtActions(deps: Deps): DebtActions {
  const {
    user, planId, resolveMemberId,
    addDebtLocal, updateDebtLocal, deleteDebtLocal, getDebtById,
  } = deps;
  const writer = useDebtWriter();
  const offlineQueue = useOfflineQueue();

  const add = useCallback(async (debt: Debt) => {
    let memberId: string | null = null;
    if (user && planId) {
      memberId = resolveMemberId(debt.profileId);
      if (!memberId) {
        toast.error(NO_MEMBER_MSG);
        return;
      }
    }

    addDebtLocal({ ...debt, ownershipScope: debt.ownershipScope ?? "individual" });
    if (!user || !planId || !memberId) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = debtToPayload(debt, {
        userId: user.id, planId, memberId, ownershipScope: "individual",
      });
      await offlineQueue.enqueue({
        entity: "debt", op: "create", entityId: debt.id, planId, payload, memberId,
      });
      toast.success("Sem conexão — salvaremos quando a internet voltar.");
      logger.warn("writer.debt.offline.enqueued", { userId: user.id, planId });
      return;
    }

    const r = await withRetry(
      () => writer.createDebt(planId, debt, memberId),
      { event: "writer.debt.create", context: { userId: user.id, planId } },
    );
    if (r.error) {
      deleteDebtLocal(debt.id);
      toast.error(`Falha ao salvar dívida: ${toFriendlyError(r.error)}`);
    } else if (r.data) {
      updateDebtLocal(debt.id, {
        id: r.data.id,
        ownershipScope: r.data.ownership_scope,
        profileId: r.data.member_id ?? debt.profileId,
      });
    }
  }, [user, planId, writer, resolveMemberId, addDebtLocal, updateDebtLocal, deleteDebtLocal, offlineQueue]);

  const update = useCallback(async (id: string, updates: Partial<Debt>) => {
    const ownerChanged = updates.profileId !== undefined;
    const memberId: string | null | undefined = ownerChanged
      ? resolveMemberId(updates.profileId)
      : undefined;
    if (ownerChanged && !memberId) {
      toast.error(NO_MEMBER_MSG);
      return;
    }

    const prev = getDebtById?.(id);
    const localPatch: Partial<Debt> = ownerChanged
      ? { ...updates, ownershipScope: "individual" }
      : updates;
    updateDebtLocal(id, localPatch);
    if (!user || !planId) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = debtToPayload(localPatch, {
        userId: user.id,
        planId,
        memberId,
        ownershipScope: ownerChanged ? "individual" : undefined,
      });
      await offlineQueue.enqueue({
        entity: "debt", op: "update", entityId: id, planId, payload,
        memberId: memberId ?? null,
      });
      toast.success("Sem conexão — sua alteração ficou em fila.");
      return;
    }

    const r = await withRetry(
      () => writer.updateDebt(planId, id, localPatch, memberId),
      { event: "writer.debt.update", context: { userId: user.id, planId } },
    );
    if (r.error) {
      if (prev) updateDebtLocal(id, prev);
      toast.error(`Falha ao atualizar dívida: ${toFriendlyError(r.error)}`);
    }
  }, [user, planId, writer, resolveMemberId, updateDebtLocal, getDebtById, offlineQueue]);

  const remove = useCallback(async (id: string) => {
    const prev = getDebtById?.(id);
    deleteDebtLocal(id);
    if (!user) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await offlineQueue.enqueue({
        entity: "debt", op: "delete", entityId: id, planId, payload: {}, memberId: null,
      });
      return;
    }
    const r = await withRetry(
      () => writer.deleteDebt(id),
      { event: "writer.debt.delete", context: { userId: user.id } },
    );
    if (r.error) {
      if (prev) addDebtLocal(prev);
      toast.error(`Falha ao remover dívida: ${toFriendlyError(r.error)}`);
    }
  }, [user, planId, writer, deleteDebtLocal, addDebtLocal, getDebtById, offlineQueue]);

  return { add, update, remove };
}
