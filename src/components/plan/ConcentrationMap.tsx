import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AppData } from "@/lib/models";
import { PlanConfig, formatBRL, formatBRLCompact } from "@/lib/types";
import { calculateConcentrationRisks, ConcentrationRisk } from "@/lib/financialEngine";
import { Building2, PieChart, Users, AlertTriangle } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
}

const STATUS_COLORS = {
  safe: "text-primary",
  warning: "text-warning",
  danger: "text-destructive",
};

const STATUS_BG = {
  safe: "bg-primary/10",
  warning: "bg-warning/10",
  danger: "bg-destructive/10",
};

const TYPE_LABELS: Record<string, string> = {
  "tesouro-selic": "Tesouro Selic",
  "cdb": "CDB",
  "lci-lca": "LCI/LCA",
  "fundo": "Fundos",
  "acao": "Ações",
  "fii": "FIIs",
  "crypto": "Crypto",
  "poupanca": "Poupança",
  "other": "Outros",
};

function RiskRow({ risk }: { risk: ConcentrationRisk }) {
  const pct = (risk.percentage * 100).toFixed(0);
  const label = risk.type === "asset-class" ? (TYPE_LABELS[risk.name] || risk.name) : risk.name;

  return (
    <div className="py-2.5 px-3 rounded-lg bg-muted/20">
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${STATUS_BG[risk.status]} ${STATUS_COLORS[risk.status]}`} 
                style={{ backgroundColor: risk.status === "safe" ? "hsl(var(--primary))" : risk.status === "warning" ? "hsl(var(--warning, 38 92% 50%))" : "hsl(var(--destructive))" }} />
          <span className="text-sm font-medium truncate">{label}</span>
        </div>
        <div className="text-right shrink-0 ml-2">
          <span className="text-sm font-bold">{formatBRLCompact(risk.balance)}</span>
          <span className="text-xs text-muted-foreground ml-1.5">({pct}%)</span>
        </div>
      </div>

      <Progress value={risk.percentage * 100} className="h-1.5" />

      {risk.type === "institution" && risk.limit && (
        <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span>FGC: {formatBRLCompact(risk.balance)} de {formatBRLCompact(risk.limit)}</span>
          {risk.headroom !== undefined && (
            <span className={risk.headroom < 50_000 ? "text-warning font-medium" : ""}>
              Disponível: {formatBRLCompact(risk.headroom)}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function ConcentrationMap({ appData, config }: Props) {
  const risks = useMemo(() => calculateConcentrationRisks(appData, config), [appData, config]);

  const byInstitution = risks.filter(r => r.type === "institution");
  const byClass = risks.filter(r => r.type === "asset-class");
  const byTitular = risks.filter(r => r.type === "titular");

  const dangerCount = risks.filter(r => r.status === "danger").length;
  const warningCount = risks.filter(r => r.status === "warning").length;

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Header */}
      <Card className="glass-card-strong p-4 lg:p-5 text-center">
        <PieChart className="w-6 h-6 lg:w-7 lg:h-7 text-primary mx-auto mb-2" />
        <h3 className="font-bold lg:text-lg">Mapa de Concentração</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Veja como seu patrimônio está distribuído e onde existe risco invisível
        </p>
        {(dangerCount > 0 || warningCount > 0) && (
          <div className="flex items-center justify-center gap-3 mt-3">
            {dangerCount > 0 && (
              <span className="text-xs font-medium text-destructive flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {dangerCount} alerta(s) crítico(s)
              </span>
            )}
            {warningCount > 0 && (
              <span className="text-xs font-medium text-warning flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> {warningCount} ponto(s) de atenção
              </span>
            )}
          </div>
        )}
      </Card>

      {/* By Institution */}
      {byInstitution.length > 0 && (
        <Card className="glass-card p-4 lg:p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" /> Por Instituição
          </h4>
          <div className="space-y-2">
            {byInstitution.map((risk, i) => <RiskRow key={i} risk={risk} />)}
          </div>
        </Card>
      )}

      {/* By Asset Class */}
      {byClass.length > 0 && (
        <Card className="glass-card p-4 lg:p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <PieChart className="w-3.5 h-3.5" /> Por Classe de Ativo
          </h4>
          <div className="space-y-2">
            {byClass.map((risk, i) => <RiskRow key={i} risk={risk} />)}
          </div>
        </Card>
      )}

      {/* By Titular (couple mode) */}
      {byTitular.length > 0 && (
        <Card className="glass-card p-4 lg:p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Por Titular
          </h4>
          <div className="space-y-2">
            {byTitular.map((risk, i) => <RiskRow key={i} risk={risk} />)}
          </div>
        </Card>
      )}

      {risks.length === 0 && (
        <Card className="glass-card p-6 text-center">
          <p className="text-sm text-muted-foreground">
            Cadastre seus investimentos para visualizar a distribuição e os riscos de concentração.
          </p>
        </Card>
      )}
    </div>
  );
}
