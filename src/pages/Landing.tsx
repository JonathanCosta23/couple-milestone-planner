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
        <title>Plano do Milhão — Cockpit financeiro para sua meta patrimonial</title>
        <meta
          name="description"
          content="Transforme sua meta patrimonial em uma rotina mensal clara, segura e mensurável. Aportes, patrimônio, projeções e disciplina em um cockpit privado."
        />
        <link rel="canonical" href="https://couple-milestone-planner.lovable.app/" />
        <meta
          property="og:title"
          content="Plano do Milhão — Cockpit financeiro para sua meta patrimonial"
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
            <Link to="/login">
              <Button variant="ghost" size="sm">Entrar</Button>
            </Link>
            <Link to="/signup">
              <Button size="sm" className="rounded-xl">Criar conta</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(var(--primary)/0.18),transparent_60%)]"
        />
        <div className="relative mx-auto max-w-6xl px-4 sm:px-6 py-16 sm:py-24 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/60 px-3 py-1 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" aria-hidden />
            Ferramenta educacional · seus dados são privados
          </div>
          <h1 className="mt-6 text-3xl sm:text-5xl font-bold tracking-tight leading-tight">
            Transforme sua meta patrimonial em uma rotina mensal clara, segura e mensurável.
          </h1>
          <p className="mt-5 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            O Plano do Milhão organiza seus aportes, patrimônio, projeções e disciplina
            financeira em um cockpit privado, para você saber exatamente o que fazer a cada mês.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link to="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto rounded-xl h-12 px-6 font-semibold">
                Criar conta grátis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="outline" className="w-full sm:w-auto rounded-xl h-12 px-6">
                Entrar
              </Button>
            </Link>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">
            Sem cobrança. Sem recomendação de investimento. Você no controle.
          </p>
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

      {/* O que você acompanha */}
      <Section title="O que você acompanha" eyebrow="Cockpit">
        <div className="grid gap-4 sm:grid-cols-2">
          <Bullet title="Meta e propósito">
            A promessa financeira que dá sentido ao esforço mensal.
          </Bullet>
          <Bullet title="Aportes mensais">
            Planejado × realizado, com déficit calculado e status por mês.
          </Bullet>
          <Bullet title="Patrimônio real">
            Bruto, líquido de imposto e ajustado por inflação — sem falsa sensação de riqueza.
          </Bullet>
          <Bullet title="Disciplina">
            Consistência dos aportes, alertas de armadilhas e sugestões de próxima ação.
          </Bullet>
          <Bullet title="Renda, gastos e dívidas">
            Um retrato honesto do fluxo, com divisão para casal quando aplicável.
          </Bullet>
          <Bullet title="Concentração e proteção">
            Distribuição por bucket, cobertura FGC e risco de concentração por instituição.
          </Bullet>
        </div>
      </Section>

      {/* Proteção e privacidade */}
      <Section title="Proteção e privacidade" eyebrow="Confiança">
        <div className="grid gap-4 sm:grid-cols-3">
          <FeatureCard
            icon={<Lock className="h-5 w-5" />}
            title="Seus dados são seus"
            body="Cada conta vê apenas os próprios registros. Nada é publicado nem compartilhado."
          />
          <FeatureCard
            icon={<ShieldCheck className="h-5 w-5" />}
            title="Somente para organização"
            body="Usamos os dados para organizar sua vida financeira e acompanhar o patrimônio. Não vendemos dados."
          />
          <FeatureCard
            icon={<Sparkles className="h-5 w-5" />}
            title="Sem promessa de retorno"
            body="Projeções são estimativas educacionais. Não constituem recomendação de investimento."
          />
        </div>
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
            <Link to="/connect">
              <Button variant="outline" size="sm" className="rounded-xl">
                Ver como conectar
              </Button>
            </Link>
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
            <Link to="/signup" className="w-full sm:w-auto">
              <Button size="lg" className="w-full sm:w-auto rounded-xl h-12 px-6 font-semibold">
                Criar minha conta
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login" className="w-full sm:w-auto">
              <Button size="lg" variant="ghost" className="w-full sm:w-auto rounded-xl h-12 px-6">
                Já tenho conta
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
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

function Bullet({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-card/30 p-4">
      <div className="text-sm font-semibold">{title}</div>
      <p className="mt-1 text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}