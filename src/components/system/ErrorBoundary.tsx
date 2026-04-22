/**
 * ErrorBoundary — Captura erros de render por área (Plano, Histórico, Perfil)
 * sem derrubar o app inteiro. Mostra fallback humano com ação "Tentar de novo".
 * Detalhes técnicos vão para o logger (não para a UI).
 */
import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";

interface Props {
  area: string;
  children: React.ReactNode;
  /** Texto curto exibido no fallback. */
  title?: string;
  /** Texto secundário humano. */
  description?: string;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    logger.error("ui.render.crash", {
      area: this.props.area,
      origin: "ErrorBoundary",
      componentStack: info.componentStack,
    }, error);
  }

  handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;
    const title = this.props.title ?? "Algo deu errado nesta área";
    const description =
      this.props.description ??
      "Não foi possível carregar este conteúdo agora. O resto do app continua funcionando.";
    return (
      <div
        role="alert"
        className="rounded-2xl border border-border/60 bg-muted/30 p-6 sm:p-8 text-center space-y-4"
      >
        <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertTriangle className="w-6 h-6 text-destructive" aria-hidden />
        </div>
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">{title}</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">{description}</p>
        </div>
        <Button
          variant="outline"
          onClick={this.handleRetry}
          className="rounded-xl"
          aria-label="Tentar carregar novamente"
        >
          <RefreshCw className="w-4 h-4 mr-2" aria-hidden /> Tentar de novo
        </Button>
      </div>
    );
  }
}