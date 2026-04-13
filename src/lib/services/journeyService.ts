/**
 * journeyService — Phase detection based on objective rules.
 * Uses CoreMetrics as input — never recalculates independently.
 */

import type { CoreMetrics } from "./metricsService";

export type JourneyPhase =
  | "chaos"
  | "control"
  | "protection"
  | "accumulation"
  | "acceleration"
  | "consolidation"
  | "passive-income"
  | "functional-wealth";

export interface JourneyState {
  currentPhase: JourneyPhase;
  phaseName: string;
  phaseEmoji: string;
  phaseDescription: string;
  completedCriteria: string[];
  pendingCriteria: string[];
  nextPhase: JourneyPhase | null;
  progressToNext: number; // 0-1
  priorities: string[];
}

interface PhaseRule {
  id: JourneyPhase;
  name: string;
  emoji: string;
  description: string;
  check: (m: CoreMetrics) => boolean;
  criteria: (m: CoreMetrics) => { completed: string[]; pending: string[] };
  priorities: string[];
  next: JourneyPhase | null;
}

const PHASE_RULES: PhaseRule[] = [
  {
    id: "functional-wealth",
    name: "Riqueza Funcional",
    emoji: "👑",
    description: "Meta alcançada. Patrimônio sustentável.",
    check: m => m.grossWealth >= 1_000_000 && m.reserveMonths >= 6,
    criteria: m => ({
      completed: ["Patrimônio ≥ R$ 1M", "Reserva completa"],
      pending: [],
    }),
    priorities: ["Preservar patrimônio", "Viver com propósito"],
    next: null,
  },
  {
    id: "passive-income",
    name: "Renda Passiva Parcial",
    emoji: "🌟",
    description: "Patrimônio gera renda significativa.",
    check: m => m.grossWealth >= 750_000 && m.reserveMonths >= 6,
    criteria: m => ({
      completed: [
        m.grossWealth >= 750_000 ? "Patrimônio ≥ R$ 750k" : "",
        m.reserveMonths >= 6 ? "Reserva completa" : "",
      ].filter(Boolean),
      pending: [
        m.grossWealth < 1_000_000 ? "Patrimônio ≥ R$ 1M" : "",
      ].filter(Boolean),
    }),
    priorities: ["Manter aportes", "Proteger contra inflação"],
    next: "functional-wealth",
  },
  {
    id: "consolidation",
    name: "Consolidação",
    emoji: "💎",
    description: "Juros compostos trabalhando forte.",
    check: m => m.grossWealth >= 500_000 && m.reserveMonths >= 6,
    criteria: m => ({
      completed: [
        m.grossWealth >= 500_000 ? "Patrimônio ≥ R$ 500k" : "",
        m.reserveMonths >= 6 ? "Reserva completa" : "",
      ].filter(Boolean),
      pending: [
        m.grossWealth < 750_000 ? "Patrimônio ≥ R$ 750k" : "",
      ].filter(Boolean),
    }),
    priorities: ["Rebalancear carteira", "Otimizar tributação"],
    next: "passive-income",
  },
  {
    id: "acceleration",
    name: "Aceleração",
    emoji: "🚀",
    description: "Patrimônio relevante, buscando crescimento.",
    check: m => m.grossWealth >= 250_000 && m.reserveMonths >= 6,
    criteria: m => ({
      completed: [
        m.grossWealth >= 250_000 ? "Patrimônio ≥ R$ 250k" : "",
        m.reserveMonths >= 6 ? "Reserva completa" : "",
      ].filter(Boolean),
      pending: [
        m.grossWealth < 500_000 ? "Patrimônio ≥ R$ 500k" : "",
      ].filter(Boolean),
    }),
    priorities: ["Diversificar entre classes", "Proteger capital"],
    next: "consolidation",
  },
  {
    id: "accumulation",
    name: "Acumulação",
    emoji: "🔵",
    description: "Investindo com disciplina. Patrimônio crescendo.",
    check: m => m.reserveMonths >= 6 && m.toxicDebtCount === 0,
    criteria: m => ({
      completed: [
        m.reserveMonths >= 6 ? "Reserva de 6 meses" : "",
        m.toxicDebtCount === 0 ? "Sem dívidas tóxicas" : "",
      ].filter(Boolean),
      pending: [
        m.grossWealth < 250_000 ? "Patrimônio ≥ R$ 250k" : "",
        m.streak < 6 ? "6+ meses consecutivos" : "",
      ].filter(Boolean),
    }),
    priorities: ["Manter consistência", "Diversificar", "Controlar FGC"],
    next: "acceleration",
  },
  {
    id: "protection",
    name: "Proteção",
    emoji: "🟢",
    description: "Reserva parcial. Construindo segurança.",
    check: m => m.reserveMonths >= 3 && m.savingsRate >= 0.05,
    criteria: m => ({
      completed: [
        m.reserveMonths >= 3 ? "Reserva de 3+ meses" : "",
        m.savingsRate >= 0.05 ? "Taxa de poupança positiva" : "",
      ].filter(Boolean),
      pending: [
        m.reserveMonths < 6 ? "Completar reserva para 6 meses" : "",
        m.toxicDebtCount > 0 ? "Eliminar dívidas tóxicas" : "",
      ].filter(Boolean),
    }),
    priorities: ["Completar 6 meses de reserva", "Iniciar aportes recorrentes"],
    next: "accumulation",
  },
  {
    id: "control",
    name: "Controle",
    emoji: "🟡",
    description: "Mapeando fluxo. Sem novas dívidas.",
    check: m => m.totalIncome > 0 || m.totalExpenses > 0,
    criteria: m => ({
      completed: [
        m.totalIncome > 0 ? "Receitas cadastradas" : "",
        m.totalExpenses > 0 ? "Gastos mapeados" : "",
      ].filter(Boolean),
      pending: [
        m.reserveMonths < 3 ? "Reserva de emergência (3 meses)" : "",
        m.savingsRate < 0.1 ? "Taxa de poupança > 10%" : "",
      ].filter(Boolean),
    }),
    priorities: ["Criar reserva de emergência", "Manter orçamento equilibrado"],
    next: "protection",
  },
  {
    id: "chaos",
    name: "Caos Financeiro",
    emoji: "🔴",
    description: "Sem controle sobre gastos e dívidas.",
    check: () => true, // fallback
    criteria: m => ({
      completed: [],
      pending: [
        "Mapear receitas e despesas",
        "Parar de criar novas dívidas",
        m.toxicDebtCount > 0 ? "Negociar dívidas tóxicas" : "",
      ].filter(Boolean),
    }),
    priorities: ["Mapear tudo que entra e sai", "Parar de criar novas dívidas"],
    next: "control",
  },
];

export function detectJourneyState(metrics: CoreMetrics): JourneyState {
  // Walk from highest phase to lowest
  for (const rule of PHASE_RULES) {
    if (rule.check(metrics)) {
      const { completed, pending } = rule.criteria(metrics);
      const totalCriteria = completed.length + pending.length;
      const progressToNext = totalCriteria > 0 ? completed.length / totalCriteria : 1;

      return {
        currentPhase: rule.id,
        phaseName: rule.name,
        phaseEmoji: rule.emoji,
        phaseDescription: rule.description,
        completedCriteria: completed,
        pendingCriteria: pending,
        nextPhase: rule.next,
        progressToNext,
        priorities: rule.priorities,
      };
    }
  }

  // Should never reach here
  return detectJourneyState(metrics);
}
