/**
 * useMemberResolver — resolve plan_member_id a partir do profileId do AppData.
 * Compartilhado por todos os hooks de domínio (income/expense/debt/asset).
 */
import { useCallback } from "react";
import type { AppData } from "@/lib/models";
import type { PlanMemberRow } from "@/hooks/usePlan";

export function useMemberResolver(
  appData: AppData,
  primaryMember: PlanMemberRow | null,
  partnerMember: PlanMemberRow | null,
) {
  return useCallback(
    (profileId?: string): string | null => {
      if (!profileId) return null;
      if (appData.primaryProfile?.id === profileId) return primaryMember?.id ?? null;
      if (appData.partner?.profile?.id === profileId) return partnerMember?.id ?? null;
      return null;
    },
    [appData.primaryProfile?.id, appData.partner?.profile?.id, primaryMember?.id, partnerMember?.id],
  );
}
