import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Info } from "lucide-react";

export interface CalculationMemoryProps {
  formula: string;
  inputs: { label: string; value: string }[];
  intermediate?: { label: string; value: string }[];
  assumptions: string[];
  limitations: string[];
  source?: { name: string; url?: string };
  lastReviewedAt?: string;
  disclaimer?: string;
}

export function CalculationMemory({
  formula, inputs, intermediate = [], assumptions, limitations, source, lastReviewedAt,
  disclaimer = "Conteúdo educacional. Não constitui recomendação de investimento.",
}: CalculationMemoryProps) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <Button variant="ghost" size="sm" className="text-xs h-8 gap-1" onClick={() => setOpen((v) => !v)}>
        <Info className="w-3.5 h-3.5" /> Entender o cálculo
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </Button>
      {open && (
        <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs space-y-3">
          <Section title="Fórmula">
            <code className="text-[11px]">{formula}</code>
          </Section>
          <Section title="Dados utilizados">
            <List items={inputs} />
          </Section>
          {intermediate.length > 0 && (
            <Section title="Resultado intermediário">
              <List items={intermediate} />
            </Section>
          )}
          <Section title="Premissas">
            <Bullets items={assumptions} />
          </Section>
          <Section title="Limitações">
            <Bullets items={limitations} />
          </Section>
          {(source || lastReviewedAt) && (
            <Section title="Fonte e revisão">
              {source && (
                <p className="text-muted-foreground">
                  {source.url ? (
                    <a className="text-primary hover:underline" href={source.url} target="_blank" rel="noopener noreferrer">{source.name}</a>
                  ) : source.name}
                </p>
              )}
              {lastReviewedAt && <p className="text-muted-foreground">Última revisão: {lastReviewedAt}</p>}
            </Section>
          )}
          <p className="italic text-muted-foreground">{disclaimer}</p>
        </div>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">{title}</p>
      {children}
    </div>
  );
}
function List({ items }: { items: { label: string; value: string }[] }) {
  return (
    <ul className="space-y-0.5">
      {items.map((it, i) => (
        <li key={i} className="flex justify-between gap-2">
          <span className="text-muted-foreground">{it.label}</span>
          <span className="font-medium">{it.value}</span>
        </li>
      ))}
    </ul>
  );
}
function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
      {items.map((it, i) => <li key={i}>{it}</li>)}
    </ul>
  );
}