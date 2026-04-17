import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppData, Investment } from "@/lib/models";
import { PlanConfig, formatBRL, formatBRLCompact } from "@/lib/types";
import type { FinancialCoreState } from "@/hooks/useFinancialCore";
import { InvestmentForm } from "./InvestmentForm";
import { PieChart, AlertTriangle, Building2, Shield, TrendingUp, Plus, Pencil } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  core: FinancialCoreState;
  onAddInvestment: (inv: Investment) => void;
  onUpdateInvestment: (id: string, updates: Partial<Investment>) => void;
  onDeleteInvestment: (id: string) => void;
}

const TYPE_LABELS: Record<string, string> = {
  "tesouro-selic": "Tesouro Selic", "cdb": "CDB", "lci-lca": "LCI/LCA",
  "fundo": "Fundos", "acao": "Ações", "fii": "FIIs",
  "crypto": "Crypto", "poupanca": "Poupança", "other": "Outros",
};

const TYPE_COLORS = [
  "bg-primary", "bg-accent", "bg-warning", "bg-destructive",
  "bg-purple-500", "bg-pink-500", "bg-orange-500", "bg-teal-500", "bg-muted",
];

export function WealthDistribution({ appData, config, core, onAddInvestment, onUpdateInvestment, onDeleteInvestment }: Props) {
  const { metrics, allocation } = core;
  const totalInvested = metrics.grossWealth;
  const netWorth = metrics.netWealth;
  const [showForm, setShowForm] = useState(false);
  const [editingInvestment, setEditingInvestment] = useState<Investment | undefined>();

  const activeInvestments = appData.investments.filter(i => i.active);

  const byType = useMemo(() => {
    const map = new Map<string, number>();
    map.set("tesouro-selic", config.initialAmount);
    activeInvestments.forEach(i => {
      map.set(i.type, (map.get(i.type) || 0) + i.currentBalance);
    });
    return Array.from(map.entries())
      .map(([type, balance]) => ({ type, label: TYPE_LABELS[type] || type, balance, pct: totalInvested > 0 ? balance / totalInvested : 0 }))
      .filter(e => e.balance > 0)
      .sort((a, b) => b.balance - a.balance);
  }, [activeInvestments, config.initialAmount, totalInvested]);

  const handleSave = (inv: Investment) => {
    if (editingInvestment) {
      onUpdateInvestment(inv.id, inv);
    } else {
      onAddInvestment(inv);
    }
    setEditingInvestment(undefined);
  };

  const handleEdit = (inv: Investment) => {
    setEditingInvestment(inv);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    onDeleteInvestment(id);
    setEditingInvestment(undefined);
  };

  const hasInvestments = activeInvestments.length > 0 || config.initialAmount > 0;

  return (
    <div className="space-y-4">
      <Card className="glass-card-strong p-4 text-center">
        <PieChart className="w-6 h-6 text-primary mx-auto mb-2" />
        <h3 className="font-bold">Distribuição Patrimonial</h3>
        <p className="text-xs text-muted-foreground mt-1">Visão completa do seu patrimônio por classe e instituição</p>
      </Card>

      {/* CTA to add investment */}
      <Button className="w-full h-12 font-semibold" onClick={() => { setEditingInvestment(undefined); setShowForm(true); }}>
        <Plus className="w-4 h-4 mr-2" /> Cadastrar investimento
      </Button>

      {!hasInvestments ? (
        <Card className="glass-card p-6 text-center space-y-3">
          <PieChart className="w-10 h-10 text-muted-foreground mx-auto" />
          <p className="text-sm font-medium">Nenhum investimento cadastrado</p>
          <p className="text-xs text-muted-foreground">
            Cadastre seus investimentos para visualizar a distribuição patrimonial, concentração por instituição e proteção FGC.
          </p>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Card className="glass-card p-3 text-center">
              <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground uppercase">Investido</p>
              <p className="text-sm font-bold text-primary">{formatBRLCompact(totalInvested)}</p>
            </Card>
            <Card className="glass-card p-3 text-center">
              <AlertTriangle className="w-4 h-4 text-destructive mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground uppercase">Dívidas</p>
              <p className="text-sm font-bold text-destructive">{formatBRLCompact(metrics.totalDebtBalance)}</p>
            </Card>
            <Card className="glass-card p-3 text-center">
              <Shield className="w-4 h-4 text-accent mx-auto mb-1" />
              <p className="text-[10px] text-muted-foreground uppercase">Líquido</p>
              <p className={`text-sm font-bold ${netWorth >= 0 ? "text-primary" : "text-destructive"}`}>{formatBRLCompact(netWorth)}</p>
            </Card>
          </div>

          {/* Active investments list */}
          {activeInvestments.length > 0 && (
            <Card className="glass-card p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Seus Investimentos</h4>
              <div className="space-y-2">
                {activeInvestments.map(inv => (
                  <button
                    key={inv.id}
                    className="w-full flex items-center justify-between py-2.5 px-3 rounded-lg bg-muted/20 hover:bg-muted/30 transition-colors text-left"
                    onClick={() => handleEdit(inv)}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{inv.name || TYPE_LABELS[inv.type] || inv.type}</p>
                      <p className="text-[10px] text-muted-foreground">{inv.institution || "Sem instituição"}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      <span className="text-sm font-bold">{formatBRLCompact(inv.currentBalance)}</span>
                      <Pencil className="w-3 h-3 text-muted-foreground" />
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          <Card className="glass-card p-4 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Por Tipo de Ativo</h4>
            {byType.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">Nenhum investimento cadastrado</p>
            ) : (
              <div className="space-y-2">
                {byType.map((item, i) => (
                  <div key={`${item.type}-${i}`} className="space-y-1">
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

          {allocation.institutions.length > 0 && (
            <Card className="glass-card p-4 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Building2 className="w-3.5 h-3.5" /> Por Instituição
              </h4>
              <div className="space-y-2">
                {allocation.institutions.map((inst) => (
                  <div key={inst.institution} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20 text-sm">
                    <span className="font-medium truncate">{inst.institution}</span>
                    <span className="font-bold shrink-0 ml-2">{formatBRLCompact(inst.amount)} <span className="text-muted-foreground text-xs">({(inst.percentage * 100).toFixed(0)}%)</span></span>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {allocation.institutions.filter(i => i.isOverLimit).length > 0 && (
            <Card className="glass-card p-4 border-warning/30 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-warning" />
                <h4 className="text-xs font-bold uppercase tracking-wider text-warning">Alerta FGC</h4>
              </div>
              {allocation.institutions.filter(i => i.isOverLimit).map(inst => (
                <div key={inst.institution} className="text-sm p-2 rounded-lg bg-warning/5">
                  <p className="font-medium">{inst.institution}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatBRL(inst.fgcCovered)} de R$ 250.000 ({((inst.fgcCovered / inst.fgcLimit) * 100).toFixed(0)}% do limite FGC)
                  </p>
                  <Progress value={Math.min(100, (inst.fgcCovered / inst.fgcLimit) * 100)} className="h-1.5 mt-1" />
                </div>
              ))}
            </Card>
          )}
        </>
      )}

      <InvestmentForm
        appData={appData}
        open={showForm}
        onOpenChange={(open) => { setShowForm(open); if (!open) setEditingInvestment(undefined); }}
        editingInvestment={editingInvestment}
        onSave={handleSave}
        onDelete={handleDelete}
      />
    </div>
  );
}
