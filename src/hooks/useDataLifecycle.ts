/**
 * useDataLifecycle — ciclo unificado de hidratação, sync e migração legada.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCloudSync } from "@/hooks/useCloudSync";
import { useAssetWriter, assetRowToInvestment } from "@/hooks/useAssetWriter";
import { useDataHydration } from "@/hooks/useDataHydration";
import { backupBeforeDestructiveOp } from "@/lib/services/dataMigrationService";
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

  const [migrationOpen, setMigrationOpen] = useState(false);
  const [migrationLoading, setMigrationLoading] = useState(false);
  const [localSnapshot, setLocalSnapshot] = useState<ConflictSnapshot | null>(null);
  const [cloudSnapshot, setCloudSnapshot] = useState<ConflictSnapshot | null>(null);

  const [blobOpen, setBlobOpen] = useState(false);
  const [blobCounts, setBlobCounts] = useState({
    assets: 0, incomes: 0, expenses: 0, debts: 0,
  });
  const [blobAppDataCache, setBlobAppDataCache] = useState<AppData | null>(null);
  const [cloudAssetCount, setCloudAssetCount] = useState(0);

  const hydratedRef = useRef(false);
  const syncRanRef = useRef<string | null>(null);
  const assetsHydratedRef = useRef<string | null>(null);
  const blobCheckedRef = useRef(false);

  useEffect(() => {
    if (!user) {
      hydratedRef.current = false;
      syncRanRef.current = null;
      assetsHydratedRef.current = null;
      blobCheckedRef.current = false;
      setCloudAssetCount(0);
      setStatus("idle");
    }
  }, [user]);

  const hydration = useDataHydration({
    userId: user?.id,
    planId: cloudPlanRow?.id,
    members: cloudMembers,
    setAppData,
    setPlanData,
  });

  useEffect(() => {
    if (hydration.hydrated) hydratedRef.current = true;
  }, [hydration.hydrated]);

  const buildLocalSnapshot = useCallback((): ConflictSnapshot => {
    const totalWealth = (appData.investments ?? [])
      .reduce((sum, inv) => sum + (inv.currentBalance || 0), 0) || 0;
    const participants = [
      appData.primaryProfile?.name,
      appData.partner && !appData.partner.removedAt ? appData.partner.profile.name : null,
    ].filter((name): name is string => Boolean(name?.trim()));
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
      ].filter((name): name is string => Boolean(name?.trim()));
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
      const cloudExists = Boolean(
        cloudData?.planData &&
        (cloudData.planData as unknown as { wizardComplete?: boolean }).wizardComplete,
      );

      if (localHasData && cloudExists) {
        setLocalSnapshot(buildLocalSnapshot());
        setCloudSnapshot(buildCloudSnapshot(cloudData?.planData ?? null, cloudData?.appData ?? null));
        setMigrationOpen(true);
      } else if (localHasData && !cloudExists) {
        await saveToCloud(user.id, data, appData);
        toast.success("Seus dados foram salvos na nuvem! ☁️");
      } else if (!localHasData && cloudExists && cloudData) {
        if (cloudData.planData) importJSON(JSON.stringify(cloudData.planData));
        if (cloudData.appData) setAppData(cloudData.appData as AppData);
        toast.success("Dados carregados da nuvem! ☁️");
      } else {
        markMigrationDone(user.id);
      }
      setStatus("ready");
      setLastSyncedAt(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido no sync inicial");
      setStatus("error");
    }
  }, [
    user, hasLocalData, loadFromCloud, saveToCloud, importJSON, setAppData,
    buildLocalSnapshot, buildCloudSnapshot, data, appData,
  ]);

  useEffect(() => {
    if (!user || syncRanRef.current === user.id) return;
    syncRanRef.current = user.id;
    void runInitialSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Assets normalizados vencem o blob. O mapper preserva ownership_scope,
  // inclusive needs_review, sem atribuí-lo ao titular.
  useEffect(() => {
    if (!user || !cloudPlanRow || assetsHydratedRef.current === cloudPlanRow.id) return;
    assetsHydratedRef.current = cloudPlanRow.id;
    let cancelled = false;
    (async () => {
      const result = await assetWriter.listAssets(cloudPlanRow.id);
      if (cancelled || !result.data) return;
      setCloudAssetCount(result.data.length);
      const cloudInvestments = result.data.map(assetRowToInvestment);
      setAppData((prev) => {
        const localIds = new Set(prev.investments.map((item) => item.id));
        const merged = [
          ...prev.investments,
          ...cloudInvestments.filter((item) => !localIds.has(item.id)),
        ];
        return {
          ...prev,
          investments: prev.investments.length === 0 ? cloudInvestments : merged,
        };
      });
    })();
    return () => { cancelled = true; };
  }, [user, cloudPlanRow, assetWriter, setAppData]);

  useEffect(() => {
    if (!user || !cloudPlanRow || !hydration.hydrated || blobCheckedRef.current) return;
    if (isMigrationDone(user.id)) {
      blobCheckedRef.current = true;
      return;
    }
    blobCheckedRef.current = true;
    (async () => {
      const remoteBlob = await loadAppDataFromBlob(user.id);
      const localCount = (appData.investments?.length ?? 0)
        + appData.incomes.length + appData.expenses.length + appData.debts.length;
      const candidate: AppData | null = remoteBlob ?? (localCount > 0 ? appData : null);
      const preview = previewBlobMigration(candidate);
      const counts = {
        assets: cloudAssetCount === 0 ? preview.assets : 0,
        incomes: hydration.counts.incomes === 0 ? preview.incomes : 0,
        expenses: hydration.counts.expenses === 0 ? preview.expenses : 0,
        debts: hydration.counts.debts === 0 ? preview.debts : 0,
      };
      const total = counts.assets + counts.incomes + counts.expenses + counts.debts;
      if (total > 0 && candidate) {
        setBlobAppDataCache(candidate);
        setBlobCounts(counts);
        setBlobOpen(true);
      } else {
        markMigrationDone(user.id);
      }
    })();
  }, [
    user, cloudPlanRow, hydration.hydrated, hydration.counts,
    appData, cloudAssetCount,
  ]);

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
    const summary = await migrateBlobToTables(
      user.id, cloudPlanRow.id, blobAppDataCache, cloudMembers,
    );
    markMigrationDone(user.id);
    setBlobOpen(false);
    if (summary.errors.length > 0) {
      toast.error(`Migração concluída com avisos: ${summary.errors.join("; ")}`);
    } else {
      const review = summary.needsReviewCreated > 0
        ? ` ${summary.needsReviewCreated} item(ns) precisam de revisão de responsável.`
        : "";
      toast.success(
        `Migrado: ${summary.assets} investimento(s), ${summary.incomes} renda(s), `
        + `${summary.expenses} gasto(s), ${summary.debts} dívida(s).${review}`,
      );
    }
    hydration.forceRefresh();
    assetsHydratedRef.current = null;
  }, [user, cloudPlanRow, blobAppDataCache, cloudMembers, hydration]);

  const handleBlobLater = useCallback(() => {
    setBlobOpen(false);
    toast.message("Tudo bem!", {
      description: "Você pode migrar depois nas configurações.",
    });
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
