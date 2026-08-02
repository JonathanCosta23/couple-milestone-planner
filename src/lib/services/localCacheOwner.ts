/**
 * Isolamento de cache financeiro por conta.
 *
 * Todas as chaves persistentes do produto são derivadas do usuário autenticado.
 * Chaves legadas sem namespace são removidas antes da primeira hidratação para
 * impedir que dados de uma conta sejam lidos ou sincronizados por outra conta
 * no mesmo navegador.
 */

export const PRODUCT_LOCAL_CACHE_KEYS = [
  "plano-do-milhao",
  "plano-do-milhao-v5",
  "plano-do-milhao-v6",
  "plano-do-milhao-app-v7",
  "plano-do-milhao-app-v7-prev",
  "plano-do-milhao-backup",
  "plano-do-milhao-app-backup",
  "plano-do-milhao-pre-migration-backup",
] as const;

export const PRODUCT_LOCAL_CACHE_PREFIXES = [
  "plano-do-milhao",
  "plano-celebrated-milestones",
] as const;

export const LOCAL_CACHE_OWNER_KEY = "plano-do-milhao-cache-owner";
export const LOCAL_CACHE_USER_MARKER = "::user::";

function storageAvailable(): boolean {
  return typeof localStorage !== "undefined";
}

function normalizeUserId(userId: string): string {
  return encodeURIComponent(userId.trim());
}

export function getActiveLocalCacheUserId(): string | null {
  if (!storageAvailable()) return null;
  try {
    const value = localStorage.getItem(LOCAL_CACHE_OWNER_KEY)?.trim();
    return value || null;
  } catch {
    return null;
  }
}

export function scopedStorageKey(baseKey: string, userId = getActiveLocalCacheUserId()): string | null {
  if (!userId?.trim()) return null;
  return `${baseKey}${LOCAL_CACHE_USER_MARKER}${normalizeUserId(userId)}`;
}

export function readUserScopedLocalStorage(baseKey: string, userId?: string | null): string | null {
  if (!storageAvailable()) return null;
  const key = scopedStorageKey(baseKey, userId ?? getActiveLocalCacheUserId());
  if (!key) return null;
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeUserScopedLocalStorage(
  baseKey: string,
  value: string,
  userId?: string | null,
): boolean {
  if (!storageAvailable()) return false;
  const key = scopedStorageKey(baseKey, userId ?? getActiveLocalCacheUserId());
  if (!key) return false;
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function removeUserScopedLocalStorage(baseKey: string, userId?: string | null): boolean {
  if (!storageAvailable()) return false;
  const key = scopedStorageKey(baseKey, userId ?? getActiveLocalCacheUserId());
  if (!key) return false;
  try {
    const existed = localStorage.getItem(key) !== null;
    localStorage.removeItem(key);
    return existed;
  } catch {
    return false;
  }
}

function isProductKey(key: string): boolean {
  return PRODUCT_LOCAL_CACHE_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function belongsToUser(key: string, userId: string): boolean {
  return key.includes(`${LOCAL_CACHE_USER_MARKER}${normalizeUserId(userId)}`);
}

/** Remove somente chaves antigas sem namespace de usuário. */
export function clearLegacyUnscopedKeys(): string[] {
  const removed: string[] = [];
  if (!storageAvailable()) return removed;

  const toRemove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || key === LOCAL_CACHE_OWNER_KEY) continue;
    if (isProductKey(key) && !key.includes(LOCAL_CACHE_USER_MARKER)) {
      toRemove.push(key);
    }
  }

  for (const key of toRemove) {
    localStorage.removeItem(key);
    removed.push(key);
  }
  return removed;
}

/** Remove todas as chaves do produto pertencentes a uma conta específica. */
export function clearUserScopedLocalCache(userId: string): string[] {
  const removed: string[] = [];
  if (!storageAvailable() || !userId.trim()) return removed;

  const toRemove: string[] = [];
  for (let index = 0; index < localStorage.length; index += 1) {
    const key = localStorage.key(index);
    if (!key || !isProductKey(key)) continue;
    if (belongsToUser(key, userId)) toRemove.push(key);
  }

  for (const key of toRemove) {
    localStorage.removeItem(key);
    removed.push(key);
  }
  return removed;
}

/**
 * Limpa o cache financeiro da conta informada e qualquer chave legada global.
 * Não remove dados de outras aplicações nem namespaces de outras contas.
 */
export function clearProductLocalCache(userId = getActiveLocalCacheUserId() ?? undefined): string[] {
  const removed = new Set<string>();
  if (!storageAvailable()) return [];

  if (userId) {
    for (const key of clearUserScopedLocalCache(userId)) removed.add(key);
  }
  for (const key of clearLegacyUnscopedKeys()) removed.add(key);

  try {
    const activeOwner = localStorage.getItem(LOCAL_CACHE_OWNER_KEY);
    if (!userId || activeOwner === userId) {
      localStorage.removeItem(LOCAL_CACHE_OWNER_KEY);
    }
  } catch {
    // ignore
  }

  return [...removed];
}

/**
 * Ativa o namespace do usuário antes de qualquer leitura ou sincronização.
 * Em troca de conta, o namespace anterior é apagado e chaves globais legadas
 * são removidas. Retorna true quando a página deve ser recarregada.
 */
export function claimLocalCacheOwner(userId: string): boolean {
  if (!storageAvailable() || !userId.trim()) return false;

  const previousOwner = getActiveLocalCacheUserId();
  let changed = previousOwner !== userId;

  if (previousOwner && previousOwner !== userId) {
    if (clearUserScopedLocalCache(previousOwner).length > 0) changed = true;
  }
  if (clearLegacyUnscopedKeys().length > 0) changed = true;

  try {
    localStorage.setItem(LOCAL_CACHE_OWNER_KEY, userId);
  } catch {
    return false;
  }

  return changed;
}
