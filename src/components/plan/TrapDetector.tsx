import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { TRAP_CHECKLIST, evaluateTrap, TrapCheckResult } from "@/lib/behavioralEngine";
import { ShieldAlert, AlertTriangle, CheckCircle, XCircle } from "lucide-react";

export function TrapDetector() {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const result = evaluateTrap(checkedIds);

  const toggle = (id: string) => {
    setCheckedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const verdictConfig = {
    safe: { icon: CheckCircle, color: "text-primary", bg: "bg-primary/10", label: "Parece seguro" },
    caution: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", label: "Atenção" },
    danger: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", label: "Perigo" },
    scam: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Alto risco de golpe" },
  };

  const v = verdictConfig[result.verdict];
  const VerdictIcon = v.icon;

  return (
    <div className="space-y-4">
      <Card className="glass-card-strong p-4 text-center">
        <ShieldAlert className="w-6 h-6 text-primary mx-auto mb-2" />
        <h3 className="font-bold">Radar de Armadilhas</h3>
        <p className="text-xs text-muted-foreground mt-1">Avalie oportunidades de investimento antes de cair em ciladas</p>
      </Card>

      <Card className="glass-card p-4 space-y-3">
        <p className="text-sm font-semibold">Checklist de Risco</p>
        <p className="text-xs text-muted-foreground">Marque os sinais presentes na "oportunidade" que estão te oferecendo:</p>
        <div className="space-y-2.5 mt-2">
          {TRAP_CHECKLIST.map(item => (
            <label key={item.id} className="flex items-start gap-2.5 cursor-pointer group">
              <Checkbox
                checked={checkedIds.includes(item.id)}
                onCheckedChange={() => toggle(item.id)}
                className="mt-0.5"
              />
              <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                {item.label}
              </span>
            </label>
          ))}
        </div>
      </Card>

      {/* Result */}
      <Card className={`glass-card p-4 border ${result.verdict === "safe" ? "border-primary/20" : result.verdict === "scam" ? "border-destructive/30" : "border-warning/20"}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2 rounded-full ${v.bg}`}>
            <VerdictIcon className={`w-5 h-5 ${v.color}`} />
          </div>
          <div>
            <p className={`text-sm font-bold ${v.color}`}>{v.label}</p>
            <p className="text-xs text-muted-foreground">Score de risco: {result.score}/100</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
      </Card>

      {/* Educational note */}
      <Card className="glass-card p-3 border-primary/10">
        <p className="text-[10px] text-primary uppercase font-bold mb-1">Lembre-se</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Investimento legítimo tem risco, prazo e explicação clara. Se alguém promete risco zero com retorno alto, desconfie. Consulte sempre se a empresa é regulada pela CVM ou Banco Central.
        </p>
      </Card>
    </div>
  );
}
