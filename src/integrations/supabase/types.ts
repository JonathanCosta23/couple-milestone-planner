export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      assets: {
        Row: {
          asset_subtype: string | null
          asset_type: string
          bucket: string | null
          conglomerate: string | null
          created_at: string
          current_amount: number
          has_fgc: boolean
          has_sovereign_guarantee: boolean
          id: string
          institution: string | null
          invested_amount: number
          is_active: boolean
          liquidity_type: string | null
          mark_to_market: boolean
          maturity_date: string | null
          member_id: string | null
          net_estimated: number
          plan_id: string
          reference_date: string | null
          ticker_or_name: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          asset_subtype?: string | null
          asset_type: string
          bucket?: string | null
          conglomerate?: string | null
          created_at?: string
          current_amount?: number
          has_fgc?: boolean
          has_sovereign_guarantee?: boolean
          id?: string
          institution?: string | null
          invested_amount?: number
          is_active?: boolean
          liquidity_type?: string | null
          mark_to_market?: boolean
          maturity_date?: string | null
          member_id?: string | null
          net_estimated?: number
          plan_id: string
          reference_date?: string | null
          ticker_or_name?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          asset_subtype?: string | null
          asset_type?: string
          bucket?: string | null
          conglomerate?: string | null
          created_at?: string
          current_amount?: number
          has_fgc?: boolean
          has_sovereign_guarantee?: boolean
          id?: string
          institution?: string | null
          invested_amount?: number
          is_active?: boolean
          liquidity_type?: string | null
          mark_to_market?: boolean
          maturity_date?: string | null
          member_id?: string | null
          net_estimated?: number
          plan_id?: string
          reference_date?: string | null
          ticker_or_name?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assets_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assets_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      debts: {
        Row: {
          created_at: string
          debt_type: string
          effective_cost: number
          end_date: string | null
          id: string
          institution: string | null
          interest_rate: number
          is_active: boolean
          member_id: string | null
          monthly_payment: number
          plan_id: string
          priority: string | null
          start_date: string | null
          total_balance: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          debt_type: string
          effective_cost?: number
          end_date?: string | null
          id?: string
          institution?: string | null
          interest_rate?: number
          is_active?: boolean
          member_id?: string | null
          monthly_payment?: number
          plan_id: string
          priority?: string | null
          start_date?: string | null
          total_balance?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          debt_type?: string
          effective_cost?: number
          end_date?: string | null
          id?: string
          institution?: string | null
          interest_rate?: number
          is_active?: boolean
          member_id?: string | null
          monthly_payment?: number
          plan_id?: string
          priority?: string | null
          start_date?: string | null
          total_balance?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "debts_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debts_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      education_progress: {
        Row: {
          completed_at: string | null
          context_trigger: string | null
          created_at: string
          id: string
          lesson_id: string
          opened_at: string | null
          status: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          context_trigger?: string | null
          created_at?: string
          id?: string
          lesson_id: string
          opened_at?: string | null
          status?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          context_trigger?: string | null
          created_at?: string
          id?: string
          lesson_id?: string
          opened_at?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      expenses: {
        Row: {
          amount: number
          category: string
          created_at: string
          expense_date: string | null
          expense_type: string
          id: string
          is_essential: boolean
          is_recurring: boolean
          member_id: string | null
          month_key: string | null
          notes: string | null
          plan_id: string
          subcategory: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          category: string
          created_at?: string
          expense_date?: string | null
          expense_type?: string
          id?: string
          is_essential?: boolean
          is_recurring?: boolean
          member_id?: string | null
          month_key?: string | null
          notes?: string | null
          plan_id: string
          subcategory?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          category?: string
          created_at?: string
          expense_date?: string | null
          expense_type?: string
          id?: string
          is_essential?: boolean
          is_recurring?: boolean
          member_id?: string | null
          month_key?: string | null
          notes?: string | null
          plan_id?: string
          subcategory?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "expenses_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "expenses_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      income: {
        Row: {
          amount: number
          created_at: string
          id: string
          income_date: string | null
          income_type: string
          is_recurring: boolean
          member_id: string | null
          month_key: string | null
          notes: string | null
          plan_id: string
          source: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          id?: string
          income_date?: string | null
          income_type?: string
          is_recurring?: boolean
          member_id?: string | null
          month_key?: string | null
          notes?: string | null
          plan_id: string
          source: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          income_date?: string | null
          income_type?: string
          is_recurring?: boolean
          member_id?: string | null
          month_key?: string | null
          notes?: string | null
          plan_id?: string
          source?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "income_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "income_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      insights_log: {
        Row: {
          cause: string | null
          created_at: string
          id: string
          insight_type: string
          is_read: boolean
          message: string
          plan_id: string
          recommended_action: string | null
          severity: string
          title: string
          user_id: string
        }
        Insert: {
          cause?: string | null
          created_at?: string
          id?: string
          insight_type: string
          is_read?: boolean
          message: string
          plan_id: string
          recommended_action?: string | null
          severity?: string
          title: string
          user_id: string
        }
        Update: {
          cause?: string | null
          created_at?: string
          id?: string
          insight_type?: string
          is_read?: boolean
          message?: string
          plan_id?: string
          recommended_action?: string | null
          severity?: string
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "insights_log_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      members: {
        Row: {
          actual_cdb: number
          actual_selic: number
          created_at: string
          current_reserve: number
          id: string
          individual_goal: string | null
          is_active: boolean
          monthly_expenses: number
          monthly_income: number
          name: string
          plan_id: string
          planned_cdb: number
          planned_selic: number
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_cdb?: number
          actual_selic?: number
          created_at?: string
          current_reserve?: number
          id?: string
          individual_goal?: string | null
          is_active?: boolean
          monthly_expenses?: number
          monthly_income?: number
          name?: string
          plan_id: string
          planned_cdb?: number
          planned_selic?: number
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_cdb?: number
          actual_selic?: number
          created_at?: string
          current_reserve?: number
          id?: string
          individual_goal?: string | null
          is_active?: boolean
          monthly_expenses?: number
          monthly_income?: number
          name?: string
          plan_id?: string
          planned_cdb?: number
          planned_selic?: number
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "members_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          created_at: string
          id: string
          milestone_type: string
          origin: string
          plan_id: string
          status: string
          triggered_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          milestone_type?: string
          origin?: string
          plan_id: string
          status?: string
          triggered_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          milestone_type?: string
          origin?: string
          plan_id?: string
          status?: string
          triggered_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "milestones_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      monthly_tracking: {
        Row: {
          actual_total: number
          created_at: string
          id: string
          is_current: boolean
          month: number
          month_key: string
          notes: string | null
          plan_id: string
          planned_total: number
          shortfall: number
          status: string
          updated_at: string
          user_id: string
          year: number
        }
        Insert: {
          actual_total?: number
          created_at?: string
          id?: string
          is_current?: boolean
          month: number
          month_key: string
          notes?: string | null
          plan_id: string
          planned_total?: number
          shortfall?: number
          status?: string
          updated_at?: string
          user_id: string
          year: number
        }
        Update: {
          actual_total?: number
          created_at?: string
          id?: string
          is_current?: boolean
          month?: number
          month_key?: string
          notes?: string | null
          plan_id?: string
          planned_total?: number
          shortfall?: number
          status?: string
          updated_at?: string
          user_id?: string
          year?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_tracking_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          assumption_cdb_pct: number
          assumption_inflation: number
          assumption_iof: number
          assumption_ir: number
          assumption_selic: number
          created_at: string
          engine_version: string
          goal_amount: number
          goal_months: number
          goal_purpose: string | null
          goal_purpose_custom: string | null
          goal_years: number
          id: string
          initial_amount: number
          mode: string
          monthly_contribution: number
          onboarding_complete: boolean
          start_date: string
          status: string
          updated_at: string
          user_id: string
          wizard_complete: boolean
        }
        Insert: {
          assumption_cdb_pct?: number
          assumption_inflation?: number
          assumption_iof?: number
          assumption_ir?: number
          assumption_selic?: number
          created_at?: string
          engine_version?: string
          goal_amount?: number
          goal_months?: number
          goal_purpose?: string | null
          goal_purpose_custom?: string | null
          goal_years?: number
          id?: string
          initial_amount?: number
          mode?: string
          monthly_contribution?: number
          onboarding_complete?: boolean
          start_date?: string
          status?: string
          updated_at?: string
          user_id: string
          wizard_complete?: boolean
        }
        Update: {
          assumption_cdb_pct?: number
          assumption_inflation?: number
          assumption_iof?: number
          assumption_ir?: number
          assumption_selic?: number
          created_at?: string
          engine_version?: string
          goal_amount?: number
          goal_months?: number
          goal_purpose?: string | null
          goal_purpose_custom?: string | null
          goal_years?: number
          id?: string
          initial_amount?: number
          mode?: string
          monthly_contribution?: number
          onboarding_complete?: boolean
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
          wizard_complete?: boolean
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_color: string | null
          created_at: string
          currency: string | null
          display_name: string | null
          goal_purpose: string | null
          id: string
          onboarding_status: string | null
          plan_mode: string | null
          timezone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_color?: string | null
          created_at?: string
          currency?: string | null
          display_name?: string | null
          goal_purpose?: string | null
          id?: string
          onboarding_status?: string | null
          plan_mode?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_color?: string | null
          created_at?: string
          currency?: string | null
          display_name?: string | null
          goal_purpose?: string | null
          id?: string
          onboarding_status?: string | null
          plan_mode?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_financial_data: {
        Row: {
          app_data: Json
          created_at: string
          id: string
          plan_data: Json
          schema_version: string
          updated_at: string
          user_id: string
        }
        Insert: {
          app_data?: Json
          created_at?: string
          id?: string
          plan_data?: Json
          schema_version?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          app_data?: Json
          created_at?: string
          id?: string
          plan_data?: Json
          schema_version?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
