/**
 * allocationService — Buckets, concentration, FGC protection, governance.
 * Single source of truth for patrimonial architecture analysis.
 */

import type { AppData, Investment, PatrimonialBucketId } from "@/lib/models";
import { getDefaultBucket, getDefaultSecurity, BUCKET_LABELS } from "@/lib/models";

export interface BucketAllocation {
  id: PatrimonialBucketId;
  label: string;
  amount: number;
  percentage: number;
  investments: Investment[];
}

export interface InstitutionExposure {
  institution: string;
  conglomerate: string;
  amount: number;
  percentage: number;
  fgcCovered: number;
  fgcLimit: number;
  headroom: number;
  isOverLimit: boolean;
  investments: Investment[];
}

export interface TitularExposure {
  titularId: string;
  titularName: string;
  totalAmount: number;
  fgcCovered: number;
  sovereignAmount: number;
  marketAmount: number;
  institutions: InstitutionExposure[];
}

export interface AllocationAnalysis {
  buckets: BucketAllocation[];
  institutions: InstitutionExposure[];
  titulares: TitularExposure[];
  totalWealth: number;
  fgcTotal: number;
  sovereignTotal: number;
  marketTotal: number;
  unprotectedTotal: number;
  protectionRatio: number;
  liquidityRatio: number;
  concentrationRisk: "low" | "medium" | "high" | "critical";
  structuralScore: number; // 0-100
}

const FGC_LIMIT_PER_CPF_PER_INSTITUTION = 250_000;

