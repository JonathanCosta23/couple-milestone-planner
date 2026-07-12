import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import type { AssetEducationCase } from "@/features/education/types";
import { ContentFreshnessBadge } from "./ContentFreshnessBadge";
import { SourceList } from "./SourceList";

export function AssetEducationDetail({ asset, onBack }: { asset: AssetEducationCase; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack} className="rounded-xl -ml-2">
        <ArrowLeft className="w-4 h-4 mr-1" /> Voltar
      </Button>
      <Card className="glass-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="text-base font-semibold">{asset.company_name}</h3>
            <p className="text-xs text-muted-foreground">
              {asset.ticker ?? "Ticker não confirmado"}{asset.share_class ? ` · ${asset.share_class}` : ""} · {asset.sector}
            </p>
          </div>
          <ContentFreshnessBadge reviewStatus={asset.review_status} lastVerifiedAt={asset.last_verified_at} />
        </div>

        {!asset.ticker_validated && (
          <div className="text-xs bg-muted rounded-xl p-3 border border-border">
            Ficha pendente de validação oficial do ticker e da classe de ações. Use como estudo, não como decisão de investimento.
          </div>
        )}

        <Paragraph title="Modelo de negócio" text={asset.business_model} />
        <List title="Direcionadores de receita" items={asset.revenue_drivers} />
        <List title="Direcionadores de custo" items={asset.cost_drivers} />
        <List title="Vantagens competitivas mencionadas" items={asset.competitive_advantages} />

        <Exposures asset={asset} />

        {asset.governance_summary ? <Paragraph title="Governança" text={asset.governance_summary} /> : null}
        {asset.debt_summary ? <Paragraph title="Endividamento" text={asset.debt_summary} /> : null}
        {asset.cash_flow_summary ? <Paragraph title="Geração de caixa" text={asset.cash_flow_summary} /> : null}
        {asset.dividend_summary ? <Paragraph title="Dividendos" text={asset.dividend_summary} /> : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
              O que pode sustentar uma visão favorável
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {asset.positive_thesis.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </div>
          <div className="bg-muted/40 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground mb-1">
              O que pode invalidar ou enfraquecer essa visão
            </p>
            <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
              {asset.negative_thesis.map((it, i) => <li key={i}>{it}</li>)}
            </ul>
          </div>
        </div>

        <List title="Riscos-chave" items={asset.key_risks} />
        <List title="Indicadores a acompanhar" items={asset.indicators_to_watch} />
        <List title="Eventos a acompanhar" items={asset.events_to_watch} />

        {asset.reporting_period ? (
          <p className="text-[10px] text-muted-foreground">Período de referência: {asset.reporting_period}</p>
        ) : null}

        <SourceList sources={asset.sources} sourceDate={asset.source_date} />
        <p className="text-[10px] text-muted-foreground italic">{asset.educational_disclaimer}</p>
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

function Exposures({ asset }: { asset: AssetEducationCase }) {
  const rows: Array<[string, string | null]> = [
    ["Intensidade de capital", asset.capital_intensity],
    ["Ciclicidade", asset.cyclicality],
    ["Exposição a governo", asset.government_exposure],
    ["Exposição cambial", asset.currency_exposure],
    ["Exposição a commodity", asset.commodity_exposure],
    ["Exposição regulatória", asset.regulatory_exposure],
  ].filter((r): r is [string, string] => Boolean(r[1]));
  if (rows.length === 0) return null;
  return (
    <div className="grid grid-cols-2 gap-2">
      {rows.map(([label, value]) => (
        <div key={label} className="bg-muted/40 rounded-xl p-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
          <p className="text-xs font-medium">{value}</p>
        </div>
      ))}
    </div>
  );
}