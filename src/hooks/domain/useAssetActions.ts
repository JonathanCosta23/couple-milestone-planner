/**
 * useAssetActions — handler de domínio para Investimentos (assets).
 * - Valida member_id antes de chamar o Supabase (evita erro de FK).
 * - Mantém fallback de soft-delete (deactivateAsset) quando delete falha.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Investment } from "@/lib/models";
import { useAssetWriter } from "@/hooks/useAssetWriter";
import { toFriendlyError } from "@/lib/errors/friendlyError";
import { withRetry, logger } from "@/lib/logger";

interface Deps {
  user: { id: string } | null;
  planId: string | null;
  /** Resolve um member.id real e ativo do plano para o profileId informado. */
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

const NO_MEMBER_MSG =
  "Não foi possível vincular esse investimento a um participante válido do plano. Atualize os participantes e tente novamente.";

export function useAssetActions(deps: Deps): AssetActions {
  const { user, planId, resolveMemberId, addInvestmentLocal, updateInvestmentLocal, deleteInvestmentLocal } = deps;
  const writer = useAssetWriter();

  const add = useCallback(async (inv: Investment) => {
    addInvestmentLocal(inv);
    if (!user || !planId) return;
    const memberId = resolveMemberId(inv.profileId);
    if (!memberId) {
      toast.error(NO_MEMBER_MSG);
      return;
    }
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      toast.error("Sem conexão. Vamos tentar de novo quando a internet voltar.");
      logger.warn("writer.asset.offline", { userId: user.id, planId, action: "add" });
      return;
    }
    const r = await withRetry(
      () => writer.createAsset(planId, inv, memberId),
      { event: "writer.asset.create", context: { userId: user.id, planId } },
    );
    if (r.error) toast.error(`Falha ao salvar investimento: ${toFriendlyError(r.error)}`);
    else if (r.data) updateInvestmentLocal(inv.id, { id: r.data.id } as Partial<Investment>);
  }, [user, planId, writer, resolveMemberId, addInvestmentLocal, updateInvestmentLocal]);

  const update = useCallback(async (id: string, updates: Partial<Investment>) => {
    updateInvestmentLocal(id, updates);
    if (!user || !planId) return;
    const memberId = resolveMemberId(updates.profileId);
    if (updates.profileId !== undefined && !memberId) {
      toast.error(NO_MEMBER_MSG);
      return;
    }
    const r = await withRetry(
      () => writer.updateAsset(planId, id, updates, memberId),
      { event: "writer.asset.update", context: { userId: user.id, planId } },
    );
    if (r.error) toast.error(`Falha ao atualizar investimento: ${toFriendlyError(r.error)}`);
  }, [user, planId, writer, resolveMemberId, updateInvestmentLocal]);

  const remove = useCallback(async (id: string) => {
    deleteInvestmentLocal(id);
    if (!user) return;
    const r = await withRetry(
      () => writer.deleteAsset(id),
      { event: "writer.asset.delete", context: { userId: user.id } },
    );
    if (r.error) {
      logger.warn("writer.asset.delete.fallback_deactivate", { userId: user.id });
      await writer.deactivateAsset(id);
    }
  }, [user, writer, deleteInvestmentLocal]);

  return { add, update, remove };
}
