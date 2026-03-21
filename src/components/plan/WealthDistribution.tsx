import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { AppData } from "@/lib/models";
import { PlanConfig, formatBRL, formatBRLCompact } from "@/lib/types";
import { checkFGCAlerts } from "@/lib/financialEngine";
import { PieChart, AlertTriangle, Building2, Shield, TrendingUp } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
}

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

const TYPE_COLORS = [
  "bg-primary", "bg-accent", "bg-warning", "bg-destructive",
  "bg-purple-500", "bg-pink-500", "bg-orange-500", "bg-teal-500", "bg-muted",
];

export function WealthDistribution({ appData, config }: Props) {
  const activeInvestments = appData.investments.filter(i => i.active);
  const totalInvested = activeInvestments.reduce((s, i) => s + i.currentBalance, 0) + config.initialAmount;
  const totalDebts = appData.debts.filter(d => d.active).reduce((s, d) => s + d.totalAmount, 0);
  const netWorth = totalInvested - totalDebts;

  // By type
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    // Include initial amount as tesouro-selic
    map.set("tesouro-selic", config.initialAmount);
    activeInvestments.forEach(i => {
      map.set(i.type, (map.get(i.type) || 0) + i.currentBalance);
    });
    return Array.from(map.entries())
      .map(([type, balance]) => ({ type, label: TYPE_LABELS[type] || type, balance, pct: totalInvested > 0 ? balance / totalInvested : 0 }))
      .filter(e => e.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [activeInvestments, config.initialAmount, totalInvested]);

  // By institution
  const byInstitution = useMemo(() => {
    const map = new Map<string, number>();
    activeInvestments.forEach(i => {
      map.set(i.institution || "Sem instituição", (map.get(i.institution || "Sem instituição") || 0) + i.currentBalance);
    });
    return Array.from(map.entries())
      .map(([inst, balance]) => ({ institution: inst, balance, pct: totalInvested > 0 ? balance / totalInvested : 0 }))
      .sort((a, b) => b.balance - a.balance);
  }, [activeInvestments, totalInvested]);

  const fgcAlerts = useMemo(() => checkFGCAlerts(appData), [appData]);

  // Low liquidity alert
  const lowLiquidityAssets = activeInvestments.filter(i => i.maturityDate && new Date(i.maturityDate) > new Date());
  const lowLiquidityTotal = lowLiquidityAssets.reduce((s, i) => s + i.currentBalance, 0);
  const lowLiquidityPct = totalInvested > 0 ? lowLiquidityTotal / totalInvested : 0;

  return (
    <div className="space-y-4">
      <Card className="glass-card-strong p-4 text-center">
        <PieChart className="w-6 h-6 text-primary mx-auto mb-2" />
        <h3 className="font-bold">Distribuição Patrimonial</h3>
        <p className="text-xs text-muted-foreground mt-1">Visão completa do seu patrimônio por classe e instituição</p>
      </Card>

      {/* Net Worth */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="glass-card p-3 text-center">
          <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase">Investido</p>
          <p className="text-sm font-bold text-primary">{formatBRLCompact(totalInvested)}</p>
        </Card>
        <Card className="glass-card p-3 text-center">
          <AlertTriangle className="w-4 h-4 text-destructive mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase">Dívidas</p>
          <p className="text-sm font-bold text-destructive">{formatBRLCompact(totalDebts)}</p>
        </Card>
        <Card className="glass-card p-3 text-center">
          <Shield className="w-4 h-4 text-accent mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase">Líquido</p>
          <p className={`text-sm font-bold ${netWorth >= 0 ? "text-primary" : "text-destructive"}`}>{formatBRLCompact(netWorth)}</p>
        </Card>
      </div>

      {/* By Type */}
      <Card className="glass-card p-4 space-y-3">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Por Tipo de Ativo</h4>
        {byType.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-2">Nenhum investimento cadastrado</p>
        ) : (
          <div className="space-y-2">
            {byType.map((item, i) => (
              <div key={item.type} className="space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${TYPE_COLORS[i % TYPE_COLORS.length]}`} />
                    {item.label}
                  </span>
                  <span className="font-medium">{formatBRLCompact(item.balance)} <span className="text-muted-foreground text-xs">({(item.pct * 100).toFixed(0)}%)</span></span>
                </div>
                <Progress value={item.pct * 100} className="h-1.5" />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* By Institution */}
      {byInstitution.length > 0 && (
        <Card className="glass-card p-4 space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
            <Building2 className="w-3.5 h-3.5" /> Por Instituição
          </h4>
          <div className="space-y-2">
            {byInstitution.map((item, i) => (
              <div key={item.institution} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 text-sm">
                <span className="font-medium truncate">{item.institution}</span>
                <span className="font-bold shrink-0 ml-2">{formatBRLCompact(item.balance)} <span className="text-muted-foreground text-xs">({(item.pct * 100).toFixed(0)}%)</span></span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* FGC Alerts */}
      {fgcAlerts.length > 0 && (
        <Card className="glass-card p-4 border-warning/30 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-warning">Alerta FGC</h4>
          </div>
          {fgcAlerts.map(alert => (
            <div key={alert.institution} className="text-sm p-2 rounded-lg bg-warning/5">
              <p className="font-medium">{alert.institution}</p>
              <p className="text-xs text-muted-foreground">
                {formatBRL(alert.balance)} de R$ 250.000 ({(alert.percentage * 100).toFixed(0)}% do limite FGC)
              </p>
              <Progress value={alert.percentage * 100} className="h-1.5 mt-1" />
            </div>
          ))}
        </Card>
      )}

      {/* Low Liquidity Alert */}
      {lowLiquidityPct > 0.5 && (
        <Card className="glass-card p-4 border-warning/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-warning shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Baixa Liquidez</p>
              <p className="text-xs text-muted-foreground">
                {(lowLiquidityPct * 100).toFixed(0)}% do patrimônio está em ativos com prazo fechado.
                Considere manter pelo menos 30% em liquidez diária.
              </p>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
