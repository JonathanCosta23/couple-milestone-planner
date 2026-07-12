/**
 * Domain types for the education layer:
 *  - Schools of investment thought
 *  - Investor references (historical)
 *  - Asset education cases (companies / tickers)
 *
 * All content is educational and versioned. Nothing here represents a
 * recommendation to buy, sell, or hold any asset.
 */

export type ReviewStatus = "unverified" | "in_review" | "verified" | "outdated" | "archived";
export type FreshnessState = "current" | "review_due" | "stale" | "unverified" | "archived";

export interface EducationSource {
  source_name: string;
  source_url?: string | null;
  source_type?: string | null;
  publication_date?: string | null;
  reporting_period?: string | null;
  accessed_at?: string | null;
  last_verified_at?: string | null;
  is_primary_source?: boolean;
}

export interface InvestmentSchool {
  id: string;
  slug: string;
  name: string;
  summary: string;
  central_question: string;
  core_concepts: string[];
  key_risks: string[];
  limitations: string[];
  when_it_works: string | null;
  when_it_fails: string | null;
  jurisdiction: string;
  version: string;
  last_verified_at: string;
  review_status: ReviewStatus;
  educational_disclaimer: string;
  sort_order: number;
}

export interface HistoricalPosition {
  entity: string;
  description: string;
  reference_date: string; // ISO date
  source: EducationSource;
}

export interface InvestorReference {
  id: string;
  slug: string;
  full_name: string;
  short_bio: string;
  historical_context: string;
  documented_principles: string[];
  associated_school_slugs: string[];
  lessons: string[];
  limitations: string[];
  controversies_or_risks: string[];
  historical_positions: HistoricalPosition[];
  sources: EducationSource[];
  source_date: string | null;
  last_verified_at: string;
  review_status: ReviewStatus;
  educational_only: boolean;
  educational_disclaimer: string;
  version: string;
}

export interface AssetEducationCase {
  id: string;
  ticker: string | null;
  company_name: string;
  share_class: string | null;
  sector: string;
  subsector: string | null;
  business_model: string;
  revenue_drivers: string[];
  cost_drivers: string[];
  competitive_advantages: string[];
  capital_intensity: string | null;
  cyclicality: string | null;
  government_exposure: string | null;
  currency_exposure: string | null;
  commodity_exposure: string | null;
  regulatory_exposure: string | null;
  governance_summary: string | null;
  debt_summary: string | null;
  cash_flow_summary: string | null;
  dividend_summary: string | null;
  positive_thesis: string[];
  negative_thesis: string[];
  key_risks: string[];
  indicators_to_watch: string[];
  events_to_watch: string[];
  reporting_period: string | null;
  associated_school_slugs: string[];
  sources: EducationSource[];
  source_date: string | null;
  last_verified_at: string;
  review_status: ReviewStatus;
  educational_only: boolean;
  educational_disclaimer: string;
  ticker_validated: boolean;
  version: string;
}