import { Card } from "@/components/ui/card";
import { formatBRL } from "@/lib/types";
import type { FgcDiagnosis } from "../types/fgc";

export function FgcConglomerateTable({ diagnosis }: { diagnosis: FgcDiagnosis }) {
  if (diagnosis.rows.length === 0) {
    return (
      <Card className="glass-card p-4">
        <p className="text-xs text-muted-foreground">Sem exposição potencialmente coberta agrupável por titular/conglomerado no momento.</p>
      </Card>
    );
  }
  return (
    <Card className="glass-card p-4 space-y-3">
      <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Exposição por titular e conglomerado</h5>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-muted-foreground">
            <tr className="text-left border-b border-border/50">
              <th className="py-1.5 pr-2">Titular</th>
              <th className="py-1.5 pr-2">Conglomerado</th>
              <th className="py-1.5 pr-2 text-right">Saldo elegível</th>
              <th className="py-1.5 pr-2 text-right">Coberto (oficial)</th>
              <th className="py-1.5 pr-2 text-right">Excedente</th>
              <th className="py-1.5 text-right">Uso</th>
            </tr>
          </thead>
          <tbody>
            {diagnosis.rows.map((r, i) => (
              <tr key={i} className="border-b border-border/30">
                <td className="py-1.5 pr-2">{r.titularName}</td>
                <td className="py-1.5 pr-2">{r.conglomerateName}</td>
                <td className="py-1.5 pr-2 text-right font-mono">{formatBRL(r.eligibleBalance)}</td>
                <td className="py-1.5 pr-2 text-right font-mono">{formatBRL(r.officialCovered)}</td>
                <td className={`py-1.5 pr-2 text-right font-mono ${r.officialExcess > 0 ? "text-warning" : ""}`}>{formatBRL(r.officialExcess)}</td>
                <td className="py-1.5 text-right">{Math.round(r.officialUsage * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] text-muted-foreground">
        Regra vigente: {formatBRL(diagnosis.officialLimit)} • versão {diagnosis.ruleVersion} • fonte {diagnosis.ruleSourceName}
      </p>
    </Card>
  );
}