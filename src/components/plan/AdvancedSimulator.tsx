import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact } from "@/lib/types";
import { generateScenarioSuite, AdvancedScenarioResult, simulateAdvancedScenario } from "@/lib/financialEngine";
import { Calculator, TrendingUp, Clock, DollarSign, ArrowUpRight, ArrowDownRight, Eye, Shield, Layers, ToggleLeft, ToggleRight } from "lucide-react";
import { ContextualEducation } from "./ContextualEducation";
import { AppData } from "@/lib/models";

import { FinancialCoreState } from "@/hooks/useFinancialCore";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  core: FinancialCoreState;
}

function CurrencyInput({ value, onChange, id, label }: { value: number; onChange: (v: number) => void; id: string; label: string }) {
  return (
    <div>
      <Label htmlFor={id} className="text-xs sm:text-sm">{label}</Label>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">R$</span>
        <Input id={id} type="text" inputMode="numeric"
          value={value ? value.toLocaleString("pt-BR") : ""}
          onChange={(e) => onChange(Number(e.target.value.replace(/\D/g, "")) || 0)}
          className="text-right pl-10 h-9 lg:h-10 text-sm" />
      </div>
    </div>
  );
}

export function AdvancedSimulator({ appData, config, monthRecords, startDate, core }: Props) {
  const monthly = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const [mode, setMode] = useState<"simple" | "advanced">("simple");
  const [customWealth, setCustomWealth] = useState(config.initialAmount);
  const [customMonthly, setCustomMonthly] = useState(monthly);
  const [customExtra, setCustomExtra] = useState(0);
  const [customRate, setCustomRate] = useState(config.selicRate * 100);
  const [customInflation, setCustomInflation] = useState(4.5);

  // Check if using default values (no custom tweaks) — use core.projection
  const isDefault = customWealth === config.initialAmount
    && customMonthly === monthly
    && customExtra === 0
    && Math.abs(customRate - config.selicRate * 100) < 0.01
    && Math.abs(customInflation - 4.5) < 0.01;

  const scenarios = useMemo(
    () => generateScenarioSuite(config, monthRecords, startDate, customWealth),
    [config, monthRecords, startDate, customWealth]
  );

  const custom = useMemo(() => {
    // When using defaults, derive from core.projection to avoid recalculation
    if (isDefault) {
      return {
        finalWealth: core.projection.finalNominal,
        realWealth: core.projection.finalReal,
        passiveIncome4pct: core.projection.estimatedPassiveIncome,
        monthsToTarget: core.projection.monthsToTargetNominal,
      };
    }
    return simulateAdvancedScenario(config, monthRecords, startDate, {
      currentWealth: customWealth,
      monthlyContribution: customMonthly,
      extraContribution: customExtra,
      annualRate: customRate / 100,
      inflationRate: customInflation / 100,
      months: config.years * 12,
      skippedMonths: 0,
    });
  }, [customWealth, customMonthly, customExtra, customRate, customInflation, config, monthRecords, startDate, isDefault, core.projection]);

  // Simple mode: quick result with nominal/real/líquido
  const simpleResult = useMemo(() => {
    if (isDefault) {
      return {
        nominal: core.projection.finalNominal,
        net: core.projection.finalNet,
        real: core.projection.finalReal,
        passiveIncome: core.projection.estimatedPassiveIncome,
        monthsToTarget: core.projection.monthsToTargetNominal,
        inflationLoss: core.projection.finalNominal - core.projection.finalReal,
        taxLoss: core.projection.finalNominal - core.projection.finalNet,
      };
    }
    const taxRate = 0.15;
    const gains = custom.finalWealth - (customWealth + customMonthly * config.years * 12);
    const netWealth = custom.finalWealth - Math.max(0, gains * taxRate);
    return {
      nominal: custom.finalWealth,
      net: netWealth,
      real: custom.realWealth,
      passiveIncome: custom.passiveIncome4pct,
      monthsToTarget: custom.monthsToTarget,
      inflationLoss: custom.finalWealth - custom.realWealth,
      taxLoss: custom.finalWealth - netWealth,
    };
  }, [custom, customWealth, customMonthly, config.years, isDefault, core.projection]);

  return (
    <div className="space-y-4 lg:space-y-6">
      {/* Header with mode toggle */}
      <Card className="glass-card-strong p-4 lg:p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-center sm:text-left">
            <div className="flex items-center gap-2 justify-center sm:justify-start">
              <Calculator className="w-6 h-6 lg:w-7 lg:h-7 text-primary" />
              <h3 className="font-bold lg:text-lg">Simulador</h3>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              {mode === "simple"
                ? "Veja rapidamente quanto seu dinheiro pode virar — e quanto disso é real"
                : "Teste cenários completos com impostos, inflação e stress tests"}
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full h-9 px-4 text-xs font-semibold shrink-0"
            onClick={() => setMode(mode === "simple" ? "advanced" : "simple")}
          >
            {mode === "simple" ? (
              <><Layers className="w-3.5 h-3.5 mr-1.5" /> Modo avançado</>
            ) : (
              <><Eye className="w-3.5 h-3.5 mr-1.5" /> Modo simples</>
            )}
          </Button>
        </div>
      </Card>

      {/* Input parameters — always visible */}
      <Card className="glass-card p-4 lg:p-6 space-y-3 lg:space-y-4">
        <h4 className="section-label">Monte sua simulação</h4>
        <div className={`grid gap-3 lg:gap-4 ${mode === "simple" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 lg:grid-cols-4"}`}>
          <CurrencyInput id="sim-wealth" label="Quanto já tem" value={customWealth} onChange={setCustomWealth} />
          <CurrencyInput id="sim-monthly" label="Aporte por mês" value={customMonthly} onChange={setCustomMonthly} />
          {mode === "advanced" && (
            <CurrencyInput id="sim-extra" label="Aporte extra/mês" value={customExtra} onChange={setCustomExtra} />
          )}
          <div>
            <Label htmlFor="sim-rate" className="text-xs sm:text-sm">Rendimento a.a. (%)</Label>
            <Input id="sim-rate" type="number" step={0.5} min={0} max={30}
              value={customRate} onChange={(e) => setCustomRate(Number(e.target.value) || 0)}
              className="text-right h-9 lg:h-10 text-sm" />
          </div>
          {mode === "advanced" && (
            <div>
              <Label htmlFor="sim-inflation" className="text-xs sm:text-sm">Inflação a.a. (%)</Label>
              <Input id="sim-inflation" type="number" step={0.5} min={0} max={20}
                value={customInflation} onChange={(e) => setCustomInflation(Number(e.target.value) || 0)}
                className="text-right h-9 lg:h-10 text-sm" />
            </div>
          )}
        </div>
      </Card>

      {/* ── SIMPLE MODE ── */}
      {mode === "simple" && (
        <>
          {/* 3 results: nominal, líquido, real */}
          <div className="grid grid-cols-3 gap-3">
            <Card className="glass-card p-3.5 lg:p-5 text-center">
              <DollarSign className="w-4 h-4 lg:w-5 lg:h-5 text-primary mx-auto mb-1" />
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Nominal</p>
              <p className="text-base lg:text-lg font-extrabold text-primary">{formatBRLCompact(simpleResult.nominal)}</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">O número que aparece na conta</p>
            </Card>
            <Card className="glass-card p-3.5 lg:p-5 text-center">
              <Shield className="w-4 h-4 lg:w-5 lg:h-5 text-accent mx-auto mb-1" />
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Líquido</p>
              <p className="text-base lg:text-lg font-extrabold text-accent">{formatBRLCompact(simpleResult.net)}</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">Depois de pagar imposto</p>
            </Card>
            <Card className="glass-card p-3.5 lg:p-5 text-center">
              <Eye className="w-4 h-4 lg:w-5 lg:h-5 text-warning mx-auto mb-1" />
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Real</p>
              <p className="text-base lg:text-lg font-extrabold text-warning">{formatBRLCompact(simpleResult.real)}</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">O que ele compra de verdade</p>
            </Card>
          </div>

          {/* Key takeaways */}
          <div className="grid grid-cols-2 gap-3 lg:gap-4">
            <Card className="glass-card p-3.5 lg:p-5 text-center">
              <Clock className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Tempo até a meta</p>
              <p className="text-lg font-bold text-primary">
                {simpleResult.monthsToTarget ? `~${Math.ceil(simpleResult.monthsToTarget / 12)} anos` : "—"}
              </p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">
                {simpleResult.monthsToTarget ? `${simpleResult.monthsToTarget} meses` : "Aumente o aporte para atingir no prazo"}
              </p>
            </Card>
            <Card className="glass-card p-3.5 lg:p-5 text-center">
              <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
              <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">Renda passiva estimada</p>
              <p className="text-lg font-bold text-primary">{formatBRL(simpleResult.passiveIncome)}/mês</p>
              <p className="text-[9px] sm:text-[10px] text-muted-foreground">Regra dos 4% ao ano</p>
            </Card>
          </div>

          {/* Simple education */}
          <Card className="glass-card p-4 lg:p-5 border-primary/20">
            <p className="text-[10px] sm:text-xs text-primary font-bold uppercase mb-1.5">💡 O que esses números significam</p>
            <div className="space-y-1.5 text-xs sm:text-sm text-muted-foreground leading-relaxed">
              <p><strong className="text-foreground">Nominal</strong> é o saldo bruto. <strong className="text-foreground">Líquido</strong> é o que sobra após imposto. <strong className="text-foreground">Real</strong> é o poder de compra.</p>
              <p>Chegar a R$ 1 milhão nominal não é o mesmo que ter R$ 1 milhão em poder de compra. A inflação corrói o valor ao longo dos anos.</p>
            </div>
          </Card>
        </>
      )}

      {/* ── ADVANCED MODE ── */}
      {mode === "advanced" && (
        <>
          {/* Custom Result */}
          <Card className="glass-card p-4 lg:p-6">
            <h4 className="section-label mb-3">Resultado da simulação</h4>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
              <ResultCard label="Patrimônio nominal" value={formatBRLCompact(custom.finalWealth)} sub="Valor bruto" icon={TrendingUp} />
              <ResultCard label="Poder de compra real" value={formatBRLCompact(custom.realWealth)} sub={`Inflação: ${customInflation}% a.a.`} icon={DollarSign} />
              <ResultCard label="Renda passiva" value={`${formatBRL(custom.passiveIncome4pct)}/mês`} sub="Retirada de 4% a.a." icon={ArrowUpRight} />
              <ResultCard label="Tempo até a meta" value={custom.monthsToTarget ? `${Math.ceil(custom.monthsToTarget / 12)} anos` : "—"} sub={custom.monthsToTarget ? `${custom.monthsToTarget} meses` : "Não atinge no prazo"} icon={Clock} />
            </div>
          </Card>

          {/* Scenarios */}
          <Card className="glass-card p-4 lg:p-6">
            <h4 className="section-label mb-1">Compare cenários</h4>
            <p className="text-xs text-muted-foreground mb-3">Veja como cada variável muda o resultado final</p>
            <div className="space-y-2 lg:space-y-3">
              {scenarios.map((s, i) => (
                <ScenarioRow key={i} scenario={s} baseMonths={scenarios[2]?.monthsToTarget} />
              ))}
            </div>
          </Card>

          {/* Impact analysis */}
          <Card className="glass-card p-4 lg:p-5">
            <h4 className="section-label mb-3">O que mais impacta seu resultado</h4>
            <div className="grid grid-cols-2 gap-3">
              <ImpactCard
                label="Se parar 6 meses"
                impact={scenarios.find(s => s.label.includes("parados"))?.finalWealth || 0}
                base={custom.finalWealth}
                negative
              />
              <ImpactCard
                label="Se adicionar R$ 300/mês"
                impact={scenarios.find(s => s.label.includes("Extra"))?.finalWealth || 0}
                base={custom.finalWealth}
              />
            </div>
          </Card>
        </>
      )}

      {/* Contextual Education */}
      <ContextualEducation
        appData={appData}
        config={config}
        monthRecords={monthRecords}
        startDate={startDate}
        context="simulator"
        maxSuggestions={1}
        simulatorRate={customRate / 100}
      />
    </div>
  );
}

