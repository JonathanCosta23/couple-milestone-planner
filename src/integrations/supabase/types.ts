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
          member_id: string
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
          member_id: string
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
          member_id?: string
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
            referencedRelation: "plan_members"
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
      audit_log: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          new_value: Json | null
          old_value: Json | null
          plan_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          plan_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          new_value?: Json | null
          old_value?: Json | null
          plan_id?: string | null
          user_id?: string
        }
        Relationships: []
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
            referencedRelation: "plan_members"
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
            referencedRelation: "plan_members"
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
      fgc_guarantee_events: {
        Row: {
          conglomerate_id: string | null
          created_at: string
          event_date: string
          gross_credit_amount: number
          guaranteed_amount_received: number
          holder_member_id: string | null
          id: string
          institution_id: string | null
          notes: string | null
          source_type: string
          tax_withheld: number
          updated_at: string
          user_id: string
        }
        Insert: {
          conglomerate_id?: string | null
          created_at?: string
          event_date: string
          gross_credit_amount?: number
          guaranteed_amount_received?: number
          holder_member_id?: string | null
          id?: string
          institution_id?: string | null
          notes?: string | null
          source_type?: string
          tax_withheld?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          conglomerate_id?: string | null
          created_at?: string
          event_date?: string
          gross_credit_amount?: number
          guaranteed_amount_received?: number
          holder_member_id?: string | null
          id?: string
          institution_id?: string | null
          notes?: string | null
          source_type?: string
          tax_withheld?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fgc_guarantee_events_conglomerate_id_fkey"
            columns: ["conglomerate_id"]
            isOneToOne: false
            referencedRelation: "financial_conglomerates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fgc_guarantee_events_holder_member_id_fkey"
            columns: ["holder_member_id"]
            isOneToOne: false
            referencedRelation: "plan_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fgc_guarantee_events_institution_id_fkey"
            columns: ["institution_id"]
            isOneToOne: false
            referencedRelation: "financial_institutions"
            referencedColumns: ["id"]
          },
        ]
      }
      fgc_product_catalog: {
        Row: {
          active: boolean
          conditions: string | null
          coverage_status: string
          created_at: string
          effective_date: string
          id: string
          last_verified_at: string
          product_code: string
          product_name: string
          review_status: string
          source_name: string
          source_url: string | null
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          conditions?: string | null
          coverage_status: string
          created_at?: string
          effective_date: string
          id?: string
          last_verified_at?: string
          product_code: string
          product_name: string
          review_status?: string
          source_name: string
          source_url?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          active?: boolean
          conditions?: string | null
          coverage_status?: string
          created_at?: string
          effective_date?: string
          id?: string
          last_verified_at?: string
          product_code?: string
          product_name?: string
          review_status?: string
          source_name?: string
          source_url?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      fgc_regulatory_rules: {
        Row: {
          active: boolean
          created_at: string
          currency: string | null
          description: string
          effective_date: string
          id: string
          last_verified_at: string
          numeric_value: number | null
          review_status: string
          rule_key: string
          source_name: string
          source_url: string | null
          updated_at: string
          version: string
          window_years: number | null
        }
        Insert: {
          active?: boolean
          created_at?: string
          currency?: string | null
          description: string
          effective_date: string
          id?: string
          last_verified_at?: string
          numeric_value?: number | null
          review_status?: string
          rule_key: string
          source_name: string
          source_url?: string | null
          updated_at?: string
          version?: string
          window_years?: number | null
        }
        Update: {
          active?: boolean
          created_at?: string
          currency?: string | null
          description?: string
          effective_date?: string
          id?: string
          last_verified_at?: string
          numeric_value?: number | null
          review_status?: string
          rule_key?: string
          source_name?: string
          source_url?: string | null
          updated_at?: string
          version?: string
          window_years?: number | null
        }
        Relationships: []
      }
      financial_conglomerates: {
        Row: {
          active: boolean
          created_at: string
          effective_date: string | null
          external_reference: string | null
          id: string
          last_verified_at: string | null
          official_name: string
          review_status: string
          source_name: string | null
          source_url: string | null
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          effective_date?: string | null
          external_reference?: string | null
          id?: string
          last_verified_at?: string | null
          official_name: string
          review_status?: string
          source_name?: string | null
          source_url?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          effective_date?: string | null
          external_reference?: string | null
          id?: string
          last_verified_at?: string | null
          official_name?: string
          review_status?: string
          source_name?: string | null
          source_url?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      financial_institutions: {
        Row: {
          active: boolean
          association_type: string | null
          conglomerate_id: string | null
          created_at: string
          document_reference: string | null
          effective_date: string | null
          fgc_association_status: string
          id: string
          last_verified_at: string | null
          legal_name: string
          review_status: string
          source_name: string | null
          source_url: string | null
          trade_name: string | null
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          association_type?: string | null
          conglomerate_id?: string | null
          created_at?: string
          document_reference?: string | null
          effective_date?: string | null
          fgc_association_status?: string
          id?: string
          last_verified_at?: string | null
          legal_name: string
          review_status?: string
          source_name?: string | null
          source_url?: string | null
          trade_name?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          active?: boolean
          association_type?: string | null
          conglomerate_id?: string | null
          created_at?: string
          document_reference?: string | null
          effective_date?: string | null
          fgc_association_status?: string
          id?: string
          last_verified_at?: string | null
          legal_name?: string
          review_status?: string
          source_name?: string | null
          source_url?: string | null
          trade_name?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "financial_institutions_conglomerate_id_fkey"
            columns: ["conglomerate_id"]
            isOneToOne: false
            referencedRelation: "financial_conglomerates"
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
            referencedRelation: "plan_members"
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
      iof_rules: {
        Row: {
          active: boolean
          calculation_base: string
          created_at: string
          effective_date: string
          expires_at: string | null
          holding_day: number
          id: string
          jurisdiction: string
          last_verified_at: string | null
          product_category: string
          rate: number
          source_name: string | null
          source_url: string | null
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          calculation_base?: string
          created_at?: string
          effective_date: string
          expires_at?: string | null
          holding_day: number
          id?: string
          jurisdiction?: string
          last_verified_at?: string | null
          product_category?: string
          rate: number
          source_name?: string | null
          source_url?: string | null
          updated_at?: string
          version?: string
        }
        Update: {
          active?: boolean
          calculation_base?: string
          created_at?: string
          effective_date?: string
          expires_at?: string | null
          holding_day?: number
          id?: string
          jurisdiction?: string
          last_verified_at?: string | null
          product_category?: string
          rate?: number
          source_name?: string | null
          source_url?: string | null
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      knowledge_articles: {
        Row: {
          active: boolean
          content: Json
          created_at: string
          difficulty: string
          educational_disclaimer: string
          effective_date: string | null
          estimated_minutes: number
          id: string
          jurisdiction: string
          last_verified_at: string | null
          review_status: string
          summary: string
          title: string
          topic_id: string
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          content?: Json
          created_at?: string
          difficulty?: string
          educational_disclaimer?: string
          effective_date?: string | null
          estimated_minutes?: number
          id?: string
          jurisdiction?: string
          last_verified_at?: string | null
          review_status?: string
          summary: string
          title: string
          topic_id: string
          updated_at?: string
          version?: string
        }
        Update: {
          active?: boolean
          content?: Json
          created_at?: string
          difficulty?: string
          educational_disclaimer?: string
          effective_date?: string | null
          estimated_minutes?: number
          id?: string
          jurisdiction?: string
          last_verified_at?: string | null
          review_status?: string
          summary?: string
          title?: string
          topic_id?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_articles_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "knowledge_topics"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_asset_cases: {
        Row: {
          active: boolean
          associated_school_slugs: Json
          business_model: string
          capital_intensity: string | null
          cash_flow_summary: string | null
          commodity_exposure: string | null
          company_name: string
          competitive_advantages: Json
          cost_drivers: Json
          created_at: string
          currency_exposure: string | null
          cyclicality: string | null
          debt_summary: string | null
          dividend_summary: string | null
          educational_disclaimer: string
          educational_only: boolean
          events_to_watch: Json
          governance_summary: string | null
          government_exposure: string | null
          id: string
          indicators_to_watch: Json
          key_risks: Json
          last_verified_at: string
          negative_thesis: Json
          positive_thesis: Json
          regulatory_exposure: string | null
          reporting_period: string | null
          revenue_drivers: Json
          review_status: string
          sector: string
          share_class: string | null
          source_date: string | null
          sources: Json
          subsector: string | null
          ticker: string | null
          ticker_validated: boolean
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          associated_school_slugs?: Json
          business_model: string
          capital_intensity?: string | null
          cash_flow_summary?: string | null
          commodity_exposure?: string | null
          company_name: string
          competitive_advantages?: Json
          cost_drivers?: Json
          created_at?: string
          currency_exposure?: string | null
          cyclicality?: string | null
          debt_summary?: string | null
          dividend_summary?: string | null
          educational_disclaimer: string
          educational_only?: boolean
          events_to_watch?: Json
          governance_summary?: string | null
          government_exposure?: string | null
          id?: string
          indicators_to_watch?: Json
          key_risks?: Json
          last_verified_at?: string
          negative_thesis?: Json
          positive_thesis?: Json
          regulatory_exposure?: string | null
          reporting_period?: string | null
          revenue_drivers?: Json
          review_status?: string
          sector: string
          share_class?: string | null
          source_date?: string | null
          sources?: Json
          subsector?: string | null
          ticker?: string | null
          ticker_validated?: boolean
          updated_at?: string
          version?: string
        }
        Update: {
          active?: boolean
          associated_school_slugs?: Json
          business_model?: string
          capital_intensity?: string | null
          cash_flow_summary?: string | null
          commodity_exposure?: string | null
          company_name?: string
          competitive_advantages?: Json
          cost_drivers?: Json
          created_at?: string
          currency_exposure?: string | null
          cyclicality?: string | null
          debt_summary?: string | null
          dividend_summary?: string | null
          educational_disclaimer?: string
          educational_only?: boolean
          events_to_watch?: Json
          governance_summary?: string | null
          government_exposure?: string | null
          id?: string
          indicators_to_watch?: Json
          key_risks?: Json
          last_verified_at?: string
          negative_thesis?: Json
          positive_thesis?: Json
          regulatory_exposure?: string | null
          reporting_period?: string | null
          revenue_drivers?: Json
          review_status?: string
          sector?: string
          share_class?: string | null
          source_date?: string | null
          sources?: Json
          subsector?: string | null
          ticker?: string | null
          ticker_validated?: boolean
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      knowledge_formulas: {
        Row: {
          active: boolean
          assumptions: string
          created_at: string
          example: string | null
          expression: string
          id: string
          input_definition: Json
          limitations: string
          purpose: string
          slug: string
          title: string
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          assumptions: string
          created_at?: string
          example?: string | null
          expression: string
          id?: string
          input_definition?: Json
          limitations: string
          purpose: string
          slug: string
          title: string
          updated_at?: string
          version?: string
        }
        Update: {
          active?: boolean
          assumptions?: string
          created_at?: string
          example?: string | null
          expression?: string
          id?: string
          input_definition?: Json
          limitations?: string
          purpose?: string
          slug?: string
          title?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      knowledge_investment_schools: {
        Row: {
          active: boolean
          central_question: string
          core_concepts: Json
          created_at: string
          educational_disclaimer: string
          id: string
          jurisdiction: string
          key_risks: Json
          last_verified_at: string
          limitations: Json
          name: string
          review_status: string
          slug: string
          sort_order: number
          summary: string
          updated_at: string
          version: string
          when_it_fails: string | null
          when_it_works: string | null
        }
        Insert: {
          active?: boolean
          central_question: string
          core_concepts?: Json
          created_at?: string
          educational_disclaimer: string
          id?: string
          jurisdiction?: string
          key_risks?: Json
          last_verified_at?: string
          limitations?: Json
          name: string
          review_status?: string
          slug: string
          sort_order?: number
          summary: string
          updated_at?: string
          version?: string
          when_it_fails?: string | null
          when_it_works?: string | null
        }
        Update: {
          active?: boolean
          central_question?: string
          core_concepts?: Json
          created_at?: string
          educational_disclaimer?: string
          id?: string
          jurisdiction?: string
          key_risks?: Json
          last_verified_at?: string
          limitations?: Json
          name?: string
          review_status?: string
          slug?: string
          sort_order?: number
          summary?: string
          updated_at?: string
          version?: string
          when_it_fails?: string | null
          when_it_works?: string | null
        }
        Relationships: []
      }
      knowledge_investor_references: {
        Row: {
          active: boolean
          associated_school_slugs: Json
          controversies_or_risks: Json
          created_at: string
          documented_principles: Json
          educational_disclaimer: string
          educational_only: boolean
          full_name: string
          historical_context: string
          historical_positions: Json
          id: string
          last_verified_at: string
          lessons: Json
          limitations: Json
          review_status: string
          short_bio: string
          slug: string
          source_date: string | null
          sources: Json
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          associated_school_slugs?: Json
          controversies_or_risks?: Json
          created_at?: string
          documented_principles?: Json
          educational_disclaimer: string
          educational_only?: boolean
          full_name: string
          historical_context: string
          historical_positions?: Json
          id?: string
          last_verified_at?: string
          lessons?: Json
          limitations?: Json
          review_status?: string
          short_bio: string
          slug: string
          source_date?: string | null
          sources?: Json
          updated_at?: string
          version?: string
        }
        Update: {
          active?: boolean
          associated_school_slugs?: Json
          controversies_or_risks?: Json
          created_at?: string
          documented_principles?: Json
          educational_disclaimer?: string
          educational_only?: boolean
          full_name?: string
          historical_context?: string
          historical_positions?: Json
          id?: string
          last_verified_at?: string
          lessons?: Json
          limitations?: Json
          review_status?: string
          short_bio?: string
          slug?: string
          source_date?: string | null
          sources?: Json
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      knowledge_regulatory_rules: {
        Row: {
          active: boolean
          category: string
          created_at: string
          effective_date: string
          id: string
          jurisdiction: string
          last_verified_at: string
          rule_content: string
          rule_name: string
          source_url: string
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          effective_date: string
          id?: string
          jurisdiction?: string
          last_verified_at: string
          rule_content: string
          rule_name: string
          source_url: string
          updated_at?: string
          version?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          effective_date?: string
          id?: string
          jurisdiction?: string
          last_verified_at?: string
          rule_content?: string
          rule_name?: string
          source_url?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      knowledge_sources: {
        Row: {
          accessed_at: string
          article_id: string
          created_at: string
          id: string
          is_primary_source: boolean
          publication_date: string | null
          source_name: string
          source_type: string
          source_url: string | null
        }
        Insert: {
          accessed_at?: string
          article_id: string
          created_at?: string
          id?: string
          is_primary_source?: boolean
          publication_date?: string | null
          source_name: string
          source_type?: string
          source_url?: string | null
        }
        Update: {
          accessed_at?: string
          article_id?: string
          created_at?: string
          id?: string
          is_primary_source?: boolean
          publication_date?: string | null
          source_name?: string
          source_type?: string
          source_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_sources_article_id_fkey"
            columns: ["article_id"]
            isOneToOne: false
            referencedRelation: "knowledge_articles"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_strategies: {
        Row: {
          active: boolean
          common_mistakes: string
          created_at: string
          description: string
          educational_only: boolean
          id: string
          risks: string
          slug: string
          suitable_context: string
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          common_mistakes: string
          created_at?: string
          description: string
          educational_only?: boolean
          id?: string
          risks: string
          slug: string
          suitable_context: string
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          common_mistakes?: string
          created_at?: string
          description?: string
          educational_only?: boolean
          id?: string
          risks?: string
          slug?: string
          suitable_context?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      knowledge_topics: {
        Row: {
          active: boolean
          category: string
          created_at: string
          description: string | null
          difficulty: string
          id: string
          slug: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          category: string
          created_at?: string
          description?: string | null
          difficulty?: string
          id?: string
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          category?: string
          created_at?: string
          description?: string | null
          difficulty?: string
          id?: string
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      legal_consents: {
        Row: {
          accepted_at: string
          consent_type: string
          created_at: string
          id: string
          metadata: Json
          user_id: string
          version: string
        }
        Insert: {
          accepted_at?: string
          consent_type: string
          created_at?: string
          id?: string
          metadata?: Json
          user_id: string
          version: string
        }
        Update: {
          accepted_at?: string
          consent_type?: string
          created_at?: string
          id?: string
          metadata?: Json
          user_id?: string
          version?: string
        }
        Relationships: []
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
      monthly_member_tracking: {
        Row: {
          actual_cdb: number
          actual_selic: number
          created_at: string
          id: string
          monthly_tracking_id: string
          plan_member_id: string
          planned_cdb: number
          planned_selic: number
          updated_at: string
          user_id: string
        }
        Insert: {
          actual_cdb?: number
          actual_selic?: number
          created_at?: string
          id?: string
          monthly_tracking_id: string
          plan_member_id: string
          planned_cdb?: number
          planned_selic?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          actual_cdb?: number
          actual_selic?: number
          created_at?: string
          id?: string
          monthly_tracking_id?: string
          plan_member_id?: string
          planned_cdb?: number
          planned_selic?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mmt_plan_member_fkey"
            columns: ["plan_member_id"]
            isOneToOne: false
            referencedRelation: "plan_members"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mmt_tracking_fkey"
            columns: ["monthly_tracking_id"]
            isOneToOne: false
            referencedRelation: "monthly_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_member_tracking_monthly_tracking_id_fkey"
            columns: ["monthly_tracking_id"]
            isOneToOne: false
            referencedRelation: "monthly_tracking"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "monthly_member_tracking_plan_member_id_fkey"
            columns: ["plan_member_id"]
            isOneToOne: false
            referencedRelation: "plan_members"
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
      plan_members: {
        Row: {
          age: number | null
          avatar_color: string | null
          created_at: string
          id: string
          is_active: boolean
          is_primary: boolean
          name: string
          plan_id: string
          role: string
          updated_at: string
          user_id: string
        }
        Insert: {
          age?: number | null
          avatar_color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name?: string
          plan_id: string
          role?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          age?: number | null
          avatar_color?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          is_primary?: boolean
          name?: string
          plan_id?: string
          role?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_members_plan_id_fkey"
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
      product_events: {
        Row: {
          created_at: string
          event_name: string
          id: string
          plan_id: string | null
          properties: Json
          user_id: string
        }
        Insert: {
          created_at?: string
          event_name: string
          id?: string
          plan_id?: string | null
          properties?: Json
          user_id: string
        }
        Update: {
          created_at?: string
          event_name?: string
          id?: string
          plan_id?: string | null
          properties?: Json
          user_id?: string
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
      tax_rules: {
        Row: {
          active: boolean
          calculation_base: string
          created_at: string
          effective_date: string
          expires_at: string | null
          id: string
          jurisdiction: string
          last_verified_at: string | null
          max_days: number | null
          min_days: number
          notes: string | null
          product_category: string
          rate: number
          source_name: string | null
          source_url: string | null
          tax_type: string
          updated_at: string
          version: string
        }
        Insert: {
          active?: boolean
          calculation_base?: string
          created_at?: string
          effective_date: string
          expires_at?: string | null
          id?: string
          jurisdiction?: string
          last_verified_at?: string | null
          max_days?: number | null
          min_days: number
          notes?: string | null
          product_category: string
          rate: number
          source_name?: string | null
          source_url?: string | null
          tax_type: string
          updated_at?: string
          version?: string
        }
        Update: {
          active?: boolean
          calculation_base?: string
          created_at?: string
          effective_date?: string
          expires_at?: string | null
          id?: string
          jurisdiction?: string
          last_verified_at?: string | null
          max_days?: number | null
          min_days?: number
          notes?: string | null
          product_category?: string
          rate?: number
          source_name?: string | null
          source_url?: string | null
          tax_type?: string
          updated_at?: string
          version?: string
        }
        Relationships: []
      }
      user_action_events: {
        Row: {
          action_category: string
          action_key: string
          created_at: string
          engine_version: string
          event_type: string
          id: string
          plan_id: string | null
          user_id: string
        }
        Insert: {
          action_category: string
          action_key: string
          created_at?: string
          engine_version?: string
          event_type: string
          id?: string
          plan_id?: string | null
          user_id: string
        }
        Update: {
          action_category?: string
          action_key?: string
          created_at?: string
          engine_version?: string
          event_type?: string
          id?: string
          plan_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_action_events_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      user_action_state: {
        Row: {
          action_category: string
          action_key: string
          completed_at: string | null
          created_at: string
          dismissed_reason: string | null
          engine_version: string
          first_seen_at: string
          id: string
          last_seen_at: string
          plan_id: string | null
          snoozed_until: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          action_category: string
          action_key: string
          completed_at?: string | null
          created_at?: string
          dismissed_reason?: string | null
          engine_version?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          plan_id?: string | null
          snoozed_until?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          action_category?: string
          action_key?: string
          completed_at?: string | null
          created_at?: string
          dismissed_reason?: string | null
          engine_version?: string
          first_seen_at?: string
          id?: string
          last_seen_at?: string
          plan_id?: string | null
          snoozed_until?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_action_state_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
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
      user_learning_progress: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          last_viewed_at: string
          progress_percentage: number
          status: string
          topic_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_viewed_at?: string
          progress_percentage?: number
          status?: string
          topic_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          last_viewed_at?: string
          progress_percentage?: number
          status?: string
          topic_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_learning_progress_topic_id_fkey"
            columns: ["topic_id"]
            isOneToOne: false
            referencedRelation: "knowledge_topics"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      reset_user_plan_data: { Args: never; Returns: Json }
      upsert_month_with_members: {
        Args: {
          p_completed?: boolean
          p_members?: Json
          p_month_key: string
          p_notes?: string
          p_plan_id: string
        }
        Returns: Json
      }
      upsert_plan_with_members: {
        Args: {
          p_goal_amount?: number
          p_goal_purpose?: string
          p_goal_purpose_custom?: string
          p_goal_years?: number
          p_initial_amount?: number
          p_mode: string
          p_monthly_contribution?: number
          p_onboarding_complete?: boolean
          p_partner_age?: number
          p_partner_name?: string
          p_primary_age?: number
          p_primary_name: string
          p_wizard_complete?: boolean
        }
        Returns: Json
      }
      upsert_plan_with_members_v2: {
        Args: {
          p_goal_amount?: number
          p_goal_purpose?: string
          p_goal_purpose_custom?: string
          p_goal_years?: number
          p_initial_amount?: number
          p_mode: string
          p_monthly_contribution?: number
          p_onboarding_complete?: boolean
          p_partner_age?: number
          p_partner_name?: string
          p_plan_id?: string
          p_primary_age?: number
          p_primary_name: string
          p_wizard_complete?: boolean
        }
        Returns: Json
      }
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
