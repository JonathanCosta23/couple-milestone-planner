import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { formatBRLCompact } from "@/lib/types";
import { BucketDistribution } from "@/lib/financialEngine";
import { Shield, Building2, Landmark, TrendingUp } from "lucide-react";

const BUCKET_ICONS: Record<string, React.ElementType> = {
  "reserva": Shield,
  "protecao-bancaria": Building2,
  "base-soberana": Landmark,
  "crescimento": TrendingUp,
};

const STATUS_COLORS = {
  healthy: "text-primary border-primary/20 bg-primary/5",
  attention: "text-warning border-warning/20 bg-warning/5",
  critical: "text-destructive border-destructive/20 bg-destructive/5",
};

const STATUS_LABELS = {
  healthy: "Saudável",
  attention: "Atenção",
  critical: "Crítico",
};

const STATUS_DOT = {
  healthy: "bg-primary",
  attention: "bg-warning",
  critical: "bg-destructive",
};

interface Props {
  bucket: BucketDistribution;
  compact?: boolean;
}

export function BucketCard({ bucket, compact }: Props) {
  const Icon = BUCKET_ICONS[bucket.bucket] || Shield;

  if (compact) {
    return (
      <div className={`rounded-xl border p-3 lg:p-4 ${STATUS_COLORS[bucket.status]}`}>
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4" />
          <span className="text-xs font-bold uppercase tracking-wider">{bucket.label}</span>
          <span className={`ml-auto w-2 h-2 rounded-full ${STATUS_DOT[bucket.status]}`} />
        </div>
        <p className="text-lg lg:text-xl font-bold">{formatBRLCompact(bucket.balance)}</p>
        <p className="text-[10px] text-muted-foreground">{(bucket.percentage * 100).toFixed(0)}% do patrimônio</p>
      </div>
    );
  }

  return (
    <Card className={`glass-card p-4 lg:p-5 border ${STATUS_COLORS[bucket.status]}`}>
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${STATUS_COLORS[bucket.status]}`}>
            <Icon className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm lg:text-base font-bold">{bucket.label}</h4>
            <p className="text-[10px] sm:text-xs text-muted-foreground">{bucket.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT[bucket.status]}`} />
          <span className="text-xs font-medium">{STATUS_LABELS[bucket.status]}</span>
        </div>
      </div>

      <div className="flex items-end justify-between mb-3">
        <div>
          <p className="text-2xl lg:text-3xl font-bold">{formatBRLCompact(bucket.balance)}</p>
          <p className="text-xs text-muted-foreground">{(bucket.percentage * 100).toFixed(0)}% do patrimônio total</p>
        </div>
      </div>

      <Progress value={bucket.percentage * 100} className="h-1.5 mb-3" />

      {bucket.recommendation && (
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          💡 {bucket.recommendation}
        </p>
      )}

      {bucket.investments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-border/30 space-y-1.5">
          {bucket.investments.slice(0, 3).map(inv => (
            <div key={inv.id} className="flex justify-between text-xs">
              <span className="truncate text-muted-foreground">{inv.name || inv.institution}</span>
              <span className="font-medium shrink-0 ml-2">{formatBRLCompact(inv.currentBalance)}</span>
            </div>
          ))}
          {bucket.investments.length > 3 && (
            <p className="text-[10px] text-muted-foreground">+{bucket.investments.length - 3} outros</p>
          )}
        </div>
      )}
    </Card>
  );
}
