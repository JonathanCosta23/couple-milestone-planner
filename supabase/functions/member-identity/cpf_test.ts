/**
 * Testes da lógica compartilhada de CPF. Importa a implementação real de
 * `./cpf.ts` — nada é duplicado no teste.
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { hmacCpf, isValidCpf, normalizeCpf } from "./cpf.ts";

Deno.test("normalizeCpf strips non-digits and enforces length", () => {
  assertEquals(normalizeCpf("123.456.789-09"), "12345678909");
  assertEquals(normalizeCpf("529 982 247-25"), "52998224725");
  assertEquals(normalizeCpf("123"), null);
  assertEquals(normalizeCpf(""), null);
  assertEquals(normalizeCpf(123 as unknown as string), null);
});

Deno.test("normalizeCpf rejects entries with letters or symbols", () => {
  // 11 dígitos válidos escondidos entre letras — não deve normalizar.
  assertEquals(normalizeCpf("5a2b9c9d8e2f2g4h7i2j5"), null);
  assertEquals(normalizeCpf("cpf:52998224725"), null);
  assertEquals(normalizeCpf("52998224725x"), null);
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