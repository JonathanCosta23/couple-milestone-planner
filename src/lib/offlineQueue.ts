/**
 * offlineQueue — Persistência IndexedDB para writes pendentes.
 *
 * A fila preserva ownership explicitamente. Creates financeiros sem
 * `member_id` ativo ou sem `ownership_scope = individual` são enviados para
 * dead-letter pelo dispatcher e nunca recebem fallback implícito.
 */
import { logger } from "./logger";
import { isOwnershipScope, type OwnershipScope } from "./models";

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
  id: string;
  userId: string;
  entity: WriteEntity;
  op: WriteOp;
  entityId: string;
  planId: string | null;
  payload: Record<string, unknown>;
  memberId: string | null;
  enqueuedAt: string;
  attempts: number;
  lastError?: string;
  status?: "pending" | "dead";
  expiresAt?: string;
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

export async function listWrites(userId: string): Promise<QueuedWrite[]> {
  try {
    const store = await tx("readonly");
    const all = await reqToPromise(store.index("by_user").getAll(IDBKeyRange.only(userId)));
    return (all as QueuedWrite[])
      .filter((w) => (w.status ?? "pending") === "pending")
      .sort((a, b) => a.enqueuedAt.localeCompare(b.enqueuedAt));
  } catch (err) {
    logger.warn("offlineQueue.list.fail", { userId }, err);
    return [];
  }
}

export async function listDeadLetters(userId: string): Promise<QueuedWrite[]> {
  try {
    const store = await tx("readonly");
    const all = await reqToPromise(
      store.index("by_user_status").getAll(IDBKeyRange.only([userId, "dead"])),
    );
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
  for (const write of writes) {
    const expiresAt = write.expiresAt
      ? Date.parse(write.expiresAt)
      : Date.parse(write.enqueuedAt) + WRITE_TTL_MS;
    if (Number.isFinite(expiresAt) && expiresAt < now) {
      await deadLetterWrite(write.id, "Tempo limite de sincronização excedido.");
      moved++;
    }
  }
  return moved;
}

async function findByEntityId(
  userId: string,
  entity: WriteEntity,
  entityId: string,
): Promise<QueuedWrite[]> {
  try {
    const store = await tx("readonly");
    const all = await reqToPromise(
      store.index("by_entity_id").getAll(IDBKeyRange.only([userId, entity, entityId])),
    );
    return (all as QueuedWrite[]).filter((w) => (w.status ?? "pending") === "pending");
  } catch {
    return [];
  }
}

export async function enqueueWrite(
  input: Omit<QueuedWrite, "id" | "enqueuedAt" | "attempts">,
): Promise<{ enqueuedId: string | null; coalesced: boolean }> {
  try {
    const existing = await findByEntityId(input.userId, input.entity, input.entityId);

    if (input.op === "delete") {
      const pendingCreate = existing.find((w) => w.op === "create");
      if (pendingCreate) {
        const store = await tx("readwrite");
        for (const write of existing) await reqToPromise(store.delete(write.id));
        logger.info("offlineQueue.coalesce.delete_cancels_create", {
          userId: input.userId,
          entity: input.entity,
          entityId: input.entityId,
        });
        return { enqueuedId: null, coalesced: true };
      }
    }

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
    for (const write of writes) {
      await reqToPromise(store.put({ ...write, entityId: newId }));
    }
  } catch (err) {
    logger.warn("offlineQueue.rebind.fail", { userId, entity, oldId, newId }, err);
  }
}

export async function clearAll(userId: string): Promise<void> {
  try {
    const writes = [...await listWrites(userId), ...await listDeadLetters(userId)];
    const store = await tx("readwrite");
    for (const write of writes) await reqToPromise(store.delete(write.id));
  } catch (err) {
    logger.warn("offlineQueue.clear.fail", { userId }, err);
  }
}

export async function countWrites(userId: string): Promise<number> {
  return (await listWrites(userId)).length;
}

export async function countDeadLetters(userId: string): Promise<number> {
  return (await listDeadLetters(userId)).length;
}

const FINANCIAL_ENTITIES: ReadonlySet<WriteEntity> = new Set([
  "asset", "income", "expense", "debt",
]);

export function resolveMemberId(
  write: Pick<QueuedWrite, "payload" | "memberId">,
): string | null {
  const fromPayload = write.payload?.member_id;
  if (typeof fromPayload === "string" && fromPayload.length > 0) return fromPayload;
  if (fromPayload === null) return null;
  return write.memberId ?? null;
}

export function resolveOwnershipScope(
  write: Pick<QueuedWrite, "payload">,
): OwnershipScope | null {
  const scope = write.payload?.ownership_scope;
  return isOwnershipScope(scope) ? scope : null;
}

export function payloadMentionsMember(
  payload: Record<string, unknown> | undefined | null,
): boolean {
  return Boolean(payload && Object.prototype.hasOwnProperty.call(payload, "member_id"));
}

export function payloadMentionsOwnership(
  payload: Record<string, unknown> | undefined | null,
): boolean {
  return Boolean(payload && Object.prototype.hasOwnProperty.call(payload, "ownership_scope"));
}

/**
 * Updates comuns não reenviam ownership. Quando a intenção de troca é
 * explícita, os campos informados são preservados e o banco valida o contrato.
 */
export function sanitizeUpdatePayload(
  write: Pick<QueuedWrite, "payload" | "memberId">,
): Record<string, unknown> {
  const payload = { ...(write.payload ?? {}) } as Record<string, unknown>;
  delete payload.user_id;
  delete payload.plan_id;

  if (!payloadMentionsMember(write.payload)) {
    delete payload.member_id;
  } else {
    payload.member_id = resolveMemberId(write);
  }

  if (!payloadMentionsOwnership(write.payload)) {
    delete payload.ownership_scope;
  } else if (!isOwnershipScope(payload.ownership_scope)) {
    // Mantém valor inválido para o banco rejeitar de forma segura.
    payload.ownership_scope = write.payload.ownership_scope;
  }
  return payload;
}

export type CreateValidation =
  | { ok: false; reason: string }
  | { ok: true; payload: Record<string, unknown> };

export function validateCreatePayload(
  write: Pick<QueuedWrite, "entity" | "userId" | "planId" | "payload" | "memberId">,
): CreateValidation {
  if (!write.userId) return { ok: false, reason: "Write sem user_id." };

  const payload: Record<string, unknown> = { ...(write.payload ?? {}) };
  delete payload.user_id;
  if (write.planId) payload.plan_id = write.planId;

  if (FINANCIAL_ENTITIES.has(write.entity)) {
    if (!write.planId) {
      return { ok: false, reason: `Replay de ${write.entity} sem plan_id válido.` };
    }
    const memberId = resolveMemberId(write);
    if (!memberId) {
      return { ok: false, reason: `Replay de ${write.entity} sem member_id válido.` };
    }
    const scope = resolveOwnershipScope(write);
    if (scope !== "individual") {
      return { ok: false, reason: `Replay de ${write.entity} sem ownership individual explícito.` };
    }
    payload.member_id = memberId;
    payload.ownership_scope = "individual";
    return { ok: true, payload };
  }

  // Entidades não financeiras mantêm o contrato legado de user_id explícito.
  payload.user_id = write.userId;
  const memberId = resolveMemberId(write);
  if (memberId) payload.member_id = memberId;
  return { ok: true, payload };
}
