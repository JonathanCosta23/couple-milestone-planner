import { Card } from "@/components/ui/card";
import { BookOpen, AlertTriangle } from "lucide-react";

export function HowToUse() {
  return (
    <div className="space-y-6">
      <Card className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">Como aproveitar ao máximo</h3>
        </div>
        <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
          <li>
            <strong className="text-foreground">Defina sua meta</strong> — Escolha quanto quer acumular, em quanto tempo e com qual aporte mensal.
          </li>
          <li>
            <strong className="text-foreground">Cadastre sua renda e gastos</strong> — Assim o app entende sua realidade e dá orientações personalizadas.
          </li>
          <li>
            <strong className="text-foreground">Simule cenários</strong> — Veja como cada decisão impacta o tempo até sua meta.
          </li>
          <li>
            <strong className="text-foreground">Registre seus aportes todo mês</strong> — Anote quanto realmente investiu e acompanhe sua evolução.
          </li>
          <li>
            <strong className="text-foreground">Exporte seus dados</strong> — Faça backup em JSON ou CSV para não perder nada.
          </li>
        </ol>
      </Card>

      <Card className="glass-card p-6 border-warning/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Aviso importante</p>
            <p>
              Este app é uma ferramenta educacional e de planejamento pessoal.
              Não substitui a orientação de um profissional de investimentos.
              Rentabilidades passadas não garantem resultados futuros.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
