/**
 * localCacheOwner — Isola o cache local (localStorage) por conta.
 *
 * Problema resolvido: as chaves `plano-do-milhao*` são globais do navegador.
 * Em dispositivo compartilhado, os dados financeiros do usuário A poderiam ser
 * enviados para a nuvem do usuário B (ou oferecidos no diálogo de conflito).
 *
 * Estratégia:
 *  1. Toda sessão autenticada "reivindica" o cache local (`claimLocalCacheOwner`).
 *     Se o dono registrado for outro usuário, o cache é apagado antes de qualquer
 *     hidratação ou sync.
 *  2. No logout, o cache é apagado explicitamente (`clearProductLocalCache`).
 */

/** Chaves exatas do produto que guardam dados financeiros locais. */
export const PRODUCT_LOCAL_CACHE_KEYS: readonly string[] = [
  "plano-do-milhao",
  "plano-do-milhao-v5",
  "plano-do-milhao-v6",
  "plano-do-milhao-app-v7",
  "plano-do-milhao-app-v7-prev",
  "plano-do-milhao-backup",
  "plano-do-milhao-app-backup",
  "plano-do-milhao-pre-migration-backup",
];

/** Prefixos varridos além das chaves exatas. */
export const PRODUCT_LOCAL_CACHE_PREFIXES: readonly string[] = [
  "plano-do-milhao",
  "plano-celebrated-milestones",
];

/** Chave que registra qual conta é dona do cache local atual. */
export const LOCAL_CACHE_OWNER_KEY = "plano-do-milhao-cache-owner";

/**
 * Remove todo o cache financeiro local do produto, incluindo backups,
 * flags de migração e marcos celebrados. Retorna as chaves removidas.
 */
export function clearProductLocalCache(): string[] {
  const removed: string[] = [];
  if (typeof localStorage === "undefined") return removed;

  const toRemove = new Set<string>(
    PRODUCT_LOCAL_CACHE_KEYS.filter((key) => localStorage.getItem(key) !== null),
  );

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || key === LOCAL_CACHE_OWNER_KEY) continue;
    if (PRODUCT_LOCAL_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      toRemove.add(key);
    }
  }

  for (const key of toRemove) {
    localStorage.removeItem(key);
    removed.push(key);
  }

  try {
    localStorage.removeItem(LOCAL_CACHE_OWNER_KEY);
  } catch {
    // ignore
  }

  return removed;
}

/**
 * Garante que o cache local pertence ao usuário informado.
 * Se pertencia a outra conta, apaga tudo e retorna `true` (houve limpeza).
 */
export function claimLocalCacheOwner(userId: string): boolean {
  if (typeof localStorage === "undefined" || !userId) return false;
  let owner: string | null = null;
  try {
    owner = localStorage.getItem(LOCAL_CACHE_OWNER_KEY);
  } catch {
    return false;
  }

  if (owner === userId) return false;

  const wiped = owner !== null;
  if (wiped) clearProductLocalCache();

  try {
    localStorage.setItem(LOCAL_CACHE_OWNER_KEY, userId);
  } catch {
    // ignore
  }
  return wiped;
}
