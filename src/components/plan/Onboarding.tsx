import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Rocket, Shield, TrendingUp, Eye, Target } from "lucide-react";

interface OnboardingProps {
  onComplete: () => void;
}

const screens = [
  {
    emoji: "🎯",
    title: "Construa patrimônio com clareza",
    description: "Veja onde você está, para onde pode ir e qual o próximo passo para chegar mais rápido — com segurança.",
    highlight: "Mais que um simulador: um sistema de construção patrimonial guiada.",
  },
  {
    emoji: "🛡️",
    title: "Proteja o que você constrói",
    description: "Entenda riscos invisíveis, limites do FGC, concentração e a diferença entre patrimônio nominal e real.",
    highlight: "O app cuida da estrutura enquanto você foca no crescimento.",
  },
  {
    emoji: "🧠",
    title: "Um mentor no seu bolso",
    description: "Alertas inteligentes, diagnóstico financeiro, próximo melhor passo e educação no momento certo.",
    highlight: "Orientação prática sem linguagem complicada.",
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const screen = screens[step];
  const isLast = step === screens.length - 1;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <Card className="glass-card-strong p-6 sm:p-8 max-w-sm w-full text-center space-y-6 animate-fade-in-up">
        {/* Progress bar */}
        <Progress value={((step + 1) / screens.length) * 100} className="h-1.5" />

        <div className="text-5xl pt-2">{screen.emoji}</div>

        <div className="space-y-3">
          <h1 className="text-xl font-bold leading-snug">{screen.title}</h1>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">{screen.description}</p>
          <p className="text-xs text-primary font-medium">{screen.highlight}</p>
        </div>

        <div className="space-y-3 pt-2">
          {isLast ? (
            <Button onClick={onComplete} className="w-full h-12 text-sm font-semibold touch-target">
              <Rocket className="w-4 h-4 mr-2" /> Começar agora
            </Button>
          ) : (
            <Button onClick={() => setStep(step + 1)} className="w-full h-12 text-sm font-semibold touch-target">
              Continuar <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {step === 0 && (
            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2 touch-target" onClick={onComplete}>
              Pular introdução
            </button>
          )}

          {step > 0 && !isLast && (
            <button className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2 touch-target" onClick={() => setStep(step - 1)}>
              Voltar
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
