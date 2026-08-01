/**
 * Dívidas e parcelamentos.
 */
import type { OwnershipScope } from "./ownership";

export type DebtType = "credit-card" | "loan" | "financing" | "informal" | "recurring-bill" | "installment";
export type DebtRisk = "low" | "medium" | "high" | "toxic";

export interface Debt {
  id: string;
  name: string;
  type: DebtType;
  totalAmount: number;
  currentInstallment: number;
  totalInstallments: number;
  monthlyPayment: number;
  interestRate: number; // annual
  dueDay: number;
  creditor?: string;
  risk: DebtRisk;
  payoffPriority: number; // 1 = highest
  notes?: string;
  startDate: string;
  endDate?: string;
  active: boolean;
  profileId?: string;
  ownershipScope?: OwnershipScope;
  createdAt: string;
  updatedAt: string;
}

export interface Installment {
  id: string;
  debtId: string;
  monthKey: string;
  amount: number;
  paid: boolean;
  paidDate?: string;
  installmentNumber: number;
}
