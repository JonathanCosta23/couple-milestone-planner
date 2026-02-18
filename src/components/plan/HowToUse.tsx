import { Card } from "@/components/ui/card";
import { BookOpen, AlertTriangle } from "lucide-react";

export function HowToUse() {
  return (
    <div className="space-y-6">
      <Card className="glass-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <BookOpen className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-bold">Como Usar</h3>
        </div>
        <ol className="space-y-3 text-sm text-muted-foreground list-decimal list-inside">
          <li>
            <strong className="text-foreground">Configure sua meta</strong> — Defina o valor inicial, a meta (ex: R$1M), o prazo e as taxas no assistente.
          </li>
          <li>
            <strong className="text-foreground">Divida os aportes</strong> — Cada pessoa define quanto vai investir em Tesouro Selic e CDB por mês.
          </li>
          <li>
            <strong className="text-foreground">Simule o crescimento</strong> — Veja no gráfico e na tabela como seu patrimônio cresce com juros compostos.
          </li>
          <li>
            <strong className="text-foreground">Registre todo mês</strong> — Na aba "Plano Mensal", anote o valor real depositado e acompanhe sua sequência.
          </li>
          <li>
            <strong className="text-foreground">Exporte e faça backup</strong> — Use os botões de CSV e JSON para salvar ou compartilhar o plano entre celulares.
          </li>
        </ol>
      </Card>

      <Card className="glass-card p-6 border-warning/30">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-warning shrink-0 mt-0.5" />
          <div className="text-sm text-muted-foreground">
            <p className="font-semibold text-foreground mb-1">Aviso Importante</p>
            <p>
              Esta ferramenta é apenas para fins educacionais e de planejamento pessoal.
              Não constitui recomendação de investimento personalizada. Rentabilidades passadas
              não garantem resultados futuros. Consulte um assessor de investimentos antes de
              tomar decisões financeiras.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
