/**
 * Geração pura de candidatos por categoria. Cada builder retorna 0+ candidatos.
 * Sem side effects. Determinístico (não usa Math.random nem Date.now direto).
 */

import type { NextActionCandidate, NextActionContext } from "../types/nextAction";

function currencyBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Prioridade 1 – Qualidade dos dados / segurança. */
export function buildDataQualityCandidates(ctx: NextActionContext): NextActionCandidate[] {
  const out: NextActionCandidate[] = [];
  if (!ctx.hasCoreDataLoaded) {
    out.push({
      actionKey: "data:core:not_loaded",
      category: "data_quality",
      priority: 1,
      severity: "high",
      title: "Dados do plano não carregaram",
      description: "Não conseguimos ler seus dados financeiros neste momento.",
      reason: "Alguns dados essenciais ainda não foram carregados na sessão.",
      evidence: [{ label: "Origem", value: "sessão atual" }],
      riskIfIgnored: "Diagnóstico e recomendações educacionais podem ficar incompletos.",
      ctaLabel: "Tentar novamente",
      destination: { tab: "inicio" },
      completionCriteria: "Dados do plano carregam com sucesso.",
      confidence: "insufficient_data",
      missingData: ["core_state"],
      score: 100,
    });
  }
  return out;
}

/** Prioridade 2 – Dívida cara. */
export function buildDebtCandidates(ctx: NextActionContext): NextActionCandidate[] {
  const out: NextActionCandidate[] = [];
  const priority = ctx.debts
    .filter((d) => d.active && (d.risk === "toxic" || d.risk === "high"))
    .sort((a, b) => (b.monthlyPayment ?? 0) - (a.monthlyPayment ?? 0));
  if (priority.length === 0) return out;
  const top = priority[0];
  const missingData = top.interestRateAnnual == null ? ["debt_interest_rate"] : [];
  out.push({
    actionKey: `debt:review:${top.id}`,
    category: "debt",
    priority: 2,
    severity: "critical",
    title: "Revise sua dívida de maior custo informado",
    description: `A dívida "${top.label}" possui perfil de custo elevado.`,
    reason: "Dívidas caras reduzem a capacidade de formar reserva e realizar aportes.",
    evidence: [
      { label: "Parcela mensal", value: currencyBRL(top.monthlyPayment) },
      { label: "Perfil de risco", value: top.risk },
      ...(top.interestRateAnnual != null ? [{ label: "Taxa informada (a.a.)", value: `${top.interestRateAnnual}%` }] : []),
    ],
    calculationSummary:
      "Ordenamos suas dívidas ativas por perfil de risco e parcela mensal informada.",
    riskIfIgnored:
      "O custo pode continuar comprometendo sua renda e atrasar a formação da reserva.",
    ctaLabel: "Analisar dívidas",
    destination: { tab: "execucao", sub: "dividas" },
    completionCriteria: "Atualizar taxa/estratégia da dívida ou marcar como quitada.",
    educationalTopicId: "divida-cara",
    confidence: missingData.length ? "medium" : "high",
    missingData: missingData.length ? missingData : undefined,
    score: 92,
  });
  return out;
}

