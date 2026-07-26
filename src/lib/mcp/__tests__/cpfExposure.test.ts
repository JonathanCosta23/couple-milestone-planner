/**
 * Sub-passe 4.a — Guarda estática: nada em `src/` pode ler diretamente da
 * tabela privada `plan_member_private_identity`, nem manipular chaves
 * relacionadas a CPF/HMAC no cliente. A única superfície permitida é a
 * Edge Function `member-identity` (invocada via supabase.functions.invoke).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(ts|tsx|js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

const files = walk("src");

// Whitelist: apenas este próprio teste pode conter as strings acima
// (para descrevê-las). Nenhum código de produção pode referenciar a
// tabela privada ou o segredo HMAC diretamente.
const WHITELIST = new Set<string>([
  "src/lib/mcp/__tests__/cpfExposure.test.ts",
]);

describe("CPF exposure — client hygiene", () => {
  it("plan_member_private_identity is not referenced anywhere in src/", () => {
    const offenders = files
      .filter((f) => !WHITELIST.has(f.replace(/\\/g, "/")))
      .filter((f) => readFileSync(f, "utf-8").includes("plan_member_private_identity"));
    expect(offenders).toEqual([]);
  });

  it("CPF_HMAC_SECRET is never referenced in client bundle code", () => {
    const offenders = files
      .filter((f) => !WHITELIST.has(f.replace(/\\/g, "/")))
      .filter((f) => readFileSync(f, "utf-8").includes("CPF_HMAC_SECRET"));
    expect(offenders).toEqual([]);
  });

  it("cpf_hmac column is never selected in client code", () => {
    const offenders = files
      .filter((f) => !WHITELIST.has(f.replace(/\\/g, "/")))
      .filter((f) => /\bcpf_hmac\b/.test(readFileSync(f, "utf-8")));
    expect(offenders).toEqual([]);
  });
});