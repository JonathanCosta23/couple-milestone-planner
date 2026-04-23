/**
 * OfflineBanner — Aviso fixo no topo quando o navegador está offline OU
 * quando há writes pendentes sendo sincronizados.
 *
 * Estados visuais:
 *  - offline + sem fila        → "Você está sem conexão."
 *  - offline + fila > 0        → "Sem conexão. N alterações em espera."
 *  - online + sincronizando    → "Sincronizando N alterações…"
 *  - online + fila zerada      → não renderiza nada.
 */
import { WifiOff, RefreshCw, Clock } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useOfflineQueue } from "@/hooks/useOfflineQueue";

export function OfflineBanner() {
  const online = useOnlineStatus();
  const { count, syncing } = useOfflineQueue();

  // Online + fila vazia + nada sincronizando → nada para mostrar.
  if (online && count === 0 && !syncing) return null;

  const isSyncing = online && (syncing || count > 0);
  const tone = isSyncing
    ? "bg-primary/10 border-primary/30 text-primary"
    : "bg-destructive/10 border-destructive/30 text-destructive";

  return (
    <div
      role="status"
      aria-live="polite"
      className={`sticky top-0 z-[60] w-full border-b ${tone}`}
    >
      <div className="max-w-6xl mx-auto px-4 py-2 flex items-center gap-2 text-sm">
        {isSyncing ? (
          <RefreshCw className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
        ) : (
          <WifiOff className="w-4 h-4 shrink-0" aria-hidden />
        )}
        <span className="font-medium">
          {isSyncing
            ? `Sincronizando ${count > 0 ? count : ""} ${count === 1 ? "alteração" : "alterações"}…`
            : "Você está sem conexão."}
        </span>
        {!isSyncing && count > 0 && (
          <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-destructive/20">
            <Clock className="w-3 h-3" aria-hidden />
            {count} {count === 1 ? "alteração em espera" : "alterações em espera"}
          </span>
        )}
        {!isSyncing && count === 0 && (
          <span className="text-destructive/80 hidden sm:inline">
            Suas mudanças serão salvas quando a internet voltar.
          </span>
        )}
      </div>
    </div>
  );
}