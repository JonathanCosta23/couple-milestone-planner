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
const DB_VERSION = 2;
const STORE = "writes";
export const MAX_WRITE_ATTEMPTS = 5;
export const WRITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
  /** Estado interno: dead-letter não é mais retentado automaticamente. */
  status?: "pending" | "dead";
  /** Expiração controlada para evitar writes presos para sempre. */
  expiresAt?: string;
  /** Quando foi enviado para dead-letter. */
  deadLetteredAt?: string;
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
        store.createIndex("by_user_status", ["userId", "status"], { unique: false });
      } else {
        const store = req.transaction?.objectStore(STORE);
        if (store && !store.indexNames.contains("by_user_status")) {
          store.createIndex("by_user_status", ["userId", "status"], { unique: false });
        }
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
    return (all as QueuedWrite[]).filter((w) => (w.status ?? "pending") === "pending").sort((a, b) =>
      a.enqueuedAt.localeCompare(b.enqueuedAt),
    );
  } catch (err) {
    logger.warn("offlineQueue.list.fail", { userId }, err);
    return [];
  }
}

export async function listDeadLetters(userId: string): Promise<QueuedWrite[]> {
  try {
    const store = await tx("readonly");
    const idx = store.index("by_user_status");
    const all = await reqToPromise(idx.getAll(IDBKeyRange.only([userId, "dead"])));
    return (all as QueuedWrite[]).sort((a, b) =>
      (b.deadLetteredAt ?? b.enqueuedAt).localeCompare(a.deadLetteredAt ?? a.enqueuedAt),
    );
  } catch (err) {
    logger.warn("offlineQueue.deadLetters.list.fail", { userId }, err);
    return [];
  }
}

export async function deadLetterWrite(id: string, reason: string): Promise<void> {
  try {
    const store = await tx("readwrite");
    const existing = (await reqToPromise(store.get(id))) as QueuedWrite | undefined;
    if (!existing) return;
    await reqToPromise(store.put({
      ...existing,
      status: "dead",
      lastError: reason,
      deadLetteredAt: new Date().toISOString(),
    }));
  } catch (err) {
    logger.warn("offlineQueue.deadLetter.fail", { id }, err);
  }
}

export async function quarantineExpiredWrites(userId: string): Promise<number> {
  const now = Date.now();
  const writes = await listWrites(userId);
  let moved = 0;
  for (const w of writes) {
    const expiresAt = w.expiresAt ? Date.parse(w.expiresAt) : Date.parse(w.enqueuedAt) + WRITE_TTL_MS;
    if (Number.isFinite(expiresAt) && expiresAt < now) {
      await deadLetterWrite(w.id, "Tempo limite de sincronização excedido.");
      moved++;
    }
  }
  return moved;
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
    return (all as QueuedWrite[]).filter((w) => (w.status ?? "pending") === "pending");
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
      expiresAt: new Date(Date.now() + WRITE_TTL_MS).toISOString(),
      status: "pending",
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

export async function countDeadLetters(userId: string): Promise<number> {
  try {
    const writes = await listDeadLetters(userId);
    return writes.length;
  } catch {
    return 0;
  }
}

// ============================================================================
// Helpers puros de validação/sanitização do replay.
//
// Isolados aqui para serem testáveis sem IndexedDB e para garantir que o
// dispatcher (useOfflineQueue) e qualquer consumidor futuro apliquem
// EXATAMENTE as mesmas regras de integridade ao reabrir conexão.
//
// Regras de produto que justificam cada helper:
//   1. Replay NUNCA pode reintroduzir `member_id = null` num registro que
//      depende de titular (asset).  Se o titular sumiu, vai para dead-letter.
//   2. Update parcial NUNCA pode sobrescrever `member_id` que já existe na
//      nuvem — só envia se o payload original mencionou explicitamente.
//   3. Conflict resolution "mine" preserva member_id do servidor pelo
//      mesmo motivo: payload sem member_id ⇒ não tocar nesse campo.
// ============================================================================

/** Entidades que exigem member_id válido para serem criadas. */
const ENTITY_REQUIRES_MEMBER: ReadonlySet<WriteEntity> = new Set(["asset"]);

/** Resolve o member_id final de um write (payload tem prioridade sobre snapshot). */
export function resolveMemberId(write: Pick<QueuedWrite, "payload" | "memberId">): string | null {
  const fromPayload = write.payload?.member_id;
  if (typeof fromPayload === "string" && fromPayload.length > 0) return fromPayload;
  if (fromPayload === null) return null;
  return write.memberId ?? null;
}

/** True se o payload original mencionou member_id (mesmo como null explícito). */
export function payloadMentionsMember(payload: Record<string, unknown> | undefined | null): boolean {
  if (!payload) return false;
  return Object.prototype.hasOwnProperty.call(payload, "member_id");
}

/**
 * Sanitiza payload de UPDATE antes do replay:
 *  - Remove user_id/plan_id (jamais devem ser alterados via update).
 *  - Só inclui member_id se o payload original mencionou explicitamente
 *    OU se o write é de troca de titular (out-of-band do payload).
 *  - Devolve cópia rasa — não muta a entrada.
 */
export function sanitizeUpdatePayload(write: Pick<QueuedWrite, "payload" | "memberId">): Record<string, unknown> {
  const payload = { ...(write.payload ?? {}) } as Record<string, unknown>;
  delete payload.user_id;
  delete payload.plan_id;
  if (!payloadMentionsMember(write.payload)) {
    // Não tocar em member_id — preserva vínculo existente no banco/cloud.
    delete payload.member_id;
  } else {
    // Payload mencionou: usa o valor resolvido (string ou null explícito).
    const resolved = resolveMemberId(write);
    if (resolved === null) {
      delete payload.member_id;
    } else {
      payload.member_id = resolved;
    }
  }
  return payload;
}

export type CreateValidation =
  | { ok: false; reason: string }
  | { ok: true; payload: Record<string, unknown> };

/**
 * Valida e monta o payload de CREATE para replay.
 * Falhas devem ser enviadas ao dead-letter — nunca tentar inserir dado órfão.
 */
export function validateCreatePayload(
  write: Pick<QueuedWrite, "entity" | "userId" | "planId" | "payload" | "memberId">,
): CreateValidation {
  if (!write.userId) return { ok: false, reason: "Write sem user_id." };
  const payload: Record<string, unknown> = { ...(write.payload ?? {}), user_id: write.userId };
  if (write.planId) payload.plan_id = write.planId;

  const memberId = resolveMemberId(write);
  if (memberId) payload.member_id = memberId;

  if (ENTITY_REQUIRES_MEMBER.has(write.entity)) {
    if (!write.planId) {
      return { ok: false, reason: `Replay de ${write.entity} sem plan_id válido.` };
    }
    if (!memberId) {
      return { ok: false, reason: `Replay de ${write.entity} sem member_id válido — titular ausente.` };
    }
  }

  return { ok: true, payload };
}
