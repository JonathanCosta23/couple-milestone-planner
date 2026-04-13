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
    title: "Bem-vindo ao Plano do Milhão",
    description: "Aqui você constrói patrimônio com disciplina, juros compostos e clareza. Simples de usar, poderoso nos resultados.",
    emoji: "🎯",
  },
  {
    icon: BookOpen,
    title: "Como funciona",
    description: "Defina sua meta e seus aportes mensais. O app calcula tudo, mostra seu progresso e te orienta como um mentor financeiro.",
    emoji: "📊",
  },
  {
    icon: Target,
    title: "Mais que um app de investimentos",
    description: "Além de acompanhar aportes, você controla gastos, aprende sobre finanças, recebe alertas inteligentes e se protege de armadilhas.",
    emoji: "🛡️",
  },
  {
    icon: Rocket,
    title: "Vamos começar!",
    description: "Configure sua meta, registre seus primeiros dados e deixe o app trabalhar por você. O primeiro passo é o mais importante.",
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
                i === step ? "w-8 bg-primary" : i < step ? "w-3 bg-primary/40" : "w-2 bg-muted"
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
            <Button onClick={() => setStep(step + 1)} className="h-10 px-5">
              Próximo <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={onComplete} className="h-10 px-5">
              <Rocket className="w-4 h-4 mr-1" /> Começar agora
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
