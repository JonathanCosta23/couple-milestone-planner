/**
 * fundamentalNextAction — Próxima melhor ação fundamental, considerando:
 *  1. dívida cara;
 *  2. reserva insuficiente;
 *  3. orçamento sem dados;
 *  4. reserva formada mas sem plano de aporte;
 *  5. seguir plano.
 */

import type { CoreMetrics } from "./metricsService";

export type FundamentalActionKind =
  | "expensive_debt"
  | "reserve_insufficient"
  | "budget_incomplete"
  | "wealth_plan_review"
  | "keep_going";

export interface FundamentalAction {
  kind: FundamentalActionKind;
  headline: string;
  detail: string;
  ctaLabel: string;
  ctaTarget: { tab: string; sub?: string };
}

export interface FundamentalContext {
  metrics: CoreMetrics;
  hasBudgetData: boolean;
  reserveMonths: number;
  reserveTargetMonths?: number;
}

export function computeFundamentalNextAction(ctx: FundamentalContext): FundamentalAction {
  const { metrics } = ctx;
  const targetMonths = ctx.reserveTargetMonths ?? 6;

  if (metrics.toxicDebtCount > 0) {
    return {
      kind: "expensive_debt",
      headline: "Dívida cara detectada",
      detail: "Revise primeiro sua dívida mais cara antes de aumentar exposição a risco.",
      ctaLabel: "Analisar dívidas",
      ctaTarget: { tab: "execucao", sub: "dividas" },
    };
  }

  if (!ctx.hasBudgetData) {
    return {
      kind: "budget_incomplete",
      headline: "Orçamento sem dados",
      detail: "Complete seus gastos essenciais para calcular sua proteção.",
      ctaLabel: "Completar diagnóstico",
      ctaTarget: { tab: "mais", sub: "calculadoras" },
    };
  }

  if (ctx.reserveMonths < targetMonths) {
    return {
      kind: "reserve_insufficient",
      headline: "Reserva ainda em formação",
      detail: `Faltam meses para completar sua reserva de referência (${targetMonths} meses de despesas essenciais).`,
      ctaLabel: "Ver plano da reserva",
      ctaTarget: { tab: "mais", sub: "calculadoras" },
    };
  }

  if (metrics.investmentRate < 0.05 && metrics.savingsRate > 0) {
    return {
      kind: "wealth_plan_review",
      headline: "Reserva básica formada",
      detail: "Sua reserva está no cenário-alvo. Agora revise sua estratégia de construção patrimonial.",
      ctaLabel: "Revisar plano",
      ctaTarget: { tab: "configuracoes", sub: "plano-meta" },
    };
  }

  return {
    kind: "keep_going",
    headline: "Continue no plano",
    detail: "Seus fundamentos estão coerentes com o cenário atual. Mantenha o acompanhamento mensal.",
    ctaLabel: "Ver acompanhamento",
    ctaTarget: { tab: "execucao", sub: "mensal" },
  };
}