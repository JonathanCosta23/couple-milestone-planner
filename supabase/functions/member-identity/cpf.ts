/**
 * Lógica compartilhada de CPF para a Edge Function `member-identity`.
 * Fica isolada aqui para ser importada tanto pelo `index.ts` quanto
 * pelos testes Deno — sem duplicar implementação.
 */

/**
 * Normaliza CPF aceitando somente dígitos, pontos, hífen e espaços.
 * Retorna string de 11 dígitos ou `null` quando a entrada contém
 * qualquer caractere fora da lista permitida ou não fecha em 11 dígitos.
 */
export function normalizeCpf(input: unknown): string | null {
  if (typeof input !== "string") return null;
  if (!/^[0-9.\-\s]+$/.test(input)) return null;
  const digits = input.replace(/[^0-9]/g, "");
  if (digits.length !== 11) return null;
  return digits;
}

/** Valida dígitos verificadores e rejeita sequências repetidas. */
export function isValidCpf(cpf: string): boolean {
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

/** HMAC-SHA-256 hex do CPF. NUNCA logar o resultado nem a entrada. */
export async function hmacCpf(cpf: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(cpf));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (const b of bytes) hex += b.toString(16).padStart(2, "0");
  return hex;
}