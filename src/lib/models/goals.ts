/**
 * Objetivos e marcos.
 */

export type GoalStatus = "active" | "paused" | "completed" | "cancelled";

export interface Goal {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  deadline?: string;
  category:
    | "emergency"
    | "retirement"
    | "house"
    | "travel"
    | "education"
    | "freedom"
    | "family"
    | "other";
  status: GoalStatus;
  priority: number;
  profileId?: string; // null = shared goal
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  id: string;
  goalId?: string;
  label: string;
  value: number;
  reachedAt?: string;
  estimatedDate?: string;
}
