/**
 * DataMigrationDialog — modal de conflito entre dados deste dispositivo e dados da conta.
 *
 * Princípios de UX:
 * - A ação destrutiva (sobrescrever a conta com dados locais) NUNCA é o botão principal.
 * - Mostra um resumo comparável das duas versões: data, meta, patrimônio e participantes.
 * - Permite comparar lado a lado antes de decidir.
 * - Sobrescrever a conta exige um segundo passo de confirmação explícita.
 * - Antes de qualquer sobrescrita, dispara um backup local automático.
 * - "Decidir depois" deixa explícito qual versão será usada temporariamente.
 */
import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Cloud,
  Smartphone,
  Loader2,
  ShieldCheck,
  Scale,
  Users,
  Target,
  Wallet,
  Clock,
  AlertTriangle,
} from "lucide-react";

export interface ConflictSnapshot {
  /** ISO string da última atualização desta versão. Pode ser null se não houver. */
  updatedAt: string | null;
  /** Meta total do plano em reais. */
  goalAmount: number | null;
  /** Patrimônio atual estimado em reais. */
  currentWealth: number | null;
  /** Lista de participantes ativos do plano (nomes reais). */
  participants: string[];
  /** Modo do plano: "individual" | "casal" | null (desconhecido). */
  mode: "individual" | "casal" | null;
}

interface DataMigrationDialogProps {
  open: boolean;
  loading?: boolean;
  /** Resumo do que está salvo neste dispositivo. */
  localSnapshot: ConflictSnapshot | null;
  /** Resumo do que está salvo na conta. Null = sem dados na conta. */
  cloudSnapshot: ConflictSnapshot | null;
  /** Usuário decidiu usar os dados da conta (descartar locais nesta sessão). */
  onUseCloud: () => void;
  /** Usuário confirmou substituir os dados da conta pelos dados deste dispositivo. */
  onUseLocal: () => void;
  /** Usuário decidiu adiar — o app vai usar os dados da conta temporariamente. */
  onDecideLater: () => void;
  /** Fechar o modal sem decidir (equivalente a "Decidir depois"). */
  onClose: () => void;
}

const BRL = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  maximumFractionDigits: 0,
});

const DATE_FMT = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDate(iso: string | null): string {
  if (!iso) return "Sem data registrada";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "Sem data registrada";
  return DATE_FMT.format(d);
}

function formatMoney(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "—";
  return BRL.format(v);
}

function modeLabel(mode: ConflictSnapshot["mode"]): string {
  if (mode === "casal") return "Casal";
  if (mode === "individual") return "Individual";
  return "—";
}

interface VersionCardProps {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  snapshot: ConflictSnapshot | null;
  emptyHint: string;
  highlight?: boolean;
}

function VersionCard({ title, subtitle, icon, snapshot, emptyHint, highlight }: VersionCardProps) {
  const isEmpty = !snapshot;

  return (
    <div
      className={[
        "rounded-xl border p-4 space-y-3 transition-colors",
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-card",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center text-foreground">
            {icon}
          </div>
          <div>
            <div className="text-sm font-semibold">{title}</div>
            <div className="text-xs text-muted-foreground">{subtitle}</div>
          </div>
        </div>
        {snapshot?.mode && (
          <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
            {modeLabel(snapshot.mode)}
          </Badge>
        )}
      </div>

      {isEmpty ? (
        <p className="text-xs text-muted-foreground italic">{emptyHint}</p>
      ) : (
        <dl className="grid grid-cols-2 gap-3 text-xs">
          <div className="flex items-start gap-1.5 col-span-2">
            <Clock className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <dt className="text-muted-foreground">Última atualização</dt>
              <dd className="font-medium">{formatDate(snapshot.updatedAt)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <Target className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <dt className="text-muted-foreground">Meta</dt>
              <dd className="font-medium">{formatMoney(snapshot.goalAmount)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <Wallet className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <div>
              <dt className="text-muted-foreground">Patrimônio</dt>
              <dd className="font-medium">{formatMoney(snapshot.currentWealth)}</dd>
            </div>
          </div>
          <div className="flex items-start gap-1.5 col-span-2">
            <Users className="w-3.5 h-3.5 mt-0.5 text-muted-foreground shrink-0" />
            <div className="min-w-0">
              <dt className="text-muted-foreground">Participantes</dt>
              <dd className="font-medium truncate">
                {snapshot.participants.length > 0 ? snapshot.participants.join(", ") : "—"}
              </dd>
            </div>
          </div>
        </dl>
      )}
    </div>
  );
}

export function DataMigrationDialog({
  open,
  loading = false,
  localSnapshot,
  cloudSnapshot,
  onUseCloud,
  onUseLocal,
  onDecideLater,
  onClose,
}: DataMigrationDialogProps) {
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);
  const hasCloudData = !!cloudSnapshot;
  const hasLocalData = !!localSnapshot;

  const handleAttemptUseLocal = () => {
    if (hasCloudData) setConfirmOverwrite(true);
    else onUseLocal();
  };

  const handleConfirmOverwrite = () => {
    setConfirmOverwrite(false);
    onUseLocal();
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Scale className="w-5 h-5 text-primary" />
              Encontramos dados diferentes
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              Existe um plano salvo neste dispositivo e outro vinculado à sua conta.
              Compare as duas versões e escolha qual deseja usar. Nenhum dado será
              substituído sem confirmação e sem backup automático.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 sm:grid-cols-2 pt-1">
            <VersionCard
              title="Na sua conta"
              subtitle="Versão sincronizada na nuvem"
              icon={<Cloud className="w-4 h-4" />}
              snapshot={cloudSnapshot}
              emptyHint="Sua conta ainda não tem um plano salvo."
              highlight
            />
            <VersionCard
              title="Neste dispositivo"
              subtitle="Versão salva neste navegador"
              icon={<Smartphone className="w-4 h-4" />}
              snapshot={localSnapshot}
              emptyHint="Não encontramos dados neste dispositivo."
            />
          </div>

          <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
            <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
            <p>
              Antes de qualquer substituição, fazemos um backup local automático da
              versão que estava ativa. Você pode revisitar essa decisão depois.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-1">
            <Button
              variant="default"
              className="w-full justify-start h-auto py-3 rounded-xl"
              onClick={onUseCloud}
              disabled={loading || !hasCloudData}
            >
              <Cloud className="w-4 h-4 mr-2" />
              <div className="flex flex-col items-start text-left">
                <span className="font-semibold text-sm">Usar dados da conta</span>
                <span className="text-[11px] font-normal opacity-80">
                  Mantém o que já está salvo na nuvem. Os dados deste dispositivo
                  serão guardados em backup local.
                </span>
              </div>
              {loading && <Loader2 className="w-4 h-4 animate-spin ml-auto" />}
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-3 rounded-xl"
              onClick={handleAttemptUseLocal}
              disabled={loading || !hasLocalData}
            >
              <Smartphone className="w-4 h-4 mr-2" />
              <div className="flex flex-col items-start text-left">
                <span className="font-semibold text-sm">Usar dados deste dispositivo</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {hasCloudData
                    ? "Substitui os dados da sua conta. Pediremos uma confirmação extra."
                    : "Envia os dados deste dispositivo para sua conta."}
                </span>
              </div>
            </Button>

            <Button
              variant="ghost"
              className="w-full text-xs text-muted-foreground hover:text-foreground"
              onClick={onDecideLater}
              disabled={loading}
            >
              Decidir depois — manter os dados da conta nesta sessão
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOverwrite} onOpenChange={setConfirmOverwrite}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Tem certeza?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm leading-relaxed">
              <span className="block">
                Os dados atuais da sua conta serão substituídos pelos dados deste
                dispositivo. Vamos criar um backup local automático antes de continuar.
              </span>
              {cloudSnapshot && (
                <span className="block rounded-md bg-muted/70 px-3 py-2 text-xs text-foreground">
                  Versão atual da conta: meta {formatMoney(cloudSnapshot.goalAmount)},
                  patrimônio {formatMoney(cloudSnapshot.currentWealth)}, atualizada em{" "}
                  {formatDate(cloudSnapshot.updatedAt)}.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmOverwrite}
              disabled={loading}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Continuar e substituir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
