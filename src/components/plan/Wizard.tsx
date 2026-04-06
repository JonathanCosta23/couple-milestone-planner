import { useState } from "react";
import { PlanConfig, DEFAULT_CONFIG, formatBRL, formatPercent } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { ArrowRight, ArrowLeft, Check, HelpCircle, Users, Target, CalendarCheck } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface WizardProps {
  onComplete: (config: PlanConfig) => void;
}

function Tip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="w-4 h-4 text-muted-foreground inline ml-1 cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm">{text}</TooltipContent>
    </Tooltip>
  );
}

function CurrencyInput({ value, onChange, id }: { value: number; onChange: (v: number) => void; id: string }) {
  const formatToDisplay = (val: number): string => {
    if (!val) return "";
    return val.toLocaleString("pt-BR");
  };

  const parseFromDisplay = (raw: string): number => {
    const cleaned = raw.replace(/\D/g, "");
    return Number(cleaned) || 0;
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
      <Input
        id={id}
        type="text"
        inputMode="numeric"
        value={formatToDisplay(value)}
        onChange={(e) => onChange(parseFromDisplay(e.target.value))}
        className="text-right pl-10"
      />
    </div>
  );
}

export function Wizard({ onComplete }: WizardProps) {
  const [step, setStep] = useState(0);
  const [showSecond, setShowSecond] = useState(false);
  const [config, setConfig] = useState<PlanConfig>({
    ...DEFAULT_CONFIG,
    contributors: [
      { ...DEFAULT_CONFIG.contributors[0] },
      { name: "", plannedSelic: 0, plannedCDB: 0, age: 25 },
    ],
  });

  const steps = [
    { icon: Target, label: "Meta e Prazo" },
    { icon: Users, label: "Aportes Mensais" },
    { icon: CalendarCheck, label: "Confirmar" },
  ];

  const totalMonthly =
    config.contributors[0].plannedSelic +
    config.contributors[0].plannedCDB +
    config.contributors[1].plannedSelic +
    config.contributors[1].plannedCDB;

  return (
    <div className="max-w-lg mx-auto px-4">
      {/* Progress */}
      <div className="flex items-center justify-center gap-2 mb-8">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center gap-2">
            <div
              className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
                i <= step ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {i < step ? <Check className="w-4 h-4" /> : i + 1}
            </div>
            <span className="hidden sm:inline text-sm text-muted-foreground">{s.label}</span>
            {i < steps.length - 1 && <div className={`w-8 h-0.5 ${i < step ? "bg-primary" : "bg-border"}`} />}
          </div>
        ))}
      </div>

      <Card className="glass-card-strong p-6 animate-fade-in-up">
        {step === 0 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold">Meta e Prazo</h2>
            <div className="grid gap-4">
              <div>
                <Label htmlFor="initial">
                  Valor inicial
                  <Tip text="Quanto vocês já têm investido ou podem aportar de imediato." />
                </Label>
                <CurrencyInput
                  id="initial"
                  value={config.initialAmount}
                  onChange={(v) => setConfig({ ...config, initialAmount: v })}
                />
              </div>
              <div>
                <Label htmlFor="target">
                  Meta
                  <Tip text="Objetivo financeiro do casal." />
                </Label>
                <CurrencyInput
                  id="target"
                  value={config.targetAmount}
                  onChange={(v) => setConfig({ ...config, targetAmount: v })}
                />
              </div>
              <div>
                <Label htmlFor="years">Prazo (anos)</Label>
                <Input
                  id="years"
                  type="number"
                  min={1}
                  max={50}
                  value={config.years}
                  onChange={(e) => setConfig({ ...config, years: Number(e.target.value) || 20 })}
                  className="text-right"
                />
              </div>
              <div>
                <Label htmlFor="selic">
                  Taxa Selic (a.a.)
                  <Tip text="Taxa básica de juros. O Tesouro Selic rende aproximadamente essa taxa. Ex: 13,15%." />
                </Label>
                <Input
                  id="selic"
                  type="number"
                  step={0.01}
                  min={0}
                  value={(config.selicRate * 100).toFixed(2)}
                  onChange={(e) => setConfig({ ...config, selicRate: (Number(e.target.value) || 0) / 100 })}
                  className="text-right"
                />
              </div>
              <div>
                <Label htmlFor="cdb">
                  CDB (% do CDI)
                  <Tip text="Quanto o CDB paga em relação ao CDI. Ex: 100% = rende igual ao CDI. CDI ≈ Selic." />
                </Label>
                <Input
                  id="cdb"
                  type="number"
                  step={1}
                  min={0}
                  value={(config.cdbRate * 100).toFixed(0)}
                  onChange={(e) => setConfig({ ...config, cdbRate: (Number(e.target.value) || 0) / 100 })}
                  className="text-right"
                />
              </div>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold">Aportes Mensais por Pessoa</h2>
            {config.contributors.map((c, idx) => {
              if (idx === 1 && !showSecond) return null;
              return (
                <div key={idx} className="p-4 rounded-xl bg-muted/50 space-y-3 relative">
                  {idx === 1 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="absolute top-2 right-2 h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => {
                        const updated = [...config.contributors] as [Contributor, Contributor];
                        updated[1] = { name: "", plannedSelic: 0, plannedCDB: 0, age: 25 };
                        setConfig({ ...config, contributors: updated });
                        setShowSecond(false);
                      }}
                    >
                      <Trash2 className="w-3 h-3 mr-1" /> Remover
                    </Button>
                  )}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`name-${idx}`}>Nome</Label>
                      <Input
                        id={`name-${idx}`}
                        value={c.name}
                        onChange={(e) => {
                          const updated = [...config.contributors] as [Contributor, Contributor];
                          updated[idx] = { ...c, name: e.target.value };
                          setConfig({ ...config, contributors: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`age-${idx}`}>
                        Idade
                        <Tip text="Sua idade atual. Usada para projetar patrimônio por idade." />
                      </Label>
                      <Input
                        id={`age-${idx}`}
                        type="number"
                        min={16}
                        max={80}
                        value={c.age || 25}
                        onChange={(e) => {
                          const updated = [...config.contributors] as [Contributor, Contributor];
                          updated[idx] = { ...c, age: Number(e.target.value) || 25 };
                          setConfig({ ...config, contributors: updated });
                        }}
                        className="text-right"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label htmlFor={`selic-${idx}`}>
                        Selic (R$)
                        <Tip text="Aporte mensal no Tesouro Selic. Tem alta liquidez — pode resgatar a qualquer momento." />
                      </Label>
                      <CurrencyInput
                        id={`selic-${idx}`}
                        value={c.plannedSelic}
                        onChange={(v) => {
                          const updated = [...config.contributors] as [Contributor, Contributor];
                          updated[idx] = { ...c, plannedSelic: v };
                          setConfig({ ...config, contributors: updated });
                        }}
                      />
                    </div>
                    <div>
                      <Label htmlFor={`cdb-${idx}`}>
                        CDB (R$)
                        <Tip text="Aporte mensal em CDB. Geralmente tem prazo de carência. Pode render mais que a Selic." />
                      </Label>
                      <CurrencyInput
                        id={`cdb-${idx}`}
                        value={c.plannedCDB}
                        onChange={(v) => {
                          const updated = [...config.contributors] as [Contributor, Contributor];
                          updated[idx] = { ...c, plannedCDB: v };
                          setConfig({ ...config, contributors: updated });
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {!showSecond && (
              <Button
                variant="outline"
                className="w-full border-dashed"
                onClick={() => setShowSecond(true)}
              >
                <UserPlus className="w-4 h-4 mr-2" /> Adicionar outra pessoa
              </Button>
            )}

            <p className="text-sm text-muted-foreground text-center">
              Aporte combinado: <strong className="text-foreground">{formatBRL(totalMonthly)}/mês</strong>
            </p>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5">
            <h2 className="text-xl font-bold">Resumo do Plano</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Valor inicial</span>
                <span className="font-semibold">{formatBRL(config.initialAmount)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Meta</span>
                <span className="font-semibold">{formatBRL(config.targetAmount)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Prazo</span>
                <span className="font-semibold">{config.years} anos ({config.years * 12} meses)</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">Selic a.a.</span>
                <span className="font-semibold">{formatPercent(config.selicRate)}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-muted-foreground">CDB (% CDI)</span>
                <span className="font-semibold">{formatPercent(config.cdbRate)}</span>
              </div>
              {config.contributors.map((c, i) => (
                <div key={i} className="flex justify-between py-2 border-b border-border/50">
                  <span className="text-muted-foreground">{c.name}</span>
                  <span className="font-semibold">
                    {formatBRL(c.plannedSelic)} Selic + {formatBRL(c.plannedCDB)} CDB
                  </span>
                </div>
              ))}
              <div className="flex justify-between py-2">
                <span className="text-muted-foreground font-medium">Total mensal</span>
                <span className="font-bold text-primary">{formatBRL(totalMonthly)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6 pt-4 border-t border-border/50">
          <Button variant="ghost" onClick={() => setStep(step - 1)} disabled={step === 0}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
          </Button>
          {step < 2 ? (
            <Button onClick={() => setStep(step + 1)}>
              Próximo <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={() => onComplete(config)}>
              <Check className="w-4 h-4 mr-1" /> Começar!
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
