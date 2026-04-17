/**
 * useExpenseActions — handler de domínio para Gastos.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Expense } from "@/lib/models";
import { useExpenseWriter } from "@/hooks/useExpenseWriter";

interface Deps {
  user: { id: string } | null;
  planId: string | null;
  resolveMemberId: (profileId?: string) => string | null;
  addExpenseLocal: (expense: Expense) => void;
  updateExpenseLocal: (id: string, updates: Partial<Expense>) => void;
  deleteExpenseLocal: (id: string) => void;
}

export interface ExpenseActions {
  add: (expense: Expense) => Promise<void>;
  update: (id: string, updates: Partial<Expense>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useExpenseActions(deps: Deps): ExpenseActions {
  const { user, planId, resolveMemberId, addExpenseLocal, updateExpenseLocal, deleteExpenseLocal } = deps;
  const writer = useExpenseWriter();

  const add = useCallback(async (expense: Expense) => {
    addExpenseLocal(expense);
    if (!user || !planId) return;
    const r = await writer.createExpense(planId, expense, resolveMemberId(expense.responsibleProfileId));
    if (r.error) toast.error(`Falha ao salvar gasto: ${r.error}`);
    else if (r.data) updateExpenseLocal(expense.id, { id: r.data.id } as Partial<Expense>);
  }, [user, planId, writer, resolveMemberId, addExpenseLocal, updateExpenseLocal]);

  const update = useCallback(async (id: string, updates: Partial<Expense>) => {
    updateExpenseLocal(id, updates);
    if (!user || !planId) return;
    const memberId = updates.responsibleProfileId !== undefined ? resolveMemberId(updates.responsibleProfileId) : undefined;
    const r = await writer.updateExpense(planId, id, updates, memberId);
    if (r.error) toast.error(`Falha ao atualizar gasto: ${r.error}`);
  }, [user, planId, writer, resolveMemberId, updateExpenseLocal]);

  const remove = useCallback(async (id: string) => {
    deleteExpenseLocal(id);
    if (!user) return;
    const r = await writer.deleteExpense(id);
    if (r.error) toast.error(`Falha ao remover gasto: ${r.error}`);
  }, [user, writer, deleteExpenseLocal]);

  return { add, update, remove };
}
