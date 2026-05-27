/**
 * useAssetWriter — Camada de escrita real para investimentos (Fase 2.B)
 *
 * Espelha usePlanWriter para a tabela `assets`. Mantém useAppData/useCloudSync
 * rodando em paralelo como rede de segurança até a Fase 2.D.
 *
 * Mapeamento Investment (modelo do app) ↔ assets (tabela normalizada):
 * - id ↔ id (uuid; quando vier do app, é regenerado pelo banco se inválido)
 * - name ↔ ticker_or_name
 * - type ↔ asset_type
 * - institution ↔ institution
 * - conglomerate ↔ conglomerate
 * - currentBalance ↔ current_amount + net_estimated
 * - monthlyContribution → não persistido aqui (vai em monthly_tracking)
 * - securityLevel → has_fgc / has_sovereign_guarantee derivados
 * - bucket ↔ bucket
 * - profileId/titular → member_id
 * - active ↔ is_active
 */
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import type { Investment, SecurityLevel } from "@/lib/models";
import { trackWriterChange } from "@/lib/services/auditService";

export interface AssetRow {
  id: string;
  plan_id: string;
  user_id: string;
  member_id: string | null;
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

/** Deriva flags de proteção a partir do nível de segurança do app. */
function deriveProtectionFlags(level?: SecurityLevel): { has_fgc: boolean; has_sovereign_guarantee: boolean } {
  switch (level) {
    case "soberano":
      return { has_fgc: false, has_sovereign_guarantee: true };
    case "fgc":
      return { has_fgc: true, has_sovereign_guarantee: false };
    default:
      return { has_fgc: false, has_sovereign_guarantee: false };
  }
}

/** Reverte flags do banco para o nível de segurança do app. */
function flagsToSecurityLevel(row: AssetRow): SecurityLevel {
  if (row.has_sovereign_guarantee) return "soberano";
  if (row.has_fgc) return "fgc";
  return "mercado";
}

/**
 * Mapa bucket do app (PT) → bucket aceito pelo CHECK constraint da tabela assets (EN).
 * Tabela aceita: reserve | protection | sovereign | growth.
 */
const BUCKET_TO_DB: Record<string, string> = {
  "reserva": "reserve",
  "protecao-bancaria": "protection",
  "base-soberana": "sovereign",
  "crescimento": "growth",
};
const BUCKET_FROM_DB: Record<string, string> = {
  "reserve": "reserva",
  "protection": "protecao-bancaria",
  "sovereign": "base-soberana",
  "growth": "crescimento",
};

/** Mapa liquidez do app → CHECK aceito (daily | scheduled | maturity | variable). */
const LIQUIDITY_TO_DB: Record<string, string> = {
  "diaria": "daily", "diária": "daily", "daily": "daily",
  "programada": "scheduled", "scheduled": "scheduled",
  "vencimento": "maturity", "maturity": "maturity",
  "variavel": "variable", "variável": "variable", "variable": "variable",
};

/**
 * Normaliza datas vindas do app (YYYY-MM ou YYYY-MM-DD) para o formato DATE do Postgres.
 * Strings vazias viram null. YYYY-MM é completado com o dia 01.
 */
function normalizeDate(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  // Tenta parsear formatos arbitrários como ISO
  const d = new Date(trimmed);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
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
    monthlyContribution: 0, // não persistido em assets
    annualRate: 0, // legado; pode ser inferido pelas premissas do plano
    startDate: row.reference_date ?? row.created_at?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    maturityDate: row.maturity_date ?? undefined,
    profileId: row.member_id ?? undefined,
    notes: undefined,
    active: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Converte um Investment do app em payload para insert/update na tabela assets. */
export function investmentToAssetPayload(
  inv: Partial<Investment>,
  ctx: { userId: string; planId: string; memberId?: string | null }
): Record<string, unknown> {
  const protection = deriveProtectionFlags(inv.securityLevel);
  const payload: Record<string, unknown> = {
    user_id: ctx.userId,
    plan_id: ctx.planId,
  };
  // member_id: só entra no payload quando o chamador passou explicitamente
  // (`null` = limpar, valor = setar). `undefined` significa "não tocar",
  // evitando que um update parcial apague o vínculo existente no banco.
  if (ctx.memberId !== undefined) payload.member_id = ctx.memberId;
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

export function useAssetWriter() {
  const { user } = useAuth();

  /** Lista todos os assets ativos do plano. */
  const listAssets = useCallback(
    async (planId: string): Promise<WriterResult<AssetRow[]>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      const { data, error } = await supabase
        .from("assets")
        .select("*")
        .eq("plan_id", planId)
        .eq("user_id", uid)
        .order("created_at", { ascending: true });

      if (error) return { data: null, error: error.message };
      return { data: (data ?? []) as AssetRow[], error: null };
    },
    [user]
  );

  /** Cria um novo asset. Retorna a linha criada com id real do banco. */
  const createAsset = useCallback(
    async (
      planId: string,
      investment: Investment,
      memberId?: string | null
    ): Promise<WriterResult<AssetRow>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };
      if (!memberId) return { data: null, error: "Participante do plano não encontrado." };

      const payload = investmentToAssetPayload(investment, { userId: uid, planId, memberId });
      // Garante asset_type sempre presente (NOT NULL)
      if (!payload.asset_type) payload.asset_type = investment.type ?? "other";

      const { data, error } = await supabase
        .from("assets")
        .insert(payload as never)
        .select()
        .single();

      if (error || !data) return { data: null, error: error?.message ?? "Falha ao criar investimento." };
      void trackWriterChange({
        userId: uid,
        planId,
        entity: "asset",
        entityId: (data as AssetRow).id,
        action: "create",
        newValue: data as unknown as Record<string, unknown>,
        event: "asset_created",
        eventProperties: { asset_type: (data as AssetRow).asset_type },
      });
      return { data: data as AssetRow, error: null };
    },
    [user]
  );

