export interface Contributor {
  name: string;
  plannedSelic: number;
  plannedCDB: number;
}

export interface PlanConfig {
  initialAmount: number;
  targetAmount: number;
  years: number;
  selicRate: number; // annual decimal, e.g. 0.1315
  cdbRate: number; // fraction of CDI, e.g. 1.0 = 100%
  contributors: [Contributor, Contributor];
}

export interface MonthDeposit {
  actualSelic: number;
  actualCDB: number;
}

export interface MonthRecord {
  monthKey: string; // "2025-03"
  deposits: [MonthDeposit, MonthDeposit];
  notes: string;
}

export interface ProjectionRow {
  monthIndex: number;
  date: string;
  selicBalance: number;
  cdbBalance: number;
  totalBalance: number;
  totalDeposited: number;
  totalInterest: number;
  depositThisMonth: number;
}

export interface PlanData {
  config: PlanConfig;
  monthRecords: MonthRecord[];
  wizardComplete: boolean;
  startDate: string; // "2025-03"
}

export const MILESTONES = [50_000, 100_000, 250_000, 500_000, 1_000_000];

export const DEFAULT_CONFIG: PlanConfig = {
  initialAmount: 9_000,
  targetAmount: 1_000_000,
  years: 20,
  selicRate: 0.1315,
  cdbRate: 1.0,
  contributors: [
    { name: "Jonathan", plannedSelic: 1_000, plannedCDB: 500 },
    { name: "Isabella", plannedSelic: 0, plannedCDB: 0 },
  ],
};

export const EMPTY_DEPOSIT: MonthDeposit = { actualSelic: 0, actualCDB: 0 };

export function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatPercent(value: number): string {
  return (value * 100).toFixed(2) + "%";
}

export function monthKeyToLabel(key: string): string {
  const [y, m] = key.split("-");
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  return `${months[parseInt(m) - 1]}/${y}`;
}

export function generateMonthKeys(startDate: string, count: number): string[] {
  const [sy, sm] = startDate.split("-").map(Number);
  const keys: string[] = [];
  for (let i = 0; i < count; i++) {
    const m = ((sm - 1 + i) % 12) + 1;
    const y = sy + Math.floor((sm - 1 + i) / 12);
    keys.push(`${y}-${String(m).padStart(2, "0")}`);
  }
  return keys;
}

export function getCurrentMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
