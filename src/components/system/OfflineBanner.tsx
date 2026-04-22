/**
 * OfflineBanner — Aviso fixo no topo quando o navegador está offline.
 * Mensagem humana, sem detalhes técnicos. Some sozinho ao reconectar.
 */
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="sticky top-0 z-[60] w-full bg-destructive/10 border-b border-destructive/30 text-destructive"
    >
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-2 text-sm">
        <WifiOff className="w-4 h-4 shrink-0" aria-hidden />
        <span className="font-medium">Você está sem conexão.</span>
        <span className="text-destructive/80 hidden sm:inline">
          Suas mudanças serão salvas quando a internet voltar.
        </span>
      </div>
    </div>
  );
}