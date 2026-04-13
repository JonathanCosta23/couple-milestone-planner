import { PlanConfig, formatBRLCompact } from "@/lib/types";

interface HeroProps {
  goalLabel?: string | null;
  config?: PlanConfig;
  contributorCount?: number;
}

export function Hero({ goalLabel, config, contributorCount = 1 }: HeroProps) {
  return (
    <section className="gradient-hero py-5 px-4">
      <div className="container max-w-lg mx-auto text-center">
        <h1 className="text-lg font-extrabold tracking-tight">
          <span className="text-gradient">Plano do Milhão</span>
        </h1>
        {goalLabel && (
          <p className="text-xs text-primary/80 font-medium mt-1">🎯 {goalLabel}</p>
        )}
      </div>
    </section>
  );
}
