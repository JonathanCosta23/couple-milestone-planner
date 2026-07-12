import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { InvestorReference } from "@/features/education/types";
import { ContentFreshnessBadge } from "./ContentFreshnessBadge";
import { SourceList } from "./SourceList";

export function InvestorReferenceDetail({ investor, onBack }: { investor: InvestorReference; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl -ml-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>
      <Card className="glass-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold">{investor.full_name}</h3>
          <ContentFreshnessBadge reviewStatus={investor.review_status} lastVerifiedAt={investor.last_verified_at} />
        </div>
        <p className="text-xs text-muted-foreground">{investor.short_bio}</p>
        <Paragraph title="Contexto histórico" text={investor.historical_context} />
        <List title="Princípios documentados" items={investor.documented_principles} />
        <List title="Lições" items={investor.lessons} />
        <List title="Limitações" items={investor.limitations} />
        <List title="Riscos de copiar sem contexto" items={investor.controversies_or_risks} />
        {investor.historical_positions.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Posições históricas</p>
            <ul className="text-xs text-muted-foreground space-y-1">
              {investor.historical_positions.map((p, i) => (
                <li key={i}>
                  {p.description} — fonte {p.source?.source_name} · {p.reference_date}. Pode não representar a situação atual.
                </li>
              ))}
            </ul>
          </div>
        )}
        <SourceList sources={investor.sources} sourceDate={investor.source_date} />
        <p className="text-[10px] text-muted-foreground italic">{investor.educational_disclaimer}</p>
      </Card>
    </div>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (!items || items.length === 0) return null;
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">{title}</p>
      <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
        {items.map((it, i) => <li key={i}>{it}</li>)}
      </ul>
    </div>
  );
}

function Paragraph({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">{title}</p>
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}