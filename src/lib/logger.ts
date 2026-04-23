/**
 * logger — Logger central com níveis (info/warn/error) e contexto estruturado.
 *
 * Uso:
 *   logger.info("plan.save", { userId, planId });
 *   logger.warn("writer.income.retry", { attempt: 2 });
 *   logger.error("writer.asset.fail", { code, raw }, error);
 *
 * Mensagens são padronizadas em "namespace.evento". O contexto deve trazer
 * dados úteis para diagnóstico (userId, planId, route, action). NUNCA logar
 * segredos, tokens ou conteúdo sensível do usuário.
 *
 * Em produção usamos `console.*` para preservar o stack do navegador. Caso
 * futuramente seja conectado a um sink remoto (Sentry/Logflare), basta
 * substituir o `transport` mantendo a mesma API.
 *
 * Sink remoto:
 *  - Defina `VITE_LOG_REMOTE_URL` no ambiente para ativar o envio HTTP best
 *    effort de eventos `warn`/`error` para um endpoint coletor (Logflare,
 *    Logtail, função edge própria, etc.).
 *  - Quando offline, eventos são enfileirados em memória (até 50) e
 *    retentados no `online`. Sem garantia de entrega — é best effort.
 *  - Para conectar Sentry: troque `remoteTransport` por
 *    `Sentry.captureMessage` / `captureException` mantendo a assinatura.
 */

export type LogLevel = "info" | "warn" | "error";

export interface LogContext {
  userId?: string | null;
  planId?: string | null;
  route?: string;
  action?: string;
  origin?: string;
  [key: string]: unknown;
}

function safeRoute(): string | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    return window.location?.pathname;
  } catch {
    return undefined;
  }
}

// ---- Remote transport (best effort) ----

const REMOTE_URL: string | undefined =
  typeof import.meta !== "undefined"
    ? (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_LOG_REMOTE_URL
    : undefined;

const MAX_QUEUE = 50;
const pendingQueue: Array<Record<string, unknown>> = [];
let onlineListenerAttached = false;

function isOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

function attachOnlineListener() {
  if (onlineListenerAttached || typeof window === "undefined") return;
  onlineListenerAttached = true;
  window.addEventListener("online", () => {
    if (!REMOTE_URL || pendingQueue.length === 0) return;
    const drained = pendingQueue.splice(0, pendingQueue.length);
    for (const evt of drained) void postRemote(evt);
  });
}

async function postRemote(payload: Record<string, unknown>): Promise<void> {
  if (!REMOTE_URL) return;
  try {
    await fetch(REMOTE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      keepalive: true,
    });
  } catch {
    // best effort — re-enfileira se ainda houver espaço
    if (pendingQueue.length < MAX_QUEUE) pendingQueue.push(payload);
  }
}

function remoteTransport(level: LogLevel, payload: Record<string, unknown>) {
  if (!REMOTE_URL) return;
  if (level === "info") return; // só warn/error vão para o sink remoto
  attachOnlineListener();
  if (!isOnline()) {
    if (pendingQueue.length < MAX_QUEUE) pendingQueue.push(payload);
    return;
  }
  void postRemote(payload);
}

function emit(level: LogLevel, event: string, context: LogContext = {}, err?: unknown) {
  if (typeof console === "undefined") return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    route: context.route ?? safeRoute(),
    ...context,
  };
  const fn =
    level === "error" ? console.error :
    level === "warn" ? console.warn :
    console.info;
  if (err !== undefined) {
    fn(`[${level}] ${event}`, payload, err);
    remoteTransport(level, { ...payload, error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err) });
  } else {
    fn(`[${level}] ${event}`, payload);
    remoteTransport(level, payload);
  }
}

export const logger = {
  info: (event: string, context?: LogContext) => emit("info", event, context),
  warn: (event: string, context?: LogContext, err?: unknown) => emit("warn", event, context, err),
  error: (event: string, context?: LogContext, err?: unknown) => emit("error", event, context, err),
};

/**
 * withRetry — Executa uma operação assíncrona com backoff curto para falhas
 * transitórias (rede, timeout, 5xx). Não tenta novamente erros permanentes
 * (validação, RLS, auth).
 *
 * @param fn        Operação a executar; deve retornar { error?: string|null } ou lançar.
 * @param opts      attempts (default 3), baseMs (default 250), event (para log).
 */
export interface RetryOptions {
  attempts?: number;
  baseMs?: number;
  event?: string;
  context?: LogContext;
}

const TRANSIENT_PATTERNS = [
  /network/i,
  /failed to fetch/i,
  /timeout/i,
  /timed? out/i,
  /fetch.*aborted/i,
  /service unavailable/i,
  /temporarily/i,
  /5\d{2}/, // 5xx HTTP
];

function isTransient(message?: string | null): boolean {
  if (!message) return false;
  return TRANSIENT_PATTERNS.some((re) => re.test(message));
}

export async function withRetry<T extends { error?: string | null }>(
  fn: () => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = Math.max(1, opts.attempts ?? 3);
  const baseMs = opts.baseMs ?? 250;
  let last: T | null = null;

  for (let i = 0; i < attempts; i++) {
    try {
      const result = await fn();
      if (!result?.error) return result;
      last = result;
      if (!isTransient(result.error)) return result;
      if (i < attempts - 1) {
        const delay = baseMs * Math.pow(2, i);
        logger.warn(opts.event ?? "writer.retry", { ...opts.context, attempt: i + 1, delay });
        await new Promise((r) => setTimeout(r, delay));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isTransient(message) || i === attempts - 1) {
        logger.error(opts.event ?? "writer.fail", { ...opts.context, attempt: i + 1 }, err);
        return { error: message } as T;
      }
      const delay = baseMs * Math.pow(2, i);
      logger.warn(opts.event ?? "writer.retry", { ...opts.context, attempt: i + 1, delay }, err);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  return (last ?? ({ error: "Operação falhou após múltiplas tentativas." } as T));
}