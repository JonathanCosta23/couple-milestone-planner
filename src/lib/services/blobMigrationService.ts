/**
 * Blob Migration Service
 *
 * Migra dados legados para tabelas normalizadas sem inferir ownership em
 * planos de casal. Participante inequívoco vira `individual`; ambiguidade
 * vira `needs_review` com member_id nulo.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  AppData,
  Income,
  Expense,
  Debt,
  Investment,
  OwnershipScope,
} from "@/lib/models";
import type { PlanMemberRow } from "@/hooks/usePlan";
import { toFriendlyError } from "@/lib/errors/friendlyError";
import { logger } from "@/lib/logger";

export interface BlobMigrationSummary {
  assets: number;
  incomes: number;
  expenses: number;
  debts: number;
  individualCreated: number;
  needsReviewCreated: number;
  ignored: number;
  errors: string[];
}

export async function loadAppDataFromBlob(userId: string): Promise<AppData | null> {
  const { data, error } = await supabase
    .from("user_financial_data")
    .select("app_data")
    .eq("user_id", userId)
    .maybeSingle();
  if (error || !data?.app_data) return null;
  return data.app_data as unknown as AppData;
}

interface PreviewCounts {
  assets: number;
  incomes: number;
  expenses: number;
  debts: number;
  hasAnything: boolean;
}

export function previewBlobMigration(appData: AppData | null): PreviewCounts {
  if (!appData) {
    return { assets: 0, incomes: 0, expenses: 0, debts: 0, hasAnything: false };
  }
  const assets = appData.investments?.length ?? 0;
  const incomes = appData.incomes?.length ?? 0;
  const expenses = appData.expenses?.length ?? 0;
  const debts = appData.debts?.length ?? 0;
  return {
    assets,
    incomes,
    expenses,
    debts,
    hasAnything: assets + incomes + expenses + debts > 0,
  };
}

interface OwnershipResolution {
  memberId: string | null;
  ownershipScope: Extract<OwnershipScope, "individual" | "needs_review">;
}

function isActiveMember(member: PlanMemberRow): boolean {
  return member.status ? member.status === "active" : member.is_active;
}

/**
 * Resolve ownership sem fallback inseguro:
 * - profile/member id conhecido e ativo: individual;
 * - exatamente um membro ativo no plano: individual;
 * - qualquer ambiguidade em casal: needs_review.
 */
export function buildBlobOwnershipResolver(appData: AppData, members: PlanMemberRow[]) {
  const activeMembers = members.filter(isActiveMember);
  const primary = activeMembers.find((m) => m.is_primary) ?? null;
  const partner = activeMembers.find((m) => !m.is_primary) ?? null;

  return (profileId?: string): OwnershipResolution => {
    if (profileId) {
      const direct = activeMembers.find((m) => m.id === profileId);
      if (direct) return { memberId: direct.id, ownershipScope: "individual" };
      if (appData.primaryProfile?.id === profileId && primary) {
        return { memberId: primary.id, ownershipScope: "individual" };
      }
      if (appData.partner?.profile?.id === profileId && partner) {
        return { memberId: partner.id, ownershipScope: "individual" };
      }
    }

    if (activeMembers.length === 1) {
      return { memberId: activeMembers[0].id, ownershipScope: "individual" };
    }
    return { memberId: null, ownershipScope: "needs_review" };
  };
}

function ownershipFields(resolution: OwnershipResolution) {
  return {
    member_id: resolution.memberId,
    ownership_scope: resolution.ownershipScope,
  };
}

function incomeToRow(inc: Income, planId: string, resolution: OwnershipResolution) {
  const recurrenceToType: Record<Income["recurrence"], string> = {
    monthly: "salary", biweekly: "salary", weekly: "salary",
    yearly: "bonus", "one-time": "other",
  };
  return {
    plan_id: planId,
    ...ownershipFields(resolution),
    source: inc.label || "Renda",
    income_type: inc.type || recurrenceToType[inc.recurrence] || "salary",
    amount: inc.amount || 0,
    is_recurring: inc.recurrence !== "one-time",
    income_date: inc.startDate ? `${inc.startDate}${inc.startDate.length === 7 ? "-01" : ""}` : null,
    notes: inc.notes ?? null,
  };
}

function expenseToRow(exp: Expense, planId: string, resolution: OwnershipResolution) {
  return {
    plan_id: planId,
    ...ownershipFields(resolution),
    category: exp.category || "outros",
    subcategory: exp.subcategory || exp.name || null,
    amount: exp.amount || 0,
    is_essential: exp.priority === "essential",
    expense_type: exp.type || "fixed",
    is_recurring: exp.recurrence !== "one-time",
    expense_date: exp.dueDate ? `${exp.dueDate}${exp.dueDate.length === 7 ? "-01" : ""}` : null,
    month_key: exp.monthKey || null,
    notes: exp.notes ?? null,
  };
}

function debtToRow(debt: Debt, planId: string, resolution: OwnershipResolution) {
  const priorityToDb: Record<number, string> = { 1: "high", 2: "medium", 3: "low" };
  return {
    plan_id: planId,
    ...ownershipFields(resolution),
    debt_type: debt.type || "loan",
    institution: debt.creditor || debt.name || null,
    total_balance: debt.totalAmount || 0,
    monthly_payment: debt.monthlyPayment || 0,
    interest_rate: (debt.interestRate || 0) / 12,
    effective_cost: (debt.interestRate || 0) / 12,
    priority: priorityToDb[debt.payoffPriority ?? 2] ?? "medium",
    start_date: debt.startDate ? `${debt.startDate}${debt.startDate.length === 7 ? "-01" : ""}` : null,
    end_date: debt.endDate ? `${debt.endDate}${debt.endDate.length === 7 ? "-01" : ""}` : null,
    is_active: debt.active !== false,
  };
}

const BUCKET_TO_DB: Record<string, string> = {
  reserva: "reserve",
  "protecao-bancaria": "protection",
  "base-soberana": "sovereign",
  crescimento: "growth",
};

function assetToRow(inv: Investment, planId: string, resolution: OwnershipResolution) {
  const hasFgc = inv.securityLevel === "fgc";
  const hasSovereign = inv.securityLevel === "soberano";
  return {
    plan_id: planId,
    ...ownershipFields(resolution),
    asset_type: inv.type || "other",
    institution: inv.institution || null,
    conglomerate: inv.conglomerate || null,
    ticker_or_name: inv.name || null,
    invested_amount: inv.currentBalance || 0,
    current_amount: inv.currentBalance || 0,
    net_estimated: inv.currentBalance || 0,
    has_fgc: hasFgc,
    has_sovereign_guarantee: hasSovereign,
    bucket: inv.bucket ? (BUCKET_TO_DB[inv.bucket] ?? null) : null,
    is_active: inv.active !== false,
    reference_date: inv.startDate || null,
    maturity_date: inv.maturityDate || null,
  };
}

function countOwnership(rows: Array<{ ownership_scope: OwnershipScope }>) {
  return {
    individual: rows.filter((r) => r.ownership_scope === "individual").length,
    review: rows.filter((r) => r.ownership_scope === "needs_review").length,
  };
}

async function tableIsEmpty(table: "assets" | "income" | "expenses" | "debts", planId: string) {
  const { count } = await supabase.from(table).select("id", { count: "exact", head: true })
    .eq("plan_id", planId);
  return (count ?? 0) === 0;
}

export async function migrateBlobToTables(
  _userId: string,
  planId: string,
  appData: AppData,
  members: PlanMemberRow[],
): Promise<BlobMigrationSummary> {
  const summary: BlobMigrationSummary = {
    assets: 0,
    incomes: 0,
    expenses: 0,
    debts: 0,
    individualCreated: 0,
    needsReviewCreated: 0,
    ignored: 0,
    errors: [],
  };
  const resolveOwnership = buildBlobOwnershipResolver(appData, members);

  const migrateCategory = async (
    table: "assets" | "income" | "expenses" | "debts",
    label: string,
    rows: Array<Record<string, unknown> & { ownership_scope: OwnershipScope }>,
    countKey: "assets" | "incomes" | "expenses" | "debts",
  ) => {
    if (rows.length === 0) return;
    if (!(await tableIsEmpty(table, planId))) {
      summary.ignored += rows.length;
      return;
    }
    const { error, data } = await supabase.from(table).insert(rows as never).select("id");
    if (error) {
      logger.error(`blobMigration.${table}.insert`, { code: error.code });
      summary.errors.push(`${label}: ${toFriendlyError(error)}`);
      return;
    }
    const created = data?.length ?? 0;
    summary[countKey] = created;
    const ownership = countOwnership(rows.slice(0, created));
    summary.individualCreated += ownership.individual;
    summary.needsReviewCreated += ownership.review;
  };

  const assetRows = (appData.investments ?? []).map((inv) =>
    assetToRow(inv, planId, resolveOwnership(inv.profileId)),
  );
  await migrateCategory("assets", "Investimentos", assetRows, "assets");

  const incomeRows = (appData.incomes ?? []).map((inc) =>
    incomeToRow(inc, planId, resolveOwnership(inc.profileId)),
  );
  await migrateCategory("income", "Renda", incomeRows, "incomes");

  const expenseRows = (appData.expenses ?? []).map((exp) => {
    const explicitProfile = exp.responsibleProfileId;
    return expenseToRow(exp, planId, resolveOwnership(explicitProfile));
  });
  await migrateCategory("expenses", "Gastos", expenseRows, "expenses");

  const debtRows = (appData.debts ?? []).map((debt) =>
    debtToRow(debt, planId, resolveOwnership(debt.profileId)),
  );
  await migrateCategory("debts", "Dívidas", debtRows, "debts");

  return summary;
}
