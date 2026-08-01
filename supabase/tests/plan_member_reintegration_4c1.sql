-- Passo 4.c.1 — reintegração com ownership explícito
-- Execução: psql -v ON_ERROR_STOP=1 -f supabase/tests/plan_member_reintegration_4c1.sql

BEGIN;

DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000004c2003';
  u2 uuid := '00000000-0000-0000-0000-0000004c2103';
  p uuid;
  titular uuid;
  parceiro uuid;
  expense_id uuid;
  before_amount numeric;
  j jsonb;
  blocked boolean := false;
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);

  INSERT INTO auth.users (id, email, aud, role) VALUES
    (u, 'ownership-reintegration-a@test.local', 'authenticated', 'authenticated'),
    (u2, 'ownership-reintegration-b@test.local', 'authenticated', 'authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans
    (user_id, mode, goal_amount, initial_amount, monthly_contribution, goal_years, goal_months)
  VALUES (u, 'casal', 1000000, 0, 0, 21, 252)
  RETURNING id INTO p;
  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Titular', true, 'titular', 'active')
  RETURNING id INTO titular;
  INSERT INTO public.plan_members
    (plan_id, user_id, name, is_primary, role, status)
  VALUES (p, u, 'Parceiro', false, 'parceiro', 'active')
  RETURNING id INTO parceiro;

  INSERT INTO public.expenses
    (plan_id, member_id, ownership_scope, category, expense_type,
     is_essential, amount, is_recurring)
  VALUES (p, parceiro, 'individual', 'moradia', 'fixed', true, 999, true)
  RETURNING id INTO expense_id;
  SELECT amount INTO before_amount FROM public.expenses WHERE id=expense_id;

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', u::text, true);
  ASSERT auth.uid()=u, 'auth.uid do titular não foi configurado para remoção';
  PERFORM public.remove_plan_partner_v1(p);

  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);
  PERFORM set_config('request.jwt.claim.sub', '', true);
  UPDATE public.plan_members
     SET identity_status='verified', cpf_last4='1234'
   WHERE id=parceiro;
  INSERT INTO public.plan_member_private_identity
    (member_id, plan_id, user_id, cpf_hmac, hmac_key_version)
  VALUES (parceiro, p, u, repeat('a', 64), '1');

  ASSERT EXISTS (
    SELECT 1 FROM public.plan_members
     WHERE id=parceiro AND plan_id=p AND user_id=u
       AND status='removed' AND identity_status='verified'
       AND cpf_last4 ~ '^[0-9]{4}$'
  ), 'pré-condição pública da identidade não foi persistida';
  ASSERT EXISTS (
    SELECT 1 FROM public.plan_member_private_identity
     WHERE member_id=parceiro AND plan_id=p AND user_id=u
       AND cpf_hmac ~ '^[a-f0-9]{64}$'
       AND hmac_key_version='1'
  ), 'pré-condição privada da identidade não foi persistida';

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u2::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', u2::text, true);
  ASSERT auth.uid()=u2, 'auth.uid cross-user não foi configurado';
  BEGIN
    PERFORM public.reintegrate_plan_member_v1(p, parceiro);
  EXCEPTION WHEN no_data_found THEN
    blocked := true;
  END;
  ASSERT blocked, 'cross-user deveria falhar';
  ASSERT (SELECT status FROM public.plan_members WHERE id=parceiro)='removed',
    'cross-user alterou status';
  ASSERT (SELECT mode FROM public.plans WHERE id=p)='individual',
    'cross-user alterou mode';
  ASSERT (SELECT amount FROM public.expenses WHERE id=expense_id)=before_amount,
    'cross-user alterou valor';
  ASSERT (SELECT ownership_scope FROM public.expenses WHERE id=expense_id)='individual',
    'cross-user alterou ownership';

  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role', 'authenticated')::text, true);
  PERFORM set_config('request.jwt.claim.sub', u::text, true);
  ASSERT auth.uid()=u, 'auth.uid do proprietário não foi restaurado';
  ASSERT EXISTS (
    SELECT 1 FROM public.plan_members
     WHERE id=parceiro AND status='removed'
       AND identity_status='verified' AND cpf_last4='1234'
  ), 'identidade pública mudou após tentativa cross-user';
  ASSERT EXISTS (
    SELECT 1 FROM public.plan_member_private_identity
     WHERE member_id=parceiro AND plan_id=p AND user_id=u
       AND cpf_hmac ~ '^[a-f0-9]{64}$' AND hmac_key_version='1'
  ), 'identidade privada mudou após tentativa cross-user';

  j := public.reintegrate_plan_member_v1(p, parceiro);
  ASSERT (j->>'member_id')::uuid=parceiro, 'membro reintegrado incorreto';
  ASSERT j->>'mode'='casal', 'mode deveria ser casal';
  ASSERT (SELECT status FROM public.plan_members WHERE id=parceiro)='active',
    'parceiro deveria estar active';
  ASSERT (SELECT mode FROM public.plans WHERE id=p)='casal',
    'plano deveria estar casal';
  ASSERT (SELECT member_id FROM public.expenses WHERE id=expense_id)=parceiro,
    'reintegração alterou owner histórico';
  ASSERT (SELECT ownership_scope FROM public.expenses WHERE id=expense_id)='individual',
    'reintegração alterou scope histórico';
  ASSERT (SELECT amount FROM public.expenses WHERE id=expense_id)=before_amount,
    'reintegração alterou valor financeiro';

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;
  RAISE NOTICE 'plan member reintegration 4.c.1: OK';
END $$;

ROLLBACK;
