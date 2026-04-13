import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { TRAP_CHECKLIST, evaluateTrap, TrapCheckResult } from "@/lib/behavioralEngine";
import { ShieldAlert, AlertTriangle, CheckCircle, XCircle, Eye, TrendingUp, Users, Landmark } from "lucide-react";

// Extended checklist categories
const TRAP_CATEGORIES = [
  {
    id: "promessas",
    label: "Promessas e retornos",
    emoji: "💰",
    items: ["high-return", "guaranteed-income", "no-logic"],
  },
  {
    id: "pressao",
    label: "Pressão e urgência",
    emoji: "⏰",
    items: ["urgency", "social-pressure"],
  },
  {
    id: "transparencia",
    label: "Transparência e clareza",
    emoji: "🔍",
    items: ["no-explanation", "complexity", "no-liquidity"],
  },
  {
    id: "origem",
    label: "Origem e confiabilidade",
    emoji: "🏛️",
    items: ["influencer-only", "obscure-platform"],
  },
  {
    id: "estrutura",
    label: "Riscos estruturais",
    emoji: "⚠️",
    items: ["concentration-excess", "optimistic-sim", "nominal-real-confusion"],
  },
];

// Extended checklist (add new structural items)
const EXTENDED_CHECKLIST = [
  ...TRAP_CHECKLIST,
  { id: "concentration-excess", label: "Concentração excessiva em uma instituição ou ativo", weight: 10 },
  { id: "optimistic-sim", label: "Simulação otimista demais (retorno > 15% a.a.)", weight: 9 },
  { id: "nominal-real-confusion", label: "Confusão entre patrimônio nominal e poder de compra real", weight: 8 },
];

function evaluateExtendedTrap(checkedIds: string[]): TrapCheckResult {
  const flags = EXTENDED_CHECKLIST.map(item => ({
    label: item.label,
    triggered: checkedIds.includes(item.id),
    weight: item.weight,
  }));

  const score = flags.filter(f => f.triggered).reduce((s, f) => s + f.weight, 0);
  const maxScore = flags.reduce((s, f) => s + f.weight, 0);
  const pct = (score / maxScore) * 100;

  let verdict: TrapCheckResult["verdict"] = "safe";
  let summary = "Parece seguro. Sempre pesquise mais antes de investir.";

  if (pct >= 70) {
    verdict = "scam";
    summary = "Alto risco de fraude! Muitos sinais foram acionados. Não prossiga com essa oportunidade.";
  } else if (pct >= 45) {
    verdict = "danger";
    summary = "Muitos sinais preocupantes. Pesquise bastante antes de decidir — provavelmente não vale o risco.";
  } else if (pct >= 20) {
    verdict = "caution";
    summary = "Alguns sinais merecem atenção. Investigue com calma antes de tomar qualquer decisão.";
  }

  return { score: Math.round(pct), flags, verdict, summary };
}

export function TrapDetector() {
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const result = evaluateExtendedTrap(checkedIds);

  const toggle = (id: string) => {
    setCheckedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const verdictConfig = {
    safe: { icon: CheckCircle, color: "text-primary", bg: "bg-primary/10", label: "Parece seguro", borderColor: "border-primary/20" },
    caution: { icon: AlertTriangle, color: "text-warning", bg: "bg-warning/10", label: "Requer atenção", borderColor: "border-warning/20" },
    danger: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10", label: "Alto risco", borderColor: "border-destructive/20" },
    scam: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10", label: "Provável golpe", borderColor: "border-destructive/30" },
  };

  const v = verdictConfig[result.verdict];
  const VerdictIcon = v.icon;

  return (
    <div className="space-y-4 lg:space-y-5">
      {/* Header */}
      <Card className="glass-card-strong p-4 lg:p-6 text-center">
        <ShieldAlert className="w-6 h-6 lg:w-8 lg:h-8 text-primary mx-auto mb-2" />
        <h3 className="font-bold lg:text-lg">Radar de proteção</h3>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-md mx-auto">
          Analise qualquer oportunidade antes de investir. Marque os sinais que se aplicam e veja o nível de risco.
        </p>
      </Card>

      {/* Categorized checklist */}
      <div className="space-y-3">
        {TRAP_CATEGORIES.map(category => {
          const categoryItems = EXTENDED_CHECKLIST.filter(item => category.items.includes(item.id));
          const checkedCount = categoryItems.filter(item => checkedIds.includes(item.id)).length;

          return (
            <Card key={category.id} className="glass-card p-4 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{category.emoji}</span>
                  <p className="text-sm font-semibold">{category.label}</p>
                </div>
                {checkedCount > 0 && (
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                    checkedCount >= categoryItems.length * 0.7 ? "bg-destructive/10 text-destructive" :
                    checkedCount >= categoryItems.length * 0.4 ? "bg-warning/10 text-warning" :
                    "bg-muted text-muted-foreground"
                  }`}>
                    {checkedCount}/{categoryItems.length}
                  </span>
                )}
              </div>
              <div className="space-y-2">
                {categoryItems.map(item => (
                  <label key={item.id} className="flex items-start gap-2.5 cursor-pointer group">
                    <Checkbox
                      checked={checkedIds.includes(item.id)}
                      onCheckedChange={() => toggle(item.id)}
                      className="mt-0.5"
                    />
                    <span className="text-xs sm:text-sm text-muted-foreground group-hover:text-foreground transition-colors leading-snug">
                      {item.label}
                    </span>
                  </label>
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {/* Result */}
      <Card className={`glass-card p-4 lg:p-5 border ${v.borderColor}`}>
        <div className="flex items-center gap-3 mb-3">
          <div className={`p-2.5 rounded-full ${v.bg}`}>
            <VerdictIcon className={`w-5 h-5 lg:w-6 lg:h-6 ${v.color}`} />
          </div>
          <div>
            <p className={`text-sm lg:text-base font-bold ${v.color}`}>{v.label}</p>
            <p className="text-xs text-muted-foreground">Score de risco: {result.score}/100</p>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{result.summary}</p>
      </Card>

      {/* Educational cards by risk type */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <EducationCard
          emoji="🏛️"
          title="Regulação importa"
          description="Toda instituição financeira legítima é regulada pelo Banco Central ou CVM. Verifique antes de investir."
        />
        <EducationCard
          emoji="📊"
          title="Retorno x risco"
          description="Retornos acima de 1,5% ao mês sem risco não existem. Se parece bom demais, desconfie."
        />
        <EducationCard
          emoji="🛡️"
          title="FGC tem limites"
          description="O FGC protege até R$ 250 mil por instituição. Diversifique para ampliar sua proteção."
        />
        <EducationCard
          emoji="💡"
          title="Nominal ≠ Real"
          description="R$ 1 milhão daqui a 20 anos compra menos que hoje. A inflação corrói silenciosamente."
        />
      </div>

      {/* Golden rule */}
      <Card className="glass-card p-3.5 lg:p-4 border-primary/10">
        <p className="text-[10px] sm:text-xs text-primary uppercase font-bold mb-1">Regra de ouro</p>
        <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">
          Todo investimento legítimo tem risco, prazo e explicação clara. Se alguém promete risco zero com retorno alto, desconfie. Antes de investir, verifique se a empresa é regulada pela CVM ou Banco Central.
        </p>
      </Card>
    </div>
  );
}

function EducationCard({ emoji, title, description }: { emoji: string; title: string; description: string }) {
  return (
    <Card className="glass-card p-3.5 lg:p-4">
      <div className="flex items-start gap-2.5">
        <span className="text-lg shrink-0">{emoji}</span>
        <div>
          <p className="text-xs sm:text-sm font-semibold">{title}</p>
          <p className="text-[10px] sm:text-xs text-muted-foreground leading-relaxed mt-0.5">{description}</p>
        </div>
      </div>
    </Card>
  );
}