/** Prioridade 3 – Orçamento / fluxo de caixa. */
export function buildBudgetCandidates(ctx: NextActionContext): NextActionCandidate[] {
  const out: NextActionCandidate[] = [];
  if (!ctx.hasIncomeData) {
    out.push({
      actionKey: "budget:missing_income",
      category: "budget",
      priority: 3,
      severity: "high",
      title: "Informe sua renda líquida",
      description: "Sem dados de renda não é possível calcular sua capacidade de aporte.",
      reason: "Não há registros de renda ativa neste plano.",
      evidence: [{ label: "Fontes de renda", value: "0" }],
      riskIfIgnored: "Diagnósticos de orçamento e reserva ficarão incompletos.",
      ctaLabel: "Cadastrar renda",
      destination: { tab: "execucao", sub: "renda" },
      completionCriteria: "Existir ao menos uma fonte de renda ativa.",
      confidence: "insufficient_data",
      missingData: ["income"],
      score: 85,
    });
  }
  if (!ctx.hasExpenseData) {
    out.push({
      actionKey: "budget:missing_expenses",
      category: "budget",
      priority: 3,
      severity: "high",
      title: "Classifique suas despesas essenciais",
      description: "Sem despesas classificadas não é possível estimar sua reserva.",
      reason: "Não há despesas registradas no mês atual.",
      evidence: [{ label: "Despesas do mês", value: "0" }],
      riskIfIgnored: "Reserva e taxa de poupança ficam sem base de cálculo.",
      ctaLabel: "Completar diagnóstico",
      destination: { tab: "mais", sub: "calculadoras" },
      completionCriteria: "Existir despesas classificadas no mês atual.",
      confidence: "insufficient_data",
      missingData: ["expenses"],
      score: 82,
    });
  }
  if (ctx.hasIncomeData && ctx.hasExpenseData && ctx.metrics.savingsRate < 0) {
    out.push({
      actionKey: "budget:negative_savings",
      category: "budget",
      priority: 3,
      severity: "high",
      title: "Suas despesas superam a renda informada",
      description: "A taxa de poupança está negativa neste mês.",
      reason: "Renda menos despesas e parcelas ficou abaixo de zero.",
      evidence: [
        { label: "Renda", value: currencyBRL(ctx.metrics.totalIncome) },
        { label: "Despesas", value: currencyBRL(ctx.metrics.totalExpenses) },
      ],
      calculationSummary: "(renda − despesas − parcelas) / renda.",
      riskIfIgnored: "Falta de sobra pode gerar novas dívidas caras.",
      ctaLabel: "Revisar despesas essenciais",
      destination: { tab: "mais", sub: "calculadoras" },
      completionCriteria: "Ajustar despesas ou renda para taxa de poupança ≥ 0.",
      confidence: "high",
      score: 80,
    });
  }
  return out;
}

/** Prioridade 4 – Reserva de emergência. */
export function buildEmergencyFundCandidates(ctx: NextActionContext): NextActionCandidate[] {
  const out: NextActionCandidate[] = [];
  if (!ctx.hasExpenseData) return out; // já coberto por budget
  if (ctx.metrics.reserveMonths >= ctx.metrics.reserveGoalMonths) return out;
  const gap = Math.max(0, ctx.metrics.reserveGap);
  const key = ctx.planId ? `reserve:gap:${ctx.planId}` : "reserve:gap:global";
  out.push({
    actionKey: key,
    category: "emergency_fund",
    priority: 4,
    severity: ctx.metrics.reserveMonths < 1 ? "high" : "medium",
    title: "Sua reserva de emergência ainda está em formação",
    description: `Faltam ${currencyBRL(gap)} para atingir a faixa de ${ctx.metrics.reserveGoalMonths} meses escolhida.`,
    reason: "Reserva insuficiente reduz proteção diante de imprevistos.",
    evidence: [
      { label: "Meses de reserva", value: ctx.metrics.reserveMonths.toFixed(1) },
      { label: "Meta de meses", value: String(ctx.metrics.reserveGoalMonths) },
      { label: "Diferença estimada", value: currencyBRL(gap) },
    ],
    calculationSummary: "reserva líquida / despesas essenciais mensais.",
    riskIfIgnored: "Imprevistos podem forçar uso de dívida cara.",
    ctaLabel: "Ver plano da reserva",
    destination: { tab: "mais", sub: "calculadoras" },
    completionCriteria: `Reserva atingir ${ctx.metrics.reserveGoalMonths} meses de despesas essenciais.`,
    educationalTopicId: "reserva-emergencia",
    confidence: "high",
    score: 70,
  });
  return out;
}

