import { Loader2 } from "lucide-react";

/**
 * PanelSkeleton — fallback consistente para painéis lazy-loaded.
 * Evita flash de conteúdo vazio durante o carregamento de chunks.
 */
export const PanelSkeleton = ({ label = "Carregando..." }: { label?: string }) => (
  <div className="space-y-4 animate-pulse">
    {/* Header skeleton */}
    <div className="space-y-2">
      <div className="h-5 w-40 bg-muted/60 rounded-md" />
      <div className="h-3 w-64 bg-muted/40 rounded-md" />
    </div>

    {/* Card skeletons */}
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-24 bg-muted/30 rounded-xl border border-border/40"
        />
      ))}
    </div>

    <div className="h-48 bg-muted/30 rounded-xl border border-border/40" />

    <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground pt-2">
      <Loader2 className="w-3 h-3 animate-spin" />
      <span>{label}</span>
    </div>
  </div>
);

/**
 * FullscreenSkeleton — usado para rotas inteiras (App-level Suspense).
 */
export const FullscreenSkeleton = () => (
  <div className="min-h-screen bg-background flex items-center justify-center">
    <div className="flex flex-col items-center gap-3">
      <Loader2 className="w-6 h-6 animate-spin text-primary" />
      <p className="text-xs text-muted-foreground">Carregando...</p>
    </div>
  </div>
);
