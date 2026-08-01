-- =====================================================================
-- Passo 4.c.1 — grants explícitos das tabelas financeiras
--
-- RLS define quais linhas podem ser acessadas. Os grants abaixo apenas
-- habilitam as operações necessárias para os writers autenticados e removem
-- qualquer dependência de default privileges específicos do ambiente.
-- =====================================================================

ALTER TABLE public.assets   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.income   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts    ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public.assets   FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON TABLE public.income   FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON TABLE public.expenses FROM PUBLIC, anon;
REVOKE ALL PRIVILEGES ON TABLE public.debts    FROM PUBLIC, anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assets   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.income   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.expenses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.debts    TO authenticated;

GRANT ALL PRIVILEGES ON TABLE public.assets   TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.income   TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.expenses TO service_role;
GRANT ALL PRIVILEGES ON TABLE public.debts    TO service_role;

COMMENT ON TABLE public.assets IS
  'Dados patrimoniais protegidos por RLS; ownership validado server-side.';
COMMENT ON TABLE public.income IS
  'Rendas protegidas por RLS; ownership validado server-side.';
COMMENT ON TABLE public.expenses IS
  'Gastos protegidos por RLS; ownership validado server-side.';
COMMENT ON TABLE public.debts IS
  'Dívidas protegidas por RLS; ownership validado server-side.';