/** Prioridade 5 – Execução mensal. */
export function buildMonthlyExecutionCandidates(ctx: NextActionContext): NextActionCandidate[] {
  const out: NextActionCandidate[] = [];
  if (ctx.currentMonthPlanned <= 0) return out;
  if (ctx.currentMonthCompleted) return out;
  const remaining = Math.max(0, ctx.currentMonthPlanned - ctx.currentMonthActual);
  if (remaining <= 0) {
    out.push({
      actionKey: `monthly:close:${ctx.currentMonthKey}`,
      category: "monthly_execution",
      priority: 5,
      severity: "medium",
      title: "Feche o mês atual",
      description: "O aporte planejado já foi realizado. Marque o mês como concluído.",
      reason: "Fechar o mês mantém o histórico consistente para acompanhamento.",
      evidence: [
        { label: "Planejado", value: currencyBRL(ctx.currentMonthPlanned) },
        { label: "Realizado", value: currencyBRL(ctx.currentMonthActual) },
      ],
      riskIfIgnored: "Histórico de disciplina fica incompleto.",
      ctaLabel: "Fechar o mês",
      destination: { tab: "execucao", sub: "mensal" },
      completionCriteria: "Marcar mês atual como concluído.",
      confidence: "high",
      score: 55,
    });
    return out;
  }
  out.push({
    actionKey: `monthly:deposit:${ctx.currentMonthKey}`,
    category: "monthly_execution",
    priority: 5,
    severity: ctx.currentMonthActual === 0 ? "medium" : "low",
    title: ctx.currentMonthActual === 0 ? "Registre o aporte deste mês" : "Complete o aporte planejado",
    description:
      ctx.currentMonthActual === 0
        ? "Ainda não há aporte registrado no mês atual."
        : `Faltam ${currencyBRL(remaining)} para atingir o planejado do mês.`,
    reason: "Manter regularidade de aportes preserva a consistência do plano.",
    evidence: [
      { label: "Planejado", value: currencyBRL(ctx.currentMonthPlanned) },
      { label: "Realizado", value: currencyBRL(ctx.currentMonthActual) },
    ],
    riskIfIgnored: "Atrasos recorrentes reduzem o efeito de longo prazo do plano.",
    ctaLabel: "Registrar aporte",
    destination: { tab: "execucao", sub: "mensal" },
    completionCriteria: "Registrar aporte que iguale ou supere o planejado do mês.",
    confidence: "high",
    score: 50,
  });
  return out;
}

/** Prioridade 6 – FGC. */
export function buildFgcCandidates(ctx: NextActionContext): NextActionCandidate[] {
  const out: NextActionCandidate[] = [];
  if (!ctx.fgc) return out;
  if (ctx.fgc.hasPendingClassification || ctx.fgc.hasPendingInstitution) {
    out.push({
      actionKey: "fgc:pending_classification",
      category: "fgc",
      priority: 6,
      severity: "medium",
      title: "Há ativos sem classificação FGC completa",
      description: "Classifique ativos ou instituições pendentes para checar cobertura.",
      reason: "Sem classificação não é possível calcular sua exposição por conglomerado.",
      evidence: [
        { label: "Ativos sem tipo", value: ctx.fgc.hasPendingClassification ? "sim" : "não" },
        { label: "Instituições sem cadastro", value: ctx.fgc.hasPendingInstitution ? "sim" : "não" },
      ],
      riskIfIgnored: "Análise de proteção fica incompleta.",
      ctaLabel: "Analisar proteção FGC",
      destination: { tab: "patrimonio", sub: "estrutura" },
      completionCriteria: "Classificar ativos e confirmar instituições pendentes.",
      confidence: "medium",
      missingData: ["fgc_classification"],
      score: 45,
    });
    return out;
  }
  if (ctx.fgc.officialExcess > 0) {
    out.push({
      actionKey: "fgc:excess:official",
      category: "fgc",
      priority: 6,
      severity: "high",
      title: "Exposição acima do limite oficial informado",
      description: `Há ${currencyBRL(ctx.fgc.officialExcess)} acima do limite oficial em pelo menos um conglomerado.`,
      reason: "O limite oficial define a cobertura ordinária do FGC.",
      evidence: [{ label: "Excesso oficial", value: currencyBRL(ctx.fgc.officialExcess) }],
      riskIfIgnored: "Parte do saldo pode ficar fora da cobertura ordinária.",
      ctaLabel: "Analisar proteção FGC",
      destination: { tab: "patrimonio", sub: "estrutura" },
      completionCriteria: "Ajustar exposição para dentro do limite ou registrar decisão consciente.",
      confidence: "high",
      score: 65,
    });
  } else if (ctx.fgc.prudentialExcess > 0) {
    out.push({
      actionKey: "fgc:excess:prudential",
      category: "fgc",
      priority: 6,
      severity: "medium",
      title: "Exposição acima da margem operacional",
      description: "Dentro do limite oficial, porém acima da sua margem prudencial informada.",
      reason: "Sua margem operacional define uma folga adicional.",
      evidence: [{ label: "Excesso prudencial", value: currencyBRL(ctx.fgc.prudentialExcess) }],
      riskIfIgnored: "Rendimentos futuros podem cruzar o limite oficial.",
      ctaLabel: "Analisar proteção FGC",
      destination: { tab: "patrimonio", sub: "estrutura" },
      completionCriteria: "Reduzir exposição ou aceitar margem revisada.",
      confidence: "high",
      score: 40,
    });
  }
  return out;
}

