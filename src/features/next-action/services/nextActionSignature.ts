/**
 * Assinatura determinística da condição de uma ação.
 *
 * Regras (Pass 3.1):
 *  - Determinística: mesma entrada => mesma assinatura.
 *  - Independente da ordem das chaves e de coleções.
 *  - Não pode conter Math.random, Date.now nem timestamps.
 *  - Não pode expor valores financeiros em texto legível
 *    (o hash absorve os valores materiais em um digest hexadecimal).
 *  - Serve como chave de invalidação: mudar a condição => mudar a assinatura
 *    => estado persistido anterior não se aplica mais ao candidato atual,
 *    mas seu histórico é preservado.
 */

import {
  NBA_SIGNATURE_VERSION,
  type NextActionCandidate,
  type UserActionState,
} from "../types/nextAction";

/** Serializa recursivamente com chaves ordenadas e arrays estáveis. */
function stableStringify(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "number" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    const parts = value.map((v) => stableStringify(v));
    parts.sort();
    return `[${parts.join(",")}]`;
  }
  if (typeof value === "object") {
    const keys = Object.keys(value as Record<string, unknown>).sort();
    const parts = keys.map(
      (k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`,
    );
    return `{${parts.join(",")}}`;
  }
  return "null";
}

/** Hash FNV-1a 64-bit em hex. Determinístico, sem crypto assíncrono. */
function fnv1a64Hex(input: string): string {
  const FNV_OFFSET = 0xcbf29ce484222325n;
  const FNV_PRIME = 0x100000001b3n;
  const MASK = 0xffffffffffffffffn;
  let hash = FNV_OFFSET;
  for (let i = 0; i < input.length; i++) {
    hash = (hash ^ BigInt(input.charCodeAt(i))) & MASK;
    hash = (hash * FNV_PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, "0");
}

/**
 * Constrói a assinatura determinística de um candidato.
 * Usa `signatureInputs` quando fornecido; caso contrário deriva de campos
 * estáveis (actionKey, severity, priority, confidence, missingData ordenado).
 * Nunca inclui `generatedAt`, `expiresAt` ou dados dependentes do relógio.
 */
export function buildConditionSignature(candidate: NextActionCandidate): string {
  const inputs = candidate.signatureInputs ?? {
    actionKey: candidate.actionKey,
    severity: candidate.severity,
    priority: candidate.priority,
    confidence: candidate.confidence,
    missingData: (candidate.missingData ?? []).slice().sort(),
  };
  const payload = stableStringify({
    v: NBA_SIGNATURE_VERSION,
    k: candidate.actionKey,
    i: inputs,
  });
  return `${NBA_SIGNATURE_VERSION}:${fnv1a64Hex(payload)}`;
}

/**
 * Diz se o estado persistido ainda se aplica ao candidato atual.
 * Estados de versão/assinatura divergente são considerados invalidados.
 * Estados sem assinatura registrada (registros legados) permanecem aplicáveis
 * para não descartar histórico existente de usuários.
 */
export function isStoredStateApplicableToCandidate(
  state: UserActionState | undefined,
  currentSignature: string,
): boolean {
  if (!state) return true;
  if (state.conditionVersion && state.conditionVersion !== NBA_SIGNATURE_VERSION) {
    return false;
  }
  if (state.conditionSignature && state.conditionSignature !== currentSignature) {
    return false;
  }
  return true;
}