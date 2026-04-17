/**
 * useDebtActions — handler de domínio para Dívidas.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Debt } from "@/lib/models";
import { useDebtWriter } from "@/hooks/useDebtWriter";

interface Deps {
  user: { id: string } | null;
  planId: string | null;
  resolveMemberId: (profileId?: string) => string | null;
  addDebtLocal: (debt: Debt) => void;
  updateDebtLocal: (id: string, updates: Partial<Debt>) => void;
  deleteDebtLocal: (id: string) => void;
}

export interface DebtActions {
  add: (debt: Debt) => Promise<void>;
  update: (id: string, updates: Partial<Debt>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useDebtActions(deps: Deps): DebtActions {
  const { user, planId, resolveMemberId, addDebtLocal, updateDebtLocal, deleteDebtLocal } = deps;
  const writer = useDebtWriter();

  const add = useCallback(async (debt: Debt) => {
    addDebtLocal(debt);
    if (!user || !planId) return;
    const r = await writer.createDebt(planId, debt, resolveMemberId(debt.profileId));
    if (r.error) toast.error(`Falha ao salvar dívida: ${r.error}`);
    else if (r.data) updateDebtLocal(debt.id, { id: r.data.id } as Partial<Debt>);
  }, [user, planId, writer, resolveMemberId, addDebtLocal, updateDebtLocal]);

  const update = useCallback(async (id: string, updates: Partial<Debt>) => {
    updateDebtLocal(id, updates);
    if (!user || !planId) return;
    const memberId = updates.profileId !== undefined ? resolveMemberId(updates.profileId) : undefined;
    const r = await writer.updateDebt(planId, id, updates, memberId);
    if (r.error) toast.error(`Falha ao atualizar dívida: ${r.error}`);
  }, [user, planId, writer, resolveMemberId, updateDebtLocal]);

  const remove = useCallback(async (id: string) => {
    deleteDebtLocal(id);
    if (!user) return;
    const r = await writer.deleteDebt(id);
    if (r.error) toast.error(`Falha ao remover dívida: ${r.error}`);
  }, [user, writer, deleteDebtLocal]);

  return { add, update, remove };
}
