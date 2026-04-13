
-- ============================================
-- PLANS
-- ============================================
CREATE TABLE public.plans (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  mode TEXT NOT NULL DEFAULT 'individual' CHECK (mode IN ('individual', 'couple')),
  goal_amount NUMERIC NOT NULL DEFAULT 1000000,
  goal_years INTEGER NOT NULL DEFAULT 21,
  goal_months INTEGER NOT NULL DEFAULT 252,
  goal_purpose TEXT,
  goal_purpose_custom TEXT,
  initial_amount NUMERIC NOT NULL DEFAULT 0,
  monthly_contribution NUMERIC NOT NULL DEFAULT 0,
  assumption_selic NUMERIC NOT NULL DEFAULT 0.1315,
  assumption_cdb_pct NUMERIC NOT NULL DEFAULT 1.0,
  assumption_inflation NUMERIC NOT NULL DEFAULT 0.045,
  assumption_ir NUMERIC NOT NULL DEFAULT 0.15,
  assumption_iof NUMERIC NOT NULL DEFAULT 0,
  engine_version TEXT NOT NULL DEFAULT '1.0',
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'completed')),
  start_date TEXT NOT NULL DEFAULT to_char(now(), 'YYYY-MM'),
  onboarding_complete BOOLEAN NOT NULL DEFAULT false,
  wizard_complete BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plans" ON public.plans FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own plans" ON public.plans FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own plans" ON public.plans FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own plans" ON public.plans FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_plans_updated_at BEFORE UPDATE ON public.plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- MEMBERS
-- ============================================
CREATE TABLE public.members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'primary' CHECK (role IN ('primary', 'spouse', 'other')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  planned_selic NUMERIC NOT NULL DEFAULT 0,
  planned_cdb NUMERIC NOT NULL DEFAULT 0,
  actual_selic NUMERIC NOT NULL DEFAULT 0,
  actual_cdb NUMERIC NOT NULL DEFAULT 0,
  monthly_income NUMERIC NOT NULL DEFAULT 0,
  monthly_expenses NUMERIC NOT NULL DEFAULT 0,
  current_reserve NUMERIC NOT NULL DEFAULT 0,
  individual_goal TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own members" ON public.members FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own members" ON public.members FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own members" ON public.members FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own members" ON public.members FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_members_updated_at BEFORE UPDATE ON public.members
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ASSETS
-- ============================================
CREATE TABLE public.assets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  asset_type TEXT NOT NULL,
  asset_subtype TEXT,
  institution TEXT,
  conglomerate TEXT,
  ticker_or_name TEXT,
  bucket TEXT CHECK (bucket IN ('reserve', 'protection', 'sovereign', 'growth')),
  has_fgc BOOLEAN NOT NULL DEFAULT false,
  has_sovereign_guarantee BOOLEAN NOT NULL DEFAULT false,
  liquidity_type TEXT CHECK (liquidity_type IN ('daily', 'scheduled', 'maturity', 'variable')),
  maturity_date DATE,
  mark_to_market BOOLEAN NOT NULL DEFAULT false,
  invested_amount NUMERIC NOT NULL DEFAULT 0,
  current_amount NUMERIC NOT NULL DEFAULT 0,
  net_estimated NUMERIC NOT NULL DEFAULT 0,
  reference_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own assets" ON public.assets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own assets" ON public.assets FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own assets" ON public.assets FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own assets" ON public.assets FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- EXPENSES
-- ============================================
CREATE TABLE public.expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  category TEXT NOT NULL,
  subcategory TEXT,
  expense_type TEXT NOT NULL DEFAULT 'fixed' CHECK (expense_type IN ('fixed', 'variable')),
  is_essential BOOLEAN NOT NULL DEFAULT true,
  amount NUMERIC NOT NULL DEFAULT 0,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  expense_date DATE,
  month_key TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own expenses" ON public.expenses FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own expenses" ON public.expenses FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own expenses" ON public.expenses FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own expenses" ON public.expenses FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- INCOME
-- ============================================
CREATE TABLE public.income (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  income_type TEXT NOT NULL DEFAULT 'salary',
  amount NUMERIC NOT NULL DEFAULT 0,
  is_recurring BOOLEAN NOT NULL DEFAULT true,
  income_date DATE,
  month_key TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.income ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own income" ON public.income FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own income" ON public.income FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own income" ON public.income FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own income" ON public.income FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_income_updated_at BEFORE UPDATE ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- DEBTS
-- ============================================
CREATE TABLE public.debts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  debt_type TEXT NOT NULL,
  institution TEXT,
  total_balance NUMERIC NOT NULL DEFAULT 0,
  monthly_payment NUMERIC NOT NULL DEFAULT 0,
  interest_rate NUMERIC NOT NULL DEFAULT 0,
  effective_cost NUMERIC NOT NULL DEFAULT 0,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'critical')),
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own debts" ON public.debts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own debts" ON public.debts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own debts" ON public.debts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own debts" ON public.debts FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_debts_updated_at BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- MONTHLY_TRACKING
-- ============================================
CREATE TABLE public.monthly_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  year INTEGER NOT NULL,
  month INTEGER NOT NULL,
  month_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'partial', 'completed')),
  is_current BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  planned_total NUMERIC NOT NULL DEFAULT 0,
  actual_total NUMERIC NOT NULL DEFAULT 0,
  shortfall NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (plan_id, month_key)
);

ALTER TABLE public.monthly_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tracking" ON public.monthly_tracking FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own tracking" ON public.monthly_tracking FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own tracking" ON public.monthly_tracking FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own tracking" ON public.monthly_tracking FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_monthly_tracking_updated_at BEFORE UPDATE ON public.monthly_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- MILESTONES
-- ============================================
CREATE TABLE public.milestones (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  milestone_type TEXT NOT NULL DEFAULT 'financial' CHECK (milestone_type IN ('financial', 'behavioral', 'journey')),
  value NUMERIC NOT NULL,
  triggered_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  origin TEXT NOT NULL DEFAULT 'projected' CHECK (origin IN ('projected', 'realized')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'celebrated', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.milestones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own milestones" ON public.milestones FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own milestones" ON public.milestones FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own milestones" ON public.milestones FOR UPDATE USING (auth.uid() = user_id);

CREATE TRIGGER update_milestones_updated_at BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- INSIGHTS_LOG
-- ============================================
CREATE TABLE public.insights_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  insight_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  cause TEXT,
  recommended_action TEXT,
  severity TEXT NOT NULL DEFAULT 'info' CHECK (severity IN ('info', 'warning', 'critical', 'success')),
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.insights_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own insights" ON public.insights_log FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own insights" ON public.insights_log FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own insights" ON public.insights_log FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- EDUCATION_PROGRESS
-- ============================================
CREATE TABLE public.education_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lesson_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'started', 'completed')),
  opened_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  context_trigger TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, lesson_id)
);

ALTER TABLE public.education_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own education" ON public.education_progress FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own education" ON public.education_progress FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own education" ON public.education_progress FOR UPDATE USING (auth.uid() = user_id);

-- ============================================
-- Update profiles table with plan mode
-- ============================================
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS plan_mode TEXT DEFAULT 'individual' CHECK (plan_mode IN ('individual', 'couple'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS goal_purpose TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_status TEXT DEFAULT 'pending' CHECK (onboarding_status IN ('pending', 'profile', 'goal', 'contributions', 'complete'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL';
