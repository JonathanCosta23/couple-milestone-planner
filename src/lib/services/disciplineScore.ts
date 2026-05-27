/**
 * disciplineScore — Score 0..100 de consistência de execução mensal.
 *
 * Não promete retorno financeiro. Mede apenas:
 *   1. Execução do mês atual (planejado vs realizado).
 *   2. Consistência dos últimos meses concluídos.
 *   3. Desvio médio entre planejado e realizado nesses meses.
 *
 * Função pura. Não acessa Supabase, localStorage ou Date.now() fora do helper getCurrentMonthKey.
 */

import type { PlanConfig, MonthRecord } from "@/lib/types";
import { getCurrentMonthKey } from "@/lib/types";
import { isMonthComplete, getCurrentMonthDeposited } from "@/lib/calculator";

export interface DisciplineScore {
  /** Score final 0..100. */
  total: number;
  /** Componentes ponderados, 0..100 cada. */
  components: {
    currentMonth: number;
    consistency: number;
    deviation: number;
  };
  /** Meses considerados na análise histórica (até 6). */
  monthsAnalyzed: number;
  /** Rótulo curto: "Em construção" | "Em evolução" | "Consistente" | "Exemplar". */
  label: string;
  /** Explicação curta de como o score é calculado. */
  explanation: string;
}

const HISTORY_WINDOW = 6;

function clamp(n: number, min = 0, max = 100): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

function sumPlanned(config: PlanConfig): number {
  return config.contributors.reduce(
    (s, c) => s + (c?.plannedSelic || 0) + (c?.plannedCDB || 0),
    0,
  );
}

function sumRecord(record: MonthRecord | undefined): number {
  if (!record) return 0;
  return record.deposits.reduce(
    (s, d) => s + (d?.actualSelic || 0) + (d?.actualCDB || 0),
    0,
  );
}

/**
 * Calcula o Score de Disciplina Financeira (0..100).
 * Permite injetar referenceMonthKey em testes (default: mês corrente).
 */
export function calculateDisciplineScore(
  config: PlanConfig,
  monthRecords: MonthRecord[],
  referenceMonthKey: string = getCurrentMonthKey(),
): DisciplineScore {
  const planned = sumPlanned(config);
  const current = getCurrentMonthDeposited(config, monthRecords);

  // 1) Execução do mês corrente (0..100).
  const currentMonthScore = planned > 0
    ? clamp((current.total / planned) * 100)
    : current.total > 0 ? 100 : 0;

  // Janela histórica: meses estritamente anteriores ao mês de referência.
  const pastRecords = monthRecords
    .filter((r) => r.monthKey < referenceMonthKey)
    .sort((a, b) => a.monthKey.localeCompare(b.monthKey))
    .slice(-HISTORY_WINDOW);

  const monthsAnalyzed = pastRecords.length;

  // 2) Consistência: % de meses concluídos na janela.
  const completedCount = pastRecords.filter((r) =>
    isMonthComplete(config, monthRecords, r.monthKey),
  ).length;
  const consistencyScore = monthsAnalyzed > 0
    ? clamp((completedCount / monthsAnalyzed) * 100)
    : 0;

  // 3) Desvio médio absoluto entre planejado e realizado.
  let deviationScore = 100;
  if (monthsAnalyzed > 0 && planned > 0) {
    const deviations = pastRecords.map((r) => {
      const realized = sumRecord(r);
      return Math.min(1, Math.abs(planned - realized) / planned);
    });
    const avgDeviation = deviations.reduce((s, d) => s + d, 0) / deviations.length;
    deviationScore = clamp((1 - avgDeviation) * 100);
  } else if (monthsAnalyzed === 0) {
    deviationScore = 0;
  }

  // Pesos: execução 40%, consistência 40%, aderência 20%.
  const total = Math.round(
    currentMonthScore * 0.4 + consistencyScore * 0.4 + deviationScore * 0.2,
  );

  const label = total >= 85
    ? "Exemplar"
    : total >= 65
      ? "Consistente"
      : total >= 40
        ? "Em evolução"
        : "Em construção";

  const explanation =
    "Calculado a partir da execução do mês atual, da consistência dos últimos meses concluídos e do desvio entre planejado e realizado. Mede disciplina de execução, não retorno financeiro.";

  return {
    total,
    components: {
      currentMonth: Math.round(currentMonthScore),
      consistency: Math.round(consistencyScore),
      deviation: Math.round(deviationScore),
    },
    monthsAnalyzed,
    label,
    explanation,
  };
}