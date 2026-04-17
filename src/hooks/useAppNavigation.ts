import { useState, useCallback } from "react";
import type { NavSection } from "@/components/plan/BottomNav";

/**
 * Constantes de navegação compartilhadas entre o roteamento de painéis
 * e a lógica de "deep link" interno (handleNavigateToTab).
 */
export const PLANO_TABS = [
  "aportes",
  "estrutura",
  "simulador",
  "projecao",
  "diagnostico",
  "jornada",
  "comportamento",
  "patrimonio",
  "concentracao",
  "governanca",
] as const;

export const HISTORICO_TABS = ["tracker", "gastos", "renda", "dividas"] as const;

export const PERFIL_TABS = [
  "aprender",
  "glossario",
  "armadilhas",
  "investir",
  "compartilhar",
  "ajuda",
  "dados",
] as const;

export type PlanoTab = (typeof PLANO_TABS)[number];
export type HistoricoTab = (typeof HISTORICO_TABS)[number];
export type PerfilTab = (typeof PERFIL_TABS)[number];

/**
 * Estado e handlers de navegação do app.
 *
 * Centraliza:
 * - seção principal (home/plano/histórico/perfil)
 * - sub-aba ativa de cada seção
 * - "deep link" interno (handleNavigateToTab) usado em cards/insights da Home
 *   para pular direto para uma sub-aba específica.
 *
 * Sempre faz scroll-to-top suave na navegação.
 */
export function useAppNavigation() {
  const [navSection, setNavSection] = useState<NavSection>("home");
  const [planoSub, setPlanoSub] = useState<string>("aportes");
  const [historicoSub, setHistoricoSub] = useState<string>("tracker");
  const [perfilSub, setPerfilSub] = useState<string>("aprender");

  const scrollTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const goToSection = useCallback(
    (section: NavSection) => {
      setNavSection(section);
      scrollTop();
    },
    [scrollTop],
  );

  /**
   * Navega diretamente para qualquer sub-aba a partir do nome da aba,
   * resolvendo automaticamente a seção pai. Usado pelos cards da Home.
   */
  const navigateToTab = useCallback(
    (tab: string) => {
      if ((PLANO_TABS as readonly string[]).includes(tab)) {
        setNavSection("plano");
        setPlanoSub(tab);
      } else if ((HISTORICO_TABS as readonly string[]).includes(tab)) {
        setNavSection("historico");
        setHistoricoSub(tab);
      } else if ((PERFIL_TABS as readonly string[]).includes(tab)) {
        setNavSection("perfil");
        setPerfilSub(tab);
      } else {
        setNavSection("home");
      }
      scrollTop();
    },
    [scrollTop],
  );

  return {
    navSection,
    planoSub,
    historicoSub,
    perfilSub,
    setNavSection,
    setPlanoSub,
    setHistoricoSub,
    setPerfilSub,
    goToSection,
    navigateToTab,
  };
}
