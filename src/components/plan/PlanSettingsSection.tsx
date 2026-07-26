/**
 * PlanSettingsSection — edição oficial do plano (Configurações → Plano e meta).
 *
 * Persiste em nuvem (plans) via `onSave` e também atualiza o estado local do app
 * para que Home, Simulador e Projeção reflitam imediatamente. Não altera nomes
 * de membros nem toca em tracking mensal.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronDown, Loader2, Target } from "lucide-react";
import {
  EmotionalGoal,
  EMOTIONAL_GOAL_LABELS,
  formatBRL,
} from "@/lib/types";
import { toast } from "sonner";
import { toFriendlyError } from "@/lib/errors/friendlyError";
import { parseBRLCurrency, formatBRLCurrencyInput } from "@/lib/utils/currencyBR";

export interface PlanSettingsPatch {
  goalAmount: number;
  initialAmount: number;
  monthlyContribution: number;
  goalYears: number;
  goalPurpose: EmotionalGoal;
  goalPurposeCustom?: string;
}

export interface PlanSettingsInitial {
  goalAmount: number;
  initialAmount: number;
  monthlyContribution: number;
  goalYears: number;
  goalPurpose: EmotionalGoal;
  goalPurposeCustom?: string;
}

interface Props {
  initial: PlanSettingsInitial;
  onSave: (patch: PlanSettingsPatch) => Promise<void>;
  /** Abrir automaticamente (deep-link "Ajustar plano"). */
  autoExpand?: boolean;
  /** Chamado quando o auto-expand foi consumido, para limpar o foco global. */
  onAutoExpandConsumed?: () => void;
  /** Quando `false`, o botão de salvar é bloqueado (plano cloud ainda não pronto). */
  cloudReady?: boolean;
}

interface FieldErrors {
  goalAmount?: string;
  initialAmount?: string;
  monthlyContribution?: string;
  goalYears?: string;
  goalPurposeCustom?: string;
}

export function PlanSettingsSection({
  initial,
  onSave,
  autoExpand,
  onAutoExpandConsumed,
  cloudReady = true,
}: Props) {
  const [open, setOpen] = useState(!!autoExpand);
  // Campos monetários armazenados como string para respeitar o que o usuário
  // digita (ex.: "1.000,50"); a conversão só ocorre no submit.
  const [goalAmountStr, setGoalAmountStr] = useState(
    formatBRLCurrencyInput(initial.goalAmount),
  );
  const [initialAmountStr, setInitialAmountStr] = useState(
    formatBRLCurrencyInput(initial.initialAmount),
  );
  const [monthlyContributionStr, setMonthlyContributionStr] = useState(
    formatBRLCurrencyInput(initial.monthlyContribution),
  );
  const [goalYears, setGoalYears] = useState<number>(initial.goalYears);
  const [goalPurpose, setGoalPurpose] = useState<EmotionalGoal>(
    initial.goalPurpose,
  );
  const [goalPurposeCustom, setGoalPurposeCustom] = useState(
    initial.goalPurposeCustom ?? "",
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Auto-expandir e rolar até a seção quando vier deep-link.
  useEffect(() => {
    if (!autoExpand) return;
    setOpen(true);
    // Scroll suave após o próximo paint.
    const t = window.setTimeout(() => {
      if (typeof rootRef.current?.scrollIntoView === "function") {
        rootRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      onAutoExpandConsumed?.();
    }, 60);
    return () => window.clearTimeout(t);
  }, [autoExpand, onAutoExpandConsumed]);

  // Ressincroniza campos se os valores iniciais mudarem (ex.: outro dispositivo).
  useEffect(() => {
    setGoalAmountStr(formatBRLCurrencyInput(initial.goalAmount));
    setInitialAmountStr(formatBRLCurrencyInput(initial.initialAmount));
    setMonthlyContributionStr(formatBRLCurrencyInput(initial.monthlyContribution));
    setGoalYears(initial.goalYears);
    setGoalPurpose(initial.goalPurpose);
    setGoalPurposeCustom(initial.goalPurposeCustom ?? "");
  }, [
    initial.goalAmount,
    initial.initialAmount,
    initial.monthlyContribution,
    initial.goalYears,
    initial.goalPurpose,
    initial.goalPurposeCustom,
  ]);

  const summary = useMemo(
    () =>
      `${formatBRL(initial.goalAmount)} em ${initial.goalYears} ${
        initial.goalYears === 1 ? "ano" : "anos"
      }`,
    [initial.goalAmount, initial.goalYears],
  );

  interface Parsed {
    goalAmount: number;
    initialAmount: number;
    monthlyContribution: number;
    errors: FieldErrors;
  }

  function parseAndValidate(): Parsed {
    const errs: FieldErrors = {};

    const goal = parseBRLCurrency(goalAmountStr);
    let goalAmount = 0;
    if (goal.error) errs.goalAmount = goal.error;
    else if (goal.value === null || goal.value <= 0)
      errs.goalAmount = "Informe uma meta maior que zero.";
    else goalAmount = goal.value;

    const initialP = parseBRLCurrency(initialAmountStr);
    let initialAmount = 0;
    if (initialP.error) errs.initialAmount = initialP.error;
    else if (initialP.value === null) initialAmount = 0;
    else if (initialP.value < 0) errs.initialAmount = "Não pode ser negativo.";
    else initialAmount = initialP.value;

    const monthlyP = parseBRLCurrency(monthlyContributionStr);
    let monthlyContribution = 0;
    if (monthlyP.error) errs.monthlyContribution = monthlyP.error;
    else if (monthlyP.value === null) monthlyContribution = 0;
    else if (monthlyP.value < 0)
      errs.monthlyContribution = "Não pode ser negativo.";
    else monthlyContribution = monthlyP.value;

    if (
      !Number.isInteger(goalYears) ||
      !Number.isFinite(goalYears) ||
      goalYears < 1 ||
      goalYears > 50
    ) {
      errs.goalYears = "Escolha entre 1 e 50 anos.";
    }
    if (goalPurpose === "outro" && !goalPurposeCustom.trim())
      errs.goalPurposeCustom = "Descreva o propósito da meta.";
    return { goalAmount, initialAmount, monthlyContribution, errors: errs };
  }

  async function handleSubmit() {
    if (!cloudReady) {
      toast.error(
        "Seu plano ainda está sendo carregado. Aguarde e tente novamente.",
      );
      return;
    }
    const parsed = parseAndValidate();
    setErrors(parsed.errors);
    if (Object.keys(parsed.errors).length > 0) return;
    setSaving(true);
    try {
      await onSave({
        goalAmount: parsed.goalAmount,
        initialAmount: parsed.initialAmount,
        monthlyContribution: parsed.monthlyContribution,
        goalYears,
        goalPurpose,
        goalPurposeCustom:
          goalPurpose === "outro" ? goalPurposeCustom.trim() : undefined,
      });
      // Toast só após confirmação cloud (onSave resolveu sem lançar).
      toast.success("Plano atualizado.");
      setOpen(false);
    } catch (e) {
      toast.error(`Não foi possível salvar: ${toFriendlyError(e)}`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div ref={rootRef} data-testid="plan-settings-section" className="space-y-2">
      <Button
        variant="outline"
        className="w-full justify-between h-12 rounded-xl"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span className="flex items-center">
          <Target className="w-4 h-4 mr-2.5" /> Plano e meta
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            {summary}
          </span>
        </span>
        <ChevronDown
          className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </Button>

      {open && (
        <Card className="p-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="plan-goal-amount">Meta patrimonial</Label>
              <Input
                id="plan-goal-amount"
                inputMode="decimal"
                autoComplete="off"
                value={goalAmountStr}
                onChange={(e) => setGoalAmountStr(e.target.value)}
                aria-invalid={!!errors.goalAmount}
                aria-describedby={errors.goalAmount ? "err-goal-amount" : undefined}
              />
              {errors.goalAmount && (
                <p id="err-goal-amount" className="text-xs text-destructive">
                  {errors.goalAmount}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-goal-years">Prazo (anos)</Label>
              <Input
                id="plan-goal-years"
                type="number"
                min={1}
                max={50}
                step={1}
                value={Number.isFinite(goalYears) ? goalYears : ""}
                onChange={(e) =>
                  setGoalYears(Math.floor(Number(e.target.value) || 0))
                }
                aria-invalid={!!errors.goalYears}
                aria-describedby={errors.goalYears ? "err-goal-years" : undefined}
              />
              {errors.goalYears && (
                <p id="err-goal-years" className="text-xs text-destructive">
                  {errors.goalYears}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-initial">Patrimônio inicial</Label>
              <Input
                id="plan-initial"
                inputMode="decimal"
                autoComplete="off"
                value={initialAmountStr}
                onChange={(e) => setInitialAmountStr(e.target.value)}
                aria-invalid={!!errors.initialAmount}
              />
              {errors.initialAmount && (
                <p className="text-xs text-destructive">{errors.initialAmount}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="plan-monthly">Aporte mensal planejado</Label>
              <Input
                id="plan-monthly"
                inputMode="decimal"
                autoComplete="off"
                value={monthlyContributionStr}
                onChange={(e) => setMonthlyContributionStr(e.target.value)}
                aria-invalid={!!errors.monthlyContribution}
              />
              {errors.monthlyContribution && (
                <p className="text-xs text-destructive">
                  {errors.monthlyContribution}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="plan-purpose">Propósito da meta</Label>
            <select
              id="plan-purpose"
              className="w-full h-11 rounded-lg border border-input bg-background px-3 text-sm"
              value={goalPurpose}
              onChange={(e) => setGoalPurpose(e.target.value as EmotionalGoal)}
            >
              {(Object.keys(EMOTIONAL_GOAL_LABELS) as EmotionalGoal[]).map(
                (k) => (
                  <option key={k} value={k}>
                    {EMOTIONAL_GOAL_LABELS[k]}
                  </option>
                ),
              )}
            </select>
          </div>

          {goalPurpose === "outro" && (
            <div className="space-y-1.5">
              <Label htmlFor="plan-purpose-custom">Descreva o propósito</Label>
              <Input
                id="plan-purpose-custom"
                maxLength={80}
                value={goalPurposeCustom}
                onChange={(e) => setGoalPurposeCustom(e.target.value)}
                aria-invalid={!!errors.goalPurposeCustom}
              />
              {errors.goalPurposeCustom && (
                <p className="text-xs text-destructive">
                  {errors.goalPurposeCustom}
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-muted-foreground">
            Alterar os campos aqui atualiza o plano oficial em Home, Simulador e
            Projeção. Simulações não alteram estes valores.
          </p>

          {!cloudReady && (
            <p
              className="text-xs text-warning"
              role="status"
              data-testid="plan-settings-cloud-loading"
            >
              Seu plano ainda está sendo carregado. Aguarde alguns segundos e
              tente novamente.
            </p>
          )}

          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={saving || !cloudReady}
              title={
                !cloudReady
                  ? "Aguarde o plano oficial carregar para salvar."
                  : undefined
              }
            >
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {saving ? "Salvando…" : "Salvar plano"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}