/**
 * offlineQueue — Persistência IndexedDB para writes pendentes quando offline.
 *
 * Por que IndexedDB e não localStorage:
 *  - Limite muito maior (centenas de MB vs 5MB).
 *  - Operações async não bloqueiam o thread.
 *  - Indexação por status/userId facilita filtros eficientes.
 *
 * Modelo de dados:
 *  - Cada `QueuedWrite` representa uma intenção (create/update/delete) sobre
 *    uma entidade. Persistimos o payload mínimo necessário para o dispatcher
 *    re-executar o write quando a conexão voltar.
 *
 * Coalescing:
 *  - `delete` cancela um `create` pendente do MESMO entityId — nada vai para
 *    o servidor (decisão de produto: evita ressuscitar registro deletado).
 *  - `update` repetido sobre o mesmo entityId é mesclado (last-write-wins
 *    local), preservando o `enqueuedAt` original para detecção de conflito.
 *
 * O que NÃO faz:
 *  - Não resolve conflitos (responsabilidade do dispatcher).
 *  - Não tenta executar writes — apenas armazena/recupera.
 */
import { logger } from "./logger";

const DB_NAME = "plano-milhao-offline";
const DB_VERSION = 1;
const STORE = "writes";

export type WriteOp = "create" | "update" | "delete";
export type WriteEntity =
  | "income"
  | "expense"
  | "debt"
  | "asset"
  | "plan"
  | "plan_member"
  | "monthly_tracking";

export interface QueuedWrite {
  /** UUID do write (não da entidade). */
  id: string;
  userId: string;
  entity: WriteEntity;
  op: WriteOp;
  /** Id local da entidade (para create, é o id otimista; depois é trocado pelo real). */
  entityId: string;
  /** Plano associado (quando aplicável). */
  planId: string | null;
  /** Payload necessário para re-executar (modelo do app, não do banco). */
  payload: Record<string, unknown>;
  /** Member id resolvido no momento do enqueue (pode estar null). */
  memberId: string | null;
  /** Quando foi enfileirado — usado para detectar conflito remoto. */
  enqueuedAt: string;
  /** Tentativas já feitas. */
  attempts: number;
  /** Última mensagem de erro (best effort). */
  lastError?: string;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("IndexedDB indisponível neste ambiente."));
  }
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("by_user", "userId", { unique: false });
        store.createIndex("by_user_entity", ["userId", "entity"], { unique: false });
        store.createIndex("by_entity_id", ["userId", "entity", "entityId"], { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("Falha ao abrir IndexedDB."));
  });
  return dbPromise;
}

function tx(mode: IDBTransactionMode): Promise<IDBObjectStore> {
  return openDb().then((db) => db.transaction(STORE, mode).objectStore(STORE));
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function genId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Lista todos os writes pendentes do usuário, em ordem cronológica.
 * Ordem importa: re-executamos na ordem em que o usuário fez.
 */
export async function listWrites(userId: string): Promise<QueuedWrite[]> {
  try {
    const store = await tx("readonly");
    const idx = store.index("by_user");
    const all = await reqToPromise(idx.getAll(IDBKeyRange.only(userId)));
    return (all as QueuedWrite[]).sort((a, b) =>
      a.enqueuedAt.localeCompare(b.enqueuedAt),
    );
  } catch (err) {
    logger.warn("offlineQueue.list.fail", { userId }, err);
    return [];
  }
}

/**
 * Busca writes pendentes para uma entidade específica.
 */
async function findByEntityId(
  userId: string,
  entity: WriteEntity,
  entityId: string,
): Promise<QueuedWrite[]> {
  try {
    const store = await tx("readonly");
    const idx = store.index("by_entity_id");
    const all = await reqToPromise(
      idx.getAll(IDBKeyRange.only([userId, entity, entityId])),
    );
    return all as QueuedWrite[];
  } catch {
    return [];
  }
}

/**
 * Enfileira um write. Aplica regras de coalescing antes de gravar:
 *  - delete + create pendente → remove o create, NÃO grava o delete.
 *  - update + update → mescla payload (preserva enqueuedAt original).
 */
export async function enqueueWrite(
  input: Omit<QueuedWrite, "id" | "enqueuedAt" | "attempts">,
): Promise<{ enqueuedId: string | null; coalesced: boolean }> {
  try {
    const existing = await findByEntityId(input.userId, input.entity, input.entityId);

    // Regra 1: delete cancela create pendente.
    if (input.op === "delete") {
      const pendingCreate = existing.find((w) => w.op === "create");
      if (pendingCreate) {
        // Remove o create e quaisquer updates pendentes; nada vai para o servidor.
        const store = await tx("readwrite");
        for (const w of existing) await reqToPromise(store.delete(w.id));
        logger.info("offlineQueue.coalesce.delete_cancels_create", {
          userId: input.userId,
          entity: input.entity,
          entityId: input.entityId,
        });
        return { enqueuedId: null, coalesced: true };
      }
    }

    // Regra 2: update + update → merge.
    if (input.op === "update") {
      const pendingUpdate = existing.find((w) => w.op === "update");
      if (pendingUpdate) {
        const merged: QueuedWrite = {
          ...pendingUpdate,
          payload: { ...pendingUpdate.payload, ...input.payload },
          memberId: input.memberId ?? pendingUpdate.memberId,
        };
        const store = await tx("readwrite");
        await reqToPromise(store.put(merged));
        return { enqueuedId: merged.id, coalesced: true };
      }
      // Se há um create pendente, mescla no create (a entidade ainda nem foi pro servidor).
      const pendingCreate = existing.find((w) => w.op === "create");
      if (pendingCreate) {
        const merged: QueuedWrite = {
          ...pendingCreate,
          payload: { ...pendingCreate.payload, ...input.payload },
          memberId: input.memberId ?? pendingCreate.memberId,
        };
        const store = await tx("readwrite");
        await reqToPromise(store.put(merged));
        return { enqueuedId: merged.id, coalesced: true };
      }
    }

    const write: QueuedWrite = {
      ...input,
      id: genId(),
      enqueuedAt: new Date().toISOString(),
      attempts: 0,
    };
    const store = await tx("readwrite");
    await reqToPromise(store.put(write));
    return { enqueuedId: write.id, coalesced: false };
  } catch (err) {
    logger.error("offlineQueue.enqueue.fail", { entity: input.entity, op: input.op }, err);
    return { enqueuedId: null, coalesced: false };
  }
}

export async function removeWrite(id: string): Promise<void> {
  try {
    const store = await tx("readwrite");
    await reqToPromise(store.delete(id));
  } catch (err) {
    logger.warn("offlineQueue.remove.fail", { id }, err);
  }
}

export async function updateWriteAttempt(
  id: string,
  patch: Partial<Pick<QueuedWrite, "attempts" | "lastError" | "entityId">>,
): Promise<void> {
  try {
    const store = await tx("readwrite");
    const existing = (await reqToPromise(store.get(id))) as QueuedWrite | undefined;
    if (!existing) return;
    await reqToPromise(store.put({ ...existing, ...patch }));
  } catch (err) {
    logger.warn("offlineQueue.update.fail", { id }, err);
  }
}

/**
 * Re-mapeia o entityId em todos os writes pendentes quando uma entidade
 * recém-criada finalmente recebe seu id real do servidor.
 * Necessário para que updates/deletes posteriores apontem para o id correto.
 */
export async function rebindEntityId(
  userId: string,
  entity: WriteEntity,
  oldId: string,
  newId: string,
): Promise<void> {
  if (oldId === newId) return;
  try {
    const writes = await findByEntityId(userId, entity, oldId);
    if (writes.length === 0) return;
    const store = await tx("readwrite");
    for (const w of writes) {
      await reqToPromise(store.put({ ...w, entityId: newId }));
    }
  } catch (err) {
    logger.warn("offlineQueue.rebind.fail", { userId, entity, oldId, newId }, err);
  }
}

export async function clearAll(userId: string): Promise<void> {
  try {
    const writes = await listWrites(userId);
    const store = await tx("readwrite");
    for (const w of writes) await reqToPromise(store.delete(w.id));
  } catch (err) {
    logger.warn("offlineQueue.clear.fail", { userId }, err);
  }
}

export async function countWrites(userId: string): Promise<number> {
  try {
    const writes = await listWrites(userId);
    return writes.length;
  } catch {
    return 0;
  }
}
