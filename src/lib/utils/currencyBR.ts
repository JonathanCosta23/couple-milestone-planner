/**
 * currencyBR — Parser e formatter monetário pt-BR.
 *
 * Regras suportadas:
 *  - "." como separador de milhar, "," como separador decimal
 *  - até 2 casas decimais
 *  - prefixo opcional "R$"
 *  - string vazia → { value: null } (campo vazio, sem erro)
 *  - formato inválido → { value: null, error }
 *
 * Nunca arredonda nem multiplica silenciosamente: valores fora do formato
 * retornam erro e devem ser tratados pelo chamador (nunca convertidos a 0).
 */

export interface ParsedCurrency {
  /** Valor numérico já em reais. `null` quando o campo está vazio. */
  value: number | null;
  /** Mensagem amigável quando o formato é inválido. */
  error: string | null;
}

const INT_WITH_THOUSANDS = /^\d{1,3}(\.\d{3})+$/;

/** Interpreta um valor monetário em pt-BR. */
export function parseBRLCurrency(raw: string): ParsedCurrency {
  if (typeof raw !== "string") return { value: null, error: "Formato inválido." };
  const trimmed = raw.trim().replace(/^R\$\s*/i, "").replace(/\s+/g, "");
  if (trimmed === "") return { value: null, error: null };
  if (!/^[0-9.,]+$/.test(trimmed)) return { value: null, error: "Formato inválido." };

  const commaCount = (trimmed.match(/,/g) || []).length;
  if (commaCount > 1) return { value: null, error: "Formato inválido." };

  let intPart = trimmed;
  let decPart = "";

  if (commaCount === 1) {
    const [i, d] = trimmed.split(",");
    intPart = i;
    decPart = d;
    if (!/^\d+$/.test(decPart)) return { value: null, error: "Formato inválido." };
    if (decPart.length > 2) return { value: null, error: "Máximo 2 casas decimais." };
  }

  // Parte inteira: aceita "0", "\d+" sem pontos, ou "\d{1,3}(\.\d{3})+".
  if (intPart === "") {
    // Caso "," ou ",50" — permitimos ",50" tratando como 0,50.
    if (commaCount === 1) {
      intPart = "0";
    } else {
      return { value: null, error: "Formato inválido." };
    }
  } else if (intPart.includes(".")) {
    if (!INT_WITH_THOUSANDS.test(intPart)) {
      return { value: null, error: "Formato inválido." };
    }
  } else if (!/^\d+$/.test(intPart)) {
    return { value: null, error: "Formato inválido." };
  }

  const cleanInt = intPart.replace(/\./g, "");
  const numeric = Number(cleanInt + (decPart ? "." + decPart : ""));
  if (!Number.isFinite(numeric)) return { value: null, error: "Número inválido." };
  if (numeric < 0) return { value: null, error: "Formato inválido." };
  if (numeric > Number.MAX_SAFE_INTEGER) {
    return { value: null, error: "Valor acima do limite técnico." };
  }
  return { value: numeric, error: null };
}

/**
 * Formata um valor numérico para exibição em input pt-BR.
 * `null`/`undefined` viram string vazia. Números inteiros são exibidos sem
 * casas decimais; números com fração são exibidos com 2 casas.
 */
export function formatBRLCurrencyInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return "";
  if (!Number.isFinite(value)) return "";
  const isInt = Number.isInteger(value);
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: isInt ? 0 : 2,
    maximumFractionDigits: 2,
  });
}