CREATE OR REPLACE FUNCTION public.reset_user_plan_data()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'reset_user_plan_data: usuário não autenticado.';
  END IF;

  -- Ordem segura: filhos antes de pais (mesmo sem FKs declaradas, segue a hierarquia lógica).
  DELETE FROM public.monthly_member_tracking WHERE user_id = uid;
  DELETE FROM public.monthly_tracking        WHERE user_id = uid;
  DELETE FROM public.assets                  WHERE user_id = uid;
  DELETE FROM public.income                  WHERE user_id = uid;
  DELETE FROM public.expenses                WHERE user_id = uid;
  DELETE FROM public.debts                   WHERE user_id = uid;
  DELETE FROM public.milestones              WHERE user_id = uid;
  DELETE FROM public.insights_log            WHERE user_id = uid;
  DELETE FROM public.education_progress      WHERE user_id = uid;
  DELETE FROM public.plan_members            WHERE user_id = uid;
  DELETE FROM public.plans                   WHERE user_id = uid;

  -- Zera o blob legado para evitar reidratação após reset.
  UPDATE public.user_financial_data
     SET plan_data = '{}'::jsonb,
         app_data  = '{}'::jsonb,
         updated_at = now()
   WHERE user_id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.reset_user_plan_data() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_user_plan_data() TO authenticated;