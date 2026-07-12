// Read runtime env safely in Deno edge (primary), while remaining import-safe
// during Vite/Node build-time evaluation of the MCP entry (fallback).

export interface RuntimeDenoEnv {
  get(name: string): string | undefined;
}

export interface RuntimeDeno {
  env?: RuntimeDenoEnv;
}

export interface RuntimeProcess {
  env?: Record<string, string | undefined>;
}

export type RuntimeGlobal = typeof globalThis & {
  Deno?: RuntimeDeno;
  process?: RuntimeProcess;
};

/**
 * Pure implementation, exported for tests: reads an env var from a supplied
 * runtime-like object. Deno takes priority over Node's `process.env` so the
 * same code path serves the Supabase edge runtime and local build tooling.
 */
export function readRuntimeEnv(runtime: RuntimeGlobal, name: string): string {
  const denoGet = runtime.Deno?.env?.get;
  if (typeof denoGet === "function") {
    return denoGet.call(runtime.Deno!.env, name) ?? "";
  }
  const processEnv = runtime.process?.env;
  if (processEnv && typeof processEnv === "object") {
    return processEnv[name] ?? "";
  }
  return "";
}

export function getRuntimeEnv(name: string): string {
  const runtime = globalThis as RuntimeGlobal;
  return readRuntimeEnv(runtime, name);
}