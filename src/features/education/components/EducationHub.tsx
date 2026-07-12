import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { GraduationCap } from "lucide-react";
import { useAssetEducationCases, useInvestmentSchools, useInvestorReferences } from "@/features/education/hooks/useEducation";
import { InvestmentSchoolCard } from "./InvestmentSchoolCard";
import { InvestmentSchoolDetail } from "./InvestmentSchoolDetail";
import { InvestorReferenceCard } from "./InvestorReferenceCard";
import { InvestorReferenceDetail } from "./InvestorReferenceDetail";
import { AssetEducationCard } from "./AssetEducationCard";
import { AssetEducationDetail } from "./AssetEducationDetail";
import type { AssetEducationCase, InvestmentSchool, InvestorReference } from "@/features/education/types";

type Tab = "schools" | "investors" | "assets";

/**
 * EducationHub — ponto único de acesso a Escolas, Investidores e Fichas.
 * Fica dentro de Mais > Aprender, sem criar nova aba principal.
 */
export function EducationHub() {
  const [tab, setTab] = useState<Tab>("schools");
  const [openSchool, setOpenSchool] = useState<InvestmentSchool | null>(null);
  const [openInvestor, setOpenInvestor] = useState<InvestorReference | null>(null);
  const [openAsset, setOpenAsset] = useState<AssetEducationCase | null>(null);

  const schools = useInvestmentSchools();
  const investors = useInvestorReferences();
  const assets = useAssetEducationCases();

  const tabs: Array<{ id: Tab; label: string }> = useMemo(() => ([
    { id: "schools", label: "Escolas" },
    { id: "investors", label: "Investidores" },
    { id: "assets", label: "Fichas de ativos" },
  ]), []);

  if (openSchool) return <InvestmentSchoolDetail school={openSchool} onBack={() => setOpenSchool(null)} />;
  if (openInvestor) return <InvestorReferenceDetail investor={openInvestor} onBack={() => setOpenInvestor(null)} />;
  if (openAsset) return <AssetEducationDetail asset={openAsset} onBack={() => setOpenAsset(null)} />;

  return (
    <div className="space-y-4">
      <Card className="glass-card p-4 space-y-2">
        <div className="flex items-start gap-2">
          <GraduationCap className="w-4 h-4 text-primary mt-0.5" />
          <div>
            <p className="text-sm font-semibold">Escolas, investidores e fichas de ativos</p>
            <p className="text-xs text-muted-foreground">
              Conteúdo educacional para entender diferentes formas de pensar sobre investimentos. Não constitui recomendação de compra, venda ou manutenção de investimentos.
            </p>
          </div>
        </div>
      </Card>

      <div className="flex gap-2 overflow-x-auto">
        {tabs.map((t) => (
          <Button
            key={t.id}
            size="sm"
            variant={tab === t.id ? "default" : "outline"}
            className="rounded-full whitespace-nowrap"
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </Button>
        ))}
      </div>

      {tab === "schools" && (
        <SectionState loading={schools.loading} error={schools.error} count={schools.data.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {schools.data.map((s) => <InvestmentSchoolCard key={s.id} school={s} onOpen={setOpenSchool} />)}
          </div>
        </SectionState>
      )}

      {tab === "investors" && (
        <SectionState loading={investors.loading} error={investors.error} count={investors.data.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {investors.data.map((i) => <InvestorReferenceCard key={i.id} investor={i} onOpen={setOpenInvestor} />)}
          </div>
        </SectionState>
      )}

      {tab === "assets" && (
        <SectionState loading={assets.loading} error={assets.error} count={assets.data.length}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {assets.data.map((a) => <AssetEducationCard key={a.id} asset={a} onOpen={setOpenAsset} />)}
          </div>
        </SectionState>
      )}
    </div>
  );
}

function SectionState({ loading, error, count, children }: { loading: boolean; error: string | null; count: number; children: React.ReactNode }) {
  if (loading) return <p className="text-xs text-muted-foreground">Carregando conteúdo educacional…</p>;
  if (error) return <p className="text-xs text-destructive">{error}</p>;
  if (count === 0) return <p className="text-xs text-muted-foreground">Nenhum conteúdo disponível ainda.</p>;
  return <>{children}</>;
}