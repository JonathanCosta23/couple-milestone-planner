import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlanConfig, MonthRecord, formatBRL, formatBRLCompact } from "@/lib/types";
import { generateScenarioSuite, AdvancedScenarioResult, simulateAdvancedScenario } from "@/lib/financialEngine";
import { Calculator, TrendingUp, Clock, DollarSign, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { ContextualEducation } from "./ContextualEducation";
import { AppData } from "@/lib/models";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
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

export function AdvancedSimulator({ appData, config, monthRecords, startDate }: Props) {
  const monthly = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const [customWealth, setCustomWealth] = useState(config.initialAmount);
  const [customMonthly, setCustomMonthly] = useState(monthly);
  const [customExtra, setCustomExtra] = useState(0);
  const [customRate, setCustomRate] = useState(config.selicRate * 100);
  const [customInflation, setCustomInflation] = useState(4.5);

  const scenarios = useMemo(
    () => generateScenarioSuite(config, monthRecords, startDate, customWealth),
    [config, monthRecords, startDate, customWealth]
  );

  const custom = useMemo(() => simulateAdvancedScenario(config, monthRecords, startDate, {
    currentWealth: customWealth,
    monthlyContribution: customMonthly,
    extraContribution: customExtra,
    annualRate: customRate / 100,
    inflationRate: customInflation / 100,
    months: config.years * 12,
    skippedMonths: 0,
  }), [customWealth, customMonthly, customExtra, customRate, customInflation, config, monthRecords, startDate]);

  return (
    <div className="space-y-4 lg:space-y-6">
      <Card className="glass-card-strong p-4 lg:p-6 text-center">
        <Calculator className="w-6 h-6 lg:w-8 lg:h-8 text-primary mx-auto mb-2" />
        <h3 className="font-bold lg:text-lg">Simule seu futuro</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">Teste diferentes cenários e veja como cada decisão impacta sua meta</p>
      </Card>

      {/* Custom Parameters */}
      <Card className="glass-card p-4 lg:p-6 space-y-3 lg:space-y-4">
        <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground">Monte sua simulação</h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
          <CurrencyInput id="sim-wealth" label="Quanto já tem" value={customWealth} onChange={setCustomWealth} />
          <CurrencyInput id="sim-monthly" label="Aporte por mês" value={customMonthly} onChange={setCustomMonthly} />
          <CurrencyInput id="sim-extra" label="Aporte extra/mês" value={customExtra} onChange={setCustomExtra} />
          <div>
            <Label htmlFor="sim-rate" className="text-xs sm:text-sm">Rendimento a.a. (%)</Label>
            <Input id="sim-rate" type="number" step={0.5} min={0} max={30}
              value={customRate} onChange={(e) => setCustomRate(Number(e.target.value) || 0)}
              className="text-right h-9 lg:h-10 text-sm" />
          </div>
        </div>

        {/* Custom Result */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 pt-3 border-t border-border/30">
          <ResultCard label="Patrimônio estimado" value={formatBRLCompact(custom.finalWealth)} sub="Valor nominal" icon={TrendingUp} />
          <ResultCard label="Valor real (hoje)" value={formatBRLCompact(custom.realWealth)} sub={`Descontando ${customInflation}% de inflação`} icon={DollarSign} />
          <ResultCard label="Renda passiva" value={`${formatBRL(custom.passiveIncome4pct)}/mês`} sub="Com retirada de 4% ao ano" icon={ArrowUpRight} />
          <ResultCard label="Quando chega na meta" value={custom.monthsToTarget ? `${Math.ceil(custom.monthsToTarget / 12)} anos` : "Não atinge no prazo"} sub={custom.monthsToTarget ? `${custom.monthsToTarget} meses` : "Aumente o aporte"} icon={Clock} />
        </div>
      </Card>

      {/* Pre-built Scenarios */}
      <Card className="glass-card p-4 lg:p-6">
        <h4 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-muted-foreground mb-1">Compare cenários</h4>
        <p className="text-xs text-muted-foreground mb-3">Veja como acelerar ou o impacto de reduzir seus aportes</p>
        <div className="space-y-2 lg:space-y-3">
          {scenarios.map((s, i) => (
            <ScenarioRow key={i} scenario={s} baseMonths={scenarios[2]?.monthsToTarget} />
          ))}
        </div>
      </Card>

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
