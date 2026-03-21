import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AppData, Income, generateId } from "@/lib/models";
import { PlanConfig, MonthRecord, formatBRL } from "@/lib/types";
import { generateIncomeInsights } from "@/lib/financialEngine";
import { Plus, Trash2, Edit2, DollarSign, TrendingUp, Lightbulb, X, Check } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  onAddIncome: (income: Income) => void;
  onUpdateIncome: (id: string, updates: Partial<Income>) => void;
  onDeleteIncome: (id: string) => void;
}

const INCOME_TYPES: Record<string, string> = {
  salary: "Salário", freelance: "Freelance", rental: "Aluguel",
  dividends: "Dividendos", bonus: "Bônus", other: "Outros",
};

export function IncomePanel({ appData, config, monthRecords, startDate, onAddIncome, onUpdateIncome, onDeleteIncome }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ label: "", amount: 0, type: "salary" as Income["type"], recurrence: "monthly" as Income["recurrence"] });

  const insights = useMemo(() => generateIncomeInsights(appData, config, monthRecords, startDate), [appData, config, monthRecords, startDate]);
  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const profiles = [appData.primaryProfile, ...(appData.partner && !appData.partner.removedAt ? [appData.partner.profile] : [])];
  const [selectedProfileId, setSelectedProfileId] = useState(appData.primaryProfile.id);

  const handleAdd = () => {
    if (!form.label || form.amount <= 0) return;
    onAddIncome({
      id: generateId(), profileId: selectedProfileId, label: form.label, amount: form.amount,
      type: form.type, recurrence: form.recurrence, active: true,
    });
    setForm({ label: "", amount: 0, type: "salary", recurrence: "monthly" });
    setShowForm(false);
  };

  const handleUpdate = () => {
    if (!editingId || !form.label || form.amount <= 0) return;
    onUpdateIncome(editingId, { label: form.label, amount: form.amount, type: form.type, recurrence: form.recurrence });
    setEditingId(null);
    setForm({ label: "", amount: 0, type: "salary", recurrence: "monthly" });
  };

  const startEdit = (income: Income) => {
    setForm({ label: income.label, amount: income.amount, type: income.type, recurrence: income.recurrence });
    setEditingId(income.id);
    setShowForm(true);
  };

  return (
    <div className="space-y-4">
      <Card className="glass-card-strong p-4 text-center">
        <DollarSign className="w-6 h-6 text-primary mx-auto mb-2" />
        <h3 className="font-bold">Ganhar Mais</h3>
        <p className="text-xs text-muted-foreground mt-1">Gerencie suas rendas e descubra como acelerar o plano</p>
      </Card>

      {/* Total */}
      <Card className="glass-card p-4 text-center">
        <p className="text-[10px] text-muted-foreground uppercase">Renda Mensal Total</p>
        <p className="text-2xl font-extrabold text-primary">{formatBRL(totalIncome)}</p>
      </Card>

      {/* Income List */}
      <Card className="glass-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Fontes de Renda</h4>
          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setShowForm(true); setEditingId(null); setForm({ label: "", amount: 0, type: "salary", recurrence: "monthly" }); }}>
            <Plus className="w-3 h-3 mr-1" /> Adicionar
          </Button>
        </div>

        {showForm && (
          <div className="p-3 rounded-lg bg-muted/30 space-y-3 animate-fade-in-up">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Descrição</Label>
                <Input value={form.label} onChange={e => setForm({ ...form, label: e.target.value })} className="h-8 text-sm" placeholder="Ex: Salário" />
              </div>
              <div>
                <Label className="text-xs">Valor (R$)</Label>
                <Input type="text" inputMode="numeric" value={form.amount ? form.amount.toLocaleString("pt-BR") : ""}
                  onChange={e => setForm({ ...form, amount: Number(e.target.value.replace(/\D/g, "")) || 0 })} className="h-8 text-sm text-right" />
              </div>
              <div>
                <Label className="text-xs">Tipo</Label>
                <Select value={form.type} onValueChange={v => setForm({ ...form, type: v as Income["type"] })}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(INCOME_TYPES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {profiles.length > 1 && (
                <div>
                  <Label className="text-xs">Pessoa</Label>
                  <Select value={selectedProfileId} onValueChange={setSelectedProfileId}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {profiles.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" className="h-7" onClick={() => { setShowForm(false); setEditingId(null); }}>
                <X className="w-3 h-3 mr-1" /> Cancelar
              </Button>
              <Button size="sm" className="h-7" onClick={editingId ? handleUpdate : handleAdd}>
                <Check className="w-3 h-3 mr-1" /> {editingId ? "Salvar" : "Adicionar"}
              </Button>
            </div>
          </div>
        )}

        {appData.incomes.length === 0 && !showForm && (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma renda cadastrada ainda</p>
        )}

        {appData.incomes.map(income => {
          const profile = profiles.find(p => p.id === income.profileId);
          return (
            <div key={income.id} className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{income.label}</p>
                <p className="text-[10px] text-muted-foreground">
                  {INCOME_TYPES[income.type]} {profile ? `· ${profile.name}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-primary">{formatBRL(income.amount)}</p>
                <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEdit(income)}>
                  <Edit2 className="w-3 h-3" />
                </Button>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => onDeleteIncome(income.id)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </Card>

      {/* Insights */}
      {insights.length > 0 && (
        <Card className="glass-card p-4 space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Lightbulb className="w-4 h-4 text-primary" />
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Insights de Renda</h4>
          </div>
          {insights.map((insight, i) => (
            <div key={i} className="flex items-start gap-2 text-sm p-2 rounded-lg bg-primary/5">
              <TrendingUp className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
              <span>{insight}</span>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
