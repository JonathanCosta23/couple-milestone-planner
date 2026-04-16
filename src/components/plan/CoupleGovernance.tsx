import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppData } from "@/lib/models";
import { PlanConfig, formatBRLCompact } from "@/lib/types";
import type { FinancialCoreState } from "@/hooks/useFinancialCore";
import { Users, User, Eye, Shield, ArrowRight, UserPlus } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
  core: FinancialCoreState;
  onNavigateToTab?: (tab: string) => void;
}

type ViewMode = "consolidated" | "individual";

export function CoupleGovernance({ appData, config, core, onNavigateToTab }: Props) {
  const [view, setView] = useState<ViewMode>("consolidated");
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const { allocation, metrics } = core;

  const isCoupleMode = appData.mode === "couple" && appData.partner && !appData.partner.removedAt;
  const totalWealth = metrics.grossWealth;
  const titulares = allocation.titulares;

  const profiles = [
    { id: appData.primaryProfile.id, name: appData.primaryProfile.name || "Você" },
    ...(isCoupleMode && appData.partner ? [{ id: appData.partner.profile.id, name: appData.partner.profile.name || "Parceiro(a)" }] : []),
  ];

  // Solo mode — show smart empty state with CTA to activate couple
  if (!isCoupleMode) {
    return (
      <Card className="glass-card p-6 text-center space-y-4">
        <Users className="w-10 h-10 text-muted-foreground mx-auto" />
        <h3 className="font-bold text-lg">Governança Patrimonial</h3>
        <p className="text-sm text-muted-foreground leading-relaxed max-w-sm mx-auto">
          A governança patrimonial fica disponível quando o modo casal está ativado.
          Com ela, você visualiza a distribuição por titular, proteção individual e recomendações conjuntas.
        </p>
        <Button
          variant="outline"
          className="mx-auto"
          onClick={() => onNavigateToTab?.("dados")}
        >
          <UserPlus className="w-4 h-4 mr-2" /> Ativar modo casal
        </Button>
      </Card>
    );
  }

  const FGC_LIMIT = 250_000;

  return (
    <div className="space-y-4 lg:space-y-5">
      <Card className="glass-card-strong p-4 lg:p-5 text-center">
        <Users className="w-6 h-6 lg:w-7 lg:h-7 text-primary mx-auto mb-2" />
        <h3 className="font-bold lg:text-lg">Governança Patrimonial</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Visão por titular — como o patrimônio está distribuído entre {profiles.map(p => p.name).join(" e ")}
        </p>
      </Card>

      <div className="flex gap-2">
        <Button variant={view === "consolidated" ? "default" : "outline"} size="sm" className="flex-1 rounded-full" onClick={() => setView("consolidated")}>
          <Eye className="w-4 h-4 mr-1.5" /> Consolidada
        </Button>
        <Button variant={view === "individual" ? "default" : "outline"} size="sm" className="flex-1 rounded-full" onClick={() => setView("individual")}>
          <User className="w-4 h-4 mr-1.5" /> Individual
        </Button>
      </div>

      {view === "consolidated" ? (
        <>
          <Card className="glass-card p-4 lg:p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Distribuição por Titular</h4>
            {titulares.map(t => {
              const pct = totalWealth > 0 ? t.totalAmount / totalWealth : 0;
              return (
                <div key={t.titularId} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{t.titularName}</span>
                    <span className="text-sm font-bold">
                      {formatBRLCompact(t.totalAmount)}
                      <span className="text-muted-foreground text-xs ml-1">({(pct * 100).toFixed(0)}%)</span>
                    </span>
                  </div>
                  <Progress value={pct * 100} className="h-2" />
                </div>
              );
            })}
          </Card>

          <Card className="glass-card p-4 lg:p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" /> Proteção FGC por Titular
            </h4>
            {titulares.map(t => (
              <div key={t.titularId} className="space-y-2">
                <p className="text-sm font-medium">{t.titularName}</p>
                {t.institutions.length === 0 ? (
                  <p className="text-xs text-muted-foreground pl-2">Nenhum investimento com proteção FGC</p>
                ) : (
                  t.institutions.filter(i => i.fgcCovered > 0).map(inst => (
                    <div key={inst.institution} className="pl-2 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span>{inst.institution}</span>
                        <span className={inst.fgcCovered > FGC_LIMIT * 0.9 ? "text-destructive font-medium" : inst.fgcCovered > FGC_LIMIT * 0.7 ? "text-warning font-medium" : ""}>
                          {formatBRLCompact(inst.fgcCovered)} / R$ 250k
                        </span>
                      </div>
                      <Progress value={Math.min(100, (inst.fgcCovered / FGC_LIMIT) * 100)} className="h-1" />
                      <p className="text-[10px] text-muted-foreground">Disponível: {formatBRLCompact(inst.headroom)}</p>
                    </div>
                  ))
                )}
              </div>
            ))}
          </Card>

          {/* Recommendations */}
          {(() => {
            const recs: string[] = [];
            const primary = titulares.find(t => t.titularId === appData.primaryProfile.id);
            const partner = titulares.find(t => t.titularId === appData.partner?.profile.id);
            if (primary && partner && totalWealth > 0) {
              const primaryPct = primary.totalAmount / totalWealth;
              if (primaryPct > 0.8) {
                recs.push(`${(primaryPct * 100).toFixed(0)}% do patrimônio está no nome de ${primary.titularName}. Distribuir melhor amplia a proteção do FGC.`);
              }
            }
            if (recs.length === 0) return null;
            return (
              <Card className="glass-card p-4 lg:p-5 border-primary/20 space-y-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-2">
                  <ArrowRight className="w-3.5 h-3.5" /> Recomendações para o Casal
                </h4>
                {recs.map((rec, i) => (
                  <p key={i} className="text-xs sm:text-sm text-muted-foreground leading-relaxed">💡 {rec}</p>
                ))}
              </Card>
            );
          })()}
        </>
      ) : (
        <>
          <div className="flex gap-2 mb-2">
            {profiles.map(p => (
              <Button key={p.id} variant={selectedProfile === p.id ? "default" : "outline"} size="sm" className="flex-1 rounded-full" onClick={() => setSelectedProfile(p.id)}>
                {p.name}
              </Button>
            ))}
          </div>

          {selectedProfile && (() => {
            const titular = titulares.find(t => t.titularId === selectedProfile);
            const profile = profiles.find(p => p.id === selectedProfile);
            if (!titular || !profile) return null;

            const allInvestments = titular.institutions.flatMap(i => i.investments);

            return (
              <Card className="glass-card p-4 lg:p-5 space-y-4">
                <div className="text-center">
                  <User className="w-6 h-6 text-primary mx-auto mb-1" />
                  <h4 className="font-bold">{profile.name}</h4>
                  <p className="text-2xl font-bold text-primary mt-1">{formatBRLCompact(titular.totalAmount)}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalWealth > 0 ? `${((titular.totalAmount / totalWealth) * 100).toFixed(0)}%` : "0%"} do patrimônio total
                  </p>
                </div>

                {allInvestments.length > 0 ? (
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Investimentos</h5>
                    {allInvestments.map(inv => (
                      <div key={inv.id} className="flex justify-between py-2 px-3 rounded-lg bg-muted/20 text-sm">
                        <span className="truncate">{inv.name || inv.type} — {inv.institution}</span>
                        <span className="font-bold shrink-0 ml-2">{formatBRLCompact(inv.currentBalance)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center">Nenhum investimento registrado para este titular.</p>
                )}
              </Card>
            );
          })()}

          {!selectedProfile && (
            <Card className="glass-card p-6 text-center">
              <p className="text-sm text-muted-foreground">Selecione um titular acima para ver a visão individual.</p>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
