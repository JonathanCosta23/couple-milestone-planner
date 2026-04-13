/**
 * insightsService — Generates next best action, bottlenecks, alerts.
 * Uses CoreMetrics — never recalculates independently.
 */

import type { CoreMetrics } from "./metricsService";
import type { JourneyState } from "./journeyService";
import { formatBRL } from "@/lib/types";

export interface Insight {
  id: string;
  type: "action" | "warning" | "info" | "success";
  title: string;
  message: string;
  cause?: string;
  recommendedAction?: string;
  severity: "info" | "warning" | "critical" | "success";
  priority: number;
}

export interface InsightsResult {
  nextBestAction: Insight | null;
  biggestBottleneck: Insight | null;
  biggestRisk: Insight | null;
  allInsights: Insight[];
}

export function generateInsights(
  metrics: CoreMetrics,
  journey: JourneyState
): InsightsResult {
  const insights: Insight[] = [];
  const subject = metrics.isCouple ? "Vocês" : "Você";
  const verb = metrics.isCouple ? "têm" : "tem";
  const verbEstar = metrics.isCouple ? "estão" : "está";

  // ── Critical: No income tracked ──
  if (metrics.totalIncome === 0) {
    insights.push({
      id: "no-income",
      type: "action",
      title: "Cadastrar receitas",
      message: "Sem receitas cadastradas, as recomendações ficam limitadas.",
      recommendedAction: "Vá até Renda e cadastre suas fontes de receita.",
      severity: "critical",
      priority: 100,
    });
  }

  // ── Toxic debts ──
  if (metrics.toxicDebtCount > 0) {
    insights.push({
      id: "toxic-debt",
      type: "warning",
      title: "Dívidas de alto custo",
      message: `${subject} ${verb} ${metrics.toxicDebtCount} dívida(s) de alto risco. Priorize quitar antes de investir.`,
      cause: "Juros altos corroem seu patrimônio mais rápido do que investimentos podem crescer.",
      recommendedAction: "Renegocie ou quite as dívidas tóxicas primeiro.",
      severity: "critical",
      priority: 95,
    });
  }

  // ── Emergency fund ──
  if (metrics.reserveStatus === "empty") {
    insights.push({
      id: "no-reserve",
      type: "action",
      title: "Criar reserva de emergência",
      message: `${subject} ainda não ${verb} reserva de emergência. Meta: ${formatBRL(metrics.reserveGoal)}.`,
      recommendedAction: "Comece guardando em Tesouro Selic — liquidez diária e garantia soberana.",
      severity: "critical",
      priority: 90,
    });
  } else if (metrics.reserveStatus === "building" || metrics.reserveStatus === "partial") {
    insights.push({
      id: "reserve-partial",
      type: "info",
      title: "Reserva em construção",
      message: `${subject} ${verb} ${metrics.reserveMonths.toFixed(1)} meses de reserva. Meta: ${metrics.reserveGoalMonths} meses.`,
      recommendedAction: "Continue priorizando a reserva até atingir a meta.",
      severity: "warning",
      priority: 75,
    });
  }

  // ── High debt weight ──
  if (metrics.debtWeight > 0.3) {
    insights.push({
      id: "high-debt-weight",
      type: "warning",
      title: "Dívidas consomem mais de 30% da renda",
      message: `${(metrics.debtWeight * 100).toFixed(0)}% da renda ${verbEstar} comprometida com dívidas.`,
      severity: "warning",
      priority: 80,
    });
  }

  // ── Low savings rate ──
  if (metrics.totalIncome > 0 && metrics.savingsRate < 0.1) {
    insights.push({
      id: "low-savings",
      type: "warning",
      title: "Taxa de poupança baixa",
      message: `${subject} ${verbEstar} poupando apenas ${(metrics.savingsRate * 100).toFixed(0)}% da renda.`,
      recommendedAction: "Revise gastos variáveis e não-essenciais.",
      severity: "warning",
      priority: 70,
    });
  }

  // ── Card dependency ──
  if (metrics.cardDependency > 0.4) {
    insights.push({
      id: "card-dependency",
      type: "warning",
      title: "Alta dependência de cartão",
      message: `Gastos no cartão representam ${(metrics.cardDependency * 100).toFixed(0)}% das despesas.`,
      severity: "warning",
      priority: 65,
    });
  }

  // ── Concentration ──
  if (metrics.maxConcentrationByInstitution > 0.8 && metrics.grossWealth > 50_000) {
    insights.push({
      id: "concentration",
      type: "warning",
      title: "Concentração patrimonial alta",
      message: `${(metrics.maxConcentrationByInstitution * 100).toFixed(0)}% do patrimônio está em "${metrics.concentrationInstitution}".`,
      recommendedAction: "Diversifique entre instituições para reduzir risco.",
      severity: "warning",
      priority: 70,
    });
  }

  // ── Streak praise ──
  if (metrics.streak >= 3) {
    insights.push({
      id: "streak",
      type: "success",
      title: "Disciplina consistente",
      message: `${metrics.streak} meses consecutivos de aporte! ${metrics.isCouple ? "Continuem" : "Continue"} assim! 🔥`,
      severity: "success",
      priority: 40,
    });
  }

  // ── Reserve complete ──
  if (metrics.reserveStatus === "complete") {
    insights.push({
      id: "reserve-complete",
      type: "success",
      title: "Reserva de emergência completa",
      message: `${subject} ${verb} ${metrics.reserveMonths.toFixed(1)} meses de reserva. Base sólida! ✅`,
      severity: "success",
      priority: 30,
    });
  }

  // Sort by priority
  insights.sort((a, b) => b.priority - a.priority);

  // Classify
  const actions = insights.filter(i => i.type === "action" || (i.type === "warning" && i.severity === "critical"));
  const warnings = insights.filter(i => i.type === "warning");
  const risks = insights.filter(i => i.severity === "critical" || i.severity === "warning");

  return {
    nextBestAction: actions[0] || warnings[0] || insights[0] || null,
    biggestBottleneck: warnings[0] || null,
    biggestRisk: risks[0] || null,
    allInsights: insights,
  };
}
