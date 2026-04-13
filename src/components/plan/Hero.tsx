import { PlanConfig, formatBRLCompact } from "@/lib/types";

interface HeroProps {
  goalLabel?: string | null;
  config?: PlanConfig;
  contributorCount?: number;
}

export function Hero({ goalLabel, config, contributorCount = 1 }: HeroProps) {
  return (
    <section className="gradient-hero py-5 sm:py-6 lg:py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-lg sm:max-w-2xl lg:max-w-5xl xl:max-w-6xl mx-auto text-center lg:text-left">
        <h1 className="text-lg sm:text-xl lg:text-2xl font-extrabold tracking-tight">
          <span className="text-gradient">Plano do Milhão</span>
        </h1>
        {goalLabel && (
          <p className="text-xs sm:text-sm text-primary/80 font-medium mt-1">🎯 {goalLabel}</p>
        )}
      </div>
    </section>
  );
}
