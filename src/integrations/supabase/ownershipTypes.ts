import type { Database } from "./types";
import type { OwnershipScope } from "@/lib/models/ownership";

type Tables = Database["public"]["Tables"];

export interface FinancialOwnershipFields {
  member_id: string | null;
  ownership_scope: OwnershipScope;
}

type RowWithOwnership<T extends { member_id: unknown }> =
  Omit<T, "member_id"> & FinancialOwnershipFields;

type InsertWithOwnership<T extends { member_id?: unknown; user_id: unknown }> =
  Omit<T, "member_id" | "user_id"> & FinancialOwnershipFields & {
    /** Derivado pelo trigger server-side a partir de plan_id. */
    user_id?: never;
  };

type UpdateWithOwnership<T extends { member_id?: unknown; user_id?: unknown }> =
  Omit<T, "member_id" | "user_id"> & {
    member_id?: string | null;
    ownership_scope?: OwnershipScope;
    /** Nunca confiado quando enviado pelo cliente. */
    user_id?: never;
  };

export type AssetDatabaseRow = RowWithOwnership<Tables["assets"]["Row"]>;
export type AssetDatabaseInsert = InsertWithOwnership<Tables["assets"]["Insert"]>;
export type AssetDatabaseUpdate = UpdateWithOwnership<Tables["assets"]["Update"]>;

export type IncomeDatabaseRow = RowWithOwnership<Tables["income"]["Row"]>;
export type IncomeDatabaseInsert = InsertWithOwnership<Tables["income"]["Insert"]>;
export type IncomeDatabaseUpdate = UpdateWithOwnership<Tables["income"]["Update"]>;

export type ExpenseDatabaseRow = RowWithOwnership<Tables["expenses"]["Row"]>;
export type ExpenseDatabaseInsert = InsertWithOwnership<Tables["expenses"]["Insert"]>;
export type ExpenseDatabaseUpdate = UpdateWithOwnership<Tables["expenses"]["Update"]>;

export type DebtDatabaseRow = RowWithOwnership<Tables["debts"]["Row"]>;
export type DebtDatabaseInsert = InsertWithOwnership<Tables["debts"]["Insert"]>;
export type DebtDatabaseUpdate = UpdateWithOwnership<Tables["debts"]["Update"]>;
