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
  } else {
    fn(`[${level}] ${event}`, payload);
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