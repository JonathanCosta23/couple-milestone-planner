import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AppData } from "@/lib/models";
import { PlanConfig, formatBRLCompact } from "@/lib/types";
import { calculateConcentrationRisks, checkFGCAlerts } from "@/lib/financialEngine";
import { Users, User, Eye, Shield, AlertTriangle, ArrowRight } from "lucide-react";

interface Props {
  appData: AppData;
  config: PlanConfig;
}

type ViewMode = "consolidated" | "individual";

export function CoupleGovernance({ appData, config }: Props) {
  const [view, setView] = useState<ViewMode>("consolidated");
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);

  const isCoupleMode = appData.mode === "couple" && appData.partner;
  const activeInvestments = appData.investments.filter(i => i.active);
  const totalWealth = activeInvestments.reduce((s, i) => s + i.currentBalance, 0) + config.initialAmount;

  const profiles = useMemo(() => {
    const list = [{ id: appData.primaryProfile.id, name: appData.primaryProfile.name }];
    if (appData.partner) {
      list.push({ id: appData.partner.profile.id, name: appData.partner.profile.name });
    }
    return list;
  }, [appData]);

  const byTitular = useMemo(() => {
    const map = new Map<string, { balance: number; investments: typeof activeInvestments; fgcExposure: Map<string, number> }>();
    profiles.forEach(p => map.set(p.id, { balance: 0, investments: [], fgcExposure: new Map() }));

    activeInvestments.forEach(inv => {
      const titularId = inv.titular || inv.profileId || appData.primaryProfile.id;
      const entry = map.get(titularId) || map.get(appData.primaryProfile.id)!;
      entry.balance += inv.currentBalance;
      entry.investments.push(inv);
      if (["cdb", "lci-lca", "poupanca"].includes(inv.type)) {
        entry.fgcExposure.set(inv.institution, (entry.fgcExposure.get(inv.institution) || 0) + inv.currentBalance);
      }
    });

    // Add initial amount to primary
    const primary = map.get(appData.primaryProfile.id)!;
    primary.balance += config.initialAmount;

    return map;
  }, [activeInvestments, appData, config, profiles]);

  if (!isCoupleMode) {
    return (
      <Card className="glass-card p-6 text-center">
        <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
        <h3 className="font-bold">Governança Patrimonial</h3>
        <p className="text-sm text-muted-foreground mt-2">
          Ative o modo casal no seu plano para visualizar a distribuição por titular, proteção individual e recomendações conjuntas.
        </p>
      </Card>
    );
  }

  const FGC_LIMIT = 250_000;

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Header */}
      <Card className="glass-card-strong p-4 lg:p-5 text-center">
        <Users className="w-6 h-6 lg:w-7 lg:h-7 text-primary mx-auto mb-2" />
        <h3 className="font-bold lg:text-lg">Governança Patrimonial</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          Visão por titular — como o patrimônio está distribuído entre {profiles.map(p => p.name).join(" e ")}
        </p>
      </Card>

      {/* View Toggle */}
      <div className="flex gap-2">
        <Button
          variant={view === "consolidated" ? "default" : "outline"}
          size="sm"
          className="flex-1 rounded-full"
          onClick={() => setView("consolidated")}
        >
          <Eye className="w-4 h-4 mr-1.5" /> Consolidada
        </Button>
        <Button
          variant={view === "individual" ? "default" : "outline"}
          size="sm"
          className="flex-1 rounded-full"
          onClick={() => setView("individual")}
        >
          <User className="w-4 h-4 mr-1.5" /> Individual
        </Button>
      </div>

      {view === "consolidated" ? (
        <>
          {/* Distribution Overview */}
          <Card className="glass-card p-4 lg:p-5 space-y-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Distribuição por Titular
            </h4>
            {profiles.map(profile => {
              const data = byTitular.get(profile.id);
              if (!data) return null;
              const pct = totalWealth > 0 ? data.balance / totalWealth : 0;

              return (
                <div key={profile.id} className="space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium">{profile.name}</span>
                    <span className="text-sm font-bold">
                      {formatBRLCompact(data.balance)}
                      <span className="text-muted-foreground text-xs ml-1">({(pct * 100).toFixed(0)}%)</span>
                    </span>
                  </div>
                  <Progress value={pct * 100} className="h-2" />
                </div>
              );
            })}
          </Card>

          {/* FGC by Titular */}
          <Card className="glass-card p-4 lg:p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
              <Shield className="w-3.5 h-3.5" /> Proteção FGC por Titular
            </h4>
            {profiles.map(profile => {
              const data = byTitular.get(profile.id);
              if (!data) return null;
              const institutions = Array.from(data.fgcExposure.entries());

              return (
                <div key={profile.id} className="space-y-2">
                  <p className="text-sm font-medium">{profile.name}</p>
                  {institutions.length === 0 ? (
                    <p className="text-xs text-muted-foreground pl-2">Nenhum investimento com proteção FGC</p>
                  ) : (
                    institutions.map(([inst, balance]) => {
                      const pct = balance / FGC_LIMIT;
                      const headroom = Math.max(0, FGC_LIMIT - balance);
                      return (
                        <div key={inst} className="pl-2 space-y-1">
                          <div className="flex justify-between text-xs">
                            <span>{inst}</span>
                            <span className={pct > 0.9 ? "text-destructive font-medium" : pct > 0.7 ? "text-warning font-medium" : ""}>
                              {formatBRLCompact(balance)} / R$ 250k
                            </span>
                          </div>
                          <Progress value={Math.min(100, pct * 100)} className="h-1" />
                          <p className="text-[10px] text-muted-foreground">
                            Disponível: {formatBRLCompact(headroom)}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              );
            })}
          </Card>

          {/* Recommendations */}
          {(() => {
            const recs: string[] = [];
            const primaryData = byTitular.get(appData.primaryProfile.id);
            const partnerData = appData.partner ? byTitular.get(appData.partner.profile.id) : null;
            if (primaryData && partnerData) {
              const primaryPct = totalWealth > 0 ? primaryData.balance / totalWealth : 0;
              if (primaryPct > 0.8) {
                recs.push(`${(primaryPct * 100).toFixed(0)}% do patrimônio está no nome de ${appData.primaryProfile.name}. Distribuir melhor amplia a proteção do FGC e reduz risco.`);
              }
              // Check if partner has FGC headroom while primary is near limit
              primaryData.fgcExposure.forEach((balance, inst) => {
                if (balance > FGC_LIMIT * 0.7) {
                  const partnerHasRoom = !partnerData.fgcExposure.has(inst) || (partnerData.fgcExposure.get(inst) || 0) < FGC_LIMIT * 0.5;
                  if (partnerHasRoom) {
                    recs.push(`${appData.partner!.profile.name} ainda tem espaço no FGC em ${inst}. Considere abrir conta nesse nome.`);
                  }
                }
              });
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
          {/* Individual View */}
          <div className="flex gap-2 mb-2">
            {profiles.map(p => (
              <Button
                key={p.id}
                variant={selectedProfile === p.id ? "default" : "outline"}
                size="sm"
                className="flex-1 rounded-full"
                onClick={() => setSelectedProfile(p.id)}
              >
                {p.name}
              </Button>
            ))}
          </div>

          {selectedProfile && (() => {
            const data = byTitular.get(selectedProfile);
            const profile = profiles.find(p => p.id === selectedProfile);
            if (!data || !profile) return null;

            return (
              <Card className="glass-card p-4 lg:p-5 space-y-4">
                <div className="text-center">
                  <User className="w-6 h-6 text-primary mx-auto mb-1" />
                  <h4 className="font-bold">{profile.name}</h4>
                  <p className="text-2xl font-bold text-primary mt-1">{formatBRLCompact(data.balance)}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalWealth > 0 ? `${((data.balance / totalWealth) * 100).toFixed(0)}%` : "0%"} do patrimônio total
                  </p>
                </div>

                {data.investments.length > 0 ? (
                  <div className="space-y-2">
                    <h5 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Investimentos</h5>
                    {data.investments.map(inv => (
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
