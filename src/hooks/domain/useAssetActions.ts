/**
 * useAssetActions — handler de domínio para Investimentos (assets).
 * - Valida member_id antes de chamar o Supabase (evita erro de FK).
 * - Mantém fallback de soft-delete (deactivateAsset) quando delete falha.
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
  /** Resolve um member.id real e ativo do plano para o profileId informado. */
  resolveMemberId: (profileId?: string) => string | null;
  addInvestmentLocal: (inv: Investment) => void;
  updateInvestmentLocal: (id: string, updates: Partial<Investment>) => void;
  deleteInvestmentLocal: (id: string) => void;
  /** Necessário para rollback otimista em update/delete. */
  getInvestmentById?: (id: string) => Investment | undefined;
}

export interface AssetActions {
  add: (inv: Investment) => Promise<void>;
  update: (id: string, updates: Partial<Investment>) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

const NO_MEMBER_MSG =
  "Não foi possível vincular esse investimento a um participante válido do plano. Atualize os participantes e tente novamente.";

export function useAssetActions(deps: Deps): AssetActions {
  const { user, planId, resolveMemberId, addInvestmentLocal, updateInvestmentLocal, deleteInvestmentLocal, getInvestmentById } = deps;
  const writer = useAssetWriter();
  const offlineQueue = useOfflineQueue();

  const add = useCallback(async (inv: Investment) => {
    // Regra: investimento exige member_id válido. Validamos ANTES de mutar o
    // estado local — evita órfão na UI/localStorage quando o titular é inválido.
    if (user && planId) {
      const memberId = resolveMemberId(inv.profileId);
      if (!memberId) {
        toast.error(NO_MEMBER_MSG);
        return;
      }
    }
    addInvestmentLocal(inv);
    if (!user || !planId) return;
    const memberId = resolveMemberId(inv.profileId)!;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = investmentToAssetPayload(inv, { userId: user.id, planId, memberId });
      await offlineQueue.enqueue({ entity: "asset", op: "create", entityId: inv.id, planId, payload, memberId });
      toast.success("Sem conexão — salvaremos quando a internet voltar.");
      logger.warn("writer.asset.offline.enqueued", { userId: user.id, planId });
      return;
    }
    const r = await withRetry(
      () => writer.createAsset(planId, inv, memberId),
      { event: "writer.asset.create", context: { userId: user.id, planId } },
    );
    if (r.error) {
      // Rollback otimista: nada foi persistido no servidor; remove da UI/cache.
      deleteInvestmentLocal(inv.id);
      toast.error(`Falha ao salvar investimento: ${toFriendlyError(r.error)}`);
    } else if (r.data) {
      updateInvestmentLocal(inv.id, { id: r.data.id } as Partial<Investment>);
    }
  }, [user, planId, writer, resolveMemberId, addInvestmentLocal, updateInvestmentLocal, deleteInvestmentLocal, offlineQueue]);

  const update = useCallback(async (id: string, updates: Partial<Investment>) => {
    // Só resolvemos memberId quando o titular foi explicitamente alterado.
    // `undefined` sinaliza ao writer "não tocar no vínculo existente".
    const titularChanged = updates.profileId !== undefined;
    const memberId: string | null | undefined = titularChanged
      ? resolveMemberId(updates.profileId)
      : undefined;
    if (titularChanged && !memberId) {
      toast.error(NO_MEMBER_MSG);
      return;
    }
    const prev = getInvestmentById?.(id);
    updateInvestmentLocal(id, updates);
    if (!user || !planId) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const payload = investmentToAssetPayload(updates, { userId: user.id, planId, memberId });
      // Passa `memberId ?? null` para a fila só quando o titular foi tocado;
      // caso contrário marca null para representar "campo não-alterado" no
      // metadado (o payload já não contém member_id).
      await offlineQueue.enqueue({ entity: "asset", op: "update", entityId: id, planId, payload, memberId: memberId ?? null });
      toast.success("Sem conexão — sua alteração ficou em fila.");
      return;
    }
    const r = await withRetry(
      () => writer.updateAsset(planId, id, updates, memberId),
      { event: "writer.asset.update", context: { userId: user.id, planId } },
    );
    if (r.error) {
      // Rollback otimista: restaura o snapshot anterior quando disponível.
      if (prev) updateInvestmentLocal(id, prev);
      toast.error(`Falha ao atualizar investimento: ${toFriendlyError(r.error)}`);
    }
  }, [user, planId, writer, resolveMemberId, updateInvestmentLocal, getInvestmentById, offlineQueue]);

  const remove = useCallback(async (id: string) => {
    const prev = getInvestmentById?.(id);
    deleteInvestmentLocal(id);
    if (!user) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      await offlineQueue.enqueue({ entity: "asset", op: "delete", entityId: id, planId, payload: {}, memberId: null });
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
        // Restaura o item local: nem hard nem soft delete funcionaram.
        if (prev) addInvestmentLocal(prev);
        toast.error(`Falha ao remover investimento: ${toFriendlyError(deact.error)}`);
      }
    }
  }, [user, planId, writer, deleteInvestmentLocal, addInvestmentLocal, getInvestmentById, offlineQueue]);

  return { add, update, remove };
}
