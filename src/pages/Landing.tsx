import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { LegalFooter } from "@/components/plan/LegalDialogs";
import {
  ShieldCheck,
  LineChart,
  Vault,
  Users,
  Sparkles,
  Lock,
  Compass,
  Plug,
  ArrowRight,
  Check,
  X,
  KeyRound,
  UserCheck,
  SlidersHorizontal,
} from "lucide-react";

/**
 * Landing — página pública apresentada a visitantes deslogados.
 *
 * Direção: sensação de private banking / cofre digital. Sem modal de login,
 * sem ConsentGate. CTA primário abre a criação de conta em página completa.
 */
export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Plano do Milhão — Cockpit para sua meta patrimonial</title>
        <meta
          name="description"
          content="Transforme sua meta patrimonial em uma rotina mensal clara, segura e mensurável. Aportes, patrimônio, projeções e disciplina em um cockpit privado."
        />
        <link rel="canonical" href="https://couple-milestone-planner.lovable.app/" />
        <meta
          property="og:title"
          content="Plano do Milhão — Cockpit para sua meta patrimonial"
        />
        <meta
          property="og:description"
          content="Organize aportes, patrimônio, projeções e disciplina financeira em um cockpit privado. Ferramenta educacional, não é recomendação de investimento."
        />
      </Helmet>

      {/* Top bar */}
      <header className="border-b border-border/40 sticky top-0 z-40 bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Vault className="h-5 w-5 text-primary" aria-hidden />
            <span className="font-semibold tracking-tight">Plano do Milhão</span>
          </div>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/login">Entrar</Link>
            </Button>
            <Button asChild size="sm" className="rounded-xl">
              <Link to="/signup">Criar conta</Link>
            </Button>
          </div>
        </div>
      </header>

      <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-14 sm:py-20 grid gap-10 lg:grid-cols-2 lg:items-center">
          <div className="text-center lg:text-left">
            <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
              Ambiente privado · ferramenta educacional
            </div>
            <h1 className="mt-6 text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
              Transforme sua meta patrimonial em uma rotina mensal clara, segura e mensurável.
            </h1>
            <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl lg:mx-0 mx-auto leading-relaxed">
              O Plano do Milhão organiza seus aportes, patrimônio, projeções e disciplina
              financeira em um cockpit privado, para você saber exatamente o que fazer a cada mês.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row items-center lg:justify-start justify-center gap-3">
              <Button
                asChild
                size="lg"
                className="w-full sm:w-auto rounded-xl h-12 px-6 font-semibold"
              >
                <Link to="/signup">
                  Criar conta grátis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="w-full sm:w-auto rounded-xl h-12 px-6"
              >
                <Link to="/login">Entrar</Link>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Sem cobrança. Sem recomendação de investimento. Você no controle.
            </p>
          </div>

          {/* Mockup visual — abstrato, sem valores financeiros */}
          <ProductMockup />
        </div>
      </section>

      {/* Como funciona */}
      <Section title="Como funciona" eyebrow="Método">
        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={<Compass className="h-5 w-5" />}
            title="Defina a meta"
            body="Diga quanto quer acumular, em quanto tempo e o propósito. Individual ou casal."
          />
          <FeatureCard
            icon={<LineChart className="h-5 w-5" />}
            title="Acompanhe todo mês"
            body="Registre aportes, veja o gap entre planejado e realizado e ajuste o próximo passo."
          />
          <FeatureCard
            icon={<Vault className="h-5 w-5" />}
            title="Construa patrimônio"
            body="Cadastre investimentos por bucket, veja concentração e projeções nominais, líquidas e reais."
          />
        </div>
      </Section>

      {/* O que o sistema faz */}
      <Section title="O que o sistema faz" eyebrow="Escopo">
        <div className="grid gap-3 sm:grid-cols-2">
          <DoItem>Organiza meta, aportes e patrimônio em um único cockpit.</DoItem>
          <DoItem>Compara planejado × realizado a cada mês, com status honesto.</DoItem>
          <DoItem>Mostra patrimônio nominal, líquido de imposto e real (ajustado por inflação).</DoItem>
          <DoItem>Sugere a próxima melhor ação com base nos seus dados.</DoItem>
          <DoItem>Registra renda, gastos e dívidas — individual ou casal.</DoItem>
          <DoItem>Mapeia concentração por bucket, instituição e cobertura FGC.</DoItem>
        </div>
      </Section>

      {/* O que o sistema NÃO faz */}
      <Section title="O que o sistema não faz" eyebrow="Limites claros">
        <div className="grid gap-3 sm:grid-cols-2">
          <DontItem>Não recomenda ativos, corretoras ou produtos específicos.</DontItem>
          <DontItem>Não promete retorno, rentabilidade nem “ficar rico rápido”.</DontItem>
          <DontItem>Não movimenta dinheiro, não abre conta e não opera investimentos.</DontItem>
          <DontItem>Não substitui um assessor financeiro qualificado.</DontItem>
          <DontItem>Não vende, aluga nem compartilha seus dados com terceiros.</DontItem>
          <DontItem>Não publica seu plano nem seu patrimônio em lugar nenhum.</DontItem>
        </div>
      </Section>

      {/* Como seus dados são protegidos */}
      <Section title="Como seus dados são protegidos" eyebrow="Privacidade">
        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={<KeyRound className="h-5 w-5" />}
            title="Autenticação por conta"
            body="Login por e-mail e senha. Cada acesso é vinculado a uma conta identificável."
          />
          <FeatureCard
            icon={<UserCheck className="h-5 w-5" />}
            title="Permissões por usuário"
            body="Cada conta enxerga apenas os próprios registros. Sem visão cruzada entre usuários."
          />
          <FeatureCard
            icon={<SlidersHorizontal className="h-5 w-5" />}
            title="Controles de acesso"
            body="Regras no banco garantem que leitura e escrita respeitem o dono do dado."
          />
        </div>
        <p className="mt-4 text-xs text-muted-foreground max-w-2xl">
          Seus dados são protegidos por autenticação, permissões por usuário e controles de
          acesso. Não vendemos nem alugamos seus dados. O tratamento necessário para operar o
          serviço é descrito na Política de Privacidade.
        </p>
      </Section>

      {/* Casal / individual */}
      <Section title="Para casais ou individual" eyebrow="Flexível">
        <div className="grid gap-4 sm:grid-cols-2">
          <FeatureCard
            icon={<Users className="h-5 w-5" />}
            title="Modo individual"
            body="Um plano, uma pessoa, uma meta. Linguagem 100% no singular."
          />
          <FeatureCard
            icon={<Users className="h-5 w-5" />}
            title="Modo casal"
            body="Dois titulares reais, divisão de gastos e governança patrimonial conjunta."
          />
        </div>
      </Section>

      {/* Projeções educacionais */}
      <Section title="Projeções educacionais" eyebrow="Verdade financeira">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6">
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            O Plano do Milhão diferencia patrimônio <strong>nominal</strong>, <strong>líquido</strong>{" "}
            (pós-imposto) e <strong>real</strong> (ajustado pela inflação). Você vê a mesma meta sob
            três lentes, com premissas explícitas. É um simulador educacional — não substitui
            aconselhamento financeiro profissional.
          </p>
        </div>
      </Section>

      {/* MCP */}
      <Section title="Converse com um assistente de IA" eyebrow="Opcional · somente leitura">
        <div className="rounded-2xl border border-border/60 bg-card/40 p-5 sm:p-6 space-y-3">
          <div className="flex items-center gap-2 text-primary">
            <Plug className="h-5 w-5" />
            <span className="text-xs uppercase tracking-wide font-medium">MCP</span>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
            Conecte o ChatGPT ou o Claude para consultar o seu plano em linguagem natural.
            A integração é <strong>somente leitura</strong>: consulta plano, meta, participantes,
            investimentos e histórico de aportes. Não cria, altera ou apaga nada.
          </p>
          <div>
            <Button asChild variant="outline" size="sm" className="rounded-xl">
              <Link to="/connect">Ver como conectar</Link>
            </Button>
          </div>
        </div>
      </Section>

      {/* Bottom CTA */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-4 pb-16 sm:pb-24">
        <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-transparent p-6 sm:p-10 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">
            Comece hoje. Ajuste amanhã. Chegue lá.
          </h2>
          <p className="mt-3 text-sm sm:text-base text-muted-foreground max-w-xl mx-auto">
            Cinco minutos para configurar seu plano. Depois, um cockpit para toda a jornada.
          </p>
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              asChild
              size="lg"
              className="w-full sm:w-auto rounded-xl h-12 px-6 font-semibold"
            >
              <Link to="/signup">
                Criar minha conta
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="ghost"
              className="w-full sm:w-auto rounded-xl h-12 px-6"
            >
              <Link to="/login">Já tenho conta</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      </main>
      <footer className="border-t border-border/40">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-8 space-y-4 text-center">
          <p className="text-xs text-muted-foreground max-w-2xl mx-auto">
            O Plano do Milhão é uma ferramenta educacional de organização financeira. Não
            constitui recomendação de investimento. Consulte um profissional qualificado antes
            de tomar decisões financeiras.
          </p>
          <LegalFooter />
        </div>
      </footer>

      {/* CTA mobile fixo */}
      <div
        className="sm:hidden fixed bottom-0 inset-x-0 z-40 border-t border-border/60 bg-background/95 backdrop-blur px-4 py-3 flex gap-2"
        data-testid="mobile-cta-bar"
      >
        <Button asChild variant="outline" className="flex-1 w-full rounded-xl h-11">
          <Link to="/login">Entrar</Link>
        </Button>
        <Button asChild className="flex-1 w-full rounded-xl h-11 font-semibold">
          <Link to="/signup">Criar conta</Link>
        </Button>
      </div>
      {/* Espaço para não cobrir conteúdo no mobile */}
      <div aria-hidden className="sm:hidden h-20" />
    </div>
  );
}

