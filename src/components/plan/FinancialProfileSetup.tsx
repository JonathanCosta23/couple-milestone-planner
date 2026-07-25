import { useState } from "react";
import { PlanConfig, FinancialProfile, EmotionalGoal, EMOTIONAL_GOAL_LABELS, formatBRL } from "@/lib/types";
import { getEmergencyFundGoal, getEmergencyFundStatus, getSavingsRate, getFinancialSafetyMonths } from "@/lib/calculator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Shield, Heart, Wallet, PiggyBank, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FinancialProfileSetupProps {
  config: PlanConfig;
  profile?: FinancialProfile;
  emotionalGoal?: EmotionalGoal;
  emotionalGoalCustom?: string;
  onSave: (profile: FinancialProfile, goal: EmotionalGoal, customGoal?: string) => void;
  onSkip: () => void;
}

function Tip({ text }: { text: string }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <HelpCircle className="w-3.5 h-3.5 text-muted-foreground inline ml-1 cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-xs text-sm">{text}</TooltipContent>
    </Tooltip>
  );
}

export function FinancialProfileSetup({ config, profile: initialProfile, emotionalGoal: initialGoal, emotionalGoalCustom: initialCustom, onSave, onSkip }: FinancialProfileSetupProps) {
  const [profile, setProfile] = useState<FinancialProfile>(initialProfile || {});
  const [goal, setGoal] = useState<EmotionalGoal>(initialGoal || "liberdade-financeira");
  const [customGoal, setCustomGoal] = useState(initialCustom || "");

  const isCouple = config.contributors.length > 1;

  const emergencyGoal = getEmergencyFundGoal(profile);
  const emergencyStatus = getEmergencyFundStatus(profile);
  const savingsRate = getSavingsRate(profile, config);
  const safetyMonths = getFinancialSafetyMonths(profile);
  const emergencyProgress = emergencyGoal > 0 ? Math.min(1, (profile.emergencyFund || 0) / emergencyGoal) : 0;

  const goals = Object.entries(EMOTIONAL_GOAL_LABELS) as [EmotionalGoal, string][];

  return (
    <div className="max-w-lg mx-auto px-4 space-y-6 animate-fade-in-up">
      <Card className="glass-card-strong p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Wallet className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Perfil Financeiro</h2>
          </div>
          <p className="text-sm text-muted-foreground">Opcional. Isso ajuda a gerar insights personalizados sobre suas finanças.</p>

          <div className="grid gap-4">
            <div>
              <Label htmlFor="income-j">
                Renda mensal — {config.contributors[0]?.name || "Você"}
                <Tip text="Salário líquido ou renda mensal total." />
              </Label>
              <Input
                id="income-j"
                type="number"
                min={0}
                step={500}
                value={profile.incomePrimary || ""}
                placeholder="Opcional"
                onChange={(e) => setProfile({ ...profile, incomePrimary: Number(e.target.value) || undefined })}
                className="text-right"
              />
            </div>
            {config.contributors[1] && (
              <div>
                <Label htmlFor="income-i">
                  Renda mensal — {config.contributors[1].name || "Parceiro(a)"}
                  <Tip text="Salário líquido ou renda mensal total." />
                </Label>
                <Input
                  id="income-i"
                  type="number"
                  min={0}
                  step={500}
                  value={profile.incomePartner || ""}
                  placeholder="Opcional"
                  onChange={(e) => setProfile({ ...profile, incomePartner: Number(e.target.value) || undefined })}
                  className="text-right"
                />
              </div>
            )}
            <div>
              <Label htmlFor="expenses">
                {isCouple ? "Despesas mensais do casal" : "Suas despesas mensais"}
                <Tip text={isCouple ? "Gastos fixos + variáveis do casal: aluguel, contas, alimentação, transporte, lazer, etc." : "Seus gastos fixos + variáveis: aluguel, contas, alimentação, transporte, lazer, etc."} />
              </Label>
              <Input
                id="expenses"
                type="number"
                min={0}
                step={500}
                value={profile.monthlyExpenses || ""}
                placeholder="Opcional"
                onChange={(e) => setProfile({ ...profile, monthlyExpenses: Number(e.target.value) || undefined })}
                className="text-right"
              />
            </div>
            <div>
              <Label htmlFor="emergency">
                Reserva de emergência atual
                <Tip text={isCouple ? "Quanto vocês já têm guardado para imprevistos (acidentes, desemprego, etc)." : "Quanto você já tem guardado para imprevistos (acidentes, desemprego, etc)."} />
              </Label>
              <Input
                id="emergency"
                type="number"
                min={0}
                step={1000}
                value={profile.emergencyFund || ""}
                placeholder="Opcional"
                onChange={(e) => setProfile({ ...profile, emergencyFund: Number(e.target.value) || undefined })}
                className="text-right"
              />
            </div>
          </div>

          {/* Emergency Fund Status */}
          {(profile.monthlyExpenses || 0) > 0 && (
            <Card className="p-4 bg-muted/30 space-y-2">
              <div className="flex items-center gap-2">
                <Shield className={`w-4 h-4 ${emergencyStatus === "completed" ? "text-primary" : emergencyStatus === "in-progress" ? "text-warning" : "text-destructive"}`} />
                <span className="text-sm font-medium">
                  {isCouple ? "Reserva de Emergência do casal" : "Reserva de Emergência"}: {
                    emergencyStatus === "completed" ? "Completa ✓" :
                    emergencyStatus === "in-progress" ? "Em progresso" : "Abaixo do ideal"
                  }
                </span>
              </div>
              <Progress value={emergencyProgress * 100} className="h-2" />
              <p className="text-xs text-muted-foreground">
                Meta: {formatBRL(emergencyGoal)} (6 meses {isCouple ? "das despesas do casal" : "das suas despesas"}) · Atual: {formatBRL(profile.emergencyFund || 0)}
              </p>
              {emergencyStatus !== "completed" && (
                <p className="text-xs text-muted-foreground italic">
                  💡 Investimentos de longo prazo começam após a reserva de emergência.
                </p>
              )}
            </Card>
          )}

          {/* Quick insights */}
          {((profile.incomePrimary || 0) > 0 || (profile.incomePartner || 0) > 0) && (
            <div className="grid grid-cols-2 gap-3">
              <Card className="p-3 bg-muted/30 text-center">
                <p className="text-[10px] text-muted-foreground uppercase">Taxa de Poupança</p>
                <p className="text-lg font-bold text-primary">{(savingsRate * 100).toFixed(0)}%</p>
              </Card>
              {safetyMonths > 0 && (
                <Card className="p-3 bg-muted/30 text-center">
                  <p className="text-[10px] text-muted-foreground uppercase">Segurança</p>
                  <p className="text-lg font-bold">{safetyMonths.toFixed(1)} meses</p>
                </Card>
              )}
            </div>
          )}
      </Card>

      <Card className="glass-card-strong p-6 space-y-5">
          <div className="flex items-center gap-2">
            <Heart className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">Para que é o milhão?</h2>
          </div>
          <p className="text-sm text-muted-foreground">Ter um propósito claro ajuda a manter a disciplina nos aportes.</p>

          <div className="grid grid-cols-2 gap-2">
            {goals.map(([key, label]) => (
              <button
                key={key}
                onClick={() => setGoal(key)}
                className={`p-3 rounded-xl text-sm font-medium border transition-all text-left ${
                  goal === key
                    ? "bg-primary/15 border-primary/40 text-foreground"
                    : "bg-muted/30 border-border hover:border-primary/20 text-muted-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {goal === "outro" && (
            <Input
              placeholder="Descreva seu objetivo..."
              value={customGoal}
              onChange={(e) => setCustomGoal(e.target.value)}
            />
          )}
      </Card>

      <div className="flex justify-between pt-2">
        <Button variant="ghost" size="sm" onClick={onSkip}>Pular</Button>
        <Button onClick={() => onSave(profile, goal, customGoal)}>
          <PiggyBank className="w-4 h-4 mr-1" /> Salvar perfil
        </Button>
      </div>
    </div>
  );
}
