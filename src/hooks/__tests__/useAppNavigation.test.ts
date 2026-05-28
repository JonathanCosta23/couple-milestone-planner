import { describe, it, expect } from "vitest";
import { renderHook, act } from "@testing-library/react";
import {
  useAppNavigation,
  EXECUCAO_TABS,
  PATRIMONIO_TABS,
  PROJECAO_TABS,
  MAIS_TABS,
  TAB_ALIASES,
} from "@/hooks/useAppNavigation";

describe("useAppNavigation", () => {
  it("inicia em 'inicio' e mantém sub-tabs default", () => {
    const { result } = renderHook(() => useAppNavigation());
    expect(result.current.navSection).toBe("inicio");
    expect(result.current.execucaoSub).toBe("mensal");
    expect(result.current.patrimonioSub).toBe("ativos");
    expect(result.current.projecaoSub).toBe("projecao");
    expect(result.current.maisSub).toBe("aprender");
  });

  it("goToSection altera a seção principal", () => {
    const { result } = renderHook(() => useAppNavigation());
    act(() => result.current.goToSection("patrimonio"));
    expect(result.current.navSection).toBe("patrimonio");
  });

  it.each([
    ["mensal", "execucao", "execucaoSub"],
    ["renda", "execucao", "execucaoSub"],
    ["ativos", "patrimonio", "patrimonioSub"],
    ["concentracao", "patrimonio", "patrimonioSub"],
    ["projecao", "projecao", "projecaoSub"],
    ["simulador", "projecao", "projecaoSub"],
    ["aprender", "mais", "maisSub"],
    ["configuracoes", "mais", "maisSub"],
  ])("navigateToTab('%s') ativa seção %s/%s", (tab, section, subKey) => {
    const { result } = renderHook(() => useAppNavigation());
    act(() => result.current.navigateToTab(tab));
    expect(result.current.navSection).toBe(section);
    expect((result.current as Record<string, unknown>)[subKey]).toBe(tab);
  });

  it.each(Object.entries(TAB_ALIASES))(
    "alias '%s' navega para o destino '%s'",
    (legacy, target) => {
      const { result } = renderHook(() => useAppNavigation());
      act(() => result.current.navigateToTab(legacy));
      // Não cai no fallback "inicio" para aliases mapeados a tabs válidas.
      expect(result.current.navSection).not.toBe("inicio");
      const subValues = [
        result.current.execucaoSub,
        result.current.patrimonioSub,
        result.current.projecaoSub,
        result.current.maisSub,
      ];
      expect(subValues).toContain(target);
    },
  );

  it("destino desconhecido cai em 'inicio'", () => {
    const { result } = renderHook(() => useAppNavigation());
    act(() => result.current.navigateToTab("rota-inexistente-xyz"));
    expect(result.current.navSection).toBe("inicio");
  });

  it("nenhum alias aponta para uma tab inexistente", () => {
    const allTabs = new Set<string>([
      ...EXECUCAO_TABS, ...PATRIMONIO_TABS, ...PROJECAO_TABS, ...MAIS_TABS,
    ]);
    for (const target of Object.values(TAB_ALIASES)) {
      expect(allTabs.has(target)).toBe(true);
    }
  });
});