/**
 * EmptyHomeState — Home state quando o usuário ainda não cadastrou nada.
 * Extraído de `UnifiedHome.tsx` sem alteração visual ou comportamental.
 */
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, CheckCircle, type LucideIcon } from "lucide-react";

export interface ActivationStep {
  id: string;
  label: string;
  description: string;
  done: boolean;
  tab: string;
  Icon: LucideIcon;
  layer: "essencial" | "avançado";
}

interface Props {
  onNavigateToTab: (tab: string) => void;
  onOpenQuickDeposit: () => void;
  activationSteps: ActivationStep[];
}

export function EmptyHomeState({ onNavigateToTab, onOpenQuickDeposit, activationSteps }: Props) {
  const essentialSteps = activationSteps.filter((s) => s.layer === "essencial");
  const completedSteps = essentialSteps.filter((s) => s.done).length;

  return (
    <div className="space-y-5 lg:space-y-6 pb-4">
      <Card className="glass-card-hero p-6 lg:p-8 text-center space-y-4 animate-fade-in-up lg:max-w-xl lg:mx-auto">
        <p className="text-4xl lg:text-5xl">🚀</p>
        <div>
          <p className="text-lg lg:text-xl font-bold">Tudo pronto para começar!</p>
          <p className="text-sm lg:text-base text-muted-foreground mt-2 leading-relaxed max-w-xs mx-auto">
            Complete os passos abaixo para desbloquear seu primeiro diagnóstico financeiro.
          </p>
        </div>
        <Progress value={(completedSteps / essentialSteps.length) * 100} className="h-2 max-w-xs mx-auto" />
        <p className="text-xs text-muted-foreground">{completedSteps} de {essentialSteps.length} passos essenciais completos</p>
      </Card>

      <div className="space-y-3 lg:grid lg:grid-cols-2 lg:gap-4 lg:space-y-0">
        {activationSteps.map((step) => (
          <Card
            key={step.id}
            className={`glass-card p-4 lg:p-5 cursor-pointer hover:ring-1 hover:ring-primary/20 active:scale-[0.98] transition-all touch-target ${step.done ? "opacity-60" : ""}`}
            onClick={() => {
              if (step.tab) onNavigateToTab(step.tab);
              else onOpenQuickDeposit();
            }}
          >
            <div className="flex items-center gap-3">
              {step.done ? (
                <CheckCircle className="w-6 h-6 text-primary shrink-0" />
              ) : (
                <step.Icon className="w-5 h-5 text-muted-foreground shrink-0" aria-hidden />
              )}
              <div className="min-w-0 flex-1">
                <p className={`text-sm lg:text-base font-semibold ${step.done ? "line-through" : ""}`}>{step.label}</p>
              </div>
              {!step.done && <ArrowRight className="w-4 h-4 text-muted-foreground shrink-0" />}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
