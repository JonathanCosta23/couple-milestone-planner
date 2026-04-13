import { PlanConfig, MonthRecord, formatBRL, FinancialProfile } from "@/lib/types";
import { generateWhatsAppSummary } from "@/lib/calculator";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Share2, MessageCircle, Download, Upload, Copy } from "lucide-react";
import { toast } from "sonner";

interface SharePlanProps {
  config: PlanConfig;
  monthRecords: MonthRecord[];
  startDate: string;
  profile?: FinancialProfile;
  onExportJSON: () => void;
  onImportClick: () => void;
}

export function SharePlan({ config, monthRecords, startDate, profile, onExportJSON, onImportClick }: SharePlanProps) {
  const handleWhatsApp = () => {
    const text = generateWhatsAppSummary(config, monthRecords, startDate, profile);
    navigator.clipboard.writeText(text);
    toast.success("Resumo copiado! Cole no WhatsApp.");
  };

  return (
    <Card className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Share2 className="w-5 h-5 text-primary" />
        <h3 className="font-semibold text-sm">Compartilhar e exportar</h3>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Button variant="outline" size="sm" className="flex-col h-auto py-3 gap-1.5" onClick={handleWhatsApp}>
          <MessageCircle className="w-4 h-4" />
          <span className="text-[10px]">WhatsApp</span>
        </Button>
        <Button variant="outline" size="sm" className="flex-col h-auto py-3 gap-1.5" onClick={onExportJSON}>
          <Download className="w-4 h-4" />
          <span className="text-[10px]">Exportar</span>
        </Button>
        <Button variant="outline" size="sm" className="flex-col h-auto py-3 gap-1.5" onClick={onImportClick}>
          <Upload className="w-4 h-4" />
          <span className="text-[10px]">Importar</span>
        </Button>
      </div>
    </Card>
  );
}
