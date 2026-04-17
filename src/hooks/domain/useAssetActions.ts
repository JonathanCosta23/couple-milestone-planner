/**
 * useAssetActions — handler de domínio para Investimentos (assets).
 * Mantém fallback de soft-delete (deactivateAsset) quando delete falha por RLS/FK.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Investment } from "@/lib/models";
import { useAssetWriter } from "@/hooks/useAssetWriter";
import { toFriendlyError } from "@/lib/errors/friendlyError";

interface Deps {
  user: { id: string } | null;
  planId: string | null;
  /** Resolver dedicado para asset.profileId (mantém comportamento legado: null). */
  resolveMemberId: (profileId?: string) => string | null;
  addInvestmentLocal: (inv: Investment) => void;
  updateInvestmentLocal: (id: string, updates: Partial<Investment>) => void;
  deleteInvestmentLocal: (id: string) => void;
}

export interface AssetActions {
  add: (inv: Investment) => Promise<void>;
  update: (id: string, updates: Partial<Investment>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export function useAssetActions(deps: Deps): AssetActions {
  const { user, planId, resolveMemberId, addInvestmentLocal, updateInvestmentLocal, deleteInvestmentLocal } = deps;
  const writer = useAssetWriter();

  const add = useCallback(async (inv: Investment) => {
    addInvestmentLocal(inv);
    if (!user || !planId) return;
    const memberId = resolveMemberId(inv.profileId);
    const r = await writer.createAsset(planId, inv, memberId);
    if (r.error) toast.error(`Falha ao salvar investimento: ${r.error}`);
    else if (r.data) updateInvestmentLocal(inv.id, { id: r.data.id } as Partial<Investment>);
  }, [user, planId, writer, resolveMemberId, addInvestmentLocal, updateInvestmentLocal]);

  const update = useCallback(async (id: string, updates: Partial<Investment>) => {
    updateInvestmentLocal(id, updates);
    if (!user || !planId) return;
    const memberId = resolveMemberId(updates.profileId);
    const r = await writer.updateAsset(planId, id, updates, memberId);
    if (r.error) toast.error(`Falha ao atualizar investimento: ${r.error}`);
  }, [user, planId, writer, resolveMemberId, updateInvestmentLocal]);

  const remove = useCallback(async (id: string) => {
    deleteInvestmentLocal(id);
    if (!user) return;
    const r = await writer.deleteAsset(id);
    if (r.error) await writer.deactivateAsset(id);
  }, [user, writer, deleteInvestmentLocal]);

  return { add, update, remove };
}
