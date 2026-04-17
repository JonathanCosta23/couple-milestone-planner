-- Drop FKs antigas (apontavam para members) e recriar apontando para plan_members.
ALTER TABLE public.income   DROP CONSTRAINT IF EXISTS income_member_id_fkey;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_member_id_fkey;
ALTER TABLE public.debts    DROP CONSTRAINT IF EXISTS debts_member_id_fkey;

-- Recria apontando para plan_members.
ALTER TABLE public.income
  ADD CONSTRAINT income_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.plan_members(id) ON DELETE SET NULL;
ALTER TABLE public.expenses
  ADD CONSTRAINT expenses_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.plan_members(id) ON DELETE SET NULL;
ALTER TABLE public.debts
  ADD CONSTRAINT debts_member_id_fkey
  FOREIGN KEY (member_id) REFERENCES public.plan_members(id) ON DELETE SET NULL;

-- FKs faltantes (idempotente).
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mmt_plan_member_fkey') THEN
    ALTER TABLE public.monthly_member_tracking ADD CONSTRAINT mmt_plan_member_fkey
      FOREIGN KEY (plan_member_id) REFERENCES public.plan_members(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='mmt_tracking_fkey') THEN
    ALTER TABLE public.monthly_member_tracking ADD CONSTRAINT mmt_tracking_fkey
      FOREIGN KEY (monthly_tracking_id) REFERENCES public.monthly_tracking(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='income_plan_id_fkey') THEN
    ALTER TABLE public.income ADD CONSTRAINT income_plan_id_fkey
      FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='expenses_plan_id_fkey') THEN
    ALTER TABLE public.expenses ADD CONSTRAINT expenses_plan_id_fkey
      FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='debts_plan_id_fkey') THEN
    ALTER TABLE public.debts ADD CONSTRAINT debts_plan_id_fkey
      FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='monthly_tracking_plan_id_fkey') THEN
    ALTER TABLE public.monthly_tracking ADD CONSTRAINT monthly_tracking_plan_id_fkey
      FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname='plan_members_plan_id_fkey') THEN
    ALTER TABLE public.plan_members ADD CONSTRAINT plan_members_plan_id_fkey
      FOREIGN KEY (plan_id) REFERENCES public.plans(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Índices
CREATE INDEX IF NOT EXISTS idx_assets_user_plan ON public.assets(user_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_income_user_plan ON public.income(user_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_expenses_user_plan ON public.expenses(user_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_debts_user_plan ON public.debts(user_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_monthly_tracking_user_plan ON public.monthly_tracking(user_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_mmt_tracking ON public.monthly_member_tracking(monthly_tracking_id);
CREATE INDEX IF NOT EXISTS idx_plan_members_plan ON public.plan_members(plan_id, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_monthly_tracking_month ON public.monthly_tracking(plan_id, month_key);

-- Função de validação genérica
CREATE OR REPLACE FUNCTION public.validate_flow_member_link()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
DECLARE
  plan_mode text;
  resolved_member_id uuid;
BEGIN
  SELECT mode INTO plan_mode FROM public.plans
  WHERE id = NEW.plan_id AND user_id = NEW.user_id LIMIT 1;
  IF plan_mode IS NULL THEN
    RAISE EXCEPTION 'Registro deve pertencer a um plano válido do usuário.';
  END IF;
  IF NEW.member_id IS NULL AND plan_mode = 'individual' THEN
    SELECT pm.id INTO NEW.member_id FROM public.plan_members pm
    WHERE pm.plan_id=NEW.plan_id AND pm.user_id=NEW.user_id
      AND pm.is_active=true AND pm.is_primary=true
    ORDER BY pm.created_at ASC LIMIT 1;
  END IF;
  IF NEW.member_id IS NOT NULL THEN
    SELECT pm.id INTO resolved_member_id FROM public.plan_members pm
    WHERE pm.id=NEW.member_id AND pm.plan_id=NEW.plan_id
      AND pm.user_id=NEW.user_id AND pm.is_active=true LIMIT 1;
    IF resolved_member_id IS NULL THEN
      RAISE EXCEPTION 'member_id inválido: deve referenciar um participante ativo do mesmo plano.';
    END IF;
    NEW.member_id := resolved_member_id;
  END IF;
  RETURN NEW;
END; $fn$;

DROP TRIGGER IF EXISTS trg_income_validate_member ON public.income;
CREATE TRIGGER trg_income_validate_member
  BEFORE INSERT OR UPDATE OF member_id, plan_id, user_id ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.validate_flow_member_link();
DROP TRIGGER IF EXISTS trg_expenses_validate_member ON public.expenses;
CREATE TRIGGER trg_expenses_validate_member
  BEFORE INSERT OR UPDATE OF member_id, plan_id, user_id ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.validate_flow_member_link();
DROP TRIGGER IF EXISTS trg_debts_validate_member ON public.debts;
CREATE TRIGGER trg_debts_validate_member
  BEFORE INSERT OR UPDATE OF member_id, plan_id, user_id ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.validate_flow_member_link();

-- updated_at
DROP TRIGGER IF EXISTS trg_assets_updated_at ON public.assets;
CREATE TRIGGER trg_assets_updated_at BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_income_updated_at ON public.income;
CREATE TRIGGER trg_income_updated_at BEFORE UPDATE ON public.income
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_expenses_updated_at ON public.expenses;
CREATE TRIGGER trg_expenses_updated_at BEFORE UPDATE ON public.expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_debts_updated_at ON public.debts;
CREATE TRIGGER trg_debts_updated_at BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_monthly_tracking_updated_at ON public.monthly_tracking;
CREATE TRIGGER trg_monthly_tracking_updated_at BEFORE UPDATE ON public.monthly_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_monthly_member_tracking_updated_at ON public.monthly_member_tracking;
CREATE TRIGGER trg_monthly_member_tracking_updated_at BEFORE UPDATE ON public.monthly_member_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
DROP TRIGGER IF EXISTS trg_assets_validate_member ON public.assets;
CREATE TRIGGER trg_assets_validate_member
  BEFORE INSERT OR UPDATE OF member_id, plan_id, user_id ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.validate_asset_member_link();

-- Drop final da tabela members (snapshot já preservado).
DROP TABLE IF EXISTS public.members;