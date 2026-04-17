import { useState } from "react";
import { PlanConfig, MonthDeposit, EMPTY_DEPOSIT, formatBRL, getCurrentMonthKey, monthKeyToFullLabel } from "@/lib/types";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { DollarSign, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { MonthRecord } from "@/lib/types";

interface QuickDepositProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  onUpdateMonth: (monthKey: string, contributorIndex: number, deposit: MonthDeposit) => void;
  onToggleCompleted: (monthKey: string) => void;
}

const DOT_COLORS = ["bg-primary", "bg-accent", "bg-chart-3", "bg-chart-4", "bg-chart-5"];

export function QuickDeposit({ open, onOpenChange, config, monthRecords, onUpdateMonth, onToggleCompleted }: QuickDepositProps) {
  const currentKey = getCurrentMonthKey();
  const record = monthRecords.find((r) => r.monthKey === currentKey);

  const [values, setValues] = useState<number[]>(() =>
    config.contributors.map((_, i) => {
      const d = record?.deposits[i] || { ...EMPTY_DEPOSIT };
      return (d.actualSelic + d.actualCDB) || 0;
    })
  );
  const [markComplete, setMarkComplete] = useState(!!record?.completed);

  const handleSave = () => {
    config.contributors.forEach((c, i) => {
      const hasPlan = c.plannedSelic > 0 || c.plannedCDB > 0;
      if (!hasPlan) return;
      const val = values[i] || 0;
      const totalPlanned = c.plannedSelic + c.plannedCDB;
      const selicRatio = totalPlanned > 0 ? c.plannedSelic / totalPlanned : 1;
      onUpdateMonth(currentKey, i, {
        actualSelic: Math.round(val * selicRatio),
        actualCDB: Math.round(val * (1 - selicRatio)),
      });
    });

    if (markComplete && !record?.completed) {
      onToggleCompleted(currentKey);
    }

    toast.success("Aporte registrado! 🎉");
    onOpenChange(false);
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      title={
        <span className="flex items-center gap-2">
          <DollarSign className="w-5 h-5 text-primary" />
          Registrar aporte
        </span>
      }
      description={monthKeyToFullLabel(currentKey)}
      maxWidth="max-w-sm"
    >
      <div className="space-y-4 pt-2">
        {config.contributors.map((c, i) => {
          const hasPlan = c.plannedSelic > 0 || c.plannedCDB > 0;
          if (!hasPlan) return null;
          return (
            <div key={i} className="space-y-1.5">
              <Label className="text-sm flex items-center gap-2">
                <span className={`w-2 h-2 rounded-full shrink-0 ${DOT_COLORS[i % DOT_COLORS.length]}`} />
                <span className="truncate">{c.name || `Pessoa ${i + 1}`}</span>
                <span className="text-xs text-muted-foreground ml-auto shrink-0">
                  Meta: {formatBRL(c.plannedSelic + c.plannedCDB)}
                </span>
              </Label>
              <Input
                type="number"
                inputMode="decimal"
                min={0}
                step={100}
                value={values[i] || ""}
                placeholder="0"
                onChange={(e) => {
                  const newVals = [...values];
                  newVals[i] = Number(e.target.value) || 0;
                  setValues(newVals);
                }}
                className="text-right h-12 lg:h-10 text-base lg:text-sm"
              />
            </div>
          );
        })}

        <div className="flex items-center justify-between gap-3 py-2">
          <Label htmlFor="quick-complete" className="text-sm flex items-center gap-2 cursor-pointer min-h-[32px]">
            <CheckCircle2 className={`w-4 h-4 ${markComplete ? "text-primary" : "text-muted-foreground"}`} />
            Marcar mês como concluído
          </Label>
          <Switch
            id="quick-complete"
            checked={markComplete}
            onCheckedChange={setMarkComplete}
          />
        </div>

        <Button className="w-full h-12 lg:h-10 text-base lg:text-sm" onClick={handleSave}>
          <DollarSign className="w-4 h-4 mr-1" /> Salvar aporte
        </Button>
      </div>
    </ResponsiveModal>
  );
}
