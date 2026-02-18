import { PlanConfig, MonthRecord, MonthDeposit, MonthStatus, ProjectionRow, generateMonthKeys, EMPTY_DEPOSIT } from "./types";

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

  // Initial split: half in each (or all selic if no CDB planned)
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

    // Apply interest then deposit
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
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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
  const now = new Date();
  const currentKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

  // Check if any actual deposit > 0
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
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
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
