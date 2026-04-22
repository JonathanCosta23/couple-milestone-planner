/**
 * useOnlineStatus — Detecção best-effort de conectividade.
 * Reage a navigator.onLine e aos eventos online/offline da janela.
 * Não garante alcance real ao Supabase, mas evita writes silenciosos quando
 * o navegador já sabe que está sem rede.
 */
import { useEffect, useState } from "react";

function getInitial(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine !== false;
}

export function useOnlineStatus(): boolean {
  const [online, setOnline] = useState<boolean>(getInitial);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  return online;
}