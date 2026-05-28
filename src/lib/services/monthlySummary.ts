/**
 * monthlySummary — Resumo Mensal Executivo e Próxima Melhor Ação.
 *
 * Funções puras, sem efeitos colaterais. Consumidas pela Home para
 * apresentar status do mês corrente e a próxima ação objetiva.
 */

import type { PlanConfig, MonthRecord } from "@/lib/types";
import { getCurrentMonthKey, monthKeyToFullLabel, formatBRL } from "@/lib/types";
import { getCurrentMonthDeposited, isMonthComplete } from "@/lib/calculator";

export type MonthExecutionStatus =
  | "no_plan"
  | "pending"
  | "partial"
  | "completed";

export interface MemberProgress {
  name: string;
  planned: number;
  realized: number;
  pct: number;
}

export interface MonthlySummary {
  monthKey: string;
  monthLabel: string;
  planned: number;
  realized: number;
  remaining: number;
  /** 0..1. */
  executionPct: number;
  status: MonthExecutionStatus;
  /** Estimativa de impacto no patrimônio projetado (juro simples sobre o que falta). */
  projectedImpact: number;
  /** Frase curta de diagnóstico, sem promessa de retorno. */
  diagnostic: string;
  perMember: MemberProgress[];
  isCouple: boolean;
}

export interface NextBestActionContext {
  /** Patrimônio bruto atualizado pela última vez (ms epoch) — quando disponível. */
  lastWealthUpdateAt?: number | null;
  /** Próximo marco patrimonial (em R$), se houver. */
  nextMilestoneValue?: number | null;
  /** Faltam meses para próximo marco, se houver. */
  nextMilestoneMonths?: number | null;
  /** Se há premissas faltando (selic / cdb / inflação / anos). */
  assumptionsIncomplete?: boolean;
}

export interface NextBestAction {
  id:
    | "complete_month"
    | "review_next_month"
    | "review_assumptions"
    | "update_wealth"
    | "track_milestone"
    | "configure_plan";
  title: string;
  description: string;
  ctaLabel: string;
  /** Aba sugerida (string usada por onNavigateToTab). vazio = ação no próprio cockpit. */
  tab: string;
}

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Resumo executivo do mês corrente.
 */
export function buildMonthlySummary(
  config: PlanConfig,
  monthRecords: MonthRecord[],
  referenceMonthKey: string = getCurrentMonthKey(),
): MonthlySummary {
  const current = getCurrentMonthDeposited(config, monthRecords);
  const planned = current.planned;
  const realized = current.total;
  const remaining = Math.max(0, planned - realized);
  const executionPct = planned > 0 ? Math.min(1, realized / planned) : 0;

  let status: MonthExecutionStatus;
  if (planned <= 0) status = "no_plan";
  else if (realized <= 0) status = "pending";
  else if (realized >= planned) status = "completed";
  else status = "partial";

  // Impacto estimado: aproximação simples — o que falta ainda pode ser aportado
  // este mês. Não promete rentabilidade futura, apenas comunica o "esforço restante".
  const projectedImpact = remaining;

  let diagnostic: string;
  switch (status) {
    case "no_plan":
      diagnostic = "Defina a meta mensal para acompanhar a execução do mês.";
      break;
    case "pending":
      diagnostic = `Mês ainda sem aporte. Faltam ${formatBRL(remaining)} para fechar o planejado.`;
      break;
    case "partial":
      diagnostic = `Você já cumpriu ${Math.round(executionPct * 100)}% do plano. Faltam ${formatBRL(remaining)}.`;
      break;
    case "completed":
      diagnostic = "Mês no alvo. Quando quiser, marque como concluído.";
      break;
  }

  const isCouple = config.contributors.length > 1;
  const perMember: MemberProgress[] = current.perPerson.map((p) => ({
    name: p.name || (isCouple ? "Participante" : "Você"),
    planned: p.planned,
    realized: p.deposited,
    pct: p.pct,
  }));

  return {
    monthKey: referenceMonthKey,
    monthLabel: monthKeyToFullLabel(referenceMonthKey),
    planned,
    realized,
    remaining,
    executionPct,
    status,
    projectedImpact,
    diagnostic,
    perMember,
    isCouple,
  };
}

/**
 * Decide a próxima melhor ação. Função pura: prioriza ações urgentes
 * sobre informativas. Retorna sempre um item — nunca null — para garantir
 * que a Home tenha um próximo passo concreto.
 */
export function computeNextBestAction(
  summary: MonthlySummary,
  ctx: NextBestActionContext = {},
): NextBestAction {
  // 1) Plano não configurado.
  if (summary.status === "no_plan") {
    return {
      id: "configure_plan",
      title: "Defina sua meta mensal",
      description: "Sem meta definida não há como acompanhar a execução do mês.",
      ctaLabel: "Configurar plano",
      tab: "simulador",
    };
  }

  // 2) Premissas incompletas.
  if (ctx.assumptionsIncomplete) {
    return {
      id: "review_assumptions",
      title: "Revisar premissas da projeção",
      description: "Confira Selic, CDB, inflação e prazo para a projeção ficar fiel.",
      ctaLabel: "Abrir projeção",
      tab: "projecao",
    };
  }

  // 3) Mês ainda em aberto: priorizar fechar.
  if (summary.status === "pending" || summary.status === "partial") {
    return {
      id: "complete_month",
      title: summary.status === "pending"
        ? "Registrar aporte do mês"
        : `Faltam ${formatBRL(summary.remaining)} para fechar o mês`,
      description: "Registre o aporte agora para manter o ritmo do plano.",
      ctaLabel: "Registrar aporte",
      tab: "",
    };
  }

  // 4) Mês fechado: ver patrimônio se estiver desatualizado.
  const wealthStale = ctx.lastWealthUpdateAt != null
    && Date.now() - ctx.lastWealthUpdateAt > THIRTY_DAYS_MS;
  if (wealthStale) {
    return {
      id: "update_wealth",
      title: "Atualizar patrimônio",
      description: "Seus saldos estão há mais de 30 dias sem revisão.",
      ctaLabel: "Revisar patrimônio",
      tab: "ativos",
    };
  }

  // 5) Marco próximo: acompanhar.
  if (ctx.nextMilestoneValue && ctx.nextMilestoneMonths != null && ctx.nextMilestoneMonths <= 12) {
    return {
      id: "track_milestone",
      title: "Acompanhar próximo marco",
      description: `Você pode atingir ${formatBRL(ctx.nextMilestoneValue)} em cerca de ${ctx.nextMilestoneMonths} meses.`,
      ctaLabel: "Ver projeção",
      tab: "projecao",
    };
  }

  // 6) Mês concluído sem outras pendências: revisar próximo mês.
  return {
    id: "review_next_month",
    title: "Revisar plano do próximo mês",
    description: "Mês atual fechado. Confira a meta do próximo mês antes que vire.",
    ctaLabel: "Revisar próximo mês",
    // Aba real: "mensal" em Execução (useAppNavigation.EXECUCAO_TABS).
    tab: "mensal",
  };
}

/** Utilidade pequena para o componente de progresso de marco. */
export function buildMilestoneProgress(
  currentWealth: number,
  milestoneValues: number[],
) {
  const sorted = [...milestoneValues].sort((a, b) => a - b);
  const previous = [...sorted].reverse().find((m) => currentWealth >= m) ?? 0;
  const next = sorted.find((m) => currentWealth < m) ?? sorted[sorted.length - 1];
  const span = next - previous;
  const pct = span > 0 ? Math.min(1, Math.max(0, (currentWealth - previous) / span)) : 1;
  return { previous, next, pct };
}

/**
 * Retorna a lista de marcos relevantes para um plano, incluindo a meta final.
 * Filtra marcos acima da meta — não faz sentido orientar o usuário a marcos
 * inalcançáveis dentro do plano atual.
 */
export function getRelevantMilestones(milestoneValues: number[], targetAmount: number): number[] {
  const cleaned = milestoneValues.filter((v) => v > 0 && v <= targetAmount);
  if (!cleaned.includes(targetAmount)) cleaned.push(targetAmount);
  return Array.from(new Set(cleaned)).sort((a, b) => a - b);
}

/**
 * Calcula meses até o PRÓXIMO marco (não a meta final) usando uma série
 * de projeção. Retorna null se a série não cruzar o valor — assim a UI
 * consegue mostrar "estimativa indisponível" em vez de chumbar número.
 */
export function findMonthsToCrossing(
  series: Array<{ monthIndex: number; balance: number }>,
  targetValue: number,
): number | null {
  if (!Number.isFinite(targetValue) || targetValue <= 0) return null;
  const hit = series.find((p) => p.balance >= targetValue);
  return hit ? hit.monthIndex : null;
}