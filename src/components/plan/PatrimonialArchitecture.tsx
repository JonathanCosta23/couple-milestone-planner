import { Card } from "@/components/ui/card";
import { AppData } from "@/lib/models";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact } from "@/lib/types";
import { BucketCard } from "./BucketCard";
import type { FinancialCoreState } from "@/hooks/useFinancialCore";
import { calculateBucketDistribution } from "@/lib/financialEngine";
import { useMemo } from "react";
import { Shield, AlertTriangle, ArrowRight, Lock, Droplets, Building2, Target } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  core: FinancialCoreState;
}

function SecurityScoreRing({ score, status }: { score: number; status: string }) {
  const color = status === "strong" ? "text-primary" : status === "moderate" ? "text-warning" : "text-destructive";
  const bgColor = status === "strong" ? "bg-primary/10" : status === "moderate" ? "bg-warning/10" : "bg-destructive/10";
  const label = status === "strong" ? "Sólida" : status === "moderate" ? "Moderada" : "Frágil";
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative w-28 h-28 lg:w-36 lg:h-36 mx-auto">
      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="7" className="text-muted/20" />
        <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="7"
          className={color} strokeDasharray={circumference} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: "stroke-dashoffset 1s ease" }} />
      </svg>
      <div className={`absolute inset-0 flex flex-col items-center justify-center rounded-full ${bgColor}`}>
        <Shield className={`w-5 h-5 lg:w-6 lg:h-6 ${color} mb-0.5`} />
        <span className={`text-xl lg:text-2xl font-extrabold ${color}`}>{score}</span>
        <span className="text-[9px] sm:text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
      </div>
    </div>
  );
}

export function PatrimonialArchitecture({ appData, config, monthRecords, startDate, core }: Props) {
  const { metrics, allocation, insights } = core;

  // Use existing bucket distribution for BucketCard compatibility
  const buckets = useMemo(() => calculateBucketDistribution(appData, config), [appData, config]);

  const structuralScore = allocation.structuralScore;
  const overallStatus = structuralScore >= 70 ? "strong" : structuralScore >= 40 ? "moderate" : "fragile";

  const nextAction = insights.nextBestAction;

  // Build structural alerts from insights
  const structuralAlerts = insights.allInsights.filter(i => i.severity === "critical" || i.severity === "warning");

  return (
    <div className="space-y-4 lg:space-y-6">
      <Card className="glass-card-strong p-4 lg:p-6 text-center">
        <Shield className="w-7 h-7 lg:w-8 lg:h-8 text-primary mx-auto mb-2" />
        <h3 className="font-bold text-base lg:text-lg">Arquitetura do Patrimônio</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Como seu patrimônio está construído — proteção, concentração, liquidez e próximo passo
        </p>
      </Card>

      <div className="lg:grid lg:grid-cols-2 lg:gap-5 space-y-4 lg:space-y-0">
        <Card className="glass-card p-4 lg:p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3 text-center">
            Segurança da Estrutura
          </h4>
          <SecurityScoreRing score={structuralScore} status={overallStatus} />
          <div className="grid grid-cols-2 gap-2.5 mt-4">
            <MetricPill icon={Lock} label="Protegido" value={`${(metrics.protectedRatio * 100).toFixed(0)}%`} sub="FGC + Soberano" />
            <MetricPill icon={Droplets} label="Liquidez" value={`${(metrics.liquidityRatio * 100).toFixed(0)}%`} sub="Acesso imediato" />
            <MetricPill icon={Building2} label="Concentração"
              value={allocation.concentrationRisk === "low" ? "Baixa" : allocation.concentrationRisk === "medium" ? "Média" : "Alta"}
              sub="Por instituição" />
            <MetricPill icon={Target} label="Patrimônio" value={formatBRLCompact(metrics.grossWealth)} sub="Total investido" />
          </div>
        </Card>

        <Card className="glass-card p-4 lg:p-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
            Próximo Melhor Passo
          </h4>
          {nextAction && (
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 lg:p-5 mb-4">
              <p className="text-sm lg:text-base font-bold text-primary">{nextAction.title}</p>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 leading-relaxed">{nextAction.message}</p>
            </div>
          )}

          {structuralAlerts.length > 0 && (
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">
                Alertas Estruturais ({structuralAlerts.length})
              </h4>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {structuralAlerts.slice(0, 4).map(alert => (
                  <div key={alert.id} className={`rounded-xl border p-3.5 lg:p-4 space-y-1.5 ${
                    alert.severity === "critical" ? "border-destructive/30" : "border-warning/30"
                  }`}>
                    <p className="text-sm font-semibold">{alert.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{alert.message}</p>
                    {alert.recommendedAction && (
                      <div className="flex items-center gap-1.5 mt-2">
                        <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${alert.severity === "critical" ? "text-destructive" : "text-warning"}`} />
                        <p className={`text-xs font-medium ${alert.severity === "critical" ? "text-destructive" : "text-warning"}`}>{alert.recommendedAction}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {structuralAlerts.length === 0 && (
            <div className="text-center py-3">
              <p className="text-xs text-muted-foreground">✅ Nenhum alerta estrutural no momento</p>
            </div>
          )}
        </Card>
      </div>

      <div>
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">
          Camadas do Patrimônio
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          {buckets.map(bucket => (
            <BucketCard key={bucket.bucket} bucket={bucket} compact />
          ))}
        </div>
      </div>

      <div className="space-y-3 lg:space-y-4">
        {buckets.filter(b => b.balance > 0 || b.bucket === "reserva").map(bucket => (
          <BucketCard key={bucket.bucket} bucket={bucket} />
        ))}
      </div>
    </div>
  );
}

function MetricPill({ icon: Icon, label, value, sub }: { icon: React.ElementType; label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-2.5 lg:p-3 text-center min-w-0">
      <Icon className="w-4 h-4 mx-auto mb-1 text-primary" />
      <p className="text-[10px] text-muted-foreground uppercase truncate">{label}</p>
      <p className="text-sm font-bold break-words leading-tight">{value}</p>
      <p className="text-[9px] text-muted-foreground truncate">{sub}</p>
    </div>
  );
}
