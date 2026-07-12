-- RLS de user_action_state e user_action_events.
-- Valida ownership por plano, membership ativa, append-only e plan_id NOT NULL.

BEGIN;

DO $$
DECLARE
  owner_id uuid := '00000000-0000-0000-0000-000000000b01';
  member_id uuid := '00000000-0000-0000-0000-000000000b02';
  stranger_id uuid := '00000000-0000-0000-0000-000000000b03';
  inactive_id uuid := '00000000-0000-0000-0000-000000000b04';
  plan_id uuid;
BEGIN
  INSERT INTO auth.users (id, email, aud, role) VALUES
    (owner_id,'o@test.local','authenticated','authenticated'),
    (member_id,'m@test.local','authenticated','authenticated'),
    (stranger_id,'s@test.local','authenticated','authenticated'),
    (inactive_id,'i@test.local','authenticated','authenticated')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.plans (user_id, mode, goal_amount, initial_amount,
                            monthly_contribution, goal_years, goal_months)
  VALUES (owner_id,'individual',1000000,0,0,21,252)
  RETURNING id INTO plan_id;

  INSERT INTO public.plan_members (plan_id, user_id, name, is_primary, role, is_active)
  VALUES (plan_id, member_id,'Membro Ativo', false,'parceiro', true),
         (plan_id, inactive_id,'Membro Inativo', false,'parceiro', false);

  -- Owner insere estado
  PERFORM set_config('role','authenticated', true);
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', owner_id::text, 'role','authenticated')::text, true);
  INSERT INTO public.user_action_state (user_id, plan_id, action_key, action_category, status)
  VALUES (owner_id, plan_id, 'debt:review:1','debt','active');

  -- Membro ativo insere estado do próprio user_id no mesmo plano
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', member_id::text, 'role','authenticated')::text, true);
  INSERT INTO public.user_action_state (user_id, plan_id, action_key, action_category, status)
  VALUES (member_id, plan_id, 'reserve:gap:1','emergency_fund','active');

  -- Stranger não insere
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', stranger_id::text, 'role','authenticated')::text, true);
  BEGIN
    INSERT INTO public.user_action_state (user_id, plan_id, action_key, action_category, status)
    VALUES (stranger_id, plan_id, 'x','budget','active');
    RAISE EXCEPTION 'RLS falhou: stranger inseriu';
  EXCEPTION WHEN insufficient_privilege OR others THEN END;

  -- Membro inativo não insere
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', inactive_id::text, 'role','authenticated')::text, true);
  BEGIN
    INSERT INTO public.user_action_state (user_id, plan_id, action_key, action_category, status)
    VALUES (inactive_id, plan_id, 'y','budget','active');
    RAISE EXCEPTION 'RLS falhou: membro inativo inseriu';
  EXCEPTION WHEN insufficient_privilege OR others THEN END;

  -- Isolamento de leitura entre usuários
  IF EXISTS (SELECT 1 FROM public.user_action_state WHERE user_id = owner_id) THEN
    RAISE EXCEPTION 'RLS falhou: outro user leu estado do owner';
  END IF;

  -- plan_id NULL é rejeitado
  PERFORM set_config('request.jwt.claims',
    json_build_object('sub', owner_id::text, 'role','authenticated')::text, true);
  BEGIN
    INSERT INTO public.user_action_state (user_id, plan_id, action_key, action_category, status)
    VALUES (owner_id, NULL, 'z','budget','active');
    RAISE EXCEPTION 'NOT NULL falhou: aceitou plan_id nulo';
  EXCEPTION WHEN not_null_violation THEN END;

  -- Upsert idempotente (mesma chave não duplica)
  INSERT INTO public.user_action_state (user_id, plan_id, action_key, action_category, status)
  VALUES (owner_id, plan_id, 'debt:review:1','debt','snoozed')
  ON CONFLICT (user_id, plan_id, action_key) DO UPDATE SET status = EXCLUDED.status;
  IF (SELECT count(*) FROM public.user_action_state
       WHERE user_id = owner_id AND action_key = 'debt:review:1') <> 1 THEN
    RAISE EXCEPTION 'upsert duplicou linha';
  END IF;

  -- Eventos: insert ok, update/delete bloqueados por policy
  INSERT INTO public.user_action_events (user_id, plan_id, action_key, action_category, event_type)
  VALUES (owner_id, plan_id, 'debt:review:1','debt','action_shown');

  BEGIN
    UPDATE public.user_action_events SET event_type = 'action_opened'
     WHERE user_id = owner_id;
    RAISE EXCEPTION 'append-only falhou: update aceito';
  EXCEPTION WHEN insufficient_privilege OR others THEN END;

  BEGIN
    DELETE FROM public.user_action_events WHERE user_id = owner_id;
    RAISE EXCEPTION 'append-only falhou: delete aceito';
  EXCEPTION WHEN insufficient_privilege OR others THEN END;
END $$;

ROLLBACK;