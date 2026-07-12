/**
 * Fachada do motor NBA. Combina geração + ranking. Sem side effects.
 */

import { generateAllCandidates } from "./nextActionCandidates";
import { rankCandidates, selectNextBestAction } from "./nextActionRanking";
import type { NextActionContext, RankedResult, NextBestAction } from "../types/nextAction";

export function runNextActionEngine(ctx: NextActionContext): RankedResult {
  return rankCandidates(generateAllCandidates(ctx), ctx);
}

export function computeNextBestAction(ctx: NextActionContext): NextBestAction | null {
  return selectNextBestAction(generateAllCandidates(ctx), ctx);
}

/** Palavras proibidas na copy (guardrail de compliance). */
export const FORBIDDEN_TERMS = [
  "compre",
  "venda esse ativo",
  "resgate agora",
  "transfira para o banco",
  "melhor investimento",
  "produto ideal",
  "carteira recomendada",
  "retorno garantido",
  "você ficará rico",
  "liberdade financeira garantida",
  "aposentadoria garantida",
];

export function hasForbiddenLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return FORBIDDEN_TERMS.some((t) => lower.includes(t));
}