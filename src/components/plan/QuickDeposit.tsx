import { useState } from "react";
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
  onUpdateMonth: (monthKey: string, contributorIndex: 0 | 1, deposit: MonthDeposit) => void;
  onToggleCompleted: (monthKey: string) => void;
}

export function QuickDeposit({ open, onOpenChange, config, monthRecords, onUpdateMonth, onToggleCompleted }: QuickDepositProps) {
  const currentKey = getCurrentMonthKey();
  const record = monthRecords.find((r) => r.monthKey === currentKey);
  const d0 = record?.deposits[0] || { ...EMPTY_DEPOSIT };
  const d1 = record?.deposits[1] || { ...EMPTY_DEPOSIT };

  const [val0, setVal0] = useState(() => (d0.actualSelic + d0.actualCDB) || 0);
  const [val1, setVal1] = useState(() => (d1.actualSelic + d1.actualCDB) || 0);
  const [markComplete, setMarkComplete] = useState(!!record?.completed);

  const c0 = config.contributors[0];
  const c1 = config.contributors[1];
  const c0HasPlan = c0.plannedSelic > 0 || c0.plannedCDB > 0;
  const c1HasPlan = c1.plannedSelic > 0 || c1.plannedCDB > 0;

  const handleSave = () => {
    // Split proportionally between Selic and CDB based on plan
    if (c0HasPlan) {
      const totalPlanned = c0.plannedSelic + c0.plannedCDB;
      const selicRatio = totalPlanned > 0 ? c0.plannedSelic / totalPlanned : 1;
      onUpdateMonth(currentKey, 0, {
        actualSelic: Math.round(val0 * selicRatio),
        actualCDB: Math.round(val0 * (1 - selicRatio)),
      });
    }

    if (c1HasPlan) {
      const totalPlanned = c1.plannedSelic + c1.plannedCDB;
      const selicRatio = totalPlanned > 0 ? c1.plannedSelic / totalPlanned : 1;
      onUpdateMonth(currentKey, 1, {
        actualSelic: Math.round(val1 * selicRatio),
        actualCDB: Math.round(val1 * (1 - selicRatio)),
      });
    }

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
          {c0HasPlan && (
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {c0.name}
                <span className="text-xs text-muted-foreground ml-auto">
                  Meta: {formatBRL(c0.plannedSelic + c0.plannedCDB)}
                </span>
              </Label>
              <Input
                type="number"
                min={0}
                step={100}
                value={val0 || ""}
                placeholder="0"
                onChange={(e) => setVal0(Number(e.target.value) || 0)}
                className="text-right"
              />
            </div>
          )}

          {c1HasPlan && (
            <div className="space-y-1.5">
              <Label className="text-sm flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-accent" />
                {c1.name}
                <span className="text-xs text-muted-foreground ml-auto">
                  Meta: {formatBRL(c1.plannedSelic + c1.plannedCDB)}
                </span>
              </Label>
              <Input
                type="number"
                min={0}
                step={100}
                value={val1 || ""}
                placeholder="0"
                onChange={(e) => setVal1(Number(e.target.value) || 0)}
                className="text-right"
              />
            </div>
          )}

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
