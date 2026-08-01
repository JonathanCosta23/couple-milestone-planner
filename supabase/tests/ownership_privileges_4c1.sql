-- Passo 4.c.1 — matriz de privilégios financeiros e participantes
-- Execução: psql -v ON_ERROR_STOP=1 -f supabase/tests/ownership_privileges_4c1.sql

BEGIN;

DO $$
DECLARE
  table_name text;
  privilege_name text;
  rls_enabled boolean;
  public_grants bigint;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['assets','income','expenses','debts'] LOOP
    SELECT c.relrowsecurity INTO rls_enabled
      FROM pg_class c
      JOIN pg_namespace n ON n.oid=c.relnamespace
     WHERE n.nspname='public' AND c.relname=table_name;
    ASSERT rls_enabled, format('RLS precisa estar habilitado em public.%s', table_name);

    FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
      ASSERT has_table_privilege(
        'authenticated', format('public.%I', table_name), privilege_name
      ), format('authenticated precisa de %s em public.%s', privilege_name, table_name);

      ASSERT NOT has_table_privilege(
        'anon', format('public.%I', table_name), privilege_name
      ), format('anon não pode ter %s em public.%s', privilege_name, table_name);
    END LOOP;
  END LOOP;

  -- Participantes são visíveis somente por SELECT sujeito a RLS. Toda escrita
  -- direta permanece bloqueada para o cliente.
  SELECT c.relrowsecurity INTO rls_enabled
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public' AND c.relname='plan_members';
  ASSERT rls_enabled, 'RLS precisa estar habilitado em public.plan_members';
  ASSERT has_table_privilege('authenticated', 'public.plan_members', 'SELECT'),
    'authenticated precisa ler plan_members via RLS';
  FOREACH privilege_name IN ARRAY ARRAY['INSERT','UPDATE','DELETE'] LOOP
    ASSERT NOT has_table_privilege('authenticated', 'public.plan_members', privilege_name),
      format('authenticated não pode ter %s em public.plan_members', privilege_name);
  END LOOP;
  FOREACH privilege_name IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE'] LOOP
    ASSERT NOT has_table_privilege('anon', 'public.plan_members', privilege_name),
      format('anon não pode ter %s em public.plan_members', privilege_name);
  END LOOP;

  ASSERT NOT has_function_privilege(
    'authenticated', 'public.block_writes_to_removed_member()', 'EXECUTE'
  ), 'authenticated não executa diretamente o trigger financeiro';
  ASSERT NOT has_function_privilege(
    'authenticated', 'public.block_writes_to_removed_member_mmt()', 'EXECUTE'
  ), 'authenticated não executa diretamente o trigger mensal';

  SELECT count(*) INTO public_grants
    FROM pg_class c
    JOIN pg_namespace n ON n.oid=c.relnamespace
    CROSS JOIN LATERAL aclexplode(c.relacl) a
   WHERE n.nspname='public'
     AND c.relname IN ('assets','income','expenses','debts','plan_members')
     AND a.grantee=0
     AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE');
  ASSERT public_grants=0,
    'PUBLIC não pode ter SELECT/INSERT/UPDATE/DELETE em financeiro ou participantes';

  RAISE NOTICE 'ownership financial/member privilege matrix: OK';
END $$;

ROLLBACK;
