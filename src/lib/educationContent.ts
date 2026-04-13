/**
 * Financial Education Content & Glossary — Plano do Milhão V8
 * Contextual tooltips, glossary, mini-lessons, and educational cards.
 */

// ===== Glossary =====

export interface GlossaryTerm {
  id: string;
  term: string;
  definition: string;
  example?: string;
  category: "basic" | "investment" | "risk" | "tax" | "behavior";
}

export const GLOSSARY: GlossaryTerm[] = [
  { id: "reserva", term: "Reserva de emergência", definition: "Dinheiro guardado para cobrir imprevistos como perda de emprego ou emergências médicas. Deve cobrir de 3 a 6 meses de despesas.", example: "Se você gasta R$ 4.000/mês, sua reserva ideal é de R$ 12.000 a R$ 24.000.", category: "basic" },
  { id: "liquidez", term: "Liquidez", definition: "Facilidade de transformar um investimento em dinheiro disponível. Liquidez diária = pode sacar a qualquer momento.", example: "Tesouro Selic tem liquidez diária. Um CDB de 2 anos não tem.", category: "basic" },
  { id: "risco", term: "Risco", definition: "Possibilidade de perder dinheiro ou não obter o retorno esperado. Todo investimento tem algum nível de risco.", category: "risk" },
  { id: "rentabilidade", term: "Rentabilidade", definition: "Quanto o investimento rende em um período. Pode ser nominal (bruta) ou real (descontada a inflação).", category: "investment" },
  { id: "inflacao", term: "Inflação", definition: "Aumento geral dos preços ao longo do tempo. R$ 100 hoje compra menos do que comprava há 5 anos.", example: "Se a inflação é 5% ao ano, algo que custa R$ 100 hoje custará R$ 105 em um ano.", category: "basic" },
  { id: "ir", term: "Imposto de Renda (IR)", definition: "Tributo cobrado sobre os rendimentos dos investimentos. Segue tabela regressiva: quanto mais tempo, menos imposto.", category: "tax" },
  { id: "iof", term: "IOF", definition: "Imposto sobre Operações Financeiras. Incide nos primeiros 30 dias de investimento em renda fixa, de forma regressiva.", category: "tax" },
  { id: "fgc", term: "FGC", definition: "Fundo Garantidor de Créditos. Protege investimentos até R$ 250 mil por CPF por instituição financeira em caso de falência do banco.", category: "risk" },
  { id: "tesouro-direto", term: "Tesouro Direto", definition: "Plataforma do governo para compra de títulos públicos. Mais seguro que o FGC pois tem garantia do Governo Federal.", category: "investment" },
  { id: "marcacao", term: "Marcação a mercado", definition: "Atualização diária do preço de títulos conforme as taxas de juros. Pode fazer o valor oscilar antes do vencimento.", example: "Se os juros sobem, o preço do Tesouro IPCA+ cai no mercado. Mas no vencimento, você recebe o combinado.", category: "risk" },
  { id: "divida-boa", term: "Dívida boa", definition: "Dívida que financia algo que gera valor ou renda, como um financiamento de imóvel para alugar.", category: "basic" },
  { id: "divida-ruim", term: "Dívida ruim", definition: "Dívida com juros altos que consome sua renda sem gerar retorno, como rotativo do cartão de crédito.", category: "basic" },
  { id: "aporte", term: "Aporte", definition: "Valor que você investe regularmente. Consistência de aportes é mais importante que timing perfeito.", category: "investment" },
  { id: "juros-compostos", term: "Juros compostos", definition: "Juros sobre juros. O rendimento de um período é reinvestido e passa a render também. É o motor do crescimento patrimonial.", example: "R$ 1.000 a 10% ao ano: após 1 ano = R$ 1.100, após 2 anos = R$ 1.210 (não R$ 1.200).", category: "basic" },
  { id: "diversificacao", term: "Diversificação", definition: "Distribuir investimentos entre diferentes ativos, instituições e prazos para reduzir riscos.", category: "investment" },
  { id: "renda-passiva", term: "Renda passiva", definition: "Renda gerada por investimentos, sem precisar trabalhar ativamente. Exemplo: dividendos, aluguéis, rendimentos.", category: "investment" },
  { id: "patrimonio", term: "Patrimônio", definition: "Soma de todos os seus bens e investimentos, menos suas dívidas. Diferente de renda (quanto você ganha por mês).", category: "basic" },
  { id: "cdi", term: "CDI", definition: "Certificado de Depósito Interbancário. Taxa muito próxima da Selic, usada como referência para investimentos de renda fixa.", example: "CDB 100% do CDI rende praticamente igual à Selic.", category: "investment" },
  { id: "selic", term: "Selic", definition: "Taxa básica de juros da economia brasileira. Define o rendimento mínimo do Tesouro Selic e influencia toda a renda fixa.", category: "investment" },
];

export function searchGlossary(query: string): GlossaryTerm[] {
  const q = query.toLowerCase();
  return GLOSSARY.filter(t =>
    t.term.toLowerCase().includes(q) ||
    t.definition.toLowerCase().includes(q)
  );
}

// ===== Contextual Tooltips =====

export const CONTEXTUAL_TIPS: Record<string, string> = {
  "score-financeiro": "Seu score reflete 8 dimensões da sua saúde financeira. Quanto mais dados cadastrar, mais preciso fica.",
  "reserva-emergencia": "Sua reserva deve cobrir 3 a 6 meses de despesas em um investimento com liquidez diária, como Tesouro Selic.",
  "taxa-poupanca": "Percentual da renda que sobra após despesas e dívidas. Acima de 20% é excelente.",
  "patrimonio-investido": "Soma de todos os investimentos ativos. Não inclui bens físicos como imóvel ou carro.",
  "progresso-milhao": "Quanto do caminho até R$ 1.000.000 já foi percorrido. Lembre: os juros compostos aceleram no final.",
  "fgc-limite": "O FGC protege até R$ 250 mil por CPF por conglomerado financeiro. Diversifique entre instituições.",
  "gastos-fixos": "Gastos que se repetem todo mês com valor estável: aluguel, condomínio, plano de saúde.",
  "gastos-variaveis": "Gastos que mudam a cada mês: alimentação fora, lazer, compras. São o maior espaço para economia.",
  "divida-toxica": "Dívida com juros compostos altíssimos que cresce mais rápido do que você consegue pagar. Exemplo: rotativo do cartão.",
  "aporte-mensal": "Valor que você investe todo mês. A consistência é mais importante que o valor absoluto.",
  "streak": "Quantos meses seguidos você fez o aporte planejado. Cada mês conta!",
  "renda-passiva": "Renda gerada pelos seus investimentos. Na regra dos 4%, R$ 1M gera ~R$ 3.333/mês.",
};

// ===== Mini Lessons =====

export interface MiniLesson {
  id: string;
  title: string;
  emoji: string;
  duration: string; // e.g. "2 min"
  content: string[];
  takeaway: string;
  relatedTerms: string[];
}

export const MINI_LESSONS: MiniLesson[] = [
  {
    id: "emergency-101", title: "Reserva de emergência: por que e como", emoji: "🛡️", duration: "2 min",
    content: [
      "A reserva de emergência é o alicerce de qualquer plano financeiro.",
      "Sem ela, qualquer imprevisto — perda de emprego, doença, conserto urgente — pode destruir meses de progresso.",
      "O valor ideal é de 3 a 6 meses de despesas mensais.",
      "Onde guardar? Tesouro Selic. Tem liquidez diária, é seguro e rende mais que a poupança.",
      "Nunca use a reserva para investir. Ela não é para crescer — é para proteger.",
    ],
    takeaway: "Monte sua reserva antes de qualquer investimento. É o passo mais importante.",
    relatedTerms: ["reserva", "liquidez", "tesouro-direto"],
  },
  {
    id: "compound-magic", title: "A mágica dos juros compostos", emoji: "✨", duration: "2 min",
    content: [
      "Juros compostos são juros sobre juros. Parece simples, mas o efeito é exponencial.",
      "Nos primeiros anos, o crescimento parece lento. Mas depois dos R$ 100 mil, a bola de neve acelera.",
      "R$ 1.000/mês a 11% ao ano: em 10 anos = R$ 218 mil. Em 20 anos = R$ 860 mil. Em 25 anos = R$ 1,5 milhão.",
      "O segredo? Começar cedo e não parar. Cada mês sem aporte é um mês de juros perdido.",
      "Einstein (supostamente) disse: juros compostos são a oitava maravilha do mundo.",
    ],
    takeaway: "Tempo é seu maior aliado. Comece hoje, mesmo com pouco.",
    relatedTerms: ["juros-compostos", "aporte", "rentabilidade"],
  },
  {
    id: "good-vs-bad-debt", title: "Dívida boa vs dívida ruim", emoji: "⚖️", duration: "2 min",
    content: [
      "Nem toda dívida é ruim. O que importa é o custo (juros) e o que ela financia.",
      "Dívida ruim: cartão de crédito rotativo (>300% ao ano), cheque especial, empréstimo pessoal caro.",
      "Dívida aceitável: financiamento imobiliário a juros baixos, financiamento estudantil com retorno claro.",
      "Regra prática: se os juros da dívida são maiores que o rendimento dos seus investimentos, quite a dívida primeiro.",
      "Priorize quitar dívidas tóxicas antes de investir. Não faz sentido render 12% e pagar 150% de juros.",
    ],
    takeaway: "Quite dívidas caras primeiro. Investir endividado é como encher um balde furado.",
    relatedTerms: ["divida-boa", "divida-ruim", "juros-compostos"],
  },
  {
    id: "fgc-guide", title: "FGC: o que cobre e o que não cobre", emoji: "🛡️", duration: "3 min",
    content: [
      "O FGC garante até R$ 250 mil por CPF por conglomerado financeiro.",
      "Cobre: CDB, LCI, LCA, Poupança, LC. NÃO cobre: Tesouro Direto (que tem garantia do Governo Federal, melhor ainda), fundos, ações.",
      "Atenção: bancos do mesmo grupo financeiro compartilham o limite!",
      "Limite global: R$ 1 milhão por CPF a cada 4 anos.",
      "O Tesouro Direto não precisa de FGC — tem garantia soberana do Governo Federal, que é mais forte.",
    ],
    takeaway: "Diversifique entre instituições e respeite o limite de R$ 250k por conglomerado.",
    relatedTerms: ["fgc", "tesouro-direto", "diversificacao"],
  },
  {
    id: "traps-101", title: "Armadilhas financeiras comuns", emoji: "🪤", duration: "3 min",
    content: [
      "Se parece bom demais para ser verdade, provavelmente é.",
      "Promessas de rendimento fixo acima de 2% ao mês são quase sempre pirâmide ou golpe.",
      "Investimento legítimo tem risco. Quem promete risco zero com retorno alto está mentindo.",
      "Cuidado com pressão para decidir rápido: 'só hoje', 'vagas limitadas', 'oportunidade única'.",
      "Antes de investir, pergunte: quem está ganhando dinheiro com isso? Se não souber explicar, não invista.",
      "Desconfie de plataformas sem regulação da CVM ou Banco Central.",
    ],
    takeaway: "Ganância é a porta de entrada dos golpes. Desconfie, pesquise e nunca tenha pressa.",
    relatedTerms: ["risco"],
  },
  {
    id: "patrimonio-vs-renda", title: "Patrimônio versus Renda", emoji: "🏗️", duration: "2 min",
    content: [
      "Renda é quanto você ganha por mês. Patrimônio é quanto você acumulou.",
      "Uma pessoa pode ganhar R$ 20.000 e ter patrimônio zero se gasta tudo.",
      "Outra pode ganhar R$ 5.000 e acumular R$ 500.000 com disciplina.",
      "O que te liberta não é a renda alta — é o patrimônio que gera renda passiva.",
      "Foque em construir patrimônio, não apenas em ganhar mais.",
    ],
    takeaway: "Riqueza se mede pelo patrimônio, não pelo salário.",
    relatedTerms: ["patrimonio", "renda-passiva", "aporte"],
  },
];

// ===== Contextual Education Suggestions =====

import { AppData } from "@/lib/models";
import { PlanConfig, MonthRecord } from "@/lib/types";
import { calculateDiagnostic, calculateHealthScore } from "@/lib/financialEngine";

export interface ContextualSuggestion {
  lessonId: string;
  reason: string;
  priority: number; // lower = higher priority
}

export function getContextualLessonSuggestions(
  appData: AppData,
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string,
  context: "home" | "diagnostic" | "simulator" = "home",
  simulatorRate?: number,
): ContextualSuggestion[] {
  const diag = calculateDiagnostic(appData, config, monthRecords, startDate);
  const score = calculateHealthScore(appData, config, monthRecords, startDate);
  const suggestions: ContextualSuggestion[] = [];

  // Emergency fund low
  if (diag.emergencyMonths < 3) {
    suggestions.push({ lessonId: "emergency-101", reason: "Sua reserva está baixa", priority: 1 });
  }

  // Debt weight high or has active debts
  if (diag.debtWeight > 0.15 || appData.debts.some(d => d.active)) {
    suggestions.push({ lessonId: "good-vs-bad-debt", reason: "Você tem dívidas ativas", priority: 2 });
  }

  // High wealth — FGC awareness
  if (diag.investedWealth > 100000 || appData.investments.length > 0) {
    suggestions.push({ lessonId: "fgc-guide", reason: "Proteja seu patrimônio", priority: 4 });
  }

  // Low savings rate
  if (diag.savingsRate < 0.1) {
    suggestions.push({ lessonId: "patrimonio-vs-renda", reason: "Aumente seu potencial de poupança", priority: 3 });
  }

  // Simulator: unrealistic rate warning
  if (context === "simulator" && simulatorRate && simulatorRate > 0.20) {
    suggestions.push({ lessonId: "traps-101", reason: "Cuidado com promessas irreais", priority: 0 });
  }

  // Diagnostic: based on lowest scores
  if (context === "diagnostic") {
    if (score.disciplineScore < 50) {
      suggestions.push({ lessonId: "compound-magic", reason: "Consistência é o motor do crescimento", priority: 3 });
    }
    if (score.allocationRiskScore < 50) {
      suggestions.push({ lessonId: "fgc-guide", reason: "Sua alocação precisa de atenção", priority: 3 });
    }
  }

  // Always available as fallback
  suggestions.push({ lessonId: "compound-magic", reason: "Entenda o motor do crescimento", priority: 10 });

  // Deduplicate by lessonId, keep highest priority (lowest number)
  const seen = new Map<string, ContextualSuggestion>();
  for (const s of suggestions) {
    const existing = seen.get(s.lessonId);
    if (!existing || s.priority < existing.priority) {
      seen.set(s.lessonId, s);
    }
  }

  return Array.from(seen.values()).sort((a, b) => a.priority - b.priority);
}
