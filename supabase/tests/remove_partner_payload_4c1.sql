-- Contrato focalizado de remove_plan_partner_v1 após o ownership 4.c.1.
-- Execução: psql -v ON_ERROR_STOP=1 -f supabase/tests/remove_partner_payload_4c1.sql

BEGIN;

DO $$
DECLARE
  u uuid := '00000000-0000-0000-0000-0000004c1901';
  p uuid;
  titular uuid;
  parceiro uuid;
  j jsonb;
  returned_id uuid;
BEGIN
  PERFORM set_config('role', 'postgres', true);
  PERFORM set_config('request.jwt.claims', '', true);

  INSERT INTO auth.users (id, email, aud, role)
  VALUES (u, 'ownership-remove-payload@test.local', 'authenticated', 'authenticated')
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

  SET CONSTRAINTS ALL IMMEDIATE;
  SET CONSTRAINTS ALL DEFERRED;

  PERFORM set_config('role', 'authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', u::text, 'role', 'authenticated')::text, true);

  j := public.remove_plan_partner_v1(p);
  returned_id := NULLIF(j->>'removed_partner_id', '')::uuid;

  RAISE NOTICE 'remove_plan_partner_v1 payload=% expected_partner=% returned_partner=%',
    j, parceiro, returned_id;

  IF returned_id IS DISTINCT FROM parceiro THEN
    RAISE EXCEPTION 'remove_partner_payload_mismatch payload=% expected=% returned=%',
      j, parceiro, returned_id;
  END IF;
  IF j->>'plan_id' IS DISTINCT FROM p::text OR j->>'mode' IS DISTINCT FROM 'individual' THEN
    RAISE EXCEPTION 'remove_partner_payload_contract_invalid payload=%', j;
  END IF;
  IF (SELECT status FROM public.plan_members WHERE id=parceiro) <> 'removed' THEN
    RAISE EXCEPTION 'remove_partner_state_invalid payload=%', j;
  END IF;

  RAISE NOTICE 'remove partner payload 4.c.1: OK';
END $$;

ROLLBACK;