function Section({
  title,
  eyebrow,
  children,
}: {
  title: string;
  eyebrow: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6 py-10 sm:py-14">
      <div className="mb-6">
        <div className="text-xs uppercase tracking-wider text-primary font-medium">{eyebrow}</div>
        <h2 className="mt-1 text-xl sm:text-2xl font-semibold tracking-tight">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-2xl border border-border/60 bg-card/40 p-5 h-full">
      <div className="inline-flex items-center justify-center h-9 w-9 rounded-lg bg-primary/10 text-primary mb-3">
        {icon}
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{body}</p>
    </div>
  );
}

function DoItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/30 p-4">
      <div className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary/15 text-primary">
        <Check className="h-3.5 w-3.5" aria-hidden />
      </div>
      <p className="text-sm text-foreground leading-relaxed">{children}</p>
    </div>
  );
}

function DontItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-border/50 bg-card/20 p-4">
      <div className="mt-0.5 inline-flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
        <X className="h-3.5 w-3.5" aria-hidden />
      </div>
      <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}

/**
 * Mockup abstrato do produto — sem valores monetários reais, sem promessas.
 * Serve como referência visual do cockpit privado.
 */
function ProductMockup() {
  return (
    <div className="relative mx-auto w-full max-w-md lg:max-w-none" aria-hidden>
      <div
        className="absolute -inset-6 rounded-[2rem] bg-[radial-gradient(circle_at_top_right,hsl(var(--primary)/0.25),transparent_60%)] blur-2xl"
        aria-hidden
      />
      <div className="relative rounded-2xl border border-border/60 bg-card/80 shadow-2xl backdrop-blur p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="text-xs font-medium text-muted-foreground">Cockpit privado</span>
          </div>
          <Lock className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        <div className="rounded-xl border border-border/50 bg-background/60 p-4">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Progresso da meta
          </div>
          <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
            <div className="h-full w-2/5 rounded-full bg-gradient-to-r from-primary to-primary/60" />
          </div>
          <div className="mt-2 flex justify-between text-[10px] text-muted-foreground">
            <span>Início</span>
            <span>Meta</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {["Aportes", "Patrimônio", "Reserva"].map((label) => (
            <div key={label} className="rounded-lg border border-border/50 bg-background/40 p-3">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
              <div className="mt-1 h-1.5 w-3/4 rounded-full bg-muted" />
              <div className="mt-1 h-1.5 w-1/2 rounded-full bg-muted/70" />
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-border/50 bg-background/60 p-4 space-y-2">
          <div className="flex items-center gap-2 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Próxima melhor ação
          </div>
          <div className="h-1.5 w-5/6 rounded-full bg-muted" />
          <div className="h-1.5 w-3/5 rounded-full bg-muted/70" />
        </div>
      </div>
    </div>
  );
}