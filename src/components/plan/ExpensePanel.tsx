import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import {
  AppData, Expense, ExpenseCategory, ExpenseType, ExpenseStatus, ExpensePriority,
  ExpenseOwnership, EXPENSE_CATEGORY_LABELS, EXPENSE_CATEGORY_ICONS, generateId, createDefaultExpense,
} from "@/lib/models";
import { PlanConfig, formatBRL, getCurrentMonthKey, monthKeyToLabel } from "@/lib/types";
import {
  Plus, Pencil, Trash2, Copy, CheckCircle, RefreshCw, Filter,
  LayoutList, LayoutGrid, Calendar, BarChart3, ArrowUpDown,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  appData: AppData;
  config: PlanConfig;
  onAddExpense: (e: Expense) => void;
  onUpdateExpense: (id: string, u: Partial<Expense>) => void;
  onDeleteExpense: (id: string) => void;
  onDuplicateExpense: (id: string) => void;
  onMarkExpensePaid: (id: string) => void;
  onConvertToRecurring: (id: string) => void;
}

const CATEGORIES = Object.keys(EXPENSE_CATEGORY_LABELS) as ExpenseCategory[];

export function ExpensePanel({
  appData, config, onAddExpense, onUpdateExpense, onDeleteExpense,
  onDuplicateExpense, onMarkExpensePaid, onConvertToRecurring,
}: Props) {
  const [selectedMonth, setSelectedMonth] = useState(getCurrentMonthKey());
  const [viewMode, setViewMode] = useState<"list" | "cards" | "summary">("list");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterOwnership, setFilterOwnership] = useState<string>("all");
  const [filterPerson, setFilterPerson] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const profiles = useMemo(() => {
    const p = [appData.primaryProfile];
    if (appData.mode === "casal" && appData.partner && !appData.partner.removedAt) {
      p.push(appData.partner.profile);
    }
    return p;
  }, [appData]);

  const monthExpenses = useMemo(() => {
    let expenses = appData.expenses.filter(e => e.monthKey === selectedMonth);
    if (filterCategory !== "all") expenses = expenses.filter(e => e.category === filterCategory);
    if (filterType !== "all") expenses = expenses.filter(e => e.type === filterType);
    if (filterStatus !== "all") expenses = expenses.filter(e => e.status === filterStatus);
    if (filterOwnership !== "all") expenses = expenses.filter(e => e.ownership === filterOwnership);
    if (filterPerson !== "all") expenses = expenses.filter(e => e.responsibleProfileId === filterPerson);
    return expenses;
  }, [appData.expenses, selectedMonth, filterCategory, filterType, filterStatus, filterOwnership, filterPerson]);

  const summary = useMemo(() => {
    const all = appData.expenses.filter(e => e.monthKey === selectedMonth);
    const total = all.reduce((s, e) => s + e.amount, 0);
    const fixed = all.filter(e => e.type === "fixed").reduce((s, e) => s + e.amount, 0);
    const variable = all.filter(e => e.type === "variable").reduce((s, e) => s + e.amount, 0);
    const paid = all.filter(e => e.status === "paid").reduce((s, e) => s + e.amount, 0);
    const pending = all.filter(e => e.status === "pending").reduce((s, e) => s + e.amount, 0);
    const byCategory: Partial<Record<ExpenseCategory, number>> = {};
    all.forEach(e => { byCategory[e.category] = (byCategory[e.category] || 0) + e.amount; });
    return { total, fixed, variable, paid, pending, byCategory, count: all.length };
  }, [appData.expenses, selectedMonth]);

  const navigateMonth = (dir: number) => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + dir, 1);
    setSelectedMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const handleSave = (expense: Expense) => {
    if (editingExpense) {
      onUpdateExpense(expense.id, expense);
      toast.success("Gasto atualizado!");
    } else {
      onAddExpense(expense);
      toast.success("Gasto adicionado!");
    }
    setShowForm(false);
    setEditingExpense(null);
  };

  const handleEdit = (e: Expense) => {
    setEditingExpense(e);
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    if (confirm("Excluir este gasto?")) {
      onDeleteExpense(id);
      toast.success("Gasto excluído!");
    }
  };

  return (
    <div className="space-y-4 lg:space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg lg:text-xl font-bold">💸 Seus gastos</h2>
        <Button size="sm" onClick={() => { setEditingExpense(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" /> Novo Gasto
        </Button>
      </div>

      {/* Month navigation */}
      <Card className="glass-card p-3">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(-1)}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <p className="text-sm font-semibold">{monthKeyToLabel(selectedMonth)}</p>
          <Button variant="ghost" size="icon" onClick={() => navigateMonth(1)}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>

      {/* Summary strip */}
      <div className="grid grid-cols-3 sm:grid-cols-3 lg:grid-cols-5 gap-2 lg:gap-3">
        <MiniStat label="Total" value={formatBRL(summary.total)} />
        <MiniStat label="Fixos" value={formatBRL(summary.fixed)} />
        <MiniStat label="Variáveis" value={formatBRL(summary.variable)} />
      </div>
      <div className="grid grid-cols-2 lg:hidden gap-2">
        <MiniStat label="Pagos" value={formatBRL(summary.paid)} accent="text-primary" />
        <MiniStat label="Pendentes" value={formatBRL(summary.pending)} accent="text-warning" />
      </div>

      {/* View + Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1">
          <Button variant={viewMode === "list" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setViewMode("list")}>
            <LayoutList className="w-3.5 h-3.5" />
          </Button>
          <Button variant={viewMode === "cards" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setViewMode("cards")}>
            <LayoutGrid className="w-3.5 h-3.5" />
          </Button>
          <Button variant={viewMode === "summary" ? "default" : "outline"} size="icon" className="h-8 w-8" onClick={() => setViewMode("summary")}>
            <BarChart3 className="w-3.5 h-3.5" />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setShowFilters(!showFilters)}>
          <Filter className="w-3.5 h-3.5 mr-1" /> Filtros
        </Button>
      </div>

      {showFilters && (
        <Card className="glass-card p-3 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
            <FilterSelect label="Categoria" value={filterCategory} onChange={setFilterCategory}
              options={[{ value: "all", label: "Todas" }, ...CATEGORIES.map(c => ({ value: c, label: `${EXPENSE_CATEGORY_ICONS[c]} ${EXPENSE_CATEGORY_LABELS[c]}` }))]} />
            <FilterSelect label="Tipo" value={filterType} onChange={setFilterType}
              options={[{ value: "all", label: "Todos" }, { value: "fixed", label: "Fixo" }, { value: "variable", label: "Variável" }]} />
            <FilterSelect label="Status" value={filterStatus} onChange={setFilterStatus}
              options={[{ value: "all", label: "Todos" }, { value: "pending", label: "Pendente" }, { value: "paid", label: "Pago" }, { value: "overdue", label: "Atrasado" }]} />
            <FilterSelect label="Pertence" value={filterOwnership} onChange={setFilterOwnership}
              options={[{ value: "all", label: "Todos" }, { value: "individual", label: "Individual" }, { value: "shared", label: "Compartilhado" }]} />
          </div>
          {appData.mode === "casal" && (
            <FilterSelect label="Titular" value={filterPerson} onChange={setFilterPerson}
              options={[{ value: "all", label: "Todos" }, ...profiles.map(p => ({ value: p.id, label: p.name }))]} />
          )}
        </Card>
      )}

      {/* Content */}
      {viewMode === "list" && (
        <div className="space-y-2">
          {monthExpenses.length === 0 && (
            <Card className="glass-card p-6 text-center">
              <p className="text-sm font-semibold mb-1">Nenhum gasto neste mês</p>
              <p className="text-muted-foreground text-xs mb-3">Registre seus gastos para descobrir quanto realmente sobra para investir.</p>
              <Button size="sm" className="mt-1" onClick={() => { setEditingExpense(null); setShowForm(true); }}>
                <Plus className="w-4 h-4 mr-1" /> Registrar primeiro gasto
              </Button>
            </Card>
          )}
          {monthExpenses.map(e => (
            <ExpenseRow key={e.id} expense={e} profiles={profiles} coupleMode={appData.mode === "casal"}
              onEdit={() => handleEdit(e)} onDelete={() => handleDelete(e.id)}
              onDuplicate={() => { onDuplicateExpense(e.id); toast.success("Gasto duplicado!"); }}
              onMarkPaid={() => { onMarkExpensePaid(e.id); toast.success("Marcado como pago!"); }}
              onConvertRecurring={() => { onConvertToRecurring(e.id); toast.success("Convertido em recorrente!"); }}
            />
          ))}
        </div>
      )}

      {viewMode === "cards" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-3">
          {monthExpenses.map(e => (
            <ExpenseCard key={e.id} expense={e} onEdit={() => handleEdit(e)} onDelete={() => handleDelete(e.id)} />
          ))}
          {monthExpenses.length === 0 && (
            <Card className="glass-card p-4 text-center col-span-2">
              <p className="text-muted-foreground text-sm">Nenhum gasto neste mês.</p>
            </Card>
          )}
        </div>
      )}

      {viewMode === "summary" && (
        <Card className="glass-card p-4 space-y-3">
          <p className="text-sm font-semibold mb-2">Gastos por Categoria</p>
          {Object.entries(summary.byCategory)
            .sort(([, a], [, b]) => (b as number) - (a as number))
            .map(([cat, amount]) => (
              <div key={cat} className="space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span>{EXPENSE_CATEGORY_ICONS[cat as ExpenseCategory]} {EXPENSE_CATEGORY_LABELS[cat as ExpenseCategory]}</span>
                  <span className="font-semibold">{formatBRL(amount as number)}</span>
                </div>
                <Progress value={summary.total > 0 ? ((amount as number) / summary.total) * 100 : 0} className="h-1.5" />
              </div>
            ))}
          {Object.keys(summary.byCategory).length === 0 && (
            <p className="text-muted-foreground text-xs text-center py-4">Sem dados para exibir.</p>
          )}
        </Card>
      )}

      {/* Form Dialog */}
      <ExpenseFormDialog
        open={showForm}
        onOpenChange={(open) => { setShowForm(open); if (!open) setEditingExpense(null); }}
        expense={editingExpense}
        monthKey={selectedMonth}
        profiles={profiles}
        coupleMode={appData.mode === "casal"}
        onSave={handleSave}
      />
    </div>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <Card className="glass-card p-2 lg:p-3 text-center">
      <p className={`text-sm lg:text-base font-bold truncate ${accent || ""}`}>{value}</p>
      <p className="text-[9px] sm:text-[10px] text-muted-foreground uppercase">{label}</p>
    </Card>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <Label className="text-[10px] text-muted-foreground">{label}</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent>{options.map(o => <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}

function ExpenseRow({ expense, profiles, coupleMode, onEdit, onDelete, onDuplicate, onMarkPaid, onConvertRecurring }: {
  expense: Expense; profiles: { id: string; name: string }[]; coupleMode: boolean;
  onEdit: () => void; onDelete: () => void; onDuplicate: () => void; onMarkPaid: () => void; onConvertRecurring: () => void;
}) {
  const statusColors: Record<ExpenseStatus, string> = { pending: "bg-warning/20 text-warning", paid: "bg-primary/20 text-primary", overdue: "bg-destructive/20 text-destructive", cancelled: "bg-muted text-muted-foreground" };
  const person = profiles.find(p => p.id === expense.responsibleProfileId);

  return (
    <Card className="glass-card p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-lg shrink-0">{EXPENSE_CATEGORY_ICONS[expense.category]}</span>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{expense.name || "Sem nome"}</p>
            <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
              <Badge variant="outline" className="text-[9px] px-1.5 py-0">{expense.type === "fixed" ? "Fixo" : "Variável"}</Badge>
              <Badge className={`text-[9px] px-1.5 py-0 ${statusColors[expense.status]}`}>
                {expense.status === "paid" ? "Pago" : expense.status === "pending" ? "Pendente" : expense.status === "overdue" ? "Atrasado" : "Cancelado"}
              </Badge>
              {coupleMode && person && <Badge variant="outline" className="text-[9px] px-1.5 py-0">{person.name}</Badge>}
              {expense.ownership === "shared" && <Badge variant="outline" className="text-[9px] px-1.5 py-0">Compartilhado</Badge>}
            </div>
          </div>
        </div>
        <p className="text-sm font-bold shrink-0">{formatBRL(expense.amount)}</p>
      </div>
      <div className="flex items-center gap-1 mt-2 justify-end">
        {expense.status === "pending" && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onMarkPaid} title="Marcar como pago">
            <CheckCircle className="w-3.5 h-3.5 text-primary" />
          </Button>
        )}
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}><Pencil className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDuplicate}><Copy className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onConvertRecurring} title="Tornar recorrente"><RefreshCw className="w-3.5 h-3.5" /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onDelete}><Trash2 className="w-3.5 h-3.5 text-destructive" /></Button>
      </div>
    </Card>
  );
}

function ExpenseCard({ expense, onEdit, onDelete }: { expense: Expense; onEdit: () => void; onDelete: () => void }) {
  return (
    <Card className="glass-card p-3 cursor-pointer hover:ring-1 hover:ring-primary/20 transition-all" onClick={onEdit}>
      <div className="text-center">
        <span className="text-xl">{EXPENSE_CATEGORY_ICONS[expense.category]}</span>
        <p className="text-xs font-semibold mt-1 truncate">{expense.name || "Sem nome"}</p>
        <p className="text-sm font-bold mt-0.5">{formatBRL(expense.amount)}</p>
        <Badge variant="outline" className="text-[9px] mt-1">{EXPENSE_CATEGORY_LABELS[expense.category]}</Badge>
      </div>
    </Card>
  );
}

// ===== Form Dialog =====

function ExpenseFormDialog({ open, onOpenChange, expense, monthKey, profiles, coupleMode, onSave }: {
  open: boolean; onOpenChange: (o: boolean) => void; expense: Expense | null;
  monthKey: string; profiles: { id: string; name: string }[]; coupleMode: boolean;
  onSave: (e: Expense) => void;
}) {
  const defaults = createDefaultExpense(monthKey, profiles[0]?.id) as Expense;
  const [form, setForm] = useState<Expense>(expense || defaults);

  // Reset form when dialog opens
  const handleOpenChange = (o: boolean) => {
    if (o) setForm(expense || createDefaultExpense(monthKey, profiles[0]?.id) as Expense);
    onOpenChange(o);
  };

  const update = (key: keyof Expense, value: any) => setForm(prev => ({ ...prev, [key]: value }));

  const handleSubmit = () => {
    if (!form.name.trim()) { toast.error("Informe o nome do gasto."); return; }
    if (form.amount <= 0) { toast.error("Informe um valor válido."); return; }
    onSave({ ...form, updatedAt: new Date().toISOString() });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle>{expense ? "Editar Gasto" : "Novo Gasto"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Nome</Label>
            <Input value={form.name} onChange={e => update("name", e.target.value)} placeholder="Ex: Aluguel, Mercado..." />
          </div>
          <div>
            <Label className="text-xs">Valor (R$)</Label>
            <Input
              type="number"
              inputMode="decimal"
              min={0}
              step={0.01}
              value={form.amount || ""}
              onChange={e => update("amount", parseFloat(e.target.value) || 0)}
              placeholder="0,00"
              className="h-11 lg:h-10 text-base lg:text-sm"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Categoria</Label>
              <Select value={form.category} onValueChange={v => update("category", v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c} className="text-xs">{EXPENSE_CATEGORY_ICONS[c]} {EXPENSE_CATEGORY_LABELS[c]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Tipo</Label>
              <Select value={form.type} onValueChange={v => update("type", v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed" className="text-xs">Fixo</SelectItem>
                  <SelectItem value="variable" className="text-xs">Variável</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">Status</Label>
              <Select value={form.status} onValueChange={v => update("status", v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="pending" className="text-xs">Pendente</SelectItem>
                  <SelectItem value="paid" className="text-xs">Pago</SelectItem>
                  <SelectItem value="overdue" className="text-xs">Atrasado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Prioridade</Label>
              <Select value={form.priority} onValueChange={v => update("priority", v)}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="essential" className="text-xs">Essencial</SelectItem>
                  <SelectItem value="important" className="text-xs">Importante</SelectItem>
                  <SelectItem value="optional" className="text-xs">Opcional</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {coupleMode && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Responsável</Label>
                <Select value={form.responsibleProfileId || ""} onValueChange={v => update("responsibleProfileId", v)}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>{profiles.map(p => <SelectItem key={p.id} value={p.id} className="text-xs">{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Pertence a</Label>
                <Select value={form.ownership} onValueChange={v => update("ownership", v)}>
                  <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="individual" className="text-xs">Individual</SelectItem>
                    <SelectItem value="shared" className="text-xs">Compartilhado</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <div>
            <Label className="text-xs">Vencimento</Label>
            <Input type="date" value={form.dueDate || ""} onChange={e => update("dueDate", e.target.value)} />
          </div>
          <div>
            <Label className="text-xs">Observação</Label>
            <Input value={form.notes || ""} onChange={e => update("notes", e.target.value)} placeholder="Opcional..." />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSubmit}>{expense ? "Salvar" : "Adicionar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
