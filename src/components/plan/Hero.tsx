import { PlanConfig, formatBRLCompact } from "@/lib/types";

interface HeroProps {
  goalLabel?: string | null;
  config?: PlanConfig;
  contributorCount?: number;
}

export function Hero({ goalLabel, config, contributorCount = 1 }: HeroProps) {
  return (
    <section className="gradient-hero py-6 px-4">
      <div className="container max-w-3xl mx-auto text-center">
        <h1 className="text-xl md:text-2xl font-extrabold tracking-tight">
          <span className="text-gradient">Plano do Milhão</span>
        </h1>
        <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
          Construa patrimônio com disciplina, clareza e inteligência.
        </p>
        {goalLabel && (
          <p className="text-[11px] text-primary font-medium mt-1.5">🎯 {goalLabel}</p>
        )}
      </div>
    </section>
  );
}
