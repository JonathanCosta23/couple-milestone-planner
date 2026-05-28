/**
 * resetService — Reset destrutivo e completo do plano do usuário.
 *
 * Camadas limpas, em ordem segura:
 *  1. Banco (RPC `reset_user_plan_data`): apaga plans, plan_members, assets,
 *     income, expenses, debts, monthly_tracking, monthly_member_tracking,
 *     milestones, insights_log, education_progress; zera blob
 *     `user_financial_data` para evitar reidratação.
 *  2. Fila offline (IndexedDB): pendentes + dead-letters.
 *  3. localStorage: TODAS as chaves do produto, incluindo backups e
 *     milestones celebrados (com e sem prefixo de userId/planId).
 *
 * NÃO toca:
 *  - Sessão Supabase (usuário continua logado).
 *  - Preferências de tema, idioma e outros dados não-financeiros.
 */
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toFriendlyError } from "@/lib/errors/friendlyError";
import { logProductEvent } from "@/lib/services/auditService";
import { clearAll, listDeadLetters, removeWrite } from "@/lib/offlineQueue";

// Chaves do produto (mantidas em sincronia com storage.ts, appStorage.ts,
// dataMigrationService.ts e useCelebratedMilestones.ts).
const PRODUCT_LOCAL_STORAGE_KEYS = [
  "plano-do-milhao",                    // legado v?
  "plano-do-milhao-v5",                 // legado v5
  "plano-do-milhao-v6",                 // PlanData atual
  "plano-do-milhao-app-v7",             // AppData atual
  "plano-do-milhao-app-v7-prev",        // backup automático do RestoreBackupButton
  "plano-do-milhao-backup",             // backup PlanData
  "plano-do-milhao-app-backup",         // backup AppData
  "plano-do-milhao-pre-migration-backup",
];

/** Prefixos cujas chaves devem ser removidas (suporta múltiplos sufixos). */
const PRODUCT_KEY_PREFIXES = [
  "plano-celebrated-milestones",        // useCelebratedMilestones (com e sem userId/planId)
  "plano-do-milhao",                    // qualquer outro derivado
];

function clearProductLocalStorage(): string[] {
  const removed: string[] = [];
  if (typeof localStorage === "undefined") return removed;

  // 1. Chaves exatas conhecidas.
  for (const key of PRODUCT_LOCAL_STORAGE_KEYS) {
    if (localStorage.getItem(key) !== null) {
      localStorage.removeItem(key);
      removed.push(key);
    }
  }

  // 2. Varredura por prefixo (cobre `plano-celebrated-milestones::uid::planId`
  //    e quaisquer caches futuros do produto).
  const toRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (PRODUCT_KEY_PREFIXES.some((p) => k.startsWith(p)) && !PRODUCT_LOCAL_STORAGE_KEYS.includes(k)) {
      toRemove.push(k);
    }
  }
  for (const k of toRemove) {
    localStorage.removeItem(k);
    removed.push(k);
  }

  return removed;
}

async function clearOfflineQueueCompletely(userId: string): Promise<void> {
  // Pendentes
  await clearAll(userId);
  // Dead-letters
  const dead = await listDeadLetters(userId);
  for (const w of dead) await removeWrite(w.id);
}

export interface ResetResult {
  ok: boolean;
  error?: string;
  cleared: {
    rpc: boolean;
    offlineQueue: boolean;
    localStorageKeys: string[];
  };
  /** Resultado da auditoria crítica do reset (não bloqueia o fluxo). */
  audit: {
    ok: boolean;
    error?: string;
  };
}

/**
 * Executa reset completo. Idempotente: pode ser chamado múltiplas vezes.
 * Erros parciais são logados, mas não impedem outras camadas de serem limpas.
 */
export async function resetUserPlan(userId: string): Promise<ResetResult> {
  const result: ResetResult = {
    ok: true,
    cleared: { rpc: false, offlineQueue: false, localStorageKeys: [] },
    audit: { ok: true },
  };

  // 1. RPC server-side (transacional dentro do banco).
  try {
    const { error } = await supabase.rpc("reset_user_plan_data");
    if (error) {
      result.ok = false;
      result.error = toFriendlyError(error);
      logger.error("reset.rpc.fail", { userId }, error.message);
    } else {
      result.cleared.rpc = true;
      // Auditoria crítica: aguarda retorno e propaga falha para a UI.
      const auditRes = await logProductEvent({
        userId,
        event: "plan_reset",
        properties: { source: "user_action" },
        critical: true,
      });
      if (!auditRes.ok) {
        result.audit = { ok: false, error: toFriendlyError(auditRes.error) };
        logger.error("reset.audit.fail", { userId }, auditRes.error);
      }
    }
  } catch (err) {
    result.ok = false;
    result.error = toFriendlyError(err as { message?: string });
    logger.error("reset.rpc.exception", { userId }, err);
  }

  // 2. Fila offline (sempre tenta, mesmo se RPC falhou — evita writes antigos
  //    voltarem a sincronizar quando reconectar).
  try {
    await clearOfflineQueueCompletely(userId);
    result.cleared.offlineQueue = true;
  } catch (err) {
    logger.warn("reset.offlineQueue.fail", { userId }, err);
  }

  // 3. localStorage (sempre limpa).
  try {
    result.cleared.localStorageKeys = clearProductLocalStorage();
  } catch (err) {
    logger.warn("reset.localStorage.fail", { userId }, err);
  }

  return result;
}