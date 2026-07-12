import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { InvestmentSchool } from "@/features/education/types";
import { ContentFreshnessBadge } from "./ContentFreshnessBadge";

export function InvestmentSchoolDetail({ school, onBack }: { school: InvestmentSchool; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl -ml-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>
      <Card className="glass-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-semibold">{school.name}</h3>
          <ContentFreshnessBadge reviewStatus={school.review_status} lastVerifiedAt={school.last_verified_at} />
        </div>
        <p className="text-xs text-muted-foreground">{school.summary}</p>
        <div className="text-xs bg-muted/40 rounded-xl p-3">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">Pergunta central</p>
          <p className="italic">"{school.central_question}"</p>
        </div>
        <Section title="Conceitos-chave" items={school.core_concepts} />
        <Section title="Riscos e armadilhas" items={school.key_risks} />
        <Section title="Limitações" items={school.limitations} />
        {school.when_it_works ? <Paragraph title="Quando tende a funcionar" text={school.when_it_works} /> : null}
        {school.when_it_fails ? <Paragraph title="Quando pode falhar" text={school.when_it_fails} /> : null}
        <p className="text-[10px] text-muted-foreground italic">{school.educational_disclaimer}</p>
      </Card>
    </div>
  );
}

function Section({ title, items }: { title: string; items: string[] }) {
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