import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowRight, Rocket } from "lucide-react";

interface OnboardingProps {
  onComplete: () => void;
}

const screens = [
  {
    visual: "🎯",
    title: "Organize suas finanças de um jeito fácil",
    description: "Veja quanto já tem, quanto falta e o que fazer agora para chegar mais rápido na sua meta.",
  },
  {
    visual: "📊",
    title: "Seu plano, seus números, sua clareza",
    description: "Registre aportes, acompanhe gastos e receba orientações simples para tomar decisões melhores com dinheiro.",
  },
  {
    visual: "🛡️",
    title: "Proteção contra decisões ruins",
    description: "Alertas sobre gastos, dívidas e armadilhas financeiras. Como ter um mentor no bolso.",
  },
];

export function Onboarding({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const screen = screens[step];
  const isLast = step === screens.length - 1;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-5">
      <Card className="glass-card-strong p-8 max-w-sm w-full text-center space-y-7 animate-fade-in-up">
        {/* Progress dots */}
        <div className="flex justify-center gap-2">
          {screens.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === step ? "w-8 bg-primary" : i < step ? "w-4 bg-primary/40" : "w-3 bg-muted"
              }`}
            />
          ))}
        </div>

        <div className="text-5xl pt-2">{screen.visual}</div>

        <div className="space-y-3">
          <h2 className="text-xl font-bold leading-snug">{screen.title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-[280px] mx-auto">{screen.description}</p>
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
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2 touch-target"
              onClick={onComplete}
            >
              Pular introdução
            </button>
          )}

          {step > 0 && !isLast && (
            <button
              className="text-xs text-muted-foreground hover:text-foreground transition-colors py-2 touch-target"
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
