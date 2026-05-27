/**
 * Premissas financeiras centralizadas.
 *
 * Toda projeção, simulação e métrica derivada deve consumir as premissas a
 * partir deste módulo. O objetivo é garantir que:
 *
 * 1. Não existam taxas, inflação, IR ou horizonte hardcoded espalhados nos
 *    hooks de UI ou componentes.
 * 2. As premissas do plano salvo no Supabase (`plans.assumption_*`) tenham
 *    prioridade quando disponíveis.
 * 3. Os defaults estejam declarados em um único lugar, com fonte/comentário,
 *    facilitando auditoria.
 * 4. Existam presets explícitos de cenário (conservador, base, agressivo)
 *    para uso na UI de simulação.
 *
 * IMPORTANTE: Estes números são premissas educacionais. Não constituem
 * recomendação personalizada de investimento.
 */

export interface FinancialAssumptions {
  /** Taxa nominal esperada de retorno bruto anual (ex.: 0.1315 = 13,15%). */
  expectedReturnRate: number;
  /** % do CDI usado para CDB e equivalentes (1.0 = 100% do CDI). */
  cdbPctOfCdi: number;
  /** Inflação anual estimada para deflacionar valores reais. */
  inflationRate: number;
  /** Alíquota efetiva de IR sobre os ganhos (estimativa simplificada). */
  taxRate: number;
  /** IOF aplicado em resgates muito curtos. Estimado em 0 no longo prazo. */
  iofRate: number;
  /** Regra de retirada anual para renda passiva projetada (default 4%). */
  withdrawalRate: number;
}

/**
 * Defaults usados quando o plano ainda não persistiu premissas próprias.
 * Mantidos em sintonia com `plans.assumption_*` no Supabase.
 */
export const DEFAULT_ASSUMPTIONS: FinancialAssumptions = {
  expectedReturnRate: 0.1315, // Selic-meta de referência ao escrever este módulo
  cdbPctOfCdi: 1.0,
  inflationRate: 0.045, // IPCA médio histórico de longo prazo (BCB)
  taxRate: 0.15, // Faixa mais baixa do IR para renda fixa de longo prazo
  iofRate: 0, // Desconsiderado no horizonte de planejamento (>30 dias)
  withdrawalRate: 0.04, // Regra dos 4%, simplificação educacional
};

export type ScenarioId = "conservative" | "base" | "aggressive";

export interface ScenarioPreset {
  id: ScenarioId;
  label: string;
  description: string;
  assumptions: FinancialAssumptions;
}

/**
 * Presets explícitos para a tela de cenários. Os números são derivados do
 * default e ajustados em ±~25% para refletir realidades plausíveis sem
 * sugerir promessa de retorno.
 */
export const SCENARIO_PRESETS: Record<ScenarioId, ScenarioPreset> = {
  conservative: {
    id: "conservative",
    label: "Conservador",
    description: "Retorno menor e inflação alta. Útil para testar resiliência do plano.",
    assumptions: {
      ...DEFAULT_ASSUMPTIONS,
      expectedReturnRate: 0.10,
      inflationRate: 0.06,
    },
  },
  base: {
    id: "base",
    label: "Base",
    description: "Premissas centrais do plano. Cenário esperado.",
    assumptions: DEFAULT_ASSUMPTIONS,
  },
  aggressive: {
    id: "aggressive",
    label: "Otimista",
    description: "Retorno acima do histórico e inflação controlada. Use com cautela.",
    assumptions: {
      ...DEFAULT_ASSUMPTIONS,
      expectedReturnRate: 0.15,
      inflationRate: 0.035,
    },
  },
};

/** Subconjunto de campos vindos de `plans` (Supabase) usado para resolução. */
export interface PlanAssumptionsSource {
  assumption_selic?: number | null;
  assumption_cdb_pct?: number | null;
  assumption_inflation?: number | null;
  assumption_ir?: number | null;
  assumption_iof?: number | null;
}

function pickFinite(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/**
 * Resolve a única instância de premissas que deve ser usada. Ordem:
 * 1. overrides explícitos (cenários e simulações ad-hoc);
 * 2. premissas persistidas no plano (Supabase);
 * 3. DEFAULT_ASSUMPTIONS.
 */
export function resolveAssumptions(
  plan?: PlanAssumptionsSource | null,
  overrides?: Partial<FinancialAssumptions>,
): FinancialAssumptions {
  const fromPlan: FinancialAssumptions = {
    expectedReturnRate: pickFinite(plan?.assumption_selic, DEFAULT_ASSUMPTIONS.expectedReturnRate),
    cdbPctOfCdi: pickFinite(plan?.assumption_cdb_pct, DEFAULT_ASSUMPTIONS.cdbPctOfCdi),
    inflationRate: pickFinite(plan?.assumption_inflation, DEFAULT_ASSUMPTIONS.inflationRate),
    taxRate: pickFinite(plan?.assumption_ir, DEFAULT_ASSUMPTIONS.taxRate),
    iofRate: pickFinite(plan?.assumption_iof, DEFAULT_ASSUMPTIONS.iofRate),
    withdrawalRate: DEFAULT_ASSUMPTIONS.withdrawalRate,
  };
  return { ...fromPlan, ...(overrides ?? {}) };
}

/** Aviso padrão a exibir junto de qualquer projeção. */
export const PROJECTION_DISCLAIMER =
  "Projeções são estimativas educacionais baseadas nas premissas exibidas. " +
  "Não representam garantia de retorno nem recomendação de investimento.";
