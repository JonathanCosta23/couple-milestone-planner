import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact } from "@/lib/types";
import { simulateAdvancedScenario } from "@/lib/financialEngine";
import { AppData } from "@/lib/models";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from "recharts";
import { TrendingUp, Eye, EyeOff, ArrowUpRight, ArrowDownRight, Clock, DollarSign, Shield, Info } from "lucide-react";

import { FinancialCoreState } from "@/hooks/useFinancialCore";
import { PROJECTION_DISCLAIMER } from "@/lib/financialAssumptions";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  core: FinancialCoreState;
}

export function ProjectionRealistic({ appData, config, monthRecords, startDate, core }: Props) {
  const [showNet, setShowNet] = useState(true);
  const [showReal, setShowReal] = useState(true);

  // Use core.projection instead of recalculating
  const { projection: proj } = core;

  const nominalFinal = proj.finalNominal;
  const netFinal = proj.finalNet;
  const realFinal = proj.finalReal;
  const inflationLoss = nominalFinal - realFinal;
  const taxLoss = nominalFinal - netFinal;

  // Build chart data from core.projection.nominal/net/real
  const chartData = useMemo(() => {
    return proj.nominal
      .filter((_, i) => i % 12 === 11 || i === proj.nominal.length - 1)
      .map((p, idx) => ({
        year: Math.ceil(p.monthIndex / 12) || 1,
        nominal: Math.round(p.balance),
        net: Math.round(proj.net[proj.nominal.indexOf(p)]?.balance ?? 0),
        real: Math.round(proj.real[proj.nominal.indexOf(p)]?.balance ?? 0),
      }));
  }, [proj]);

  // 7 scenarios (these are stress tests, not base projection — keep separate)
  const monthly = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const months = config.years * 12;
  const currentWealth = appData.investments.filter(i => i.active).reduce((s, i) => s + i.currentBalance, 0) + config.initialAmount;

  const scenarios = useMemo(() => {
    const baseAnnual = core.assumptions.expectedReturnRate;
    const baseInflation = core.assumptions.inflationRate;
    const base = {
      currentWealth,
      monthlyContribution: monthly,
      extraContribution: 0,
      annualRate: baseAnnual,
      inflationRate: baseInflation,
      months,
      skippedMonths: 0,
    };
    return [
      { ...simulateAdvancedScenario(config, monthRecords, startDate, { ...base, annualRate: Math.max(0.05, baseAnnual - 0.03) }), label: `Conservador (${(Math.max(0.05, baseAnnual - 0.03) * 100).toFixed(1)}% a.a.)` },
      { ...simulateAdvancedScenario(config, monthRecords, startDate, base), label: `Atual (${(baseAnnual * 100).toFixed(1)}% a.a.)` },
      { ...simulateAdvancedScenario(config, monthRecords, startDate, { ...base, annualRate: baseAnnual + 0.03 }), label: "Otimista (+3% a.a.)" },
      { ...simulateAdvancedScenario(config, monthRecords, startDate, { ...base, inflationRate: baseInflation + 0.02 }), label: `Inflação alta (${((baseInflation + 0.02) * 100).toFixed(1)}%)` },
      { ...simulateAdvancedScenario(config, monthRecords, startDate, { ...base, skippedMonths: 12 }), label: "Pausa de 1 ano" },
      { ...simulateAdvancedScenario(config, monthRecords, startDate, { ...base, monthlyContribution: monthly * 0.7 }), label: "Choque de despesas (−30%)" },
      { ...simulateAdvancedScenario(config, monthRecords, startDate, { ...base, annualRate: baseAnnual * 0.6 }), label: "Queda de rentabilidade" },
    ];
  }, [config, monthRecords, startDate, currentWealth, monthly, months, core.assumptions]);

  const baseScenario = scenarios[1];

  const assumptions = core.assumptions;
  const targetAmount = config.targetAmount;
  const targetLabel = formatBRLCompact(targetAmount);
  const calcDate = new Date().toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header */}
      <Card className="glass-card-strong p-4 lg:p-6 text-center">
        <TrendingUp className="w-6 h-6 lg:w-8 lg:h-8 text-primary mx-auto mb-2" />
        <h3 className="font-bold lg:text-lg">Projeção Realista</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Seu patrimônio nominal não é o que você vai ter de verdade. Veja o impacto de impostos e inflação.
        </p>
        <p className="mt-3 mx-auto max-w-md inline-flex items-start gap-1.5 text-[11px] text-muted-foreground/90 leading-snug text-left">
          <Info className="w-3 h-3 mt-0.5 shrink-0" aria-hidden />
          <span>{PROJECTION_DISCLAIMER}</span>
        </p>
      </Card>

      {/* Premissas utilizadas */}
      <Card className="glass-card p-4 lg:p-5" aria-label="Premissas financeiras">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Premissas usadas no cálculo
          </h4>
          <span className="text-[10px] text-muted-foreground">Calculado em {calcDate}</span>
        </div>
        <dl className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
          <AssumptionItem label="Retorno bruto a.a." value={`${(assumptions.expectedReturnRate * 100).toFixed(2)}%`} />
          <AssumptionItem label="CDB (% do CDI)" value={`${(assumptions.cdbPctOfCdi * 100).toFixed(0)}%`} />
          <AssumptionItem label="Inflação a.a." value={`${(assumptions.inflationRate * 100).toFixed(2)}%`} />
          <AssumptionItem label="IR estimado" value={`${(assumptions.taxRate * 100).toFixed(0)}%`} />
          <AssumptionItem label="IOF" value={assumptions.iofRate === 0 ? "Não aplicável" : `${(assumptions.iofRate * 100).toFixed(2)}%`} />
          <AssumptionItem label="Cenário" value="Base (do plano)" />
        </dl>
        <p className="mt-3 text-[11px] text-muted-foreground leading-snug">
          Premissas editáveis no plano. Estimativas educacionais, não recomendação de investimento.
        </p>
      </Card>

      {/* 3 Final Values */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="glass-card p-3 lg:p-4 text-center">
          <DollarSign className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase">Nominal</p>
          <p className="text-sm lg:text-base font-bold text-primary">{formatBRLCompact(nominalFinal)}</p>
          <p className="text-[9px] text-muted-foreground">Valor bruto</p>
        </Card>
        <Card className="glass-card p-3 lg:p-4 text-center">
          <Shield className="w-4 h-4 text-accent mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase">Líquido</p>
          <p className="text-sm lg:text-base font-bold text-accent">{formatBRLCompact(netFinal)}</p>
          <p className="text-[9px] text-muted-foreground">Após IR estimado</p>
        </Card>
        <Card className="glass-card p-3 lg:p-4 text-center">
          <Eye className="w-4 h-4 text-warning mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground uppercase">Real</p>
          <p className="text-sm lg:text-base font-bold text-warning">{formatBRLCompact(realFinal)}</p>
          <p className="text-[9px] text-muted-foreground">Poder de compra</p>
        </Card>
      </div>

      {/* Impact Summary */}
      <Card className="glass-card p-4 lg:p-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-3">O que reduz seu patrimônio</h4>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-lg bg-destructive/5 border border-destructive/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">Efeito da inflação</p>
            <p className="text-lg font-bold text-destructive">−{formatBRLCompact(inflationLoss)}</p>
            <p className="text-[10px] text-muted-foreground">{nominalFinal > 0 ? ((inflationLoss / nominalFinal) * 100).toFixed(0) : 0}% do nominal</p>
          </div>
          <div className="rounded-lg bg-warning/5 border border-warning/20 p-3 text-center">
            <p className="text-xs text-muted-foreground">Imposto estimado</p>
            <p className="text-lg font-bold text-warning">−{formatBRLCompact(taxLoss)}</p>
            <p className="text-[10px] text-muted-foreground">{nominalFinal > 0 ? ((taxLoss / nominalFinal) * 100).toFixed(0) : 0}% do nominal</p>
          </div>
        </div>
      </Card>

      {/* Chart */}
      <Card className="glass-card p-4 lg:p-5">
        <div className="flex items-center justify-between mb-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Evolução ao Longo do Tempo</h4>
          <div className="flex gap-1.5">
            <Button size="sm" variant={showNet ? "default" : "outline"} className="h-7 text-[10px] rounded-full px-2.5"
              onClick={() => setShowNet(!showNet)}>
              {showNet ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />} Líquido
            </Button>
            <Button size="sm" variant={showReal ? "default" : "outline"} className="h-7 text-[10px] rounded-full px-2.5"
              onClick={() => setShowReal(!showReal)}>
              {showReal ? <Eye className="w-3 h-3 mr-1" /> : <EyeOff className="w-3 h-3 mr-1" />} Real
            </Button>
          </div>
        </div>
        <div className="h-64 lg:h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="year" tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}a`} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => formatBRLCompact(v)} width={65} />
              <Tooltip
                formatter={(value: number, name: string) => [formatBRL(value), name === "nominal" ? "Nominal" : name === "net" ? "Líquido" : "Real"]}
                labelFormatter={(v) => `Ano ${v}`}
              />
              <ReferenceLine y={targetAmount} stroke="hsl(var(--primary))" strokeDasharray="3 3" label={{ value: `Meta ${targetLabel}`, fontSize: 10 }} />
              <Line type="monotone" dataKey="nominal" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} name="Nominal" />
              {showNet && <Line type="monotone" dataKey="net" stroke="hsl(var(--accent))" strokeWidth={2} dot={false} name="Líquido" strokeDasharray="4 2" />}
              {showReal && <Line type="monotone" dataKey="real" stroke="hsl(var(--warning, 38 92% 50%))" strokeWidth={2} dot={false} name="Real" strokeDasharray="6 3" />}
              <Legend />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 7 Scenarios */}
      <Card className="glass-card p-4 lg:p-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">Cenários de Vida Real</h4>
        <p className="text-xs text-muted-foreground mb-3">
          O mesmo plano pode ter resultados muito diferentes dependendo do que acontecer pelo caminho
        </p>
        <div className="space-y-2">
          {scenarios.map((s, i) => {
            const diff = baseScenario.monthsToTarget && s.monthsToTarget
              ? baseScenario.monthsToTarget - s.monthsToTarget
              : 0;
            const isBase = i === 1;
            return (
              <div key={i} className={`flex items-center justify-between py-2.5 px-3 lg:px-4 rounded-lg text-sm ${isBase ? "bg-primary/10 border border-primary/20" : "bg-muted/20"}`}>
                <div className="flex-1 min-w-0">
                  <p className={`font-medium truncate ${isBase ? "text-primary" : ""}`}>
                    {isBase ? "→ " : ""}{s.label}
                  </p>
                  <p className="text-[10px] sm:text-xs text-muted-foreground">
                    {s.monthsToTarget ? `~${Math.ceil(s.monthsToTarget / 12)} anos` : "Não atinge no prazo"}
                    {" · "}Renda passiva: {formatBRL(s.passiveIncome4pct)}/mês
                  </p>
                </div>
                <div className="text-right shrink-0 ml-3">
                  <p className="font-bold">{formatBRLCompact(s.finalWealth)}</p>
                  {diff !== 0 && !isBase && (
                    <p className={`text-[10px] flex items-center gap-0.5 justify-end ${diff > 0 ? "text-primary" : "text-destructive"}`}>
                      {diff > 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                      {Math.abs(diff)} meses {diff > 0 ? "mais rápido" : "mais lento"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Education */}
      <Card className="glass-card p-4 lg:p-5 border-primary/20">
        <h4 className="text-xs font-bold uppercase tracking-wider text-primary mb-2 flex items-center gap-1.5">
          <Info className="w-3.5 h-3.5" aria-hidden />
          Entenda a diferença
        </h4>
        <div className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
          <p><strong>Nominal</strong> é o número que aparece na conta. <strong>Líquido</strong> é o que sobra depois de pagar imposto. <strong>Real</strong> é o que esse dinheiro realmente compra.</p>
          <p>Chegar a {targetLabel} nominal não é a mesma coisa que ter {targetLabel} em poder de compra. A inflação corrói silenciosamente. Por isso, a meta real importa mais que a meta nominal.</p>
          <p>Um plano responsável considera os três valores. Se o seu patrimônio real está distante da meta, considere aumentar o aporte ou revisar a estratégia.</p>
        </div>
      </Card>
    </div>
  );
}

function AssumptionItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 px-3 py-2">
      <dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold mt-0.5">{value}</dd>
    </div>
  );
}
