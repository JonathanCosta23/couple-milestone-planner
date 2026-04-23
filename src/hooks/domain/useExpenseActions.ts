/**
 * useExpenseActions — handler de domínio para Gastos.
 *
 * Inclui também as operações derivadas que historicamente viviam apenas em
 * memória (`duplicate`, `markPaid`, `convertToRecurring`). Agora todas
 * passam pelo writer real, mantendo a fonte única de verdade.
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
  // Para convertToRecurring — recurring expense é template local (sem tabela própria).
  addRecurringExpenseLocal?: (recurring: RecurringExpense) => void;
  // Para duplicate — precisamos do estado atual para ler o gasto fonte.
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

export function useExpenseActions(deps: Deps): ExpenseActions {
  const {
    user, planId, resolveMemberId,
    addExpenseLocal, updateExpenseLocal, deleteExpenseLocal,
    addRecurringExpenseLocal, getExpenseById,
  } = deps;
  const writer = useExpenseWriter();
  const offlineQueue = useOfflineQueue();

  const add = useCallback(async (expense: Expense) => {
    addExpenseLocal(expense);
    if (!user || !planId) return;
    const memberId = resolveMemberId(expense.responsibleProfileId);
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = expenseToPayload(expense, { userId: user.id, planId, memberId });
      await offlineQueue.enqueue({ entity: "expense", op: "create", entityId: expense.id, planId, payload, memberId });
      toast.success("Sem conexão — salvaremos quando a internet voltar.");
      logger.warn("writer.expense.offline.enqueued", { userId: user.id, planId });
      return;
    }
    const r = await withRetry(
      () => writer.createExpense(planId, expense, memberId),
      { event: "writer.expense.create", context: { userId: user.id, planId } },
    );
    if (r.error) toast.error(`Falha ao salvar gasto: ${toFriendlyError(r.error)}`);
    else if (r.data) updateExpenseLocal(expense.id, { id: r.data.id } as Partial<Expense>);
  }, [user, planId, writer, resolveMemberId, addExpenseLocal, updateExpenseLocal, offlineQueue]);

  const update = useCallback(async (id: string, updates: Partial<Expense>) => {
    updateExpenseLocal(id, updates);
    if (!user || !planId) return;
    const memberId = updates.responsibleProfileId !== undefined ? resolveMemberId(updates.responsibleProfileId) : undefined;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = expenseToPayload(updates, { userId: user.id, planId, memberId });
      await offlineQueue.enqueue({ entity: "expense", op: "update", entityId: id, planId, payload, memberId: memberId ?? null });
      toast.success("Sem conexão — sua alteração ficou em fila.");
      return;
    }
    const r = await withRetry(
      () => writer.updateExpense(planId, id, updates, memberId),
      { event: "writer.expense.update", context: { userId: user.id, planId } },
    );
    if (r.error) toast.error(`Falha ao atualizar gasto: ${toFriendlyError(r.error)}`);
  }, [user, planId, writer, resolveMemberId, updateExpenseLocal, offlineQueue]);

  const remove = useCallback(async (id: string) => {
    deleteExpenseLocal(id);
    if (!user) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await offlineQueue.enqueue({ entity: "expense", op: "delete", entityId: id, planId, payload: {}, memberId: null });
      return;
    }
    const r = await withRetry(
      () => writer.deleteExpense(id),
      { event: "writer.expense.delete", context: { userId: user.id } },
    );
    if (r.error) toast.error(`Falha ao remover gasto: ${toFriendlyError(r.error)}`);
  }, [user, planId, writer, deleteExpenseLocal, offlineQueue]);

  // ---- Operações derivadas (agora persistidas) ----

  const duplicate = useCallback(async (id: string) => {
    const source = getExpenseById?.(id);
    if (!source) {
      toast.error("Gasto não encontrado para duplicar.");
      return;
    }
    const copy: Expense = {
      ...source,
      id: generateId(),
      name: `${source.name} (cópia)`,
      status: "pending",
      paidDate: undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addExpenseLocal(copy);
    if (!user || !planId) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast.error("Sem conexão. Vamos tentar de novo quando a internet voltar.");
      logger.warn("writer.expense.offline", { userId: user.id, planId, action: "duplicate" });
      return;
    }
    const r = await withRetry(
      () => writer.createExpense(planId, copy, resolveMemberId(copy.responsibleProfileId)),
      { event: "writer.expense.duplicate", context: { userId: user.id, planId } },
    );
    if (r.error) toast.error(`Falha ao duplicar gasto: ${toFriendlyError(r.error)}`);
    else if (r.data) updateExpenseLocal(copy.id, { id: r.data.id } as Partial<Expense>);
  }, [user, planId, writer, resolveMemberId, addExpenseLocal, updateExpenseLocal, getExpenseById]);

  const markPaid = useCallback(async (id: string) => {
    const patch: Partial<Expense> = {
      status: "paid",
      paidDate: new Date().toISOString().slice(0, 10),
      updatedAt: new Date().toISOString(),
    };
    updateExpenseLocal(id, patch);
    if (!user || !planId) return;
    const r = await withRetry(
      () => writer.updateExpense(planId, id, patch),
      { event: "writer.expense.markPaid", context: { userId: user.id, planId } },
    );
    if (r.error) toast.error(`Falha ao marcar como pago: ${toFriendlyError(r.error)}`);
  }, [user, planId, writer, updateExpenseLocal]);

  const convertToRecurring = useCallback(async (id: string) => {
    const source = getExpenseById?.(id);
    if (!source) {
      toast.error("Gasto não encontrado para converter.");
      return;
    }
    // 1) Mantém template local (RecurringExpense ainda não tem tabela própria).
    const recurring: RecurringExpense = {
      id: generateId(),
      name: source.name,
      amount: source.amount,
      category: source.category,
      subcategory: source.subcategory,
      type: source.type,
      ownership: source.ownership,
      responsibleProfileId: source.responsibleProfileId,
      priority: source.priority,
      active: true,
      startDate: source.monthKey,
      createdAt: new Date().toISOString(),
    };
    addRecurringExpenseLocal?.(recurring);
    // 2) Persiste no banco marcando o gasto fonte como recorrente (round-trip real).
    const patch: Partial<Expense> = {
      recurrence: "monthly",
      updatedAt: new Date().toISOString(),
    };
    updateExpenseLocal(id, patch);
    if (!user || !planId) return;
    const r = await withRetry(
      () => writer.updateExpense(planId, id, patch),
      { event: "writer.expense.convertRecurring", context: { userId: user.id, planId } },
    );
    if (r.error) toast.error(`Falha ao converter em recorrente: ${toFriendlyError(r.error)}`);
  }, [user, planId, writer, updateExpenseLocal, addRecurringExpenseLocal, getExpenseById]);

  return { add, update, remove, duplicate, markPaid, convertToRecurring };
}
