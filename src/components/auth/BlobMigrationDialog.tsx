/**
 * BlobMigrationDialog — migração assistida do blob legado.
 */
import { useState } from "react";
import { ResponsiveModal } from "@/components/ui/responsive-modal";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  Database,
  Wallet,
  Receipt,
  AlertCircle,
  ShieldCheck,
  CheckCircle2,
  Landmark,
} from "lucide-react";

interface BlobMigrationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  counts: { assets: number; incomes: number; expenses: number; debts: number };
  loading?: boolean;
  onMigrate: () => Promise<void> | void;
  onLater: () => void;
}

export function BlobMigrationDialog({
  open, onOpenChange, counts, loading = false, onMigrate, onLater,
}: BlobMigrationDialogProps) {
  const [running, setRunning] = useState(false);
  const total = counts.assets + counts.incomes + counts.expenses + counts.debts;

  const handleMigrate = async () => {
    setRunning(true);
    try {
      await onMigrate();
    } finally {
      setRunning(false);
    }
  };

  return (
    <ResponsiveModal
      open={open}
      onOpenChange={onOpenChange}
      maxWidth="max-w-md"
      title={
        <span className="flex items-center gap-2 text-lg">
          <Database className="w-5 h-5 text-primary" />
          Vamos organizar seus dados
        </span>
      }
      description={
        <>
          Encontramos {total} item{total !== 1 ? "s" : ""} no formato antigo.
          Vamos migrar para a nova estrutura. Registros cujo responsável não puder
          ser identificado ficarão marcados para revisão, sem atribuição automática.
        </>
      }
    >
      <div className="grid gap-2 py-2">
        <Stat icon={<Landmark className="w-4 h-4 text-primary" />} label="Investimentos" value={counts.assets} />
        <Stat icon={<Wallet className="w-4 h-4 text-primary" />} label="Fontes de renda" value={counts.incomes} />
        <Stat icon={<Receipt className="w-4 h-4 text-primary" />} label="Gastos" value={counts.expenses} />
        <Stat icon={<AlertCircle className="w-4 h-4 text-primary" />} label="Dívidas" value={counts.debts} />
      </div>

      <div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
        <ShieldCheck className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <p>
          Fazemos backup local automático antes de migrar. A versão antiga continua
          disponível como fallback até você confirmar que tudo está certo.
        </p>
      </div>

      <div className="flex flex-col gap-2 pt-3">
        <Button
          onClick={handleMigrate}
          disabled={loading || running || total === 0}
          className="w-full h-12 lg:h-11 text-base lg:text-sm"
        >
          {running ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Migrando…</>
          ) : (
            <><CheckCircle2 className="w-4 h-4 mr-2" /> Migrar agora</>
          )}
        </Button>
        <Button
          variant="ghost"
          onClick={onLater}
          disabled={running}
          className="w-full text-xs text-muted-foreground h-10"
        >
          Decidir depois — manter o formato antigo nesta sessão
        </Button>
      </div>
    </ResponsiveModal>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-bold">{value}</span>
    </div>
  );
}
