import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AppData, Debt, DebtType, DebtRisk, generateId, createDefaultDebt } from "@/lib/models";
import { PlanConfig, formatBRL, formatBRLCompact } from "@/lib/types";
import { Plus, Pencil, Trash2, AlertTriangle, TrendingDown, Zap, CreditCard, FileText, Landmark, Users, ShoppingBag } from "lucide-react";
import { toast } from "sonner";

interface Props {
  appData: AppData;
  config: PlanConfig;
  onAddDebt: (d: Debt) => void;
  onUpdateDebt: (id: string, u: Partial<Debt>) => void;
  onDeleteDebt: (id: string) => void;
}

const DEBT_TYPE_LABELS: Record<DebtType, string> = {
  "credit-card": "Cartão de Crédito", loan: "Empréstimo", financing: "Financiamento",
  informal: "Dívida Informal", "recurring-bill": "Boleto Recorrente", installment: "Parcelamento",
};
const DEBT_TYPE_ICONS: Record<DebtType, React.ElementType> = {
  "credit-card": CreditCard, loan: Landmark, financing: FileText,
  informal: Users, "recurring-bill": ShoppingBag, installment: ShoppingBag,
};
const RISK_LABELS: Record<DebtRisk, string> = { low: "Baixo", medium: "Médio", high: "Alto", toxic: "Tóxico" };
const RISK_COLORS: Record<DebtRisk, string> = { low: "text-primary", medium: "text-warning", high: "text-destructive", toxic: "text-destructive" };

function classifyRisk(debt: Partial<Debt>): DebtRisk {
  if ((debt.interestRate || 0) > 100) return "toxic";
  if ((debt.interestRate || 0) > 30) return "high";
  if ((debt.interestRate || 0) > 12) return "medium";
  return "low";
}

function getPayoffStrategy(debts: Debt[]): { method: string; description: string; ordered: Debt[] } {
  const active = debts.filter(d => d.active);
  const avalanche = [...active].sort((a, b) => b.interestRate - a.interestRate);
  const snowball = [...active].sort((a, b) => {
    const remA = a.totalAmount - (a.currentInstallment - 1) * a.monthlyPayment;
    const remB = b.totalAmount - (b.currentInstallment - 1) * b.monthlyPayment;
    return remA - remB;
  });
  const hasToxic = active.some(d => d.interestRate > 100);
  if (hasToxic) return { method: "Avalanche (Urgente)", description: "Você tem dívidas com juros tóxicos. Elimine as de maior taxa primeiro.", ordered: avalanche };
  if (active.length > 3) return { method: "Bola de Neve", description: "Muitas dívidas: elimine as menores primeiro para ganhar momentum.", ordered: snowball };
  return { method: "Avalanche", description: "Elimine as dívidas de maior taxa de juros primeiro.", ordered: avalanche };
}

export function DebtModule({ appData, config, onAddDebt, onUpdateDebt, onDeleteDebt }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [editingDebt, setEditingDebt] = useState<Debt | null>(null);

  const activeDebts = useMemo(() => appData.debts.filter(d => d.active), [appData.debts]);
  const totalDebt = useMemo(() => activeDebts.reduce((s, d) => {
    const remaining = d.totalAmount - (d.currentInstallment - 1) * d.monthlyPayment;
    return s + Math.max(0, remaining);
  }, 0), [activeDebts]);
  const monthlyPayments = useMemo(() => activeDebts.reduce((s, d) => s + d.monthlyPayment, 0), [activeDebts]);
  const strategy = useMemo(() => getPayoffStrategy(appData.debts), [appData.debts]);
  const toxicDebts = useMemo(() => activeDebts.filter(d => classifyRisk(d) === "toxic" || classifyRisk(d) === "high"), [activeDebts]);

  const totalIncome = appData.incomes.filter(i => i.active).reduce((s, i) => s + i.amount, 0);
  const debtRatio = totalIncome > 0 ? monthlyPayments / totalIncome : 0;

  const monthlyInvestment = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const millionImpactMonths = monthlyInvestment > 0 && monthlyPayments > 0
    ? Math.round(totalDebt / monthlyInvestment)
    : null;

  const handleSave = (debt: Debt) => {
    debt.risk = classifyRisk(debt);
    if (editingDebt) {
      onUpdateDebt(debt.id, debt);
      toast.success("Dívida atualizada!");
    } else {
      onAddDebt(debt);
      toast.success("Dívida cadastrada!");
    }
    setShowForm(false);
    setEditingDebt(null);
  };

  const handleEdit = (d: Debt) => { setEditingDebt(d); setShowForm(true); };
  const handleDelete = (id: string) => { if (confirm("Excluir esta dívida?")) { onDeleteDebt(id); toast.success("Dívida removida!"); } };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg lg:text-xl font-bold">📋 Dívidas & Cartão</h2>
        <Button size="sm" onClick={() => { setEditingDebt(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Nova Dívida
        </Button>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-2 gap-2 lg:gap-4">
        <Card className="glass-card p-3 lg:p-5 text-center">
          <p className="text-xl lg:text-2xl font-extrabold text-destructive">{formatBRL(totalDebt)}</p>
          <p className="text-[9px] sm:text-xs text-muted-foreground uppercase">Dívida Total</p>
        </Card>
        <Card className="glass-card p-3 lg:p-5 text-center">
          <p className="text-xl lg:text-2xl font-extrabold text-warning">{formatBRL(monthlyPayments)}</p>
          <p className="text-[9px] sm:text-xs text-muted-foreground uppercase">Parcelas/mês</p>
        </Card>
      </div>

      {/* Impact */}
      <Card className="glass-card p-4 space-y-3">
        <p className="text-sm font-semibold">📊 Impacto no seu plano</p>
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Peso na renda</span>
            <span className={`font-bold ${debtRatio > 0.3 ? "text-destructive" : debtRatio > 0.15 ? "text-warning" : "text-primary"}`}>
              {(debtRatio * 100).toFixed(1)}%
            </span>
          </div>
          <Progress value={Math.min(100, debtRatio * 100)} className="h-1.5" />
          {millionImpactMonths && (
            <p className="text-xs text-muted-foreground">
              ⚠️ Suas dívidas atrasam o milhão em aproximadamente <strong className="text-foreground">{millionImpactMonths} meses</strong>.
            </p>
          )}
        </div>
      </Card>

      {/* Toxic alert */}
      {toxicDebts.length > 0 && (
        <Card className="glass-card p-3 border-destructive/30">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <div>
              <p className="text-xs font-bold text-destructive">⚠️ Juros Tóxicos Detectados</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {toxicDebts.length} dívida(s) com juros acima de 30% ao ano. Priorize a quitação dessas antes de investir.
              </p>
            </div>
          </div>
        </Card>
      )}

      {/* Strategy */}
      {activeDebts.length > 0 && (
        <Card className="glass-card p-4 border-primary/20">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-primary" />
            <p className="text-sm font-semibold">Estratégia: {strategy.method}</p>
          </div>
          <p className="text-xs text-muted-foreground mb-3">{strategy.description}</p>
          <div className="space-y-2">
            {strategy.ordered.slice(0, 3).map((d, i) => (
              <div key={d.id} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-primary">{i + 1}º</span>
                  <span className="truncate">{d.name}</span>
                </div>
                <span className={`font-semibold ${RISK_COLORS[classifyRisk(d)]}`}>{d.interestRate}% a.a.</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Debt list */}
      <div className="space-y-2">
        {activeDebts.length === 0 && (
          <Card className="glass-card p-6 text-center">
            <p className="text-2xl mb-2">🎉</p>
            <p className="text-sm font-semibold">Nenhuma dívida ativa!</p>
            <p className="text-xs text-muted-foreground">Ótimo! Todo seu dinheiro pode ir para investimentos.</p>
          </Card>
        )}
        {activeDebts.map(d => {
          const Icon = DEBT_TYPE_ICONS[d.type];
          const remaining = d.totalAmount - (d.currentInstallment - 1) * d.monthlyPayment;
          const progress = d.totalInstallments > 0 ? ((d.currentInstallment - 1) / d.totalInstallments) * 100 : 0;
          return (
            <Card key={d.id} className="glass-card p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <Icon className="w-5 h-5 text-muted-foreground shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{d.name}</p>
                    <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0">{DEBT_TYPE_LABELS[d.type]}</Badge>
                      <Badge className={`text-[9px] px-1.5 py-0 ${RISK_COLORS[classifyRisk(d)]}`}>{RISK_LABELS[classifyRisk(d)]}</Badge>
                    </div>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold">{formatBRL(d.monthlyPayment)}/mês</p>
                  <p className="text-[10px] text-muted-foreground">{d.currentInstallment}/{d.totalInstallments}</p>
                </div>
              </div>
              <div className="mt-2 space-y-1">
                <Progress value={progress} className="h-1" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Restante: {formatBRL(Math.max(0, remaining))}</span>
                  <span>{d.interestRate}% a.a.</span>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-2 justify-end">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(d)}><Pencil className="w-3.5 h-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDelete(d.id)}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
              </div>
            </Card>
          );
        })}
      </div>

      <DebtFormDialog
        open={showForm}
        onOpenChange={(o) => { setShowForm(o); if (!o) setEditingDebt(null); }}
        debt={editingDebt}
        profiles={[appData.primaryProfile, ...(appData.partner && !appData.partner.removedAt ? [appData.partner.profile] : [])]}
        coupleMode={appData.mode === "couple"}
        onSave={handleSave}
      />
    </div>
  );
}

function DebtFormDialog({ open, onOpenChange, debt, profiles, coupleMode, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; debt: Debt | null;
  profiles: { id: string; name: string }[]; coupleMode: boolean; onSave: (d: Debt) => void;
}) {
  const defaults = createDefaultDebt() as Debt;
  const [form, setForm] = useState<Debt>(debt || defaults);

  const handleOpenChange = (o: boolean) => {
    if (o) setForm(debt || createDefaultDebt() as Debt);
    onOpenChange(o);
  };

  const update = (key: keyof Debt, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("Informe o nome da dívida."); return; }
    if (form.totalAmount <= 0) { toast.error("Informe o valor total."); return; }
    onSave({ ...form, risk: classifyRisk(form), updatedAt: new Date().toISOString() });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{debt ? "Editar Dívida" : "Nova Dívida"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={form.name} onChange={e => update("name", e.target.value)} placeholder="Ex: Parcela celular, Empréstimo..." />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.type} onValueChange={v => update("type", v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(DEBT_TYPE_LABELS) as DebtType[]).map(t => (
                    <SelectItem key={t} value={t} className="text-xs">{DEBT_TYPE_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Valor Total (R$)</Label>
              <Input type="number" min={0} value={form.totalAmount || ""} onChange={e => update("totalAmount", parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Parcela Atual</Label>
              <Input type="number" min={1} value={form.currentInstallment} onChange={e => update("currentInstallment", parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label className="text-xs">Total Parcelas</Label>
              <Input type="number" min={1} value={form.totalInstallments} onChange={e => update("totalInstallments", parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <Label className="text-xs">Valor/mês (R$)</Label>
              <Input type="number" min={0} value={form.monthlyPayment || ""} onChange={e => update("monthlyPayment", parseFloat(e.target.value) || 0)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Juros (% a.a.)</Label>
              <Input type="number" min={0} step={0.1} value={form.interestRate || ""} onChange={e => update("interestRate", parseFloat(e.target.value) || 0)} />
            </div>
            <div>
              <Label className="text-xs">Dia Vencimento</Label>
              <Input type="number" min={1} max={31} value={form.dueDay} onChange={e => update("dueDay", parseInt(e.target.value) || 1)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Credor</Label>
            <Input value={form.creditor || ""} onChange={e => update("creditor", e.target.value)} placeholder="Banco, loja, pessoa..." />
          </div>
          {coupleMode && (
            <div>
              <Label className="text-xs">Responsável</Label>
              <Select value={form.profileId || ""} onValueChange={v => update("profileId", v)}>
                <SelectTrigger className="text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
          )}
          <div>
            <Label className="text-xs">Observações</Label>
            <Input value={form.notes || ""} onChange={e => update("notes", e.target.value)} placeholder="Opcional..." />
          </div>
          {form.interestRate > 0 && (
            <Card className="p-2 border-dashed">
              <p className="text-[10px] text-muted-foreground">
                Risco automático: <strong className={RISK_COLORS[classifyRisk(form)]}>{RISK_LABELS[classifyRisk(form)]}</strong>
              </p>
            </Card>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>{debt ? "Salvar" : "Cadastrar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
