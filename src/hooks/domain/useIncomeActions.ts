/**
 * useIncomeActions — handler de domínio para Renda.
 * Encapsula: cache local otimista + persistência (Supabase) + toast + rebind de id.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Income } from "@/lib/models";
import { useIncomeWriter } from "@/hooks/useIncomeWriter";
import { toFriendlyError } from "@/lib/errors/friendlyError";
import { withRetry, logger } from "@/lib/logger";

interface Deps {
  user: { id: string } | null;
  planId: string | null;
  resolveMemberId: (profileId?: string) => string | null;
  addIncomeLocal: (income: Income) => void;
  updateIncomeLocal: (id: string, updates: Partial<Income>) => void;
  deleteIncomeLocal: (id: string) => void;
}

export interface IncomeActions {
  add: (income: Income) => Promise<void>;
  update: (id: string, updates: Partial<Income>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useIncomeActions(deps: Deps): IncomeActions {
  const { user, planId, resolveMemberId, addIncomeLocal, updateIncomeLocal, deleteIncomeLocal } = deps;
  const writer = useIncomeWriter();

  const add = useCallback(async (income: Income) => {
    addIncomeLocal(income);
    if (!user || !planId) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast.error("Sem conexão. Vamos tentar de novo quando a internet voltar.");
      logger.warn("writer.income.offline", { userId: user.id, planId, action: "add" });
      return;
    }
    const r = await withRetry(
      () => writer.createIncome(planId, income, resolveMemberId(income.profileId)),
      { event: "writer.income.create", context: { userId: user.id, planId } },
    );
    if (r.error) toast.error(`Falha ao salvar renda: ${toFriendlyError(r.error)}`);
    else if (r.data) updateIncomeLocal(income.id, { id: r.data.id } as Partial<Income>);
  }, [user, planId, writer, resolveMemberId, addIncomeLocal, updateIncomeLocal]);

  const update = useCallback(async (id: string, updates: Partial<Income>) => {
    updateIncomeLocal(id, updates);
    if (!user || !planId) return;
    const memberId = updates.profileId !== undefined ? resolveMemberId(updates.profileId) : undefined;
    const r = await withRetry(
      () => writer.updateIncome(planId, id, updates, memberId),
      { event: "writer.income.update", context: { userId: user.id, planId } },
    );
    if (r.error) toast.error(`Falha ao atualizar renda: ${toFriendlyError(r.error)}`);
  }, [user, planId, writer, resolveMemberId, updateIncomeLocal]);

  const remove = useCallback(async (id: string) => {
    deleteIncomeLocal(id);
    if (!user) return;
    const r = await withRetry(
      () => writer.deleteIncome(id),
      { event: "writer.income.delete", context: { userId: user.id } },
    );
    if (r.error) toast.error(`Falha ao remover renda: ${toFriendlyError(r.error)}`);
  }, [user, writer, deleteIncomeLocal]);

  return { add, update, remove };
}
