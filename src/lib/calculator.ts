import { PlanConfig, MonthRecord, MonthDeposit, MonthStatus, ProjectionRow, generateMonthKeys, getCurrentMonthKey, EMPTY_DEPOSIT, FinancialProfile, formatBRLCompact } from "./types";

function monthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
}

function getDeposit(record: MonthRecord | undefined, idx: number): MonthDeposit {
  return record?.deposits[idx] || EMPTY_DEPOSIT;
}

export function generateProjection(
  config: PlanConfig,
  mode: "planned" | "actual",
  monthRecords: MonthRecord[],
  startDate: string
): ProjectionRow[] {
  const totalMonths = config.years * 12;
  const monthKeys = generateMonthKeys(startDate, totalMonths);
  const mSelic = monthlyRate(config.selicRate);
  const mCDB = monthlyRate(config.selicRate * config.cdbRate);

  const totalPlannedSelic = config.contributors.reduce((s, c) => s + c.plannedSelic, 0);
  const totalPlannedCDB = config.contributors.reduce((s, c) => s + c.plannedCDB, 0);

  const initialSelic = totalPlannedCDB > 0 ? config.initialAmount / 2 : config.initialAmount;
  const initialCDB = totalPlannedCDB > 0 ? config.initialAmount / 2 : 0;

  let selicBal = initialSelic;
  let cdbBal = initialCDB;
  let totalDeposited = config.initialAmount;
  const rows: ProjectionRow[] = [];

  for (let i = 0; i < totalMonths; i++) {
    const key = monthKeys[i];
    const record = monthRecords.find((r) => r.monthKey === key);

    let depositSelic: number;
    let depositCDB: number;

    if (mode === "actual" && record) {
      depositSelic = record.deposits.reduce((s, d) => s + (d.actualSelic || 0), 0);
      depositCDB = record.deposits.reduce((s, d) => s + (d.actualCDB || 0), 0);
    } else {
      depositSelic = totalPlannedSelic;
      depositCDB = totalPlannedCDB;
    }

    selicBal = selicBal * (1 + mSelic) + depositSelic;
    cdbBal = cdbBal * (1 + mCDB) + depositCDB;
    totalDeposited += depositSelic + depositCDB;

    const totalBalance = selicBal + cdbBal;
    rows.push({
      monthIndex: i + 1,
      date: key,
      selicBalance: selicBal,
      cdbBalance: cdbBal,
      totalBalance,
      totalDeposited,
      totalInterest: totalBalance - totalDeposited,
      depositThisMonth: depositSelic + depositCDB,
    });
  }

  return rows;
}

export function calculateStreak(config: PlanConfig, monthRecords: MonthRecord[], startDate: string): number {
  const currentKey = getCurrentMonthKey();
  const allKeys = generateMonthKeys(startDate, config.years * 12);
  const pastKeys = allKeys.filter((k) => k <= currentKey);
  let streak = 0;
  for (let i = pastKeys.length - 1; i >= 0; i--) {
    if (isMonthComplete(config, monthRecords, pastKeys[i])) streak++;
    else break;
  }
  return streak;
}

export function calculateCompletionRate(config: PlanConfig, monthRecords: MonthRecord[], startDate: string): number {
  const currentKey = getCurrentMonthKey();
  const allKeys = generateMonthKeys(startDate, config.years * 12);
  const pastKeys = allKeys.filter((k) => k <= currentKey).slice(-12);
  if (pastKeys.length === 0) return 0;
  return pastKeys.filter((k) => isMonthComplete(config, monthRecords, k)).length / pastKeys.length;
}

export function isMonthComplete(config: PlanConfig, monthRecords: MonthRecord[], monthKey: string): boolean {
  const record = monthRecords.find((r) => r.monthKey === monthKey);
  if (!record) return false;
  if (record.completed) return true;
  return config.contributors.every((c, i) => {
    const d = getDeposit(record, i);
    return (c.plannedSelic <= 0 || d.actualSelic >= c.plannedSelic) && (c.plannedCDB <= 0 || d.actualCDB >= c.plannedCDB);
  });
}

export function getMonthStatus(config: PlanConfig, monthRecords: MonthRecord[], monthKey: string): MonthStatus {
  const record = monthRecords.find((r) => r.monthKey === monthKey);
  if (!record) return "pending";
  if (record.completed) return "completed";
  const hasAny = record.deposits.some((d) => d.actualSelic > 0 || d.actualCDB > 0);
  const allComplete = config.contributors.every((c, i) => {
    const d = getDeposit(record, i);
    return (c.plannedSelic <= 0 || d.actualSelic >= c.plannedSelic) && (c.plannedCDB <= 0 || d.actualCDB >= c.plannedCDB);
  });
  if (allComplete) return "completed";
  if (hasAny) return "partial";
  return "pending";
}

export function calculateYearCompletion(config: PlanConfig, monthRecords: MonthRecord[], year: string): number {
  const currentMonth = getCurrentMonthKey();
  const yearMonths: string[] = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    if (key <= currentMonth) yearMonths.push(key);
  }
  if (yearMonths.length === 0) return 0;
  return yearMonths.filter((k) => isMonthComplete(config, monthRecords, k)).length / yearMonths.length;
}

export function getReachedMilestones(projection: ProjectionRow[], milestones: number[]): number[] {
  if (projection.length === 0) return [];
  const maxBalance = Math.max(...projection.map((r) => r.totalBalance));
  return milestones.filter((m) => maxBalance >= m);
}

export function calculateMonthsToTarget(config: PlanConfig, mode: "planned" | "actual", monthRecords: MonthRecord[], startDate: string): number | null {
  const projection = generateProjection(config, mode, monthRecords, startDate);
  const idx = projection.findIndex((r) => r.totalBalance >= config.targetAmount);
  return idx >= 0 ? idx + 1 : null;
}

export function calculateDelayMonths(config: PlanConfig, monthRecords: MonthRecord[], startDate: string): number {
  const planned = calculateMonthsToTarget(config, "planned", monthRecords, startDate);
  const actual = calculateMonthsToTarget(config, "actual", monthRecords, startDate);
  if (!planned || !actual) return 0;
  return Math.max(0, actual - planned);
}

export function calculateSkipMonthCost(config: PlanConfig): number {
  const totalMonthly = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const avgRate = monthlyRate(config.selicRate);
  const remainingMonths = config.years * 12;
  return totalMonthly * Math.pow(1 + avgRate, remainingMonths) - totalMonthly;
}

export function getMissedMonths(config: PlanConfig, monthRecords: MonthRecord[], startDate: string): number {
  const currentKey = getCurrentMonthKey();
  const allKeys = generateMonthKeys(startDate, config.years * 12);
  const pastKeys = allKeys.filter((k) => k < currentKey);
  return pastKeys.filter((k) => !isMonthComplete(config, monthRecords, k)).length;
}

export function getContributionTotals(config: PlanConfig, monthRecords: MonthRecord[]): { name: string; total: number; percentage: number }[] {
  const totals = config.contributors.map((c, i) => {
    const total = monthRecords.reduce((sum, r) => {
      const d = getDeposit(r, i);
      return sum + d.actualSelic + d.actualCDB;
    }, 0);
    return { name: c.name, total };
  });
  const grandTotal = totals.reduce((s, t) => s + t.total, 0);
  return totals.map((t) => ({ ...t, percentage: grandTotal > 0 ? t.total / grandTotal : 0 }));
}

export function getCurrentMonthDeposited(config: PlanConfig, monthRecords: MonthRecord[]) {
  const currentKey = getCurrentMonthKey();
  const record = monthRecords.find((r) => r.monthKey === currentKey);
  const planned = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const perPerson = config.contributors.map((c, i) => {
    const d = getDeposit(record, i);
    const deposited = d.actualSelic + d.actualCDB;
    const personPlanned = c.plannedSelic + c.plannedCDB;
    return {
      name: c.name, deposited, planned: personPlanned,
      pct: personPlanned > 0 ? Math.min(1, deposited / personPlanned) : deposited > 0 ? 1 : 0,
    };
  });
  const total = perPerson.reduce((s, p) => s + p.deposited, 0);
  return { total, planned, remaining: Math.max(0, planned - total), progress: planned > 0 ? Math.min(1, total / planned) : 0, perPerson };
}

export function getAgeTimeline(config: PlanConfig, monthRecords: MonthRecord[], startDate: string) {
  const projection = generateProjection(config, "planned", monthRecords, startDate);
  const startYear = parseInt(startDate.split("-")[0]);
  const milestoneAges = [30, 35, 40, 45, 50, 55, 60];
  const results: { age: number; name: string; balance: number; year: number }[] = [];
  config.contributors.forEach((c) => {
    if (!c.age) return;
    milestoneAges.forEach((targetAge) => {
      const yearsUntil = targetAge - c.age!;
      if (yearsUntil <= 0 || yearsUntil > config.years) return;
      const monthIdx = yearsUntil * 12 - 1;
      if (monthIdx < projection.length) {
        results.push({ age: targetAge, name: c.name, balance: projection[monthIdx].totalBalance, year: startYear + yearsUntil });
      }
    });
  });
  return results.sort((a, b) => a.age - b.age || a.name.localeCompare(b.name));
}

// ===== V6: Scenario Simulator =====

export interface ScenarioResult {
  label: string;
  monthsToTarget: number | null;
  finalWealth: number;
  difference: number;
}

export function simulateScenario(
  config: PlanConfig, monthRecords: MonthRecord[], startDate: string,
  modifier: "pause6" | "pause12" | "increase10" | "decrease20"
): ScenarioResult {
  const labels: Record<string, string> = {
    pause6: "Pausar 6 meses", pause12: "Pausar 1 ano",
    increase10: "Aumentar +10%", decrease20: "Reduzir −20%",
  };

  let modContributors = config.contributors;
  if (modifier === "increase10" || modifier === "decrease20") {
    const factor = modifier === "increase10" ? 1.1 : 0.8;
    modContributors = config.contributors.map((c) => ({
      ...c, plannedSelic: Math.round(c.plannedSelic * factor), plannedCDB: Math.round(c.plannedCDB * factor),
    }));
  }

  let pauseMonths = modifier === "pause6" ? 6 : modifier === "pause12" ? 12 : 0;

  const totalMonths = config.years * 12;
  const monthKeys = generateMonthKeys(startDate, totalMonths);
  const currentKey = getCurrentMonthKey();
  const mSelic = monthlyRate(config.selicRate);
  const mCDB = monthlyRate(config.selicRate * config.cdbRate);

  const totalPlannedSelic = modContributors.reduce((s, c) => s + c.plannedSelic, 0);
  const totalPlannedCDB = modContributors.reduce((s, c) => s + c.plannedCDB, 0);
  const initialSelic = totalPlannedCDB > 0 ? config.initialAmount / 2 : config.initialAmount;
  const initialCDB = totalPlannedCDB > 0 ? config.initialAmount / 2 : 0;

  let selicBal = initialSelic, cdbBal = initialCDB, pauseCounter = 0;
  let targetMonth: number | null = null;

  for (let i = 0; i < totalMonths; i++) {
    const key = monthKeys[i];
    const record = monthRecords.find((r) => r.monthKey === key);
    let dS: number, dC: number;

    if (record) {
      dS = record.deposits.reduce((s, d) => s + (d.actualSelic || 0), 0);
      dC = record.deposits.reduce((s, d) => s + (d.actualCDB || 0), 0);
    } else if (pauseMonths > 0 && key > currentKey && pauseCounter < pauseMonths) {
      dS = 0; dC = 0; pauseCounter++;
    } else {
      dS = totalPlannedSelic; dC = totalPlannedCDB;
    }

    selicBal = selicBal * (1 + mSelic) + dS;
    cdbBal = cdbBal * (1 + mCDB) + dC;
    if (targetMonth === null && selicBal + cdbBal >= config.targetAmount) targetMonth = i + 1;
  }

  const finalWealth = selicBal + cdbBal;
  const baseProjection = generateProjection(config, "planned", monthRecords, startDate);
  const baseFinal = baseProjection[baseProjection.length - 1]?.totalBalance || 0;

  return { label: labels[modifier], monthsToTarget: targetMonth, finalWealth, difference: finalWealth - baseFinal };
}

// ===== V6: Financial Profile Helpers =====

export function getEmergencyFundGoal(profile: FinancialProfile): number {
  return (profile.monthlyExpenses || 0) * 6;
}

export function getEmergencyFundStatus(profile: FinancialProfile): "below" | "in-progress" | "completed" {
  const goal = getEmergencyFundGoal(profile);
  if (goal <= 0) return "completed";
  const current = profile.emergencyFund || 0;
  if (current >= goal) return "completed";
  if (current > 0) return "in-progress";
  return "below";
}

export function getSavingsRate(profile: FinancialProfile, config: PlanConfig): number {
  const totalIncome = (profile.incomePrimary || 0) + (profile.incomePartner || 0);
  if (totalIncome <= 0) return 0;
  const totalInvestment = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  return totalInvestment / totalIncome;
}

export function getFinancialSafetyMonths(profile: FinancialProfile): number {
  if (!profile.monthlyExpenses || profile.monthlyExpenses <= 0) return 0;
  return (profile.emergencyFund || 0) / profile.monthlyExpenses;
}

// ===== V6: Achievement Timeline =====

export function getAchievementTimeline(
  config: PlanConfig, monthRecords: MonthRecord[], startDate: string, milestones: number[]
): { label: string; value: number; monthIndex: number; date: string; reached: boolean }[] {
  const planned = generateProjection(config, "planned", monthRecords, startDate);
  const actual = generateProjection(config, "actual", monthRecords, startDate);
  const achievements: { label: string; value: number; monthIndex: number; date: string; reached: boolean }[] = [];

  achievements.push({ label: "Primeiro investimento", value: config.initialAmount, monthIndex: 0, date: startDate, reached: monthRecords.length > 0 });

  for (const m of milestones) {
    const plannedIdx = planned.findIndex((r) => r.totalBalance >= m);
    const actualIdx = actual.findIndex((r) => r.totalBalance >= m);
    const reached = actualIdx >= 0;
    const idx = reached ? actualIdx : plannedIdx;
    if (idx >= 0) {
      achievements.push({
        label: m >= 1_000_000 ? `R$ ${(m / 1_000_000).toFixed(0)}M` : `R$ ${(m / 1_000).toFixed(0)}k`,
        value: m, monthIndex: idx + 1, date: planned[idx]?.date || startDate, reached,
      });
    }
  }
  return achievements;
}

// ===== V6: Monthly Insights =====

export function getMonthlyInsights(config: PlanConfig, monthRecords: MonthRecord[], startDate: string, profile?: FinancialProfile): string[] {
  const insights: string[] = [];
  const currentKey = getCurrentMonthKey();
  const record = monthRecords.find((r) => r.monthKey === currentKey);
  const isCouple = config.contributors.length > 1;
  const subject = isCouple ? "Vocês" : "Você";

  if (profile) {
    const totalIncome = (profile.incomePrimary || 0) + (profile.incomePartner || 0);
    if (totalIncome > 0 && record) {
      const deposited = record.deposits.reduce((s, d) => s + d.actualSelic + d.actualCDB, 0);
      insights.push(`${subject} investiram ${((deposited / totalIncome) * 100).toFixed(0)}% da renda este mês`);
    }
    const safety = getFinancialSafetyMonths(profile);
    if (safety > 0) insights.push(`${subject} ${isCouple ? "têm" : "tem"} ${safety.toFixed(1)} meses de segurança financeira`);
  }

  const streak = calculateStreak(config, monthRecords, startDate);
  if (streak > 0) insights.push(`${subject} ${isCouple ? "estão" : "está"} com ${streak} ${streak === 1 ? "mês consecutivo" : "meses consecutivos"} ✅`);

  const missed = getMissedMonths(config, monthRecords, startDate);
  if (missed > 0) insights.push(`${missed} ${missed === 1 ? "mês pendente" : "meses pendentes"} — hora de regularizar! ⚡`);

  return insights;
}

// ===== V6: WhatsApp Summary =====

export function generateWhatsAppSummary(config: PlanConfig, monthRecords: MonthRecord[], startDate: string, profile?: FinancialProfile): string {
  const currentKey = getCurrentMonthKey();
  const streak = calculateStreak(config, monthRecords, startDate);
  const record = monthRecords.find((r) => r.monthKey === currentKey);
  const totalMonthly = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const deposited = record ? record.deposits.reduce((s, d) => s + d.actualSelic + d.actualCDB, 0) : 0;

  return [
    "📊 *Plano do Milhão — Resumo*", "",
    `🎯 Meta: R$ ${(config.targetAmount / 1000).toFixed(0)}k em ${config.years} anos`,
    `💰 Aporte mensal: R$ ${totalMonthly.toLocaleString("pt-BR")}`,
    `📅 Mês atual: ${deposited > 0 ? `R$ ${deposited.toLocaleString("pt-BR")} depositado` : "Pendente"}`,
    `🔥 Sequência: ${streak} ${streak === 1 ? "mês" : "meses"}`, "",
    "_Gerado pelo Plano do Milhão V6_",
  ].join("\n");
}
