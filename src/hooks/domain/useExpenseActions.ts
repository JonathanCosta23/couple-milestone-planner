/**
 * useExpenseActions — handler de domínio para Gastos.
 * Operações comuns preservam ownership; criação e troca de responsável exigem
 * participante ativo e usam scope individual.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Expense, RecurringExpense } from "@/lib/models";
import { generateId } from "@/lib/models";
import { useExpenseWriter, expenseToPayload } from "@/hooks/useExpenseWriter";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { toFriendlyError } from "@/lib/errors/friendlyError";
import { withRetry, logger } from "@/lib/logger";

interface Deps {
  user: { id: string } | null;
  planId: string | null;
  resolveMemberId: (profileId?: string) => string | null;
  addExpenseLocal: (expense: Expense) => void;
  updateExpenseLocal: (id: string, updates: Partial<Expense>) => void;
  deleteExpenseLocal: (id: string) => void;
  addRecurringExpenseLocal?: (recurring: RecurringExpense) => void;
  getExpenseById?: (id: string) => Expense | undefined;
}

export interface ExpenseActions {
  add: (expense: Expense) => Promise<void>;
  update: (id: string, updates: Partial<Expense>) => Promise<void>;
  remove: (id: string) => Promise<void>;
  duplicate: (id: string) => Promise<void>;
  markPaid: (id: string) => Promise<void>;
  convertToRecurring: (id: string) => Promise<void>;
}

const NO_MEMBER_MSG =
  "Selecione um participante ativo para este gasto antes de salvar.";
const SCOPE_LOCKED_MSG =
  "A propriedade compartilhada será habilitada em uma etapa específica de revisão.";

export function useExpenseActions(deps: Deps): ExpenseActions {
  const {
    user, planId, resolveMemberId,
    addExpenseLocal, updateExpenseLocal, deleteExpenseLocal,
    addRecurringExpenseLocal, getExpenseById,
  } = deps;
  const writer = useExpenseWriter();
  const offlineQueue = useOfflineQueue();

  const add = useCallback(async (expense: Expense) => {
    let memberId: string | null = null;
    if (user && planId) {
      memberId = resolveMemberId(expense.responsibleProfileId);
      if (!memberId) {
        toast.error(NO_MEMBER_MSG);
        return;
      }
    }

    const localExpense: Expense = {
      ...expense,
      ownership: "individual",
      ownershipScope: "individual",
    };
    addExpenseLocal(localExpense);
    if (!user || !planId || !memberId) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = expenseToPayload(localExpense, {
        userId: user.id, planId, memberId, ownershipScope: "individual",
      });
      await offlineQueue.enqueue({
        entity: "expense", op: "create", entityId: expense.id, planId, payload, memberId,
      });
      toast.success("Sem conexão — salvaremos quando a internet voltar.");
      logger.warn("writer.expense.offline.enqueued", { userId: user.id, planId });
      return;
    }

    const r = await withRetry(
      () => writer.createExpense(planId, localExpense, memberId),
      { event: "writer.expense.create", context: { userId: user.id, planId } },
    );
    if (r.error) {
      deleteExpenseLocal(expense.id);
      toast.error(`Falha ao salvar gasto: ${toFriendlyError(r.error)}`);
    } else if (r.data) {
      updateExpenseLocal(expense.id, {
        id: r.data.id,
        ownership: r.data.ownership_scope,
        ownershipScope: r.data.ownership_scope,
        responsibleProfileId: r.data.member_id ?? expense.responsibleProfileId,
      });
    }
  }, [user, planId, writer, resolveMemberId, addExpenseLocal, updateExpenseLocal, deleteExpenseLocal, offlineQueue]);

  const update = useCallback(async (id: string, updates: Partial<Expense>) => {
    const requestedScope = updates.ownershipScope ?? updates.ownership;
    if (requestedScope !== undefined && requestedScope !== "individual") {
      toast.error(SCOPE_LOCKED_MSG);
      return;
    }

    const ownerChanged = updates.responsibleProfileId !== undefined;
    const memberId: string | null | undefined = ownerChanged
      ? resolveMemberId(updates.responsibleProfileId)
      : undefined;
    if (ownerChanged && !memberId) {
      toast.error(NO_MEMBER_MSG);
      return;
    }

    const prev = getExpenseById?.(id);
    const localPatch: Partial<Expense> = ownerChanged
      ? { ...updates, ownership: "individual", ownershipScope: "individual" }
      : updates;
    updateExpenseLocal(id, localPatch);
    if (!user || !planId) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = expenseToPayload(localPatch, {
        userId: user.id,
        planId,
        memberId,
        ownershipScope: ownerChanged ? "individual" : undefined,
      });
      await offlineQueue.enqueue({
        entity: "expense", op: "update", entityId: id, planId, payload,
        memberId: memberId ?? null,
      });
      toast.success("Sem conexão — sua alteração ficou em fila.");
      return;
    }

    const r = await withRetry(
      () => writer.updateExpense(planId, id, localPatch, memberId),
      { event: "writer.expense.update", context: { userId: user.id, planId } },
    );
    if (r.error) {
      if (prev) updateExpenseLocal(id, prev);
      toast.error(`Falha ao atualizar gasto: ${toFriendlyError(r.error)}`);
    }
  }, [user, planId, writer, resolveMemberId, updateExpenseLocal, getExpenseById, offlineQueue]);

  const remove = useCallback(async (id: string) => {
    const prev = getExpenseById?.(id);
    deleteExpenseLocal(id);
    if (!user) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await offlineQueue.enqueue({
        entity: "expense", op: "delete", entityId: id, planId, payload: {}, memberId: null,
      });
      return;
    }
    const r = await withRetry(
      () => writer.deleteExpense(id),
      { event: "writer.expense.delete", context: { userId: user.id } },
    );
    if (r.error) {
      if (prev) addExpenseLocal(prev);
      toast.error(`Falha ao remover gasto: ${toFriendlyError(r.error)}`);
    }
  }, [user, planId, writer, deleteExpenseLocal, addExpenseLocal, getExpenseById, offlineQueue]);

  const duplicate = useCallback(async (id: string) => {
    const source = getExpenseById?.(id);
    if (!source) {
      toast.error("Gasto não encontrado para duplicar.");
      return;
    }
    const memberId = user && planId
      ? resolveMemberId(source.responsibleProfileId)
      : null;
    if (user && planId && !memberId) {
      toast.error(NO_MEMBER_MSG);
      return;
    }

    const copy: Expense = {
      ...source,
      id: generateId(),
      name: `${source.name} (cópia)`,
      status: "pending",
      ownership: "individual",
      ownershipScope: "individual",
      paidDate: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addExpenseLocal(copy);
    if (!user || !planId || !memberId) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = expenseToPayload(copy, {
        userId: user.id, planId, memberId, ownershipScope: "individual",
      });
      const r = await offlineQueue.enqueue({
        entity: "expense", op: "create", entityId: copy.id, planId, payload, memberId,
      });
      if (r.enqueued) toast.success("Sem conexão — duplicaremos quando a internet voltar.");
      logger.warn("writer.expense.offline.enqueued", { userId: user.id, planId, action: "duplicate" });
      return;
    }

    const r = await withRetry(
      () => writer.createExpense(planId, copy, memberId),
      { event: "writer.expense.duplicate", context: { userId: user.id, planId } },
    );
    if (r.error) {
      deleteExpenseLocal(copy.id);
      toast.error(`Falha ao duplicar gasto: ${toFriendlyError(r.error)}`);
    } else if (r.data) {
      updateExpenseLocal(copy.id, { id: r.data.id } as Partial<Expense>);
    }
  }, [user, planId, writer, resolveMemberId, addExpenseLocal, updateExpenseLocal, deleteExpenseLocal, getExpenseById, offlineQueue]);

  const markPaid = useCallback(async (id: string) => {
    const patch: Partial<Expense> = {
      status: "paid",
      paidDate: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    };
    updateExpenseLocal(id, patch);
    if (!user || !planId) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = expenseToPayload(patch, { userId: user.id, planId });
      const r = await offlineQueue.enqueue({
        entity: "expense", op: "update", entityId: id, planId, payload, memberId: null,
      });
      if (r.enqueued) toast.success("Sem conexão — registraremos como pago quando a internet voltar.");
      logger.warn("writer.expense.offline.enqueued", { userId: user.id, planId, action: "markPaid" });
      return;
    }
    const r = await withRetry(
      () => writer.updateExpense(planId, id, patch),
      { event: "writer.expense.markPaid", context: { userId: user.id, planId } },
    );
    if (r.error) toast.error(`Falha ao marcar como pago: ${toFriendlyError(r.error)}`);
  }, [user, planId, writer, updateExpenseLocal, offlineQueue]);

  const convertToRecurring = useCallback(async (id: string) => {
    const source = getExpenseById?.(id);
    if (!source) {
      toast.error("Gasto não encontrado para converter.");
      return;
    }
    const recurring: RecurringExpense = {
      id: generateId(),
      name: source.name,
      amount: source.amount,
      category: source.category,
      subcategory: source.subcategory,
      type: source.type,
      ownership: source.ownership,
      ownershipScope: source.ownershipScope,
      responsibleProfileId: source.responsibleProfileId,
      priority: source.priority,
      active: true,
      startDate: source.monthKey,
      createdAt: new Date().toISOString(),
    };
    addRecurringExpenseLocal?.(recurring);

    const patch: Partial<Expense> = {
      recurrence: "monthly",
      updatedAt: new Date().toISOString(),
    };
    updateExpenseLocal(id, patch);
    if (!user || !planId) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = expenseToPayload(patch, { userId: user.id, planId });
      const r = await offlineQueue.enqueue({
        entity: "expense", op: "update", entityId: id, planId, payload, memberId: null,
      });
      if (r.enqueued) toast.success("Sem conexão — converteremos em recorrente quando a internet voltar.");
      logger.warn("writer.expense.offline.enqueued", { userId: user.id, planId, action: "convertToRecurring" });
      return;
    }
    const r = await withRetry(
      () => writer.updateExpense(planId, id, patch),
      { event: "writer.expense.convertRecurring", context: { userId: user.id, planId } },
    );
    if (r.error) toast.error(`Falha ao converter em recorrente: ${toFriendlyError(r.error)}`);
  }, [user, planId, writer, updateExpenseLocal, addRecurringExpenseLocal, getExpenseById, offlineQueue]);

  return { add, update, remove, duplicate, markPaid, convertToRecurring };
}
