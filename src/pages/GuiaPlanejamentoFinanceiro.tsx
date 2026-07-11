import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";

const CANONICAL = "https://couple-milestone-planner.lovable.app/guia-planejamento-financeiro";

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "Article",
  headline: "Como fazer um planejamento financeiro pessoal: o guia definitivo",
  description:
    "Guia passo a passo de planejamento financeiro pessoal: fluxo de caixa, reserva de emergência e alocação de patrimônio.",
  inLanguage: "pt-BR",
  mainEntityOfPage: CANONICAL,
  author: { "@type": "Organization", name: "Plano do Milhão" },
  publisher: { "@type": "Organization", name: "Plano do Milhão" },
};

export default function GuiaPlanejamentoFinanceiro() {
  return (
    <>
      <Helmet>
        <title>Guia de Planejamento Financeiro Pessoal · Plano do Milhão</title>
        <meta
          name="description"
          content="Guia passo a passo de planejamento financeiro pessoal: organize seu fluxo de caixa, monte a reserva de emergência e distribua seu patrimônio com segurança."
        />
        <link rel="canonical" href={CANONICAL} />
        <meta property="og:type" content="article" />
        <meta
          property="og:title"
          content="Como fazer um planejamento financeiro pessoal: o guia definitivo"
        />
        <meta
          property="og:description"
          content="Passo a passo prático para organizar sua vida financeira: fluxo de caixa, reserva de emergência e alocação de patrimônio."
        />
        <meta property="og:url" content={CANONICAL} />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>

      <main className="mx-auto max-w-3xl px-4 py-12 md:py-16">
        <article className="prose prose-invert max-w-none">
          <nav aria-label="Voltar" className="mb-6 text-sm">
            <Link to="/" className="text-primary underline hover:text-primary/90">
              ← Voltar para o Plano do Milhão
            </Link>
          </nav>

          <header className="mb-8">
            <p className="text-sm uppercase tracking-wide text-muted-foreground">
              Guia · Educação financeira
            </p>
            <h1 className="mt-2 text-3xl font-bold md:text-4xl">
              Como fazer um planejamento financeiro pessoal: o guia definitivo
            </h1>
            <p className="mt-4 text-lg text-muted-foreground">
              Um passo a passo prático para brasileiros que querem sair do improviso,
              construir reserva e começar a acumular patrimônio de verdade — sem promessas
              milagrosas e sem jargão de corretora.
            </p>
          </header>

          <section aria-labelledby="por-que">
            <h2 id="por-que">Por que planejar sua vida financeira</h2>
            <p>
              Planejamento financeiro pessoal é o processo de organizar quanto entra,
              quanto sai, quanto sobra e para onde esse dinheiro vai. Não é sobre cortar
              tudo o que dá prazer — é sobre <strong>gastar de forma consciente</strong> e
              transformar parte da sua renda em patrimônio que trabalha para você.
            </p>
            <p>
              Um bom plano responde três perguntas simples: onde você está hoje, onde
              quer chegar e qual é o próximo passo agora.
            </p>
          </section>

          <section aria-labelledby="passo-1">
            <h2 id="passo-1">Passo 1 · Diagnóstico e fluxo de caixa</h2>
            <p>
              Comece somando toda a sua <strong>renda mensal líquida</strong> (salário,
              PJ, bicos, aluguéis) e todos os seus <strong>gastos fixos e variáveis</strong>
              dos últimos três meses. A diferença entre entrada e saída é a sua
              <em> taxa de poupança</em> — o combustível de qualquer plano.
            </p>
            <ul>
              <li>Gastos fixos: aluguel, condomínio, plano de saúde, assinaturas.</li>
              <li>Gastos variáveis: alimentação fora, lazer, transporte por app, compras.</li>
              <li>Meta inicial saudável: poupar pelo menos <strong>10% a 20%</strong> da renda.</li>
            </ul>
            <p>
              Se a conta não fecha, o primeiro trabalho não é investir — é revisar
              gastos variáveis e renegociar dívidas caras.
            </p>
          </section>

          <section aria-labelledby="passo-2">
            <h2 id="passo-2">Passo 2 · Quite dívidas caras antes de investir</h2>
            <p>
              Cartão de crédito rotativo, cheque especial e empréstimo pessoal cobram
              juros muito acima de qualquer investimento seguro. Enquanto essas dívidas
              existirem, elas destroem seu progresso.
            </p>
            <p>
              Regra prática: se os juros da dívida são maiores que o rendimento dos seus
              investimentos, <strong>quite a dívida primeiro</strong>. Use a estratégia
              avalanche (maior juros primeiro) para pagar menos no total, ou snowball
              (menor saldo primeiro) para ganhar tração emocional.
            </p>
          </section>

          <section aria-labelledby="passo-3">
            <h2 id="passo-3">Passo 3 · Monte sua reserva de emergência</h2>
            <p>
              A reserva de emergência é o alicerce do plano. Ela cobre imprevistos —
              desemprego, saúde, conserto urgente — sem obrigar você a quebrar
              investimentos ou entrar em dívida nova.
            </p>
            <ul>
              <li>
                <strong>Tamanho:</strong> 3 a 6 meses de despesas essenciais. Autônomos e
                PJs devem mirar 6 a 12 meses.
              </li>
              <li>
                <strong>Onde guardar:</strong> Tesouro Selic ou um CDB de liquidez diária
                com FGC em banco sólido. Nunca em ações, cripto ou fundos de longo prazo.
              </li>
              <li>
                <strong>Regra de ouro:</strong> reserva não é para render, é para proteger.
              </li>
            </ul>
          </section>

          <section aria-labelledby="passo-4">
            <h2 id="passo-4">Passo 4 · Defina metas e prazos</h2>
            <p>
              Metas vagas (“quero ficar rico”) não sobrevivem ao primeiro mês difícil.
              Boas metas têm valor, prazo e propósito claros:
            </p>
            <ul>
              <li>Curto prazo (até 2 anos): reserva, viagem, entrada de imóvel.</li>
              <li>Médio prazo (2 a 10 anos): imóvel, troca de carreira, filhos.</li>
              <li>Longo prazo (10+ anos): liberdade financeira, aposentadoria.</li>
            </ul>
            <p>
              Para cada meta, calcule o aporte mensal necessário considerando um retorno
              real conservador (inflação já descontada).
            </p>
          </section>

          <section aria-labelledby="passo-5">
            <h2 id="passo-5">Passo 5 · Alocação de patrimônio</h2>
            <p>
              Depois de reserva formada e dívidas caras quitadas, o foco vira construir
              patrimônio. Distribua os aportes entre quatro grandes “baldes”:
            </p>
            <ol>
              <li>
                <strong>Reserva e liquidez</strong> — Tesouro Selic, CDB liquidez diária.
              </li>
              <li>
                <strong>Proteção bancária prudente</strong> — CDBs, LCIs, LCAs dentro do
                limite do FGC (R$ 250 mil por CPF por instituição).
              </li>
              <li>
                <strong>Base soberana</strong> — Tesouro IPCA+ e Prefixado de longo prazo,
                para vencer inflação no horizonte de 5 a 20 anos.
              </li>
              <li>
                <strong>Crescimento e diversificação</strong> — ações, fundos imobiliários,
                ETFs e exposição internacional, dimensionados ao seu apetite a risco.
              </li>
            </ol>
            <p>
              Diversifique entre <strong>ativos, instituições e conglomerados</strong>.
              Concentração acima de 20% em um único emissor privado é sinal amarelo.
            </p>
          </section>

          <section aria-labelledby="passo-6">
            <h2 id="passo-6">Passo 6 · Acompanhamento mensal</h2>
            <p>
              Plano não é planilha esquecida na gaveta. Reserve <strong>30 minutos por
              mês</strong> para registrar aportes, revisar gastos e comparar patrimônio
              atual com o planejado. Diferenças pequenas revisadas cedo evitam correções
              dolorosas depois.
            </p>
            <p>
              O Plano do Milhão faz exatamente esse acompanhamento — planejado vs
              realizado, projeção nominal, líquida e real, radar de risco e próximo
              melhor passo — para você e, se quiser, para o casal.
            </p>
          </section>

          <section aria-labelledby="erros">
            <h2 id="erros">Erros comuns a evitar</h2>
            <ul>
              <li>Investir antes de quitar cartão rotativo.</li>
              <li>Usar a reserva de emergência para “aproveitar oportunidades”.</li>
              <li>Concentrar patrimônio em um único banco ou ativo.</li>
              <li>Perseguir promessas de retorno fixo acima de 2% ao mês.</li>
              <li>Ignorar inflação e impostos na hora de projetar retorno.</li>
            </ul>
          </section>

          <section aria-labelledby="cta" className="mt-10 rounded-xl border border-border bg-muted/40 p-6">
            <h2 id="cta" className="mt-0">Comece seu plano agora</h2>
            <p>
              Você pode montar todo esse processo — diagnóstico, reserva, metas,
              alocação e acompanhamento mensal — dentro do Plano do Milhão, de graça e
              em português.
            </p>
            <p>
              <Link to="/" className="text-primary underline hover:text-primary/90">
                Entrar no Plano do Milhão →
              </Link>
            </p>
          </section>

          <footer className="mt-10 border-t border-border pt-6 text-xs text-muted-foreground">
            Conteúdo educacional. Não constitui recomendação individualizada de
            investimento. Rentabilidades passadas não garantem resultados futuros.
          </footer>
        </article>
      </main>
    </>
  );
}