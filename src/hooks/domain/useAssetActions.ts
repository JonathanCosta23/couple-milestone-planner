/**
 * useAssetActions — handler de domínio para Investimentos.
 * Criação e troca de titular exigem membro ativo e ownership individual.
 */
import { useCallback } from "react";
import { toast } from "sonner";
import type { Investment } from "@/lib/models";
import { useAssetWriter, investmentToAssetPayload } from "@/hooks/useAssetWriter";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";
import { toFriendlyError } from "@/lib/errors/friendlyError";
import { withRetry, logger } from "@/lib/logger";

interface Deps {
  user: { id: string } | null;
  planId: string | null;
  resolveMemberId: (profileId?: string) => string | null;
  addInvestmentLocal: (inv: Investment) => void;
  updateInvestmentLocal: (id: string, updates: Partial<Investment>) => void;
  deleteInvestmentLocal: (id: string) => void;
  getInvestmentById?: (id: string) => Investment | undefined;
}

export interface AssetActions {
  add: (inv: Investment) => Promise<void>;
  update: (id: string, updates: Partial<Investment>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const NO_MEMBER_MSG =
  "Não foi possível vincular esse investimento a um participante ativo do plano.";

export function useAssetActions(deps: Deps): AssetActions {
  const {
    user, planId, resolveMemberId,
    addInvestmentLocal, updateInvestmentLocal, deleteInvestmentLocal, getInvestmentById,
  } = deps;
  const writer = useAssetWriter();
  const offlineQueue = useOfflineQueue();

  const add = useCallback(async (inv: Investment) => {
    let memberId: string | null = null;
    if (user && planId) {
      memberId = resolveMemberId(inv.profileId);
      if (!memberId) {
        toast.error(NO_MEMBER_MSG);
        return;
      }
    }

    addInvestmentLocal({ ...inv, ownershipScope: inv.ownershipScope ?? "individual" });
    if (!user || !planId || !memberId) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = investmentToAssetPayload(inv, {
        userId: user.id, planId, memberId, ownershipScope: "individual",
      });
      await offlineQueue.enqueue({
        entity: "asset", op: "create", entityId: inv.id, planId, payload, memberId,
      });
      toast.success("Sem conexão — salvaremos quando a internet voltar.");
      logger.warn("writer.asset.offline.enqueued", { userId: user.id, planId });
      return;
    }

    const r = await withRetry(
      () => writer.createAsset(planId, inv, memberId),
      { event: "writer.asset.create", context: { userId: user.id, planId } },
    );
    if (r.error) {
      deleteInvestmentLocal(inv.id);
      toast.error(`Falha ao salvar investimento: ${toFriendlyError(r.error)}`);
    } else if (r.data) {
      updateInvestmentLocal(inv.id, {
        id: r.data.id,
        ownershipScope: r.data.ownership_scope,
        profileId: r.data.member_id ?? inv.profileId,
      });
    }
  }, [user, planId, writer, resolveMemberId, addInvestmentLocal, updateInvestmentLocal, deleteInvestmentLocal, offlineQueue]);

  const update = useCallback(async (id: string, updates: Partial<Investment>) => {
    const ownerChanged = updates.profileId !== undefined;
    const memberId: string | null | undefined = ownerChanged
      ? resolveMemberId(updates.profileId)
      : undefined;
    if (ownerChanged && !memberId) {
      toast.error(NO_MEMBER_MSG);
      return;
    }

    const prev = getInvestmentById?.(id);
    const localPatch: Partial<Investment> = ownerChanged
      ? { ...updates, ownershipScope: "individual" }
      : updates;
    updateInvestmentLocal(id, localPatch);
    if (!user || !planId) return;

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = investmentToAssetPayload(localPatch, {
        userId: user.id,
        planId,
        memberId,
        ownershipScope: ownerChanged ? "individual" : undefined,
      });
      await offlineQueue.enqueue({
        entity: "asset", op: "update", entityId: id, planId, payload,
        memberId: memberId ?? null,
      });
      toast.success("Sem conexão — sua alteração ficou em fila.");
      return;
    }

    const r = await withRetry(
      () => writer.updateAsset(planId, id, localPatch, memberId),
      { event: "writer.asset.update", context: { userId: user.id, planId } },
    );
    if (r.error) {
      if (prev) updateInvestmentLocal(id, prev);
      toast.error(`Falha ao atualizar investimento: ${toFriendlyError(r.error)}`);
    }
  }, [user, planId, writer, resolveMemberId, updateInvestmentLocal, getInvestmentById, offlineQueue]);

  const remove = useCallback(async (id: string) => {
    const prev = getInvestmentById?.(id);
    deleteInvestmentLocal(id);
    if (!user) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await offlineQueue.enqueue({
        entity: "asset", op: "delete", entityId: id, planId, payload: {}, memberId: null,
      });
      return;
    }
    const r = await withRetry(
      () => writer.deleteAsset(id),
      { event: "writer.asset.delete", context: { userId: user.id } },
    );
    if (r.error) {
      logger.warn("writer.asset.delete.fallback_deactivate", { userId: user.id });
      const deact = await writer.deactivateAsset(id);
      if (deact.error) {
        if (prev) addInvestmentLocal(prev);
        toast.error(`Falha ao remover investimento: ${toFriendlyError(deact.error)}`);
      }
    }
  }, [user, planId, writer, deleteInvestmentLocal, addInvestmentLocal, getInvestmentById, offlineQueue]);

  return { add, update, remove };
}
