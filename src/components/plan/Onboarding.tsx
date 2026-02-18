import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, BookOpen, Target, Rocket, ArrowRight } from "lucide-react";

interface OnboardingProps {
  onComplete: () => void;
}

const screens = [
  {
    icon: Sparkles,
    title: "Bem-vindos ao Plano do Milhão",
    description: "Juntos, vocês vão construir um patrimônio de R$1.000.000 com disciplina, juros compostos e muito amor. 💚",
    emoji: "🎯",
  },
  {
    icon: BookOpen,
    title: "Como funciona",
    description: "Definam sua meta, os aportes mensais em Tesouro Selic e CDB, e acompanhem mês a mês a evolução. O app calcula tudo automaticamente.",
    emoji: "📊",
  },
  {
    icon: Target,
    title: "Educação financeira básica",
    description: "Tesouro Selic: seguro e líquido, ideal para reserva. CDB: pode render mais, mas pode ter carência. Juros compostos: seu dinheiro gera dinheiro. Quanto antes começar, melhor!",
    emoji: "📚",
  },
  {
    icon: Rocket,
    title: "Vamos começar!",
    description: "Configure sua meta, divida os aportes e comece a registrar. O primeiro passo é o mais importante.",
    emoji: "🚀",
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const screen = screens[step];
  const Icon = screen.icon;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="glass-card-strong p-8 max-w-md w-full text-center space-y-6 animate-fade-in-up">
        {/* Step dots */}
        <div className="flex justify-center gap-2">
          {screens.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all ${
                i === step ? "w-8 bg-primary" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="text-5xl">{screen.emoji}</div>

        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Icon className="w-5 h-5 text-primary" />
            <h2 className="text-xl font-bold">{screen.title}</h2>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{screen.description}</p>
        </div>

        <div className="flex gap-3 justify-center pt-2">
          {step > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setStep(step - 1)}>
              Voltar
            </Button>
          )}
          {step < screens.length - 1 ? (
            <Button onClick={() => setStep(step + 1)}>
              Próximo <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={onComplete}>
              <Rocket className="w-4 h-4 mr-1" /> Começar a planejar!
            </Button>
          )}
        </div>

        {step < screens.length - 1 && (
          <button
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={onComplete}
          >
            Pular introdução
          </button>
        )}
      </Card>
    </div>
  );
}
