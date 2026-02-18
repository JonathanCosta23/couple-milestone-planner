import { TrendingUp, Users, Target } from "lucide-react";

export function Hero() {
  return (
    <section className="gradient-hero py-12 md:py-20 px-4">
      <div className="container max-w-3xl mx-auto text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-sm font-medium mb-6">
          <TrendingUp className="w-4 h-4" />
          <span>V5 — Hábito & Execução</span>
        </div>
        <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight mb-4">
          <span className="text-gradient">Plano do Milhão</span>
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-xl mx-auto mb-8">
          Juntos, de <strong className="text-foreground">R$9.000</strong> a{" "}
          <strong className="text-foreground">R$1.000.000</strong> com Tesouro Selic e CDB.
          Simule, planeje e acompanhe mês a mês.
        </p>
        <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            <span>Modo casal</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            <span>Metas & marcos</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span>Juros compostos</span>
          </div>
        </div>
      </div>
    </section>
  );
}
