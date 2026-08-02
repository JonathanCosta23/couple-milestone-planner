/**
 * LegalDialogs — Termos de Uso, Política de Privacidade e Disclaimer
 * educacional. Conteúdo enxuto, mantido em um único arquivo para edição
 * jurídica futura. Renderiza apenas o que o usuário abrir.
 *
 * Exporta:
 *  - LEGAL_DISCLAIMER: string única usada em rótulos curtos pelo app.
 *  - LegalFooter: rodapé persistente com links para os 3 documentos +
 *    atalho opcional para "Apagar meus dados".
 */
import { useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ShieldAlert, FileText, Lock, Trash2 } from "lucide-react";

export const LEGAL_DISCLAIMER =
  "Este sistema tem finalidade educacional e organizacional. Não constitui recomendação de investimento. Projeções são estimativas baseadas nas premissas cadastradas pelo usuário.";

type LegalKind = "terms" | "privacy" | "disclaimer";

interface LegalDialogProps {
  kind: LegalKind | null;
  onOpenChange: (open: boolean) => void;
}

const COPY: Record<LegalKind, { title: string; icon: ReactNode; body: ReactNode }> = {
  disclaimer: {
    title: "Aviso educacional",
    icon: <ShieldAlert className="w-5 h-5 text-warning" aria-hidden />,
    body: (
      <>
        <p>
          O <strong>Plano do Milhão</strong> é uma ferramenta de organização e
          educação financeira pessoal. Não somos consultoria, corretora,
          gestora ou agente autônomo de investimentos.
        </p>
        <p>
          Nenhum conteúdo aqui apresentado constitui recomendação personalizada
          de compra, venda ou manutenção de qualquer ativo. As projeções
          patrimoniais (nominal, líquida e real) são <strong>estimativas
          matemáticas baseadas nas premissas que você cadastra</strong>
          (taxa Selic, CDI, inflação, IR, aportes, prazo). Mudanças de mercado,
          legislação tributária ou comportamento real podem produzir
          resultados muito diferentes.
        </p>
        <p>
          Antes de tomar decisões financeiras relevantes, considere consultar
          um profissional certificado (CFP, CGA ou similar).
        </p>
      </>
    ),
  },
  terms: {
    title: "Termos de Uso",
    icon: <FileText className="w-5 h-5 text-primary" aria-hidden />,
    body: (
      <>
        <p>
          Ao utilizar o Plano do Milhão você concorda em usá-lo apenas para
          fins pessoais de organização e planejamento financeiro. O serviço é
          fornecido <em>como está</em>, sem garantia de disponibilidade
          contínua ou de resultados financeiros.
        </p>
        <p>
          Você é responsável pela veracidade dos dados informados (renda,
          gastos, dívidas, patrimônio) e pelas decisões tomadas com base nas
          estimativas exibidas. Não nos responsabilizamos por perdas
          financeiras, prejuízos fiscais ou decisões de investimento.
        </p>
        <p>
          É proibido o uso para automação não autorizada, scraping em massa,
          revenda do conteúdo ou qualquer atividade que viole legislação
          brasileira, incluindo a LGPD.
        </p>
        <p>
          Podemos atualizar estes termos. A versão vigente é sempre a exibida
          neste documento.
        </p>
      </>
    ),
  },
  privacy: {
    title: "Política de Privacidade",
    icon: <Lock className="w-5 h-5 text-primary" aria-hidden />,
    body: (
      <>
        <p>
          <strong>Quais dados coletamos.</strong> E-mail e nome (autenticação),
          dados financeiros que você cadastra (renda, gastos, dívidas,
          investimentos, aportes mensais), participantes do plano (nome e
          idade), preferências do aplicativo e logs de eventos de produto
          (criação de plano, marcos atingidos, reset de dados).
        </p>
        <p>
          <strong>Como usamos.</strong> Para operar o produto, calcular suas
          projeções, manter histórico e melhorar a experiência. Não vendemos
          dados pessoais e não compartilhamos com terceiros para marketing.
        </p>
        <p>
          <strong>Onde guardamos.</strong> Em infraestrutura Supabase (Lovable
          Cloud) com Row Level Security ativa — apenas você acessa seus
          próprios dados.
        </p>
        <p>
          <strong>Seus direitos (LGPD).</strong> Você pode exportar seus dados
          (Perfil → Exportar) e apagar tudo a qualquer momento usando
          <em> "Resetar plano"</em> — isso limpa o banco, o cache local e a
          fila de sincronização. A conta de autenticação permanece e pode ser
          excluída por solicitação.
        </p>
      </>
    ),
  },
};

function LegalDialog({ kind, onOpenChange }: LegalDialogProps) {
  if (!kind) return null;
  const { title, icon, body } = COPY[kind];
  return (
    <Dialog open={!!kind} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            {icon}
            {title}
          </DialogTitle>
          <DialogDescription className="sr-only">{title}</DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[60vh] pr-3">
          <div className="space-y-3 text-sm text-muted-foreground leading-relaxed">
            {body}
            <p className="text-[11px] uppercase tracking-wider pt-2 border-t border-border/40">
              Última atualização: maio de 2026
            </p>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

interface LegalFooterProps {
  /** Quando informado, o link "Apagar meus dados" aciona o reset. */
  onRequestReset?: () => void;
}

/** Rodapé compacto com links legais e (opcional) atalho de reset. */
export function LegalFooter({ onRequestReset }: LegalFooterProps) {
  const [open, setOpen] = useState<LegalKind | null>(null);
  const buttonClass =
    "underline-offset-2 hover:underline hover:text-foreground transition-colors";

  return (
    <>
      <footer
        role="contentinfo"
        className="mt-8 border-t border-border/40 bg-background/60"
      >
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between text-[11px] text-muted-foreground">
          <p className="leading-relaxed">{LEGAL_DISCLAIMER}</p>
          <nav
            aria-label="Links legais"
            className="flex flex-wrap items-center gap-x-3 gap-y-1"
          >
            <button type="button" className={buttonClass} onClick={() => setOpen("disclaimer")}>
              Aviso educacional
            </button>
            <span aria-hidden>·</span>
            <button type="button" className={buttonClass} onClick={() => setOpen("terms")}>
              Termos
            </button>
            <span aria-hidden>·</span>
            <button type="button" className={buttonClass} onClick={() => setOpen("privacy")}>
              Privacidade
            </button>
            {onRequestReset && (
              <>
                <span aria-hidden>·</span>
                <button
                  type="button"
                  className={`${buttonClass} text-destructive/80 hover:text-destructive inline-flex items-center gap-1`}
                  onClick={onRequestReset}
                >
                  <Trash2 className="w-3 h-3" aria-hidden />
                  Apagar meus dados
                </button>
              </>
            )}
          </nav>
        </div>
      </footer>
      <LegalDialog kind={open} onOpenChange={(o) => !o && setOpen(null)} />
    </>
  );
}