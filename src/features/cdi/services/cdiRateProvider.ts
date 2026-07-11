/**
 * cdiRateProvider — interface desacoplada para taxa CDI.
 * Sem integração de rede nesta sprint: apenas taxa informada pelo usuário
 * com metadados claros de origem.
 */
import type { CdiRateMetadata } from "../types/cdi";

export interface CdiRateProvider {
  getCurrentAnnualRate(): Promise<CdiRateMetadata | null>;
  getSourceMetadata(): { name: string; note: string };
}

export const manualCdiRateProvider: CdiRateProvider = {
  async getCurrentAnnualRate() {
    return null; // usuário fornece manualmente
  },
  getSourceMetadata() {
    return {
      name: "Taxa informada pelo usuário",
      note: "Nesta versão a Calculadora CDI usa apenas a taxa que você digitar. Nenhuma taxa é presumida.",
    };
  },
};

export function userProvidedRate(annualRate: number): CdiRateMetadata {
  return {
    annualRate,
    source: "Informado pelo usuário",
    fetchedAt: null,
    isUserProvided: true,
    stale: false,
  };
}