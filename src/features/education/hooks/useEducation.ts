import { useEffect, useState } from "react";
import {
  listAssetEducationCases,
  listInvestmentSchools,
  listInvestorReferences,
} from "@/features/education/services/educationService";
import type {
  AssetEducationCase,
  InvestmentSchool,
  InvestorReference,
} from "@/features/education/types";
import { logger } from "@/lib/logger";

export function useInvestmentSchools() {
  const [data, setData] = useState<InvestmentSchool[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    listInvestmentSchools()
      .then((rows) => { if (!cancelled) setData(rows); })
      .catch((e) => {
        if (cancelled) return;
        logger.warn("education.schools.fail", {}, (e as Error)?.message);
        setError("Não foi possível carregar as escolas de pensamento.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { data, loading, error };
}

export function useInvestorReferences() {
  const [data, setData] = useState<InvestorReference[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    listInvestorReferences()
      .then((rows) => { if (!cancelled) setData(rows); })
      .catch((e) => {
        if (cancelled) return;
        logger.warn("education.investors.fail", {}, (e as Error)?.message);
        setError("Não foi possível carregar os investidores de referência.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { data, loading, error };
}

export function useAssetEducationCases() {
  const [data, setData] = useState<AssetEducationCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    listAssetEducationCases()
      .then((rows) => { if (!cancelled) setData(rows); })
      .catch((e) => {
        if (cancelled) return;
        logger.warn("education.assets.fail", {}, (e as Error)?.message);
        setError("Não foi possível carregar as fichas de ativos.");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);
  return { data, loading, error };
}