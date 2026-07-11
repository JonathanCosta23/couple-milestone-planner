// Read runtime env safely in Deno edge (primary), while remaining import-safe
// during Vite/Node build-time evaluation of the MCP entry (fallback).
export function getRuntimeEnv(name: string): string {
  // deno-lint-ignore no-explicit-any
  const g = globalThis as any;
  const denoGet = g?.Deno?.env?.get;
  if (typeof denoGet === "function") {
    return denoGet.call(g.Deno.env, name) ?? "";
  }
  const procEnv = g?.process?.env;
  if (procEnv && typeof procEnv === "object") {
    return procEnv[name] ?? "";
  }
  return "";
}