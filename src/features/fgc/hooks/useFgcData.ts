import { useEffect, useMemo, useState } from "react";
import { createDefaultFgcProvider, FGC_FALLBACK_RULES } from "../services/fgcInstitutionProvider";
import type {
  FgcProductCatalogEntry,
  FgcRegulatoryRule,
  FinancialConglomerateRef,
  FinancialInstitutionRef,
} from "../types/fgc";

export interface FgcRegulatoryContext {
  ordinary: FgcRegulatoryRule;
  aggregate: FgcRegulatoryRule;
  institutions: FinancialInstitutionRef[];
  conglomerates: FinancialConglomerateRef[];
  catalog: FgcProductCatalogEntry[];
  loading: boolean;
  usingFallback: boolean;
}

export function useFgcData(): FgcRegulatoryContext {
  const provider = useMemo(() => createDefaultFgcProvider(), []);
  const [state, setState] = useState<FgcRegulatoryContext>({
    ordinary: FGC_FALLBACK_RULES.ordinary,
    aggregate: FGC_FALLBACK_RULES.aggregate,
    institutions: [], conglomerates: [], catalog: [],
    loading: true, usingFallback: true,
  });
  useEffect(() => {
    let cancelled = false;
    Promise.all([
      provider.getOrdinaryLimitRule(),
      provider.getAggregateLimitRule(),
      provider.getAssociatedInstitutions(),
      provider.getConglomerates(),
      provider.getProductCatalog(),
    ])
      .then(([ordinary, aggregate, institutions, conglomerates, catalog]) => {
        if (cancelled) return;
        const usingFallback = institutions.length === 0 && conglomerates.length === 0;
        setState({ ordinary, aggregate, institutions, conglomerates, catalog, loading: false, usingFallback });
      })
      .catch(() => { if (!cancelled) setState(s => ({ ...s, loading: false })); });
    return () => { cancelled = true; };
  }, [provider]);
  return state;
}