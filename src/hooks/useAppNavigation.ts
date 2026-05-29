import { useState, useCallback } from "react";
import type { NavSection } from "@/components/plan/BottomNav";

/**
 * Navegação principal — 5 seções enxutas orientadas à jornada de execução.
 *
 *  - inicio       cockpit estratégico (Home)
 *  - execucao     acompanhamento mensal, renda, gastos, dívidas
 *  - patrimonio   ativos, concentração, arquitetura patrimonial
 *  - projecao     projeção realística, simulador, jornada/marcos
 *  - mais         educação, configurações, governança, backup, perfil, reset
 */

export const EXECUCAO_TABS = ["mensal", "renda", "gastos", "dividas", "disciplina"] as const;
export const PATRIMONIO_TABS = ["ativos", "concentracao", "estrutura"] as const;
export const PROJECAO_TABS = ["projecao", "simulador", "jornada"] as const;
export const MAIS_TABS = [
  "aprender",
  "glossario",
  "armadilhas",
  "investir",
  "saude",
  "governanca",
  "ajuda",
  "configuracoes",
] as const;

export type ExecucaoTab = (typeof EXECUCAO_TABS)[number];
export type PatrimonioTab = (typeof PATRIMONIO_TABS)[number];
export type ProjecaoTab = (typeof PROJECAO_TABS)[number];
export type MaisTab = (typeof MAIS_TABS)[number];

/**
 * Aliases de retrocompatibilidade — qualquer chamada antiga para
 * `onNavigateToTab("tracker"|"patrimonio"|"dados"|...)` continua funcionando
 * porque o ID legado é traduzido para o ID novo. Mantemos a tabela aqui em
 * vez de quebrar deep links pelo app.
 */
export const TAB_ALIASES: Record<string, string> = {
  // Execução
  tracker: "mensal",
  aportes: "mensal",
  historico: "mensal",
  comportamento: "disciplina",
  // Patrimônio
  patrimonio: "ativos",
  // Projeção (mantém ids)
  // Mais
  diagnostico: "saude",
  dados: "configuracoes",
  compartilhar: "configuracoes",
  perfil: "configuracoes",
};

function resolveAlias(tab: string): string {
  return TAB_ALIASES[tab] ?? tab;
}

function sectionForTab(tab: string): NavSection | null {
  if ((EXECUCAO_TABS as readonly string[]).includes(tab)) return "execucao";
  if ((PATRIMONIO_TABS as readonly string[]).includes(tab)) return "patrimonio";
  if ((PROJECAO_TABS as readonly string[]).includes(tab)) return "projecao";
  if ((MAIS_TABS as readonly string[]).includes(tab)) return "mais";
  return null;
}

/**
 * Estado e handlers de navegação.
 *
 * - Seção principal (`inicio`/`execucao`/`patrimonio`/`projecao`/`mais`)
 * - Sub-aba ativa por seção
 * - Deep link interno (`navigateToTab`) usado por cards/insights da Home,
 *   com aliases para nomes antigos.
 */
export function useAppNavigation() {
  const [navSection, setNavSection] = useState<NavSection>("inicio");
  const [execucaoSub, setExecucaoSub] = useState<string>("mensal");
  const [patrimonioSub, setPatrimonioSub] = useState<string>("ativos");
  const [projecaoSub, setProjecaoSub] = useState<string>("projecao");
  const [maisSub, setMaisSub] = useState<string>("configuracoes");

  const scrollTop = useCallback(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }, []);

  const goToSection = useCallback(
    (section: NavSection) => {
      setNavSection(section);
      scrollTop();
    },
    [scrollTop],
  );

  const navigateToTab = useCallback(
    (rawTab: string) => {
      const tab = resolveAlias(rawTab);
      const section = sectionForTab(tab);
      if (!section) {
        // Fallback para a Home se o destino for desconhecido.
        setNavSection("inicio");
        scrollTop();
        return;
      }
      setNavSection(section);
      switch (section) {
        case "execucao": setExecucaoSub(tab); break;
        case "patrimonio": setPatrimonioSub(tab); break;
        case "projecao": setProjecaoSub(tab); break;
        case "mais": setMaisSub(tab); break;
      }
      scrollTop();
    },
    [scrollTop],
  );

  return {
    navSection,
    execucaoSub,
    patrimonioSub,
    projecaoSub,
    maisSub,
    setNavSection,
    setExecucaoSub,
    setPatrimonioSub,
    setProjecaoSub,
    setMaisSub,
    goToSection,
    navigateToTab,
  };
}