export function analyzeAllocation(appData: AppData): AllocationAnalysis {
  const investments = appData.investments.filter(i => i.active);
  const totalWealth = investments.reduce((s, i) => s + i.currentBalance, 0);

  // ── Buckets ──
  const bucketMap = new Map<PatrimonialBucketId, Investment[]>();
  investments.forEach(i => {
    const bucket = i.bucket || getDefaultBucket(i.type);
    if (!bucketMap.has(bucket)) bucketMap.set(bucket, []);
    bucketMap.get(bucket)!.push(i);
  });

  const bucketIds: PatrimonialBucketId[] = ["reserva", "protecao-bancaria", "base-soberana", "crescimento"];
  const buckets: BucketAllocation[] = bucketIds.map(id => {
    const items = bucketMap.get(id) || [];
    const amount = items.reduce((s, i) => s + i.currentBalance, 0);
    return {
      id,
      label: BUCKET_LABELS[id],
      amount,
      percentage: totalWealth > 0 ? amount / totalWealth : 0,
      investments: items,
    };
  });

  // ── Institutions ──
  const instMap = new Map<string, Investment[]>();
  investments.forEach(i => {
    const key = i.conglomerate || i.institution || "Não informado";
    if (!instMap.has(key)) instMap.set(key, []);
    instMap.get(key)!.push(i);
  });

  const institutions: InstitutionExposure[] = Array.from(instMap.entries()).map(([inst, items]) => {
    const amount = items.reduce((s, i) => s + i.currentBalance, 0);
    const fgcCovered = items
      .filter(i => ["cdb", "lci-lca", "poupanca"].includes(i.type))
      .reduce((s, i) => s + i.currentBalance, 0);
    const fgcLimit = FGC_LIMIT_PER_CPF_PER_INSTITUTION;
    return {
      institution: inst,
      conglomerate: inst,
      amount,
      percentage: totalWealth > 0 ? amount / totalWealth : 0,
      fgcCovered: Math.min(fgcCovered, fgcLimit),
      fgcLimit,
      headroom: Math.max(0, fgcLimit - fgcCovered),
      isOverLimit: fgcCovered > fgcLimit,
      investments: items,
    };
  }).sort((a, b) => b.amount - a.amount);

  // ── Titulares ──
  const titularMap = new Map<string, Investment[]>();
  investments.forEach(i => {
    const tid = i.titular || i.profileId || appData.primaryProfile.id;
    if (!titularMap.has(tid)) titularMap.set(tid, []);
    titularMap.get(tid)!.push(i);
  });

  const titulares: TitularExposure[] = Array.from(titularMap.entries()).map(([tid, items]) => {
    const name = tid === appData.primaryProfile.id
      ? appData.primaryProfile.name
      : appData.partner?.profile.id === tid
        ? appData.partner.profile.name
        : "Titular";
    const totalAmount = items.reduce((s, i) => s + i.currentBalance, 0);
    const fgcCovered = items
      .filter(i => ["cdb", "lci-lca", "poupanca"].includes(i.type))
      .reduce((s, i) => s + Math.min(i.currentBalance, FGC_LIMIT_PER_CPF_PER_INSTITUTION), 0);
    const sovereignAmount = items
      .filter(i => i.type === "tesouro-selic")
      .reduce((s, i) => s + i.currentBalance, 0);
    const marketAmount = items
      .filter(i => ["acao", "fii", "crypto", "fundo"].includes(i.type))
      .reduce((s, i) => s + i.currentBalance, 0);

    // Per-titular institution breakdown
    const titularInst = new Map<string, Investment[]>();
    items.forEach(i => {
      const key = i.conglomerate || i.institution || "Não informado";
      if (!titularInst.has(key)) titularInst.set(key, []);
      titularInst.get(key)!.push(i);
    });

    const titularInstitutions: InstitutionExposure[] = Array.from(titularInst.entries()).map(([inst, instItems]) => {
      const amount = instItems.reduce((s, i) => s + i.currentBalance, 0);
      const instFgc = instItems
        .filter(i => ["cdb", "lci-lca", "poupanca"].includes(i.type))
        .reduce((s, i) => s + i.currentBalance, 0);
      return {
        institution: inst,
        conglomerate: inst,
        amount,
        percentage: totalAmount > 0 ? amount / totalAmount : 0,
        fgcCovered: Math.min(instFgc, FGC_LIMIT_PER_CPF_PER_INSTITUTION),
        fgcLimit: FGC_LIMIT_PER_CPF_PER_INSTITUTION,
        headroom: Math.max(0, FGC_LIMIT_PER_CPF_PER_INSTITUTION - instFgc),
        isOverLimit: instFgc > FGC_LIMIT_PER_CPF_PER_INSTITUTION,
        investments: instItems,
      };
    });

    return { titularId: tid, titularName: name, totalAmount, fgcCovered, sovereignAmount, marketAmount, institutions: titularInstitutions };
  });

  // ── Totals by security ──
  const fgcTotal = investments
    .filter(i => ["cdb", "lci-lca", "poupanca"].includes(i.type))
    .reduce((s, i) => s + i.currentBalance, 0);
  const sovereignTotal = investments
    .filter(i => i.type === "tesouro-selic")
    .reduce((s, i) => s + i.currentBalance, 0);
  const marketTotal = investments
    .filter(i => ["acao", "fii", "crypto", "fundo"].includes(i.type))
    .reduce((s, i) => s + i.currentBalance, 0);
  const unprotectedTotal = Math.max(0, totalWealth - fgcTotal - sovereignTotal);

  const protectionRatio = totalWealth > 0 ? (fgcTotal + sovereignTotal) / totalWealth : 0;
  const dailyLiquidity = investments
    .filter(i => ["tesouro-selic", "poupanca"].includes(i.type))
    .reduce((s, i) => s + i.currentBalance, 0);
  const liquidityRatio = totalWealth > 0 ? dailyLiquidity / totalWealth : 0;

  // ── Concentration risk ──
  const maxInstPct = institutions.length > 0 ? Math.max(...institutions.map(i => i.percentage)) : 0;
  const concentrationRisk: AllocationAnalysis["concentrationRisk"] =
    maxInstPct >= 0.8 ? "critical"
      : maxInstPct >= 0.6 ? "high"
        : maxInstPct >= 0.4 ? "medium"
          : "low";

  // ── Structural score ──
  const reserveScore = Math.min(25, (buckets[0]?.percentage || 0) * 100);
  const protectionScore = Math.min(25, protectionRatio * 30);
  const liquidityScore = Math.min(25, liquidityRatio * 40);
  const diversificationScore = Math.min(25, (1 - maxInstPct) * 35);
  const structuralScore = Math.round(reserveScore + protectionScore + liquidityScore + diversificationScore);

  return {
    buckets,
    institutions,
    titulares,
    totalWealth,
    fgcTotal,
    sovereignTotal,
    marketTotal,
    unprotectedTotal,
    protectionRatio,
    liquidityRatio,
    concentrationRisk,
    structuralScore,
  };
}