function ResultCard({ label, value, sub, icon: Icon }: { label: string; value: string; sub: string; icon: React.ElementType }) {
  return (
    <div className="text-center p-3 lg:p-4 rounded-lg bg-muted/30">
      <Icon className="w-4 h-4 lg:w-5 lg:h-5 mx-auto mb-1 text-primary" />
      <p className="text-[10px] sm:text-xs text-muted-foreground uppercase">{label}</p>
      <p className="text-sm lg:text-base font-bold text-primary">{value}</p>
      {sub && <p className="text-[10px] sm:text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}

function ScenarioRow({ scenario, baseMonths }: { scenario: AdvancedScenarioResult; baseMonths: number | null | undefined }) {
  const diff = baseMonths && scenario.monthsToTarget ? baseMonths - scenario.monthsToTarget : 0;
  const isPositive = diff > 0;

  return (
    <div className="flex items-center justify-between py-2 lg:py-3 px-3 lg:px-4 rounded-lg bg-muted/20 text-sm lg:text-base">
      <div className="flex-1 min-w-0">
        <p className="font-medium truncate">{scenario.label}</p>
        <p className="text-[10px] sm:text-xs text-muted-foreground">
          {scenario.monthsToTarget ? `~${Math.ceil(scenario.monthsToTarget / 12)} anos (${scenario.monthsToTarget} meses)` : "Não atinge no prazo"}
          {" · "}Renda passiva: {formatBRL(scenario.passiveIncome4pct)}/mês
        </p>
      </div>
      <div className="text-right shrink-0 ml-3">
        <p className="font-bold text-sm lg:text-base">{formatBRLCompact(scenario.finalWealth)}</p>
        {diff !== 0 && (
          <p className={`text-[10px] sm:text-xs flex items-center gap-0.5 justify-end ${isPositive ? "text-primary" : "text-destructive"}`}>
            {isPositive ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {Math.abs(diff)} meses {isPositive ? "mais rápido" : "mais lento"}
          </p>
        )}
      </div>
    </div>
  );
}

function ImpactCard({ label, impact, base, negative }: { label: string; impact: number; base: number; negative?: boolean }) {
  const diff = impact - base;
  const pctDiff = base > 0 ? (diff / base) * 100 : 0;
  return (
    <div className={`rounded-lg p-3 text-center ${negative ? "bg-destructive/5 border border-destructive/20" : "bg-primary/5 border border-primary/20"}`}>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-base font-bold ${negative ? "text-destructive" : "text-primary"}`}>
        {diff >= 0 ? "+" : ""}{formatBRLCompact(diff)}
      </p>
      <p className="text-[10px] text-muted-foreground">{pctDiff >= 0 ? "+" : ""}{pctDiff.toFixed(1)}% no resultado</p>
    </div>
  );
}
