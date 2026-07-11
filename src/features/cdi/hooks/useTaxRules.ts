import { useEffect, useState } from "react";
import { fetchIofRules, fetchTaxRules } from "../services/cdiTaxService";
import type { IofRule, TaxRule } from "../types/cdi";

export function useTaxRules() {
  const [taxRules, setTaxRules] = useState<TaxRule[]>([]);
  const [iofRules, setIofRules] = useState<IofRule[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([fetchTaxRules(), fetchIofRules()])
      .then(([t, i]) => {
        if (cancelled) return;
        setTaxRules(t);
        setIofRules(i);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { taxRules, iofRules, loading };
}