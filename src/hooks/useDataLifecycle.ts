/**
 * useDataLifecycle — Ciclo de vida unificado de dados (Fase 4, Bloco 1)
 *
 * Consolida os 4 useEffects pesados que antes viviam no Index.tsx:
 *   1. Sync inicial pós-login (conflito/upload/download)
 *   2. Auto-save debounced (plan + appData)
 *   3. Hidratação de assets (cloud → estado)
 *   4. Detecção de blob legado (oferece migração)
 *
 * Garantias:
 *   - Hidratação SEMPRE acontece antes do auto-save (refs `hydratedRef`).
 *   - Auto-save só dispara depois de `data.wizardComplete` E hidratação concluída.
 *   - Sync inicial roda uma vez por sessão de usuário (`syncRanRef`).
 *   - Detecção de blob roda uma vez (`blobCheckedRef`).
 *
 * API exposta:
 *   - status: 'idle' | 'hydrating' | 'syncing' | 'ready' | 'error'
 *   - syncing: boolean (auto-save em andamento)
 *   - lastSyncedAt: Date | null
 *   - error: string | null
 *   - migrationDialog: { open, localSnapshot, cloudSnapshot, loading, useLocal, useCloud, decideLater }
 *   - blobMigration: { open, counts, migrate, later }
 *   - retry: () => void  (re-tenta sync inicial)
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useAssetWriter, assetRowToInvestment } from "@/hooks/useAssetWriter";
import { useDataHydration } from "@/hooks/useDataHydration";
import {
  backupBeforeDestructiveOp,
} from "@/lib/services/dataMigrationService";
import {
  migrateBlobToTables,
  previewBlobMigration,
  loadAppDataFromBlob,
} from "@/lib/services/blobMigrationService";
import type { ConflictSnapshot } from "@/components/auth/DataMigrationDialog";
import type { PlanData } from "@/lib/types";
import type { AppData } from "@/lib/models";
import type { User } from "@supabase/supabase-js";
import type { PlanMemberRow } from "@/hooks/usePlan";

type LifecycleStatus = "idle" | "hydrating" | "syncing" | "ready" | "error";

/**
 * Flag per-user que indica que a migração legacy → tabelas normalizadas já foi
 * resolvida (executada, recusada explicitamente ou desnecessária). Enquanto o
 * flag estiver presente, NÃO oferecemos novamente o diálogo de blob, NÃO
 * subimos cache local para o blob `user_financial_data` e NÃO reabrimos o
 * conflito local-vs-cloud. O `resetService` apaga essa chave junto com o resto
 * do cache do produto (varredura por prefixo `plano-do-milhao`).
 */
const MIGRATION_FLAG_PREFIX = "plano-do-milhao-migration-done:";
const migrationFlagKey = (uid: string) => `${MIGRATION_FLAG_PREFIX}${uid}`;
const isMigrationDone = (uid: string): boolean => {
  try { return localStorage.getItem(migrationFlagKey(uid)) === "1"; } catch { return false; }
};
const markMigrationDone = (uid: string): void => {
  try { localStorage.setItem(migrationFlagKey(uid), "1"); } catch { /* ignore */ }
};

interface UseDataLifecycleParams {
  user: User | null;
  data: PlanData;
  appData: AppData;
  cloudPlanRow: { id: string } | null;
  cloudMembers: PlanMemberRow[];
  setAppData: React.Dispatch<React.SetStateAction<AppData>>;
  setPlanData: (mutator: (prev: PlanData) => PlanData) => void;
  importJSON: (json: string) => void;
}

