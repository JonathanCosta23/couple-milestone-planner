import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, ChevronDown, ChevronUp, Clock, X } from "lucide-react";
import type { NextBestAction } from "../types/nextAction";

interface Props {
  action: NextBestAction;
  onNavigate: (tab: string, sub?: string) => void;
  onComplete: () => void;
  onSnooze: (iso: string) => void;
  onDismiss: (reason?: string) => void;
  onOpened?: () => void;
}

function addDaysISO(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export function NextActionCard({ action, onNavigate, onComplete, onSnooze, onDismiss, onOpened }: Props) {
  const [expanded, setExpanded] = useState(false);
  const [snoozeOpen, setSnoozeOpen] = useState(false);

  return (
    <Card className="glass-card p-4 space-y-3">
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
            Sua próxima ação
          </p>
          <p className="text-sm font-semibold leading-snug">{action.title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{action.description}</p>
          {action.confidence === "insufficient_data" || action.confidence === "low" ? (
            <p className="text-[11px] text-warning">
              Esta orientação depende de informações que ainda precisam ser confirmadas.
            </p>
          ) : null}
        </div>
      </div>

      <Button
        variant="default"
        size="sm"
        className="w-full justify-between rounded-xl touch-target"
        onClick={() => {
          onOpened?.();
          onNavigate(action.destination.tab, action.destination.sub);
        }}
      >
        <span>{action.ctaLabel}</span>
        <ArrowRight className="w-3.5 h-3.5" />
      </Button>

      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <button
          type="button"
          className="flex items-center gap-1 hover:text-foreground transition-colors"
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          Por que isso?
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => setSnoozeOpen((v) => !v)}
          >
            <Clock className="w-3 h-3" /> Adiar
          </button>
          <button
            type="button"
            className="flex items-center gap-1 hover:text-foreground transition-colors"
            onClick={() => onDismiss("não é prioridade")}
          >
            <X className="w-3 h-3" /> Não se aplica
          </button>
        </div>
      </div>

      {snoozeOpen && (
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Amanhã", days: 1 },
            { label: "Próxima semana", days: 7 },
            { label: "Próximo mês", days: 30 },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              className="text-[11px] rounded-lg border px-2 py-1 hover:bg-muted/40"
              onClick={() => {
                onSnooze(addDaysISO(opt.days));
                setSnoozeOpen(false);
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

      {expanded && (
        <div className="space-y-2 border-t pt-3 text-xs text-muted-foreground">
          <p>
            <span className="font-semibold text-foreground">Motivo: </span>
            {action.reason}
          </p>
          {action.evidence.length > 0 && (
            <div>
              <p className="font-semibold text-foreground">Evidências</p>
              <ul className="mt-1 space-y-0.5">
                {action.evidence.map((e, i) => (
                  <li key={i}>
                    {e.label}
                    {e.value ? `: ${e.value}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {action.calculationSummary && (
            <p>
              <span className="font-semibold text-foreground">Cálculo: </span>
              {action.calculationSummary}
            </p>
          )}
          <p>
            <span className="font-semibold text-foreground">Se eu adiar: </span>
            {action.riskIfIgnored}
          </p>
          <p>
            <span className="font-semibold text-foreground">Como concluir: </span>
            {action.completionCriteria}
          </p>
          {action.missingData && action.missingData.length > 0 && (
            <p className="text-warning">
              Dados pendentes: {action.missingData.join(", ")}
            </p>
          )}
          <div className="flex items-center gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={onComplete}>
              Já resolvi
            </Button>
          </div>
          <p className="text-[10px] italic pt-2">
            Orientação educacional baseada nos dados informados. Não constitui recomendação de investimento.
          </p>
        </div>
      )}
    </Card>
  );
}