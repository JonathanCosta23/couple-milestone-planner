import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Sparkles, Shield, TrendingUp, Rocket } from "lucide-react";

interface OnboardingProps {
  onComplete: () => void;
}

const screens = [
  {
    icon: Sparkles,
    title: "Seu plano financeiro começa aqui",
    description: "Um assistente que te ajuda a investir com disciplina, entender suas finanças e tomar decisões melhores com dinheiro.",
    visual: "🎯",
  },
  {
    icon: TrendingUp,
    title: "Simples de usar, poderoso nos resultados",
    description: "Defina uma meta, registre seus aportes e acompanhe seu progresso. O app faz o resto: calcula, orienta e alerta.",
    visual: "📊",
  },
  {
    icon: Shield,
    title: "Te protege de decisões ruins",
    description: "Alertas inteligentes sobre gastos, dívidas, golpes e hábitos que podem atrapalhar seu crescimento. Como um mentor financeiro no bolso.",
    visual: "🛡️",
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const screen = screens[step];
  const Icon = screen.icon;
  const isLast = step === screens.length - 1;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <Card className="glass-card-strong p-7 max-w-sm w-full text-center space-y-6 animate-fade-in-up">
        {/* Dots */}
        <div className="flex justify-center gap-2">
          {screens.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/40" : "w-2 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="text-5xl pt-2">{screen.visual}</div>

        <div className="space-y-2.5">
          <h2 className="text-lg font-bold leading-snug">{screen.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed">{screen.description}</p>
        </div>

        <div className="space-y-3 pt-2">
          {isLast ? (
            <Button onClick={onComplete} className="w-full h-12 text-sm font-semibold">
              <Rocket className="w-4 h-4 mr-2" /> Começar agora
            </Button>
          ) : (
            <Button onClick={() => setStep(step + 1)} className="w-full h-12 text-sm font-semibold">
              Continuar <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          )}

          {step === 0 && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={onComplete}
            >
              Pular introdução
            </button>
          )}

          {step > 0 && !isLast && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setStep(step - 1)}
            >
              Voltar
            </button>
          )}
        </div>
      </Card>
    </div>
  );
}