export function useDataLifecycle({
  user,
  data,
  appData,
  cloudPlanRow,
  cloudMembers,
  setAppData,
  setPlanData,
  importJSON,
}: UseDataLifecycleParams) {
  const { loadFromCloud, saveToCloud, hasLocalData } = useCloudSync();
  const assetWriter = useAssetWriter();

  const [status, setStatus] = useState<LifecycleStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [syncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);

  // Migração de conflito (local vs cloud)
  const [migrationOpen, setMigrationOpen] = useState(false);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [localSnapshot, setLocalSnapshot] = useState<ConflictSnapshot | null>(null);
  const [cloudSnapshot, setCloudSnapshot] = useState<ConflictSnapshot | null>(null);

  // Migração de blob legado
  const [blobOpen, setBlobOpen] = useState(false);
  const [blobCounts, setBlobCounts] = useState({ incomes: 0, expenses: 0, debts: 0 });
  const [blobAppDataCache, setBlobAppDataCache] = useState<AppData | null>(null);

  // Refs de coordenação — evitam race entre hidratação e auto-save
  const hydratedRef = useRef(false);
  const syncRanRef = useRef<string | null>(null); // userId para o qual o sync inicial já rodou
  const assetsHydratedRef = useRef<string | null>(null); // planId para o qual já hidratou
  const blobCheckedRef = useRef(false);

  // Reset de refs quando o usuário troca/desloga
  useEffect(() => {
    if (!user) {
      hydratedRef.current = false;
      syncRanRef.current = null;
      assetsHydratedRef.current = null;
      blobCheckedRef.current = false;
      setStatus("idle");
    }
  }, [user]);

  // ─────────────────────────────────────────────────────────────
  // 1. Hidratação de tabelas (income/expense/debt/tracking)
  // ─────────────────────────────────────────────────────────────
  const hydration = useDataHydration({
    userId: user?.id,
    planId: cloudPlanRow?.id,
    members: cloudMembers,
    setAppData,
    setPlanData,
  });

  // Marca como hidratado quando termina
  useEffect(() => {
    if (hydration.hydrated) hydratedRef.current = true;
  }, [hydration.hydrated]);

  // ─────────────────────────────────────────────────────────────
  // 2. Sync inicial pós-login (conflito/upload/download)
  // ─────────────────────────────────────────────────────────────
  const buildLocalSnapshot = useCallback((): ConflictSnapshot => {
    const totalWealth =
      (appData.investments ?? []).reduce((sum, inv) => sum + (inv.currentBalance || 0), 0) || 0;
    const participants = [
      appData.primaryProfile?.name,
      appData.partner && !appData.partner.removedAt ? appData.partner.profile.name : null,
    ].filter((n): n is string => !!n && n.trim().length > 0);
    return {
      updatedAt: new Date().toISOString(),
      goalAmount: data.config?.targetAmount ?? null,
      currentWealth: totalWealth,
      participants,
      mode: appData.mode === "casal" ? "casal" : "individual",
    };
  }, [appData, data.config?.targetAmount]);

  const buildCloudSnapshot = useCallback(
    (cloudPlanData: PlanData | null, cloudAppData: AppData | null): ConflictSnapshot | null => {
      if (!cloudPlanData && !cloudAppData) return null;
      const investments = (cloudAppData?.investments ?? []) as Array<{ currentBalance?: number }>;
      const totalWealth = investments.reduce((sum, inv) => sum + (inv?.currentBalance || 0), 0);
      const participants = [
        cloudAppData?.primaryProfile?.name,
        cloudAppData?.partner && !cloudAppData.partner.removedAt
          ? cloudAppData.partner.profile.name
          : null,
      ].filter((n): n is string => !!n && n.trim().length > 0);
      return {
        updatedAt: (cloudPlanData as unknown as { updatedAt?: string })?.updatedAt ?? null,
        goalAmount: cloudPlanData?.config?.targetAmount ?? null,
        currentWealth: totalWealth,
        participants,
        mode: cloudAppData?.mode === "casal" ? "casal" : "individual",
      };
    },
    [],
  );

  const runInitialSync = useCallback(async () => {
    if (!user) return;
    // Refatoração Fase 2.E: Supabase normalizado passa a ser fonte de verdade.
    // Se a migração legacy já foi resolvida para esse usuário, pulamos toda a
    // dança de "conflito local vs blob" — quem manda é o que o `useDataHydration`
    // lê das tabelas normalizadas.
    if (isMigrationDone(user.id)) {
      setStatus("ready");
      setLastSyncedAt(new Date());
      return;
    }
    setStatus("syncing");
    setError(null);
    try {
      const localHasData = hasLocalData();
      const cloudData = await loadFromCloud(user.id);
      const cloudExists = !!(
        cloudData?.planData &&
        (cloudData.planData as unknown as { wizardComplete?: boolean }).wizardComplete
      );

      if (localHasData && cloudExists) {
        setLocalSnapshot(buildLocalSnapshot());
        setCloudSnapshot(buildCloudSnapshot(cloudData?.planData ?? null, cloudData?.appData ?? null));
        setMigrationOpen(true);
      } else if (localHasData && !cloudExists) {
        // Sobe o cache local UMA VEZ para o blob legado, apenas como ponto de
        // partida para o fluxo de migração para tabelas normalizadas (Fase 2.E).
        // Depois disso o autosave contínuo NÃO existe mais.
        await saveToCloud(user.id, data, appData);
        toast.success("Seus dados foram salvos na nuvem! ☁️");
      } else if (!localHasData && cloudExists && cloudData) {
        if (cloudData.planData) importJSON(JSON.stringify(cloudData.planData));
        if (cloudData.appData) setAppData(cloudData.appData as AppData);
        toast.success("Dados carregados da nuvem! ☁️");
      } else if (!localHasData && !cloudExists) {
        // Usuário novo, sem nada para migrar — marca como resolvido.
        markMigrationDone(user.id);
      }
      setStatus("ready");
      setLastSyncedAt(new Date());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro desconhecido no sync inicial";
      setError(msg);
      setStatus("error");
    }
  }, [
    user,
    hasLocalData,
    loadFromCloud,
    saveToCloud,
    importJSON,
    setAppData,
    buildLocalSnapshot,
    buildCloudSnapshot,
    data,
    appData,
  ]);

  useEffect(() => {
    if (!user) return;
    if (syncRanRef.current === user.id) return;
    syncRanRef.current = user.id;
    void runInitialSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // ─────────────────────────────────────────────────────────────
  // 3. Auto-save contínuo do blob — REMOVIDO na Fase 2.E.
  // ─────────────────────────────────────────────────────────────
  // A escrita oficial passa pelos writers normalizados (usePlanWriter,
  // useAssetWriter, useIncomeWriter, useExpenseWriter, useDebtWriter,
  // useMonthlyTrackingWriter). O blob `user_financial_data` permanece como
  // legado: leitura para migração, escrita controlada apenas em
  // handleUseLocal/runInitialSync (e zerado pelo `resetService`).
  // Motivação: evitar que o blob "ressuscite" dados após reset, sobrescreva o
  // estado normalizado ou crie dupla fonte de verdade.

  // ─────────────────────────────────────────────────────────────
  // 4. Hidratação de assets (cloud → estado, sem duplicar)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !cloudPlanRow) return;
    if (assetsHydratedRef.current === cloudPlanRow.id) return;
    assetsHydratedRef.current = cloudPlanRow.id;

    let cancelled = false;
    (async () => {
      const result = await assetWriter.listAssets(cloudPlanRow.id);
      if (cancelled || !result.data) return;
      const cloudInvestments = result.data.map(assetRowToInvestment);
      setAppData((prev) => {
        const localIds = new Set(prev.investments.map((i) => i.id));
        const merged = [
          ...prev.investments,
          ...cloudInvestments.filter((c) => !localIds.has(c.id)),
        ];
        if (prev.investments.length === 0) return { ...prev, investments: cloudInvestments };
        return { ...prev, investments: merged };
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [user, cloudPlanRow, assetWriter, setAppData]);

  // ─────────────────────────────────────────────────────────────
  // 5. Detecção de blob legado (oferece migração)
  // ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!user || !cloudPlanRow || !hydration.hydrated || blobCheckedRef.current) return;
    if (isMigrationDone(user.id)) {
      blobCheckedRef.current = true;
      return;
    }
    blobCheckedRef.current = true;
    (async () => {
      const remoteBlob = await loadAppDataFromBlob(user.id);
      const candidate: AppData | null =
        remoteBlob ??
        ((appData.incomes.length + appData.expenses.length + appData.debts.length) > 0
          ? appData
          : null);
      const preview = previewBlobMigration(candidate);
      const counts = {
        incomes: hydration.counts.incomes === 0 ? preview.incomes : 0,
        expenses: hydration.counts.expenses === 0 ? preview.expenses : 0,
        debts: hydration.counts.debts === 0 ? preview.debts : 0,
      };
      if (counts.incomes + counts.expenses + counts.debts > 0 && candidate) {
        setBlobAppDataCache(candidate);
        setBlobCounts(counts);
        setBlobOpen(true);
      } else {
        // Nada para migrar — marca como resolvido para não reabrir esse fluxo.
        markMigrationDone(user.id);
      }
    })();
  }, [user, cloudPlanRow, hydration.hydrated, hydration.counts, appData]);

  // ─────────────────────────────────────────────────────────────
  // Handlers expostos
  // ─────────────────────────────────────────────────────────────
  const handleUseLocal = useCallback(async () => {
    if (!user) return;
    setMigrationLoading(true);
    backupBeforeDestructiveOp();
    await saveToCloud(user.id, data, appData);
    markMigrationDone(user.id);
    setMigrationLoading(false);
    setMigrationOpen(false);
    setLocalSnapshot(null);
    setCloudSnapshot(null);
    toast.success("Conta atualizada com os dados deste dispositivo. Backup local criado.");
  }, [user, saveToCloud, data, appData]);

  const handleUseCloud = useCallback(async () => {
    if (!user) return;
    setMigrationLoading(true);
    backupBeforeDestructiveOp();
    const cloudData = await loadFromCloud(user.id);
    if (cloudData?.planData) importJSON(JSON.stringify(cloudData.planData));
    if (cloudData?.appData) setAppData(cloudData.appData as AppData);
    markMigrationDone(user.id);
    setMigrationLoading(false);
    setMigrationOpen(false);
    setLocalSnapshot(null);
    setCloudSnapshot(null);
    toast.success("Dados da conta carregados. Versão local guardada em backup.");
  }, [user, loadFromCloud, importJSON, setAppData]);

  const handleDecideLater = useCallback(async () => {
    if (!user) return;
    const cloudData = await loadFromCloud(user.id);
    if (cloudData?.planData) importJSON(JSON.stringify(cloudData.planData));
    if (cloudData?.appData) setAppData(cloudData.appData as AppData);
    setMigrationOpen(false);
    toast.message("Decisão adiada", {
      description: "Por enquanto, vamos usar os dados da sua conta. Você poderá revisar esse conflito depois.",
    });
  }, [user, loadFromCloud, importJSON, setAppData]);

  const handleBlobMigrate = useCallback(async () => {
    if (!user || !cloudPlanRow || !blobAppDataCache) return;
    backupBeforeDestructiveOp();
    const summary = await migrateBlobToTables(user.id, cloudPlanRow.id, blobAppDataCache, cloudMembers);
    markMigrationDone(user.id);
    setBlobOpen(false);
    if (summary.errors.length > 0) toast.error(`Migração concluída com avisos: ${summary.errors.join("; ")}`);
    else toast.success(`Migrado: ${summary.incomes} renda(s), ${summary.expenses} gasto(s), ${summary.debts} dívida(s).`);
    hydration.forceRefresh();
  }, [user, cloudPlanRow, blobAppDataCache, cloudMembers, hydration]);

  const handleBlobLater = useCallback(() => {
    setBlobOpen(false);
    // Não marca migração como concluída — usuário pode reabrir na próxima sessão.
    toast.message("Tudo bem!", { description: "Você pode migrar depois nas configurações." });
  }, []);

  const retry = useCallback(() => {
    syncRanRef.current = null;
    void runInitialSync();
  }, [runInitialSync]);

  return {
    status,
    syncing,
    lastSyncedAt,
    error,
    hydration,
    migrationDialog: {
      open: migrationOpen,
      loading: migrationLoading,
      localSnapshot,
      cloudSnapshot,
      useLocal: handleUseLocal,
      useCloud: handleUseCloud,
      decideLater: handleDecideLater,
    },
    blobMigration: {
      open: blobOpen,
      counts: blobCounts,
      migrate: handleBlobMigrate,
      later: handleBlobLater,
    },
    retry,
  };
}
