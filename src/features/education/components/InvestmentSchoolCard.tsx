import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Compass } from "lucide-react";
import type { InvestmentSchool } from "@/features/education/types";

export function InvestmentSchoolCard({ school, onOpen }: { school: InvestmentSchool; onOpen: (s: InvestmentSchool) => void }) {
  return (
    <Card className="glass-card p-4 space-y-2">
      <div className="flex items-start gap-2">
        <Compass className="w-4 h-4 text-primary mt-0.5 shrink-0" />
        <div className="min-w-0">
          <p className="text-sm font-semibold">{school.name}</p>
          <p className="text-xs text-muted-foreground">{school.summary}</p>
        </div>
      </div>
      <p className="text-[11px] italic text-muted-foreground">"{school.central_question}"</p>
      <Button variant="outline" size="sm" className="w-full justify-between rounded-xl" onClick={() => onOpen(school)}>
        <span>Entender esta escola</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Button>
    </Card>
  );
}