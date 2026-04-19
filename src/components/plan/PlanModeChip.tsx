/**
 * PlanModeChip — Atalho global para visualizar e trocar o modo do plano.
 *
 * Sempre visível na Home (mobile + desktop). Reflete o estado canônico
 * vindo de `usePlan` (plans.mode + plan_members) e abre o `PlanModeSelector`
 * em um modal para ativar/desativar casal sem precisar navegar até Perfil → Dados.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PlanModeSelector } from "./PlanModeSelector";
import type { AppData, PlanMode } from "@/lib/models";
import { Users, User, UserPlus } from "lucide-react";

interface Props {
  appData: AppData;
  isCouple: boolean;
  primaryName: string;
  partnerName: string | null;
  onSetMode: (mode: PlanMode) => Promise<void> | void;
  onAddPartner: (name: string, age?: number) => Promise<void> | void;
  onRemovePartner: () => Promise<void> | void;
  onUpdatePrimaryProfile: (profile: { name?: string; age?: number }) => Promise<void> | void;
  onUpdatePartnerProfile: (profile: { name?: string; age?: number }) => Promise<void> | void;
}

export function PlanModeChip({
  appData,
  isCouple,
  primaryName,
  partnerName,
  onSetMode,
  onAddPartner,
  onRemovePartner,
  onUpdatePrimaryProfile,
  onUpdatePartnerProfile,
}: Props) {
  const [open, setOpen] = useState(false);

  const Icon = isCouple ? Users : User;
  const label = isCouple
    ? `${primaryName} & ${partnerName ?? "parceiro(a)"}`
    : primaryName;
  const subtitle = isCouple ? "Plano de casal" : "Plano individual";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-between gap-3 py-2.5 px-3.5 rounded-full bg-muted/40 hover:bg-muted/60 border border-border transition-colors min-h-[44px] text-left"
        aria-label="Abrir configuração do modo do plano"
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <Icon className="w-3.5 h-3.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold truncate leading-tight">{label}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{subtitle}</p>
          </div>
        </div>
        {!isCouple ? (
          <span className="flex items-center gap-1 text-[11px] font-medium text-primary shrink-0">
            <UserPlus className="w-3.5 h-3.5" /> Ativar casal
          </span>
        ) : (
          <span className="text-[11px] font-medium text-muted-foreground shrink-0">Editar</span>
        )}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modo do plano</DialogTitle>
          </DialogHeader>
          <PlanModeSelector
            appData={appData}
            onSetMode={(m) => { void onSetMode(m); }}
            onAddPartner={(n, a) => { void onAddPartner(n, a); setOpen(false); }}
            onRemovePartner={() => { void onRemovePartner(); }}
            onUpdatePrimaryProfile={(p) => { void onUpdatePrimaryProfile(p); }}
            onUpdatePartnerProfile={(p) => { void onUpdatePartnerProfile(p); }}
          />
          <div className="flex justify-end pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
