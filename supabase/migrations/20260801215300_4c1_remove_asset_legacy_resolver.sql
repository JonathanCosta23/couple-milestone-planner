-- =====================================================================
-- Passo 4.c.1 — remove o resolver legado exclusivo de assets
--
-- `validate_asset_member_link` inferia automaticamente o titular em planos
-- individuais e recusava member_id nulo em qualquer cenário. O contrato
-- canônico substitui essa lógica por `enforce_financial_ownership`, que aceita
-- `needs_review` explícito e nunca infere shared/titular silenciosamente.
-- =====================================================================

DROP TRIGGER IF EXISTS validate_asset_member_link_on_assets ON public.assets;
DROP TRIGGER IF EXISTS trg_assets_validate_member ON public.assets;
DROP FUNCTION IF EXISTS public.validate_asset_member_link();

DO $$
DECLARE
  v_legacy_triggers bigint;
  v_legacy_functions bigint;
BEGIN
  SELECT count(*) INTO v_legacy_triggers
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_class c ON c.oid=t.tgrelid
    JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname='public'
     AND c.relname='assets'
     AND NOT t.tgisinternal
     AND t.tgname IN ('validate_asset_member_link_on_assets','trg_assets_validate_member');

  SELECT count(*) INTO v_legacy_functions
    FROM pg_catalog.pg_proc p
    JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
   WHERE n.nspname='public'
     AND p.proname IN ('validate_asset_member_link','validate_flow_member_link');

  IF v_legacy_triggers<>0 OR v_legacy_functions<>0 THEN
    RAISE EXCEPTION 'ownership_legacy_resolver_remains: triggers=% functions=%',
      v_legacy_triggers, v_legacy_functions;
  END IF;
  RAISE NOTICE 'ownership legacy asset resolver removed: OK';
END $$;