  /** Atualiza um asset existente. */
  const updateAsset = useCallback(
    async (
      planId: string,
      assetId: string,
      patch: Partial<Investment>,
      memberId?: string | null
    ): Promise<WriterResult<AssetRow>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      const payload = investmentToAssetPayload(patch, { userId: uid, planId, memberId });
      // user_id/plan_id não devem ser alterados em update
      delete payload.user_id;
      delete payload.plan_id;

      const { data, error } = await supabase
        .from("assets")
        .update(payload as never)
        .eq("id", assetId)
        .eq("user_id", uid)
        .select()
        .single();

      if (error || !data) return { data: null, error: error?.message ?? "Falha ao atualizar investimento." };
      void trackWriterChange({
        userId: uid,
        planId,
        entity: "asset",
        entityId: assetId,
        action: "update",
        newValue: data as unknown as Record<string, unknown>,
        event: "asset_updated",
      });
      return { data: data as AssetRow, error: null };
    },
    [user]
  );

  /** Soft-delete: marca como inativo, preservando histórico. */
  const deactivateAsset = useCallback(
    async (assetId: string): Promise<WriterResult<true>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      const { error } = await supabase
        .from("assets")
        .update({ is_active: false })
        .eq("id", assetId)
        .eq("user_id", uid);

      if (error) return { data: null, error: error.message };
      void trackWriterChange({
        userId: uid,
        entity: "asset",
        entityId: assetId,
        action: "delete",
        event: "asset_deleted",
        eventProperties: { soft: true },
      });
      return { data: true, error: null };
    },
    [user]
  );

  /** Hard-delete (somente quando usuário pede explicitamente). */
  const deleteAsset = useCallback(
    async (assetId: string): Promise<WriterResult<true>> => {
      const uid = user?.id;
      if (!uid) return { data: null, error: "Usuário não autenticado." };

      const { error } = await supabase
        .from("assets")
        .delete()
        .eq("id", assetId)
        .eq("user_id", uid);

      if (error) return { data: null, error: error.message };
      void trackWriterChange({
        userId: uid,
        entity: "asset",
        entityId: assetId,
        action: "delete",
        event: "asset_deleted",
        eventProperties: { soft: false },
      });
      return { data: true, error: null };
    },
    [user]
  );

  return {
    listAssets,
    createAsset,
    updateAsset,
    deactivateAsset,
    deleteAsset,
  };
}
