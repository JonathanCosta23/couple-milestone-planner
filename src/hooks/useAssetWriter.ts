/**
 * useAssetWriter — Camada de escrita real para investimentos.
 * Ownership é explícito: criação normal exige membro ativo e scope individual.
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Investment, OwnershipScope, SecurityLevel } from "@/lib/models";
import { applyOwnershipPatch } from "@/lib/models";
import { trackWriterChange } from "@/lib/services/auditService";

export interface AssetRow {
  id: string;
  plan_id: string;
  user_id: string;
  member_id: string | null;
  ownership_scope: OwnershipScope;
  asset_type: string;
  asset_subtype: string | null;
  institution: string | null;
  conglomerate: string | null;
  ticker_or_name: string | null;
  invested_amount: number;
  current_amount: number;
  net_estimated: number;
  mark_to_market: boolean;
  maturity_date: string | null;
  liquidity_type: string | null;
  has_sovereign_guarantee: boolean;
  has_fgc: boolean;
  bucket: string | null;
  is_active: boolean;
  reference_date: string | null;
  created_at: string;
  updated_at: string;
}

interface WriterResult<T> {
  data: T | null;
  error: string | null;
}

function deriveProtectionFlags(level?: SecurityLevel): { has_fgc: boolean; has_sovereign_guarantee: boolean } {
  switch (level) {
    case "soberano": return { has_fgc: false, has_sovereign_guarantee: true };
    case "fgc": return { has_fgc: true, has_sovereign_guarantee: false };
    default: return { has_fgc: false, has_sovereign_guarantee: false };
  }
}

function flagsToSecurityLevel(row: AssetRow): SecurityLevel {
  if (row.has_sovereign_guarantee) return "soberano";
  if (row.has_fgc) return "fgc";
  return "mercado";
}

const BUCKET_TO_DB: Record<string, string> = {
  reserva: "reserve",
  "protecao-bancaria": "protection",
  "base-soberana": "sovereign",
  crescimento: "growth",
};
const BUCKET_FROM_DB: Record<string, string> = {
  reserve: "reserva",
  protection: "protecao-bancaria",
  sovereign: "base-soberana",
  growth: "crescimento",
};

function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const d = new Date(trimmed);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export function assetRowToInvestment(row: AssetRow): Investment {
  return {
    id: row.id,
    name: row.ticker_or_name ?? "",
    type: (row.asset_type as Investment["type"]) ?? "other",
    institution: row.institution ?? "",
    conglomerate: row.conglomerate ?? undefined,
    securityLevel: flagsToSecurityLevel(row),
    bucket: (row.bucket ? (BUCKET_FROM_DB[row.bucket] ?? row.bucket) : undefined) as Investment["bucket"],
    currentBalance: Number(row.current_amount ?? 0),
    monthlyContribution: 0,
    annualRate: 0,
    startDate: row.reference_date ?? row.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    maturityDate: row.maturity_date ?? undefined,
    profileId: row.member_id ?? undefined,
    ownershipScope: row.ownership_scope,
    notes: undefined,
    active: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function investmentToAssetPayload(
  inv: Partial<Investment>,
  ctx: {
    userId: string;
    planId: string;
    memberId?: string | null;
    ownershipScope?: OwnershipScope;
  },
): Record<string, unknown> {
  const protection = deriveProtectionFlags(inv.securityLevel);
  const payload: Record<string, unknown> = { plan_id: ctx.planId };
  applyOwnershipPatch(payload, {
    memberId: ctx.memberId,
    ownershipScope: ctx.ownershipScope ?? inv.ownershipScope,
  });
  if (inv.type !== undefined) payload.asset_type = inv.type;
  if (inv.institution !== undefined) payload.institution = inv.institution || null;
  if (inv.conglomerate !== undefined) payload.conglomerate = inv.conglomerate || null;
  if (inv.name !== undefined) payload.ticker_or_name = inv.name || null;
  if (inv.currentBalance !== undefined) {
    payload.current_amount = inv.currentBalance;
    payload.net_estimated = inv.currentBalance;
    payload.invested_amount = inv.currentBalance;
  }
  if (inv.bucket !== undefined) payload.bucket = inv.bucket ? (BUCKET_TO_DB[inv.bucket] ?? null) : null;
  if (inv.active !== undefined) payload.is_active = inv.active;
  if (inv.startDate !== undefined) payload.reference_date = normalizeDate(inv.startDate);
  if (inv.maturityDate !== undefined) payload.maturity_date = normalizeDate(inv.maturityDate);
  if (inv.securityLevel !== undefined) {
    payload.has_fgc = protection.has_fgc;
    payload.has_sovereign_guarantee = protection.has_sovereign_guarantee;
  }
  return payload;
}

function ownershipAudit(row: AssetRow): Record<string, unknown> {
  return {
    ownership_scope: row.ownership_scope,
    member_id_present: Boolean(row.member_id),
    origin: "writer",
  };
}

export function useAssetWriter() {
  const { user } = useAuth();

  const listAssets = useCallback(async (planId: string): Promise<WriterResult<AssetRow[]>> => {
    const uid = user?.id;
    if (!uid) return { data: null, error: "Usuário não autenticado." };
    const { data, error } = await supabase.from("assets").select("*")
      .eq("plan_id", planId).eq("user_id", uid).order("created_at", { ascending: true });
    if (error) return { data: null, error: error.message };
    return { data: (data ?? []) as AssetRow[], error: null };
  }, [user]);

  const createAsset = useCallback(async (
    planId: string,
    investment: Investment,
    memberId?: string | null,
  ): Promise<WriterResult<AssetRow>> => {
    const uid = user?.id;
    if (!uid) return { data: null, error: "Usuário não autenticado." };
    if (!memberId) return { data: null, error: "member_required" };

    let payload: Record<string, unknown>;
    try {
      payload = investmentToAssetPayload(investment, {
        userId: uid, planId, memberId, ownershipScope: "individual",
      });
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : "ownership_required" };
    }
    if (!payload.asset_type) payload.asset_type = investment.type ?? "other";

    const { data, error } = await supabase.from("assets").insert(payload as never).select().single();
    if (error || !data) return { data: null, error: error?.message ?? "Falha ao criar investimento." };
    const row = data as AssetRow;
    void trackWriterChange({
      userId: uid, planId, entity: "asset", entityId: row.id, action: "create",
      newValue: ownershipAudit(row), event: "asset_created",
      eventProperties: { asset_type: row.asset_type, ownership_scope: row.ownership_scope },
    });
    return { data: row, error: null };
  }, [user]);

  const updateAsset = useCallback(async (
    planId: string,
    assetId: string,
    patch: Partial<Investment>,
    memberId?: string | null,
  ): Promise<WriterResult<AssetRow>> => {
    const uid = user?.id;
    if (!uid) return { data: null, error: "Usuário não autenticado." };
    let payload: Record<string, unknown>;
    try {
      payload = investmentToAssetPayload(patch, {
        userId: uid,
        planId,
        memberId,
        ownershipScope: memberId === undefined ? patch.ownershipScope : memberId ? "individual" : patch.ownershipScope,
      });
    } catch (err) {
      return { data: null, error: err instanceof Error ? err.message : "ownership_required" };
    }
    delete payload.plan_id;

    const { data, error } = await supabase.from("assets").update(payload as never)
      .eq("id", assetId).eq("user_id", uid).select().single();
    if (error || !data) return { data: null, error: error?.message ?? "Falha ao atualizar investimento." };
    const row = data as AssetRow;
    void trackWriterChange({
      userId: uid, planId, entity: "asset", entityId: assetId, action: "update",
      newValue: ownershipAudit(row), event: "asset_updated",
    });
    return { data: row, error: null };
  }, [user]);

  const deactivateAsset = useCallback(async (assetId: string): Promise<WriterResult<true>> => {
    const uid = user?.id;
    if (!uid) return { data: null, error: "Usuário não autenticado." };
    const { error } = await supabase.from("assets").update({ is_active: false })
      .eq("id", assetId).eq("user_id", uid);
    if (error) return { data: null, error: error.message };
    void trackWriterChange({ userId: uid, entity: "asset", entityId: assetId,
      action: "delete", event: "asset_deleted", eventProperties: { soft: true } });
    return { data: true, error: null };
  }, [user]);

  const deleteAsset = useCallback(async (assetId: string): Promise<WriterResult<true>> => {
    const uid = user?.id;
    if (!uid) return { data: null, error: "Usuário não autenticado." };
    const { error } = await supabase.from("assets").delete().eq("id", assetId).eq("user_id", uid);
    if (error) return { data: null, error: error.message };
    void trackWriterChange({ userId: uid, entity: "asset", entityId: assetId,
      action: "delete", event: "asset_deleted", eventProperties: { soft: false } });
    return { data: true, error: null };
  }, [user]);

  return { listAssets, createAsset, updateAsset, deactivateAsset, deleteAsset };
}
