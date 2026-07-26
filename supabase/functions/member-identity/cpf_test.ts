/**
 * Testes puros da lógica de CPF (validação + HMAC) da Edge Function
 * `member-identity`. Reimplementamos as funções aqui, isoladas do fetch,
 * para rodar sem dependência do runtime Supabase.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";

function normalizeCpf(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const digits = input.replace(/\D+/g, "");
  if (digits.length !== 11) return null;
  return digits;
}

function isValidCpf(cpf: string): boolean {
  if (!/^[0-9]{11}$/.test(cpf)) return false;
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  const calcDigit = (base: string, factor: number): number => {
    let sum = 0;
    for (let i = 0; i < base.length; i++) {
      sum += parseInt(base[i], 10) * (factor - i);
    }
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const d1 = calcDigit(cpf.slice(0, 9), 10);
  if (d1 !== parseInt(cpf[9], 10)) return false;
  const d2 = calcDigit(cpf.slice(0, 10), 11);
  if (d2 !== parseInt(cpf[10], 10)) return false;
  return true;
}

async function hmacCpf(cpf: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(cpf));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}

Deno.test("normalizeCpf strips non-digits and enforces length", () => {
  assertEquals(normalizeCpf("123.456.789-09"), "12345678909");
  assertEquals(normalizeCpf("123"), null);
  assertEquals(normalizeCpf(""), null);
  assertEquals(normalizeCpf(123 as unknown as string), null);
});

Deno.test("isValidCpf accepts a known-valid CPF", () => {
  // 529.982.247-25 is a canonical test CPF used in Brazilian tutorials.
  assertEquals(isValidCpf("52998224725"), true);
});

Deno.test("isValidCpf rejects repeated-digit sequences", () => {
  for (const d of "0123456789") {
    assertEquals(isValidCpf(d.repeat(11)), false, `should reject ${d.repeat(11)}`);
  }
});

Deno.test("isValidCpf rejects invalid check digits", () => {
  assertEquals(isValidCpf("12345678900"), false);
  assertEquals(isValidCpf("11144477700"), false);
});

Deno.test("hmacCpf is deterministic and hex-64", async () => {
  const secret = "unit-test-secret-with-enough-length-xxxxxxxxxxxxxxxxxxxxxxxx";
  const a = await hmacCpf("52998224725", secret);
  const b = await hmacCpf("52998224725", secret);
  assertEquals(a, b);
  assertEquals(a.length, 64);
  assertEquals(/^[a-f0-9]{64}$/.test(a), true);
  const c = await hmacCpf("52998224725", secret + "!");
  // Different secret -> different HMAC.
  assertEquals(a === c, false);
});