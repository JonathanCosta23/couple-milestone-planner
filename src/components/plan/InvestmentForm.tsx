import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Investment, InvestmentType, PatrimonialBucketId, SecurityLevel,
  getDefaultSecurity, getDefaultBucket, generateId, AppData, BUCKET_LABELS,
  SECURITY_LEVEL_LABELS,
} from "@/lib/models";
import { Plus, Pencil, Trash2 } from "lucide-react";

const INVESTMENT_TYPE_LABELS: Record<InvestmentType, string> = {
  "tesouro-selic": "Tesouro Selic",
  "cdb": "CDB",
  "lci-lca": "LCI/LCA",
  "fundo": "Fundos de Investimento",
  "acao": "Ações",
  "fii": "FIIs",
  "crypto": "Criptomoedas",
  "poupanca": "Poupança",
  "other": "Outro",
};

interface Props {
  appData: AppData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingInvestment?: Investment;
  onSave: (investment: Investment) => void;
  onDelete?: (id: string) => void;
}

export function InvestmentForm({ appData, open, onOpenChange, editingInvestment, onSave, onDelete }: Props) {
  const isEditing = !!editingInvestment;
  const isCouple = appData.mode === "couple" && appData.partner && !appData.partner.removedAt;

  const profiles = [
    { id: appData.primaryProfile.id, name: appData.primaryProfile.name || "Você" },
    ...(isCouple && appData.partner ? [{ id: appData.partner.profile.id, name: appData.partner.profile.name || "Parceiro(a)" }] : []),
  ];

  const defaults: Investment = editingInvestment || {
    id: generateId(),
    name: "",
    type: "tesouro-selic",
    institution: "",
    conglomerate: "",
    titular: appData.primaryProfile.id,
    securityLevel: "soberano",
    bucket: "reserva",
    currentBalance: 0,
    monthlyContribution: 0,
    annualRate: 0,
    startDate: new Date().toISOString().slice(0, 7),
    profileId: appData.primaryProfile.id,
    active: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const [form, setForm] = useState<Investment>(defaults);

  // Reset form when dialog opens
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setForm(editingInvestment || {
        ...defaults,
        id: generateId(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
    }
    onOpenChange(isOpen);
  };

  const handleTypeChange = (type: InvestmentType) => {
    setForm(prev => ({
      ...prev,
      type,
      securityLevel: getDefaultSecurity(type),
      bucket: getDefaultBucket(type),
    }));
  };

  const handleSave = () => {
    if (!form.name.trim() && !form.type) return;
    const investment: Investment = {
      ...form,
      name: form.name.trim() || INVESTMENT_TYPE_LABELS[form.type],
      updatedAt: new Date().toISOString(),
    };
    onSave(investment);
    onOpenChange(false);
  };

  const hasFgc = form.securityLevel === "fgc";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? <Pencil className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {isEditing ? "Editar investimento" : "Novo investimento"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type */}
          <div>
            <Label>Tipo de investimento</Label>
            <Select value={form.type} onValueChange={(v) => handleTypeChange(v as InvestmentType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(INVESTMENT_TYPE_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Name */}
          <div>
            <Label>Nome / Descrição</Label>
            <Input
              placeholder={INVESTMENT_TYPE_LABELS[form.type] || "Ex: CDB Banco Inter 120%"}
              value={form.name}
              onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
            />
          </div>

          {/* Institution + Conglomerate */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Instituição</Label>
              <Input
                placeholder="Ex: Nubank"
                value={form.institution}
                onChange={(e) => setForm(prev => ({ ...prev, institution: e.target.value }))}
              />
            </div>
            <div>
              <Label>Conglomerado</Label>
              <Input
                placeholder="Ex: Itaú Unibanco"
                value={form.conglomerate || ""}
                onChange={(e) => setForm(prev => ({ ...prev, conglomerate: e.target.value }))}
              />
            </div>
          </div>

          {/* Titular */}
          {isCouple && profiles.length > 1 && (
            <div>
              <Label>Titular</Label>
              <Select value={form.titular || form.profileId || profiles[0].id} onValueChange={(v) => setForm(prev => ({ ...prev, titular: v, profileId: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {profiles.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Values */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Valor atual (R$)</Label>
              <Input
                type="number"
                min={0}
                step={100}
                value={form.currentBalance || ""}
                placeholder="0"
                onChange={(e) => setForm(prev => ({ ...prev, currentBalance: Number(e.target.value) || 0 }))}
                className="text-right"
              />
            </div>
            <div>
              <Label>Aporte mensal (R$)</Label>
              <Input
                type="number"
                min={0}
                step={100}
                value={form.monthlyContribution || ""}
                placeholder="0"
                onChange={(e) => setForm(prev => ({ ...prev, monthlyContribution: Number(e.target.value) || 0 }))}
                className="text-right"
              />
            </div>
          </div>

          {/* Security + Bucket */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Proteção</Label>
              <Select value={form.securityLevel || "sem-protecao"} onValueChange={(v) => setForm(prev => ({ ...prev, securityLevel: v as SecurityLevel }))}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SECURITY_LEVEL_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Bucket</Label>
              <Select value={form.bucket || "crescimento"} onValueChange={(v) => setForm(prev => ({ ...prev, bucket: v as PatrimonialBucketId }))}>
                <SelectTrigger className="text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(BUCKET_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início</Label>
              <Input
                type="month"
                value={form.startDate || ""}
                onChange={(e) => setForm(prev => ({ ...prev, startDate: e.target.value }))}
              />
            </div>
            <div>
              <Label>Vencimento (opcional)</Label>
              <Input
                type="month"
                value={form.maturityDate || ""}
                onChange={(e) => setForm(prev => ({ ...prev, maturityDate: e.target.value || undefined }))}
              />
            </div>
          </div>

          {/* Active toggle */}
          <div className="flex items-center justify-between py-1">
            <Label>Investimento ativo</Label>
            <Switch checked={form.active} onCheckedChange={(v) => setForm(prev => ({ ...prev, active: v }))} />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          {isEditing && onDelete && (
            <Button variant="destructive" size="sm" className="mr-auto" onClick={() => { onDelete(form.id); onOpenChange(false); }}>
              <Trash2 className="w-4 h-4 mr-1" /> Remover
            </Button>
          )}
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={handleSave}>
            {isEditing ? "Salvar alterações" : "Cadastrar investimento"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
