-- =====================================================================
-- Passo 4.c.1 — fronteira read-only de plan_members e triggers internos
-- =====================================================================

-- O frontend precisa ler participantes do próprio plano. Toda escrita direta
-- permanece revogada e passa exclusivamente pelas RPCs de domínio.
ALTER TABLE public.plan_members ENABLE ROW LEVEL SECURITY;
REVOKE ALL PRIVILEGES ON TABLE public.plan_members FROM PUBLIC, anon;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.plan_members FROM authenticated;
GRANT SELECT ON TABLE public.plan_members TO authenticated;
GRANT ALL PRIVILEGES ON TABLE public.plan_members TO service_role;

-- Os triggers de integridade não podem depender do SELECT concedido ao cliente.
-- Executam com privilégios internos, search_path fechado e sem chamada direta.
CREATE OR REPLACE FUNCTION public.block_writes_to_removed_member()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  IF NEW.member_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pm.status INTO v_status
    FROM public.plan_members pm
   WHERE pm.id = NEW.member_id
   LIMIT 1;

  IF v_status = 'removed' THEN
    RAISE EXCEPTION 'member_not_active'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;

CREATE OR REPLACE FUNCTION public.block_writes_to_removed_member_mmt()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'pg_catalog', 'public'
AS $function$
DECLARE
  v_status text;
BEGIN
  IF NEW.plan_member_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT pm.status INTO v_status
    FROM public.plan_members pm
   WHERE pm.id = NEW.plan_member_id
   LIMIT 1;

  IF v_status = 'removed' THEN
    RAISE EXCEPTION 'member_not_active'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END
$function$;

REVOKE ALL ON FUNCTION public.block_writes_to_removed_member()
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.block_writes_to_removed_member_mmt()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.block_writes_to_removed_member()
  TO service_role;
GRANT EXECUTE ON FUNCTION public.block_writes_to_removed_member_mmt()
  TO service_role;