/** Prioridade 7 – Concentração. */
export function buildConcentrationCandidates(ctx: NextActionContext): NextActionCandidate[] {
  const out: NextActionCandidate[] = [];
  if (ctx.metrics.maxConcentrationByInstitution >= 0.6 && ctx.metrics.grossWealth > 0) {
    out.push({
      actionKey: "concentration:institution",
      category: "concentration",
      priority: 7,
      severity: "medium",
      title: "Concentração alta em uma única instituição",
      description: `Uma parcela relevante do patrimônio está em ${ctx.metrics.concentrationInstitution || "uma única instituição"}.`,
      reason: "Concentração excessiva aumenta a exposição a um único fator de risco.",
      evidence: [
        {
          label: "Concentração por instituição",
          value: `${(ctx.metrics.maxConcentrationByInstitution * 100).toFixed(0)}%`,
        },
      ],
      riskIfIgnored: "Eventos específicos da instituição podem impactar boa parte do patrimônio.",
      ctaLabel: "Entender concentração",
      destination: { tab: "patrimonio", sub: "concentracao" },
      completionCriteria: "Revisar distribuição por instituição ou registrar decisão consciente.",
      confidence: "high",
      score: 35,
    });
  }
  return out;
}

/** Prioridade 11 – Aprendizado / celebração. */
export function buildLearningCandidates(ctx: NextActionContext): NextActionCandidate[] {
  const topic = ctx.learningLevel === "beginner" ? "orcamento-basico" : "reserva-liquidez";
  return [
    {
      actionKey: `learning:${topic}`,
      category: "learning",
      priority: 11,
      severity: "informational",
      title: "Aprenda em 5 minutos",
      description: "Reforce um conceito relacionado ao seu momento atual.",
      reason: "Base conceitual ajuda a interpretar melhor as próximas ações.",
      evidence: [{ label: "Nível considerado", value: ctx.learningLevel }],
      riskIfIgnored: "Sem base, decisões financeiras ficam menos confiáveis.",
      ctaLabel: "Aprender em 5 minutos",
      destination: { tab: "mais", sub: "aprender" },
      completionCriteria: "Concluir a leitura relacionada.",
      educationalTopicId: topic,
      confidence: "medium",
      score: 10,
    },
  ];
}

/** Prioridade 12 – Revisão / celebração sóbria (fallback). */
export function buildReviewCandidates(ctx: NextActionContext): NextActionCandidate[] {
  return [
    {
      actionKey: `review:month:${ctx.currentMonthKey}`,
      category: "review",
      priority: 12,
      severity: "informational",
      title: "Seu plano está coerente com o cenário atual",
      description: "Aproveite para revisar o mês ou continuar sua trilha educacional.",
      reason: "Nenhuma pendência crítica identificada com os dados disponíveis.",
      evidence: [{ label: "Base", value: "métricas atuais" }],
      riskIfIgnored: "Revisões periódicas ajudam a antecipar mudanças de cenário.",
      ctaLabel: "Ver acompanhamento",
      destination: { tab: "execucao", sub: "mensal" },
      completionCriteria: "Abrir o acompanhamento mensal ou continuar trilha educacional.",
      confidence: "medium",
      score: 5,
    },
  ];
}

export function generateAllCandidates(ctx: NextActionContext): NextActionCandidate[] {
  return [
    ...buildDataQualityCandidates(ctx),
    ...buildDebtCandidates(ctx),
    ...buildBudgetCandidates(ctx),
    ...buildEmergencyFundCandidates(ctx),
    ...buildMonthlyExecutionCandidates(ctx),
    ...buildFgcCandidates(ctx),
    ...buildConcentrationCandidates(ctx),
    ...buildLearningCandidates(ctx),
    ...buildReviewCandidates(ctx),
  ];
}