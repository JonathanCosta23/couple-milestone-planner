/**
 * Investment Education Content — Plano do Milhão V7
 * Static educational content about Brazilian financial products.
 */

export interface EducationTopic {
  id: string;
  title: string;
  emoji: string;
  category: "basics" | "products" | "strategy" | "risks" | "advanced";
  summary: string;
  content: string[];
  highlights?: string[];
  warnings?: string[];
}

export const EDUCATION_TOPICS: EducationTopic[] = [
  {
    id: "fgc",
    title: "FGC — Fundo Garantidor de Créditos",
    emoji: "🛡️",
    category: "basics",
    summary: "Protege até R$ 250 mil por CPF por instituição financeira (ou conglomerado).",
    content: [
      "O FGC garante depósitos e investimentos em caso de falência de instituições financeiras.",
      "O limite é de R$ 250.000 por CPF por instituição financeira ou conglomerado financeiro.",
      "Isso significa que se você tem CDB no Banco X e LCI no Banco X, o limite é único: R$ 250k no total naquele grupo.",
      "O limite global do FGC por CPF é de R$ 1 milhão a cada 4 anos.",
      "Produtos cobertos: CDB, LCI, LCA, LC, Poupança, depósitos à vista.",
      "Produtos NÃO cobertos: Fundos de investimento, ações, debêntures, Tesouro Direto.",
    ],
    highlights: [
      "R$ 250k por CPF por conglomerado",
      "R$ 1M global a cada 4 anos",
      "NÃO cobre Tesouro Direto (que tem garantia do Governo Federal)",
    ],
    warnings: [
      "Cuidado: bancos do mesmo grupo compartilham o limite",
      "O FGC não é instantâneo — pode demorar dias ou semanas para ressarcimento",
    ],
  },
  {
    id: "tesouro-selic",
    title: "Tesouro Selic",
    emoji: "🏛️",
    category: "products",
    summary: "O investimento mais seguro do Brasil. Ideal para reserva de emergência.",
    content: [
      "O Tesouro Selic é um título público federal que rende a taxa Selic.",
      "Tem garantia do Governo Federal — é mais seguro que o FGC.",
      "Possui liquidez diária: você pode resgatar a qualquer momento sem perder dinheiro.",
      "Não sofre marcação a mercado significativa (diferente do Tesouro IPCA+ e Prefixado).",
      "É o melhor lugar para a reserva de emergência.",
      "Incide IOF nos primeiros 30 dias e IR regressivo (de 22,5% a 15%).",
    ],
    highlights: [
      "Garantia do Governo Federal",
      "Liquidez diária real",
      "Sem risco de perda ao vender antes do vencimento",
    ],
  },
  {
    id: "tesouro-ipca",
    title: "Tesouro IPCA+",
    emoji: "📊",
    category: "products",
    summary: "Protege contra a inflação. Ideal para metas de longo prazo (5+ anos).",
    content: [
      "O Tesouro IPCA+ rende a inflação (IPCA) + uma taxa fixa pré-definida.",
      "Garante rentabilidade real: seu dinheiro sempre cresce acima da inflação no vencimento.",
      "Porém, sofre marcação a mercado: se vender antes do vencimento, pode perder dinheiro.",
      "Quanto maior o prazo, maior a volatilidade no mercado secundário.",
      "Ideal para aposentadoria, compra de imóvel e metas de longo prazo.",
      "O Tesouro IPCA+ com Juros Semestrais paga rendimentos a cada 6 meses.",
    ],
    highlights: [
      "Proteção contra inflação garantida no vencimento",
      "Ideal para metas de 5+ anos",
    ],
    warnings: [
      "⚠️ Risco de marcação a mercado se vender antes do vencimento",
      "Em cenários de alta de juros, o valor de mercado pode cair temporariamente",
    ],
  },
  {
    id: "cdb",
    title: "CDB — Certificado de Depósito Bancário",
    emoji: "🏦",
    category: "products",
    summary: "Empréstimo que você faz ao banco. Coberto pelo FGC até R$ 250k.",
    content: [
      "O CDB é um título emitido por bancos. Você empresta dinheiro e recebe juros.",
      "Pode ser pós-fixado (atrelado ao CDI), prefixado ou híbrido (CDI + spread).",
      "O CDI fica muito próximo da Selic (geralmente 0,10 p.p. abaixo).",
      "CDB 100% do CDI rende praticamente igual ao Tesouro Selic.",
      "CDBs de bancos menores costumam pagar mais (110%, 120% do CDI).",
      "Coberto pelo FGC até R$ 250.000 por CPF por conglomerado.",
      "Atenção: muitos CDBs têm prazo de carência — você não pode resgatar antes.",
    ],
    highlights: [
      "Coberto pelo FGC",
      "Bancos menores pagam mais",
      "Verifique sempre a liquidez",
    ],
  },
  {
    id: "lci-lca",
    title: "LCI e LCA",
    emoji: "🌾",
    category: "products",
    summary: "Isentos de IR para pessoa física. Cobertos pelo FGC.",
    content: [
      "LCI (Letra de Crédito Imobiliário) financia o setor imobiliário.",
      "LCA (Letra de Crédito do Agronegócio) financia o agronegócio.",
      "Ambas são isentas de Imposto de Renda para pessoa física.",
      "Cobertas pelo FGC até R$ 250k por CPF por conglomerado.",
      "Geralmente têm prazo mínimo de carência (90 dias ou mais).",
      "Uma LCI/LCA a 85% do CDI isenta pode equivaler a um CDB de ~100% do CDI com IR.",
      "Compare sempre a rentabilidade líquida (após IR) com o CDB.",
    ],
    highlights: [
      "Isentas de IR",
      "Cobertas pelo FGC",
      "Compare líquido com CDB",
    ],
  },
  {
    id: "nominal-vs-real",
    title: "Rentabilidade Nominal vs Real",
    emoji: "📈",
    category: "basics",
    summary: "Nominal é o número bruto. Real é descontando a inflação.",
    content: [
      "Rentabilidade nominal é o retorno bruto: se investiu R$ 100 e virou R$ 113, a nominal é 13%.",
      "Rentabilidade real desconta a inflação: se a inflação foi 5%, o ganho real é ~7,6%.",
      "É a rentabilidade real que importa — ela mostra se seu poder de compra aumentou.",
      "Um investimento que rende 10% num ano com inflação de 10% tem rentabilidade real de ~0%.",
      "Fórmula: (1 + nominal) / (1 + inflação) - 1 = real",
      "Sempre avalie investimentos pela rentabilidade real, especialmente no longo prazo.",
    ],
    highlights: [
      "Real = Nominal - Inflação (simplificado)",
      "Só a rentabilidade real mostra ganho de poder de compra",
    ],
  },
  {
    id: "liquidity",
    title: "Liquidez Diária vs Prazo Fechado",
    emoji: "💧",
    category: "basics",
    summary: "Liquidez é a facilidade de transformar o investimento em dinheiro.",
    content: [
      "Liquidez diária: pode resgatar a qualquer momento (ex: Tesouro Selic, CDB com liquidez).",
      "Prazo fechado: só pode resgatar no vencimento (ex: CDB 2 anos, LCI 90 dias).",
      "Investimentos com prazo fechado geralmente pagam mais — é o prêmio pela liquidez.",
      "Sua reserva de emergência deve estar SEMPRE em liquidez diária.",
      "Para metas de curto prazo (< 1 ano), prefira liquidez diária.",
      "Para metas de longo prazo (> 3 anos), pode usar prazo fechado para ganhar mais.",
    ],
    highlights: [
      "Reserva de emergência = sempre liquidez diária",
      "Prazo fechado paga mais, mas prende o dinheiro",
    ],
  },
  {
    id: "mark-to-market",
    title: "Marcação a Mercado",
    emoji: "📉",
    category: "risks",
    summary: "O preço de alguns títulos varia diariamente no mercado.",
    content: [
      "Marcação a mercado é a atualização diária do preço de um título conforme as taxas de juros.",
      "Afeta principalmente Tesouro IPCA+ e Tesouro Prefixado.",
      "Se as taxas de juros sobem, o preço do título no mercado cai.",
      "Se as taxas de juros caem, o preço do título no mercado sobe.",
      "Se você carregar até o vencimento, recebe exatamente a taxa contratada.",
      "O risco é vender antes do vencimento em momento desfavorável.",
      "Tesouro Selic quase não sofre marcação a mercado.",
    ],
    highlights: [
      "Só importa se vender antes do vencimento",
      "Tesouro Selic está praticamente imune",
    ],
    warnings: [
      "⚠️ Nunca venda Tesouro IPCA+ antes do vencimento por desespero",
      "Em cenário de alta de juros, o preço cai temporariamente",
    ],
  },
  {
    id: "taxes",
    title: "Impostos sobre Investimentos",
    emoji: "💰",
    category: "basics",
    summary: "Tabela regressiva de IR e IOF nos primeiros 30 dias.",
    content: [
      "IR Regressivo sobre renda fixa: 22,5% (até 180 dias), 20% (181-360), 17,5% (361-720), 15% (acima de 720 dias).",
      "IOF: incide nos primeiros 30 dias, regressivo (começa em 96% e vai a 0%).",
      "LCI e LCA são isentas de IR para pessoa física.",
      "Poupança é isenta de IR.",
      "Tesouro Direto e CDB seguem a tabela regressiva.",
      "Fundos de ações: 15% sobre o lucro.",
      "Quanto mais tempo investido, menos imposto paga.",
    ],
    highlights: [
      "Mantenha investimentos por mais de 2 anos: IR cai para 15%",
      "LCI/LCA: isentas de IR",
      "IOF: evite resgatar nos primeiros 30 dias",
    ],
  },
  {
    id: "diversification",
    title: "Diversificação",
    emoji: "🎯",
    category: "strategy",
    summary: "Não coloque todos os ovos na mesma cesta.",
    content: [
      "Diversificar é distribuir investimentos entre diferentes ativos, instituições e prazos.",
      "Protege contra risco específico: se um banco falir, você não perde tudo.",
      "Respeite o limite do FGC: R$ 250k por conglomerado.",
      "Diversifique por tipo: Tesouro + CDB + LCI/LCA.",
      "Diversifique por prazo: liquidez diária + médio prazo + longo prazo.",
      "Diversifique por instituição: pelo menos 2-3 instituições diferentes.",
      "No início, foque em renda fixa. Diversifique gradualmente.",
    ],
    highlights: [
      "Mínimo: 2-3 instituições",
      "Respeite o limite FGC por conglomerado",
      "Diversifique prazo: curto + médio + longo",
    ],
  },
];

export function getTopicsByCategory(category: EducationTopic["category"]): EducationTopic[] {
  return EDUCATION_TOPICS.filter(t => t.category === category);
}

export function getTopicById(id: string): EducationTopic | undefined {
  return EDUCATION_TOPICS.find(t => t.id === id);
}
