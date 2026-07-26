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
}

interface FieldErrors {
  goalAmount?: string;
  initialAmount?: string;
  monthlyContribution?: string;
  goalYears?: string;
  goalPurposeCustom?: string;
}

/** Máscara BRL para inputs numéricos. Aceita apenas dígitos e retorna o número. */
function parseBRL(raw: string): number {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return 0;
  return Number(digits);
}

function formatBRLInput(value: number): string {
  if (!value) return "";
  return value.toLocaleString("pt-BR");
}

export function PlanSettingsSection({
  initial,
  onSave,
  autoExpand,
  onAutoExpandConsumed,
}: Props) {
  const [open, setOpen] = useState(!!autoExpand);
  const [goalAmount, setGoalAmount] = useState(initial.goalAmount);
  const [initialAmount, setInitialAmount] = useState(initial.initialAmount);
  const [monthlyContribution, setMonthlyContribution] = useState(
    initial.monthlyContribution,
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
      rootRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      onAutoExpandConsumed?.();
    }, 60);
    return () => window.clearTimeout(t);
  }, [autoExpand, onAutoExpandConsumed]);

  // Ressincroniza campos se os valores iniciais mudarem (ex.: outro dispositivo).
  useEffect(() => {
    setGoalAmount(initial.goalAmount);
    setInitialAmount(initial.initialAmount);
    setMonthlyContribution(initial.monthlyContribution);
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

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!(goalAmount > 0)) next.goalAmount = "Informe uma meta maior que zero.";
    if (initialAmount < 0) next.initialAmount = "Não pode ser negativo.";
    if (monthlyContribution < 0)
      next.monthlyContribution = "Não pode ser negativo.";
    if (!Number.isInteger(goalYears) || goalYears < 1 || goalYears > 50)
      next.goalYears = "Escolha entre 1 e 50 anos.";
    if (goalPurpose === "outro" && !goalPurposeCustom.trim())
      next.goalPurposeCustom = "Descreva o propósito da meta.";
    return next;
  }

  async function handleSubmit() {
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    setSaving(true);
    try {
      await onSave({
        goalAmount,
        initialAmount,
        monthlyContribution,
        goalYears,
        goalPurpose,
        goalPurposeCustom:
          goalPurpose === "outro" ? goalPurposeCustom.trim() : undefined,
      });
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
                inputMode="numeric"
                autoComplete="off"
                value={formatBRLInput(goalAmount)}
                onChange={(e) => setGoalAmount(parseBRL(e.target.value))}
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
                inputMode="numeric"
                autoComplete="off"
                value={formatBRLInput(initialAmount)}
                onChange={(e) => setInitialAmount(parseBRL(e.target.value))}
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
                inputMode="numeric"
                autoComplete="off"
                value={formatBRLInput(monthlyContribution)}
                onChange={(e) =>
                  setMonthlyContribution(parseBRL(e.target.value))
                }
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

          <div className="flex gap-2 justify-end">
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
              {saving ? "Salvando…" : "Salvar plano"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}