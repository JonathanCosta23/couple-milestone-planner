
-- =========================================================
-- Fase 1.A — Fundação: plan_members, monthly_member_tracking,
-- padronização do plan_mode (individual/casal)
-- =========================================================

-- 1) Criar tabela plan_members (substitui o uso de `members`)
CREATE TABLE IF NOT EXISTS public.plan_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  plan_id UUID NOT NULL REFERENCES public.plans(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'titular' CHECK (role IN ('titular', 'parceiro')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  age INTEGER,
  avatar_color TEXT DEFAULT 'hsl(262, 83%, 58%)',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own plan_members"
  ON public.plan_members FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own plan_members"
  ON public.plan_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own plan_members"
  ON public.plan_members FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own plan_members"
  ON public.plan_members FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_plan_members_updated_at
  BEFORE UPDATE ON public.plan_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_plan_members_plan_id ON public.plan_members(plan_id);
CREATE INDEX IF NOT EXISTS idx_plan_members_user_id ON public.plan_members(user_id);

-- Garantir que cada plano tem exatamente um titular primário
CREATE UNIQUE INDEX IF NOT EXISTS idx_plan_members_one_primary_per_plan
  ON public.plan_members(plan_id)
  WHERE is_primary = true;


-- 2) Criar tabela monthly_member_tracking
CREATE TABLE IF NOT EXISTS public.monthly_member_tracking (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  monthly_tracking_id UUID NOT NULL REFERENCES public.monthly_tracking(id) ON DELETE CASCADE,
  plan_member_id UUID NOT NULL REFERENCES public.plan_members(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  planned_selic NUMERIC NOT NULL DEFAULT 0,
  planned_cdb NUMERIC NOT NULL DEFAULT 0,
  actual_selic NUMERIC NOT NULL DEFAULT 0,
  actual_cdb NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (monthly_tracking_id, plan_member_id)
);

ALTER TABLE public.monthly_member_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own member_tracking"
  ON public.monthly_member_tracking FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own member_tracking"
  ON public.monthly_member_tracking FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own member_tracking"
  ON public.monthly_member_tracking FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own member_tracking"
  ON public.monthly_member_tracking FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER set_monthly_member_tracking_updated_at
  BEFORE UPDATE ON public.monthly_member_tracking
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_monthly_member_tracking_user_id
  ON public.monthly_member_tracking(user_id);


-- 3) Padronizar plans.mode para individual/casal
-- Converter dados existentes
UPDATE public.plans
   SET mode = CASE
                WHEN mode IN ('solo', 'individual') THEN 'individual'
                WHEN mode IN ('couple', 'casal')    THEN 'casal'
                ELSE 'individual'
              END
 WHERE mode IS NOT NULL;

-- Remover constraint anterior (se houver) e aplicar nova
ALTER TABLE public.plans DROP CONSTRAINT IF EXISTS plans_mode_check;
ALTER TABLE public.plans
  ADD CONSTRAINT plans_mode_check CHECK (mode IN ('individual', 'casal'));

ALTER TABLE public.plans ALTER COLUMN mode SET DEFAULT 'individual';


-- 4) Mesma padronização em profiles.plan_mode (para consistência)
UPDATE public.profiles
   SET plan_mode = CASE
                     WHEN plan_mode IN ('solo', 'individual') THEN 'individual'
                     WHEN plan_mode IN ('couple', 'casal')    THEN 'casal'
                     ELSE 'individual'
                   END
 WHERE plan_mode IS NOT NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_plan_mode_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plan_mode_check CHECK (plan_mode IN ('individual', 'casal'));

ALTER TABLE public.profiles ALTER COLUMN plan_mode SET DEFAULT 'individual';


-- 5) Triggers de updated_at em tabelas existentes que ainda não têm
DROP TRIGGER IF EXISTS set_plans_updated_at ON public.plans;
CREATE TRIGGER set_plans_updated_at
  BEFORE UPDATE ON public.plans
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_profiles_updated_at ON public.profiles;
CREATE TRIGGER set_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS set_assets_updated_at ON public.assets;
CREATE TRIGGER set_assets_updated_at
  BEFORE UPDATE ON public.assets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
