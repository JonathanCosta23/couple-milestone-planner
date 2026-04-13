import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Shield, Cloud, Smartphone } from "lucide-react";

interface AccountPromptProps {
  onCreateAccount: () => void;
  onDismiss: () => void;
}

export function AccountPrompt({ onCreateAccount, onDismiss }: AccountPromptProps) {
  return (
    <Card className="border-primary/20 bg-primary/5 shadow-lg">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="font-semibold text-sm">Proteja seu progresso</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Crie uma conta gratuita para salvar seu plano com segurança e acessar de qualquer dispositivo.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1"><Cloud className="w-3.5 h-3.5" /> Backup na nuvem</span>
          <span className="flex items-center gap-1"><Smartphone className="w-3.5 h-3.5" /> Acesse em qualquer lugar</span>
        </div>
        <div className="flex gap-2">
          <Button size="sm" className="flex-1 h-9 rounded-lg text-xs font-semibold" onClick={onCreateAccount}>
            Criar conta grátis
          </Button>
          <Button size="sm" variant="ghost" className="h-9 rounded-lg text-xs text-muted-foreground" onClick={onDismiss}>
            Depois
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
