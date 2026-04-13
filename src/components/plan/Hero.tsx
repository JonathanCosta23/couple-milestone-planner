import { TrendingUp } from "lucide-react";
import { PlanConfig, formatBRLCompact } from "@/lib/types";

interface HeroProps {
  goalLabel?: string | null;
  config?: PlanConfig;
  contributorCount?: number;
}

export function Hero({ goalLabel, config, contributorCount = 1 }: HeroProps) {
  const modeLabel = contributorCount > 1 ? `${contributorCount} pessoas` : "Modo individual";

  return (
    <section className="gradient-hero py-8 md:py-12 px-4">
      <div className="container max-w-3xl mx-auto text-center">
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tight mb-2">
          <span className="text-gradient">Plano do Milhão</span>
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-md mx-auto">
          Seu assistente financeiro para construir patrimônio com disciplina e inteligência.
        </p>
        {goalLabel && (
          <p className="text-xs text-primary font-medium mt-2">
            🎯 {goalLabel}
          </p>
        )}
        <div className="flex flex-wrap justify-center gap-4 text-xs text-muted-foreground mt-3">
          <span className="flex items-center gap-1">
            <TrendingUp className="w-3.5 h-3.5 text-primary" />
            {modeLabel}
          </span>
          {config && (
            <span>Meta: {formatBRLCompact(config.targetAmount)}</span>
          )}
        </div>
      </div>
    </section>
  );
}
