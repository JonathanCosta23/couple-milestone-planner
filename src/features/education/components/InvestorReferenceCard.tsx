import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, User } from "lucide-react";
import type { InvestorReference } from "@/features/education/types";

export function InvestorReferenceCard({ investor, onOpen }: { investor: InvestorReference; onOpen: (i: InvestorReference) => void }) {
  return (
    <Card className="glass-card p-4 space-y-2">
      <div className="flex items-start gap-2">
        <User className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{investor.full_name}</p>
          <p className="text-xs text-muted-foreground">{investor.short_bio}</p>
        </div>
      </div>
      <Button variant="outline" size="sm" className="w-full justify-between rounded-xl" onClick={() => onOpen(investor)}>
        <span>Ver referência</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </Card>
  );
}