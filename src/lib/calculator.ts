import { PlanConfig, MonthRecord, MonthDeposit, MonthStatus, ProjectionRow, generateMonthKeys, getCurrentMonthKey, EMPTY_DEPOSIT, monthsBetween } from "./types";

function monthlyRate(annualRate: number): number {
  return Math.pow(1 + annualRate, 1 / 12) - 1;
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

  const totalPlannedSelic = config.contributors[0].plannedSelic + config.contributors[1].plannedSelic;
  const totalPlannedCDB = config.contributors[0].plannedCDB + config.contributors[1].plannedCDB;

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
      depositSelic = record.deposits[0].actualSelic + record.deposits[1].actualSelic;
      depositCDB = record.deposits[0].actualCDB + record.deposits[1].actualCDB;
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

export function calculateStreak(
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): number {
  const currentKey = getCurrentMonthKey();
  const allKeys = generateMonthKeys(startDate, config.years * 12);
  const pastKeys = allKeys.filter((k) => k <= currentKey);

  let streak = 0;
  for (let i = pastKeys.length - 1; i >= 0; i--) {
    if (isMonthComplete(config, monthRecords, pastKeys[i])) {
      streak++;
    } else {
      break;
    }
  }
  return streak;
}

export function calculateCompletionRate(
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): number {
  const currentKey = getCurrentMonthKey();
  const allKeys = generateMonthKeys(startDate, config.years * 12);
  const pastKeys = allKeys.filter((k) => k <= currentKey).slice(-12);

  if (pastKeys.length === 0) return 0;
  const completed = pastKeys.filter((k) => isMonthComplete(config, monthRecords, k)).length;
  return completed / pastKeys.length;
}

export function isMonthComplete(
  config: PlanConfig,
  monthRecords: MonthRecord[],
  monthKey: string
): boolean {
  const record = monthRecords.find((r) => r.monthKey === monthKey);
  if (!record) return false;
  if (record.completed) return true;

  return config.contributors.every((c, i) => {
    const d = record.deposits[i] || EMPTY_DEPOSIT;
    const selicOk = c.plannedSelic <= 0 || d.actualSelic >= c.plannedSelic;
    const cdbOk = c.plannedCDB <= 0 || d.actualCDB >= c.plannedCDB;
    return selicOk && cdbOk;
  });
}

export function getMonthStatus(
  config: PlanConfig,
  monthRecords: MonthRecord[],
  monthKey: string
): MonthStatus {
  const record = monthRecords.find((r) => r.monthKey === monthKey);
  if (!record) return "pending";
  if (record.completed) return "completed";

  const hasAnyDeposit = record.deposits.some(
    (d) => d.actualSelic > 0 || d.actualCDB > 0
  );

  const allComplete = config.contributors.every((c, i) => {
    const d = record.deposits[i] || EMPTY_DEPOSIT;
    const selicOk = c.plannedSelic <= 0 || d.actualSelic >= c.plannedSelic;
    const cdbOk = c.plannedCDB <= 0 || d.actualCDB >= c.plannedCDB;
    return selicOk && cdbOk;
  });

  if (allComplete) return "completed";
  if (hasAnyDeposit) return "partial";
  return "pending";
}

export function calculateYearCompletion(
  config: PlanConfig,
  monthRecords: MonthRecord[],
  year: string
): number {
  const currentMonth = getCurrentMonthKey();
  const yearMonths: string[] = [];
  for (let m = 1; m <= 12; m++) {
    const key = `${year}-${String(m).padStart(2, "0")}`;
    if (key <= currentMonth) yearMonths.push(key);
  }
  if (yearMonths.length === 0) return 0;
  const completed = yearMonths.filter((k) => isMonthComplete(config, monthRecords, k)).length;
  return completed / yearMonths.length;
}

export function getReachedMilestones(projection: ProjectionRow[], milestones: number[]): number[] {
  if (projection.length === 0) return [];
  const maxBalance = Math.max(...projection.map((r) => r.totalBalance));
  return milestones.filter((m) => maxBalance >= m);
}

// ===== V5: Delay Impact Engine =====

export function calculateMonthsToTarget(
  config: PlanConfig,
  mode: "planned" | "actual",
  monthRecords: MonthRecord[],
  startDate: string
): number | null {
  const projection = generateProjection(config, mode, monthRecords, startDate);
  const idx = projection.findIndex((r) => r.totalBalance >= config.targetAmount);
  return idx >= 0 ? idx + 1 : null;
}

export function calculateDelayMonths(
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): number {
  const planned = calculateMonthsToTarget(config, "planned", monthRecords, startDate);
  const actual = calculateMonthsToTarget(config, "actual", monthRecords, startDate);
  if (!planned || !actual) return 0;
  return Math.max(0, actual - planned);
}

export function calculateSkipMonthCost(config: PlanConfig): number {
  // Cost of skipping one month = that deposit + all compound interest it would have generated
  const totalMonthly = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const avgRate = monthlyRate(config.selicRate);
  // Future value of one month's deposit over remaining years
  const remainingMonths = config.years * 12;
  return totalMonthly * Math.pow(1 + avgRate, remainingMonths) - totalMonthly;
}

export function getMissedMonths(
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): number {
  const currentKey = getCurrentMonthKey();
  const allKeys = generateMonthKeys(startDate, config.years * 12);
  const pastKeys = allKeys.filter((k) => k < currentKey);
  return pastKeys.filter((k) => !isMonthComplete(config, monthRecords, k)).length;
}

// ===== V5: Contribution Split =====

export function getContributionTotals(
  config: PlanConfig,
  monthRecords: MonthRecord[]
): { name: string; total: number; percentage: number }[] {
  const totals = config.contributors.map((c, i) => {
    const total = monthRecords.reduce((sum, r) => {
      const d = r.deposits[i] || EMPTY_DEPOSIT;
      return sum + d.actualSelic + d.actualCDB;
    }, 0);
    return { name: c.name, total };
  });

  const grandTotal = totals.reduce((s, t) => s + t.total, 0);
  return totals.map((t) => ({
    ...t,
    percentage: grandTotal > 0 ? t.total / grandTotal : 0,
  }));
}

// ===== V5: Current month helpers =====

export function getCurrentMonthDeposited(
  config: PlanConfig,
  monthRecords: MonthRecord[]
): { total: number; planned: number; remaining: number; progress: number; perPerson: { name: string; deposited: number; planned: number; pct: number }[] } {
  const currentKey = getCurrentMonthKey();
  const record = monthRecords.find((r) => r.monthKey === currentKey);

  const planned = config.contributors.reduce((s, c) => s + c.plannedSelic + c.plannedCDB, 0);
  const perPerson = config.contributors.map((c, i) => {
    const d = record?.deposits[i] || EMPTY_DEPOSIT;
    const deposited = d.actualSelic + d.actualCDB;
    const personPlanned = c.plannedSelic + c.plannedCDB;
    return {
      name: c.name,
      deposited,
      planned: personPlanned,
      pct: personPlanned > 0 ? Math.min(1, deposited / personPlanned) : deposited > 0 ? 1 : 0,
    };
  });

  const total = perPerson.reduce((s, p) => s + p.deposited, 0);
  return {
    total,
    planned,
    remaining: Math.max(0, planned - total),
    progress: planned > 0 ? Math.min(1, total / planned) : 0,
    perPerson,
  };
}

// ===== V5: Age Timeline =====

export function getAgeTimeline(
  config: PlanConfig,
  monthRecords: MonthRecord[],
  startDate: string
): { age: number; name: string; balance: number; year: number }[] {
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
        results.push({
          age: targetAge,
          name: c.name,
          balance: projection[monthIdx].totalBalance,
          year: startYear + yearsUntil,
        });
      }
    });
  });

  return results.sort((a, b) => a.age - b.age || a.name.localeCompare(b.name));
}
