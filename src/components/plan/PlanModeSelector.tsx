import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AppData, PlanMode } from "@/lib/models";
import { Users, User, UserPlus, AlertTriangle, Pencil } from "lucide-react";

interface Props {
  appData: AppData;
  onSetMode: (mode: PlanMode) => void;
  onAddPartner: (name: string, age?: number) => void;
  onRemovePartner: () => void;
  onUpdatePrimaryProfile: (profile: { name?: string; age?: number }) => void;
  onUpdatePartnerProfile: (profile: { name?: string; age?: number }) => void;
}

export function PlanModeSelector({
  appData, onSetMode, onAddPartner, onRemovePartner,
  onUpdatePrimaryProfile, onUpdatePartnerProfile,
}: Props) {
  const [showAddPartner, setShowAddPartner] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [partnerName, setPartnerName] = useState("");
  const [partnerAge, setPartnerAge] = useState<number | undefined>();
  const [editingPrimary, setEditingPrimary] = useState(false);
  const [editingPartner, setEditingPartner] = useState(false);
  const [editName, setEditName] = useState("");
  const [editAge, setEditAge] = useState<number | undefined>();

  const isCouple = appData.mode === "casal" && appData.partner && !appData.partner.removedAt;
  const primaryName = appData.primaryProfile.name || "Você";
  const partnerCurrentName = appData.partner?.profile.name || "";

  const handleActivateCouple = () => {
    if (appData.partner && !appData.partner.removedAt) {
      onSetMode("casal");
    } else if (appData.partner?.removedAt) {
      // Restore soft-deleted partner
      onSetMode("casal");
    } else {
      setShowAddPartner(true);
    }
  };

  const handleConfirmAddPartner = () => {
    if (!partnerName.trim()) return;
    onAddPartner(partnerName.trim(), partnerAge);
    setShowAddPartner(false);
    setPartnerName("");
    setPartnerAge(undefined);
  };

  const handleConfirmRemove = () => {
    onRemovePartner();
    setShowRemoveConfirm(false);
  };

  const handleStartEditPrimary = () => {
    setEditName(appData.primaryProfile.name || "");
    setEditAge(appData.primaryProfile.age);
    setEditingPrimary(true);
  };

  const handleSaveEditPrimary = () => {
    onUpdatePrimaryProfile({ name: editName.trim(), age: editAge });
    setEditingPrimary(false);
  };

  const handleStartEditPartner = () => {
    setEditName(appData.partner?.profile.name || "");
    setEditAge(appData.partner?.profile.age);
    setEditingPartner(true);
  };

  const handleSaveEditPartner = () => {
    onUpdatePartnerProfile({ name: editName.trim(), age: editAge });
    setEditingPartner(false);
  };

  return (
    <>
      <Card className="glass-card p-4 lg:p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-primary" />
          <h3 className="font-bold">Modo do Plano</h3>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => {
              if (isCouple) {
                setShowRemoveConfirm(true);
              } else {
                onSetMode("individual");
              }
            }}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              !isCouple
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border hover:border-primary/30 text-muted-foreground"
            }`}
          >
            <User className="w-6 h-6 mx-auto mb-2" />
            <p className="text-sm font-semibold">Individual</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Apenas você</p>
          </button>
          <button
            onClick={handleActivateCouple}
            className={`p-4 rounded-xl border-2 text-center transition-all ${
              isCouple
                ? "border-primary bg-primary/10 text-foreground"
                : "border-border hover:border-primary/30 text-muted-foreground"
            }`}
          >
            <Users className="w-6 h-6 mx-auto mb-2" />
            <p className="text-sm font-semibold">Casal</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Dois participantes</p>
          </button>
        </div>

        {/* Participants */}
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Participantes</p>
          <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                {primaryName[0]?.toUpperCase() || "V"}
              </div>
              <div>
                <p className="text-sm font-medium">{primaryName}</p>
                {appData.primaryProfile.age && (
                  <p className="text-[10px] text-muted-foreground">{appData.primaryProfile.age} anos</p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleStartEditPrimary}>
              <Pencil className="w-3.5 h-3.5" />
            </Button>
          </div>

          {isCouple && appData.partner && (
            <div className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-accent-foreground text-xs font-bold">
                  {(partnerCurrentName || "P")[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium">{partnerCurrentName || "Parceiro(a)"}</p>
                  {appData.partner.profile.age && (
                    <p className="text-[10px] text-muted-foreground">{appData.partner.profile.age} anos</p>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleStartEditPartner}>
                <Pencil className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}

          {!isCouple && (
            <button
              onClick={handleActivateCouple}
              className="w-full flex items-center gap-2 py-2 px-3 rounded-lg border border-dashed border-border hover:border-primary/30 text-muted-foreground hover:text-foreground transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              <span className="text-sm">Adicionar parceiro(a)</span>
            </button>
          )}
        </div>
      </Card>

      {/* Add Partner Dialog */}
      <Dialog open={showAddPartner} onOpenChange={setShowAddPartner}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar parceiro(a)</DialogTitle>
            <DialogDescription>
              O plano será compartilhado entre dois participantes.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input
                placeholder="Nome do(a) parceiro(a)"
                value={partnerName}
                onChange={(e) => setPartnerName(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <Label>Idade (opcional)</Label>
              <Input
                type="number"
                min={18}
                max={100}
                placeholder="Ex: 28"
                value={partnerAge || ""}
                onChange={(e) => setPartnerAge(Number(e.target.value) || undefined)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowAddPartner(false)}>Cancelar</Button>
            <Button onClick={handleConfirmAddPartner} disabled={!partnerName.trim()}>
              <UserPlus className="w-4 h-4 mr-1.5" /> Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Partner Confirm Dialog */}
      <Dialog open={showRemoveConfirm} onOpenChange={setShowRemoveConfirm}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-warning" />
              Voltar para modo individual?
            </DialogTitle>
            <DialogDescription>
              O plano voltará a usar apenas o participante principal ({primaryName}).
              Os dados de {partnerCurrentName || "parceiro(a)"} serão preservados no histórico, mas não aparecerão mais na experiência ativa.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowRemoveConfirm(false)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleConfirmRemove}>Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Primary Dialog */}
      <Dialog open={editingPrimary} onOpenChange={setEditingPrimary}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar participante</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Idade (opcional)</Label>
              <Input type="number" min={18} max={100} value={editAge || ""} onChange={(e) => setEditAge(Number(e.target.value) || undefined)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingPrimary(false)}>Cancelar</Button>
            <Button onClick={handleSaveEditPrimary}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Partner Dialog */}
      <Dialog open={editingPartner} onOpenChange={setEditingPartner}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Editar parceiro(a)</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} autoFocus />
            </div>
            <div>
              <Label>Idade (opcional)</Label>
              <Input type="number" min={18} max={100} value={editAge || ""} onChange={(e) => setEditAge(Number(e.target.value) || undefined)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingPartner(false)}>Cancelar</Button>
            <Button onClick={handleSaveEditPartner}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
