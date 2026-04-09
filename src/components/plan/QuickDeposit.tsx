import { useState, useEffect } from "react";
import { PlanConfig, MonthDeposit, EMPTY_DEPOSIT, formatBRL, getCurrentMonthKey, monthKeyToFullLabel } from "@/lib/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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

  const [values, setValues] = useState<number[]>([]);
  const [markComplete, setMarkComplete] = useState(false);

  // Refresh values every time dialog opens
  useEffect(() => {
    if (open) {
      setValues(
        config.contributors.map((_, i) => {
          const d = record?.deposits[i] || { ...EMPTY_DEPOSIT };
          return (d.actualSelic + d.actualCDB) || 0;
        })
      );
      setMarkComplete(!!record?.completed);
    }
  }, [open, config.contributors, record]);

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

    toast.success("Depósito registrado! 🎉");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-card-strong max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-primary" />
            Registrar Depósito
          </DialogTitle>
          <p className="text-xs text-muted-foreground">{monthKeyToFullLabel(currentKey)}</p>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {config.contributors.map((c, i) => {
            const hasPlan = c.plannedSelic > 0 || c.plannedCDB > 0;
            if (!hasPlan) return null;
            return (
              <div key={i} className="space-y-1.5">
                <Label className="text-sm flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${DOT_COLORS[i % DOT_COLORS.length]}`} />
                  {c.name || `Pessoa ${i + 1}`}
                  <span className="text-xs text-muted-foreground ml-auto">
                    Meta: {formatBRL(c.plannedSelic + c.plannedCDB)}
                  </span>
                </Label>
                <Input
                  type="number"
                  min={0}
                  step={100}
                  value={values[i] || ""}
                  placeholder="0"
                  onChange={(e) => {
                    const newVals = [...values];
                    newVals[i] = Number(e.target.value) || 0;
                    setValues(newVals);
                  }}
                  className="text-right"
                />
              </div>
            );
          })}

          <div className="flex items-center justify-between py-2">
            <Label htmlFor="quick-complete" className="text-sm flex items-center gap-2 cursor-pointer">
              <CheckCircle2 className={`w-4 h-4 ${markComplete ? "text-primary" : "text-muted-foreground"}`} />
              Marcar mês como concluído
            </Label>
            <Switch
              id="quick-complete"
              checked={markComplete}
              onCheckedChange={setMarkComplete}
            />
          </div>

          <Button className="w-full" onClick={handleSave}>
            <DollarSign className="w-4 h-4 mr-1" /> Salvar depósito
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
