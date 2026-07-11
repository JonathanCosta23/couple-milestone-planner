/**
 * FgcOverview — painel Simples por padrão dentro da Arquitetura Patrimonial.
 * Nenhuma nova aba na navegação principal.
 */
import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, AlertTriangle, Info, ExternalLink } from "lucide-react";
import type { AppData } from "@/lib/models";
import { formatBRL } from "@/lib/types";
import { classifyInvestmentForFgc } from "../services/fgcClassification";
import { calculateFgcDiagnosis } from "../services/fgcCalculator";
import { computeFgcNextAction } from "../services/fgcNextAction";
import { FGC_DISCLAIMER_MARGIN, type PrudentialMarginPreset } from "../types/fgc";
import { useFgcData } from "../hooks/useFgcData";
import { FgcConglomerateTable } from "./FgcConglomerateTable";

const MARGIN_MAP: Record<PrudentialMarginPreset, number> = { none: 0, "5": 0.05, "10": 0.1, custom: 0 };

export function FgcOverview({ appData }: { appData: AppData }) {
  const fgc = useFgcData();
  const [detailed, setDetailed] = useState(false);
  const [marginPreset, setMarginPreset] = useState<PrudentialMarginPreset>("none");
  const margin = MARGIN_MAP[marginPreset];

  const diagnosis = useMemo(() => {
    const primaryId = appData.primaryProfile.id;
    const titularNames: Record<string, string> = { [primaryId]: appData.primaryProfile.name };
    if (appData.partner) titularNames[appData.partner.profile.id] = appData.partner.profile.name;
    const conglomerateNames: Record<string, string> = {};
    fgc.conglomerates.forEach(c => { conglomerateNames[c.id] = c.officialName; });
    const inputs = appData.investments.filter(i => i.active)
      .map(inv => classifyInvestmentForFgc(inv, fgc.institutions, primaryId));
    return calculateFgcDiagnosis({
      assets: inputs, ordinaryLimitRule: fgc.ordinary, prudentialMargin: margin,
      titularNames, conglomerateNames,
    });
  }, [appData, fgc.institutions, fgc.conglomerates, fgc.ordinary, margin]);

  const nextAction = useMemo(() => computeFgcNextAction({ diagnosis }), [diagnosis]);
  const hasAssets = appData.investments.some(i => i.active);

  if (fgc.loading) {
    return <Card className="glass-card p-4"><p className="text-xs text-muted-foreground">Carregando regras oficiais do FGC…</p></Card>;
  }

  return (
    <div className="space-y-4">
      <Card className="glass-card-strong p-4 lg:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <h4 className="font-bold text-sm lg:text-base">Proteção FGC</h4>
            <p className="text-xs text-muted-foreground mt-0.5">
              O FGC reduz determinados riscos de crédito, mas não elimina todos os riscos.
            </p>
          </div>
        </div>

        {!hasAssets ? (
          <div className="rounded-xl bg-muted/30 p-4 text-center">
            <p className="text-sm">Cadastre seus investimentos para avaliar a exposição por conglomerado.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2">
              <SimpleCard label="Proteção potencial" value={formatBRL(diagnosis.totalPotentiallyCovered)} tone="positive" />
              <SimpleCard label="Excesso identificado" value={formatBRL(diagnosis.totalOfficialExcess)} tone={diagnosis.totalOfficialExcess > 0 ? "warning" : "muted"} />
              <SimpleCard label="Dados para revisar" value={formatBRL(diagnosis.totalUnverified + diagnosis.totalNeedsReview)} tone={(diagnosis.totalUnverified + diagnosis.totalNeedsReview) > 0 ? "warning" : "muted"} />
            </div>

            {diagnosis.topConglomerate && (
              <p className="text-xs text-muted-foreground">
                Maior exposição por conglomerado: <span className="font-semibold text-foreground">{diagnosis.topConglomerate.name}</span> — {formatBRL(diagnosis.topConglomerate.amount)}
              </p>
            )}

            <div className="rounded-xl bg-primary/5 border border-primary/20 p-3">
              <p className="text-xs font-bold text-primary">{nextAction.headline}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{nextAction.detail}</p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground">Margem prudencial:</span>
              {(["none", "5", "10"] as PrudentialMarginPreset[]).map(m => (
                <Button key={m} size="sm" variant={marginPreset === m ? "default" : "outline"}
                  onClick={() => setMarginPreset(m)} className="h-7 text-xs">
                  {m === "none" ? "Sem margem" : `${m}%`}
                </Button>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground flex items-start gap-1.5">
              <Info className="w-3 h-3 mt-0.5 shrink-0" /> {FGC_DISCLAIMER_MARGIN}
            </p>

            <Button variant="outline" size="sm" className="w-full" onClick={() => setDetailed(v => !v)}>
              {detailed ? "Ocultar modo detalhado" : "Ver modo detalhado"}
            </Button>
          </>
        )}

        <div className="pt-2 border-t border-border/50 space-y-1">
          <p className="text-[10px] text-muted-foreground">
            Regra oficial: {formatBRL(diagnosis.officialLimit)} por CPF por conglomerado — versão {diagnosis.ruleVersion}
          </p>
          <p className="text-[10px] text-muted-foreground flex items-center gap-1 flex-wrap">
            Fonte: {diagnosis.ruleSourceName} • vigência {diagnosis.ruleEffectiveDate}
            {fgc.usingFallback && <span className="text-warning ml-1 inline-flex items-center gap-0.5"><AlertTriangle className="w-2.5 h-2.5" /> usando cache local</span>}
          </p>
          <a href="https://www.fgc.org.br/" target="_blank" rel="noopener noreferrer"
            className="text-[10px] text-primary hover:underline inline-flex items-center gap-1">
            fgc.org.br <ExternalLink className="w-2.5 h-2.5" />
          </a>
        </div>
      </Card>

      {detailed && hasAssets && <FgcConglomerateTable diagnosis={diagnosis} />}
    </div>
  );
}

function SimpleCard({ label, value, tone }: { label: string; value: string; tone: "positive" | "warning" | "muted" }) {
  const color = tone === "positive" ? "text-primary" : tone === "warning" ? "text-warning" : "text-muted-foreground";
  return (
    <div className="rounded-lg bg-muted/30 p-2.5 text-center min-w-0">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold mt-0.5 break-words ${color}`}>{value}</p>
    </div>
  );
}