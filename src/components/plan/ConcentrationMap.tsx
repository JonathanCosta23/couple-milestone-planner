import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppData } from "@/lib/models";
import { PlanConfig, formatBRLCompact } from "@/lib/types";
import type { FinancialCoreState } from "@/hooks/useFinancialCore";
import { Building2, PieChart, Users, AlertTriangle, Plus } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

interface Props {
  appData: AppData;
  config: PlanConfig;
  core: FinancialCoreState;
  onNavigateToTab?: (tab: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  "tesouro-selic": "Tesouro Selic", "cdb": "CDB", "lci-lca": "LCI/LCA",
  "fundo": "Fundos", "acao": "Ações", "fii": "FIIs",
  "crypto": "Crypto", "poupanca": "Poupança", "other": "Outros",
};

export function ConcentrationMap({ appData, config, core, onNavigateToTab }: Props) {
  const { allocation, metrics } = core;
  const activeInvestments = appData.investments.filter(i => i.active);
  const totalWealth = metrics.grossWealth;
  const isCouple = appData.mode === "casal" && appData.partner && !appData.partner.removedAt;

  const byInstitution = allocation.institutions;

  const classMap = new Map<string, number>();
  activeInvestments.forEach(i => classMap.set(i.type, (classMap.get(i.type) || 0) + i.currentBalance));
  const byClass = Array.from(classMap.entries())
    .map(([type, balance]) => ({
      name: TYPE_LABELS[type] || type,
      balance,
      pct: totalWealth > 0 ? balance / totalWealth : 0,
      status: (balance / Math.max(1, totalWealth)) > 0.6 ? "danger" as const : (balance / Math.max(1, totalWealth)) > 0.4 ? "warning" as const : "safe" as const,
    }))
    .sort((a, b) => b.balance - a.balance);

  const byTitular = allocation.titulares;

  const dangerCount = byInstitution.filter(i => i.isOverLimit).length + byClass.filter(c => c.status === "danger").length;
  const warningCount = byInstitution.filter(i => i.fgcCovered > i.fgcLimit * 0.7 && !i.isOverLimit).length + byClass.filter(c => c.status === "warning").length;

  const hasData = activeInvestments.length > 0;

  if (!hasData) {
    return (
      <div className="space-y-4 lg:space-y-5">
        <Card className="glass-card-strong p-4 lg:p-5 text-center">
          <PieChart className="w-6 h-6 lg:w-7 lg:h-7 text-primary mx-auto mb-2" />
          <h3 className="font-bold lg:text-lg">Mapa de Concentração</h3>
        </Card>
        <EmptyState
          icon={PieChart}
          title="Sem ativos cadastrados"
          description="Cadastre seus investimentos para visualizar concentração por classe, instituição e conglomerado — e identificar riscos invisíveis."
          action={{
            label: "Cadastrar investimento",
            icon: Plus,
            onClick: () => onNavigateToTab?.("patrimonio"),
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4 lg:space-y-5">
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

      {byInstitution.length > 0 && (
        <Card className="glass-card p-4 lg:p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" /> Por Instituição
          </h4>
          <div className="space-y-2">
            {byInstitution.map((inst) => (
              <div key={inst.institution} className="py-2.5 px-3 rounded-lg bg-muted/20">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium truncate">{inst.institution}</span>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-sm font-bold">{formatBRLCompact(inst.amount)}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">({(inst.percentage * 100).toFixed(0)}%)</span>
                  </div>
                </div>
                <Progress value={inst.percentage * 100} className="h-1.5" />
                <div className="flex justify-between mt-1.5 text-[10px] text-muted-foreground">
                  <span>FGC: {formatBRLCompact(inst.fgcCovered)} de {formatBRLCompact(inst.fgcLimit)}</span>
                  <span className={inst.headroom < 50_000 ? "text-warning font-medium" : ""}>
                    Disponível: {formatBRLCompact(inst.headroom)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {byClass.length > 0 && (
        <Card className="glass-card p-4 lg:p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <PieChart className="w-3.5 h-3.5" /> Por Classe de Ativo
          </h4>
          <div className="space-y-2">
            {byClass.map((item) => (
              <div key={item.name} className="py-2.5 px-3 rounded-lg bg-muted/20">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium truncate">{item.name}</span>
                  <div className="text-right shrink-0 ml-2">
                    <span className="text-sm font-bold">{formatBRLCompact(item.balance)}</span>
                    <span className="text-xs text-muted-foreground ml-1.5">({(item.pct * 100).toFixed(0)}%)</span>
                  </div>
                </div>
                <Progress value={item.pct * 100} className="h-1.5" />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Only show titular section in couple mode */}
      {isCouple && byTitular.length > 1 && (
        <Card className="glass-card p-4 lg:p-5 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Users className="w-3.5 h-3.5" /> Por Titular
          </h4>
          <div className="space-y-2">
            {byTitular.map((t) => (
              <div key={t.titularId} className="py-2.5 px-3 rounded-lg bg-muted/20">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium">{t.titularName}</span>
                  <span className="text-sm font-bold">{formatBRLCompact(t.totalAmount)}
                    <span className="text-xs text-muted-foreground ml-1">({totalWealth > 0 ? ((t.totalAmount / totalWealth) * 100).toFixed(0) : 0}%)</span>
                  </span>
                </div>
                <Progress value={totalWealth > 0 ? (t.totalAmount / totalWealth) * 100 : 0} className="h-1.5" />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
