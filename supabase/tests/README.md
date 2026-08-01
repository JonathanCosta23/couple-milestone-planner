# Testes SQL reproduzíveis

Testes em SQL puro para invariantes que dependem do banco (portão editorial,
RLS de progresso educacional e RLS de ações). Cada arquivo abre uma transação,
define claims, executa os cenários e dá `ROLLBACK` — nenhum registro fica
persistido.

Executar cada arquivo **inteiro** (do `BEGIN` ao `ROLLBACK`), nunca blocos
isolados, com papel administrativo (`postgres`/`service_role`) — os testes
escrevem em `auth.users` e usam `set_config('role', ...)`:

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/editorial_publication_gate.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/learning_progress_rls.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/user_action_state_rls.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/plan_privileges_hardening.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/plan_member_lifecycle.sql
```

Blocos por arquivo: `plan_privileges_hardening.sql` = 6 blocos `DO`;
`plan_member_lifecycle.sql` = 11 blocos `DO` (L1–L11), cada um com um
`NOTICE` final de OK.

`plan_privileges_hardening.sql` e `plan_member_lifecycle.sql` precisam ser
executados por um papel administrativo (postgres/supabase_admin), pois criam
usuários em `auth.users` e alternam para `authenticated` via `set_config`.
Executar sempre o arquivo inteiro, do `BEGIN` ao `ROLLBACK` — nunca blocos
isolados.

Cada teste usa `DO $$ ... $$` com `RAISE EXCEPTION` para falhar de forma
determinística; sucesso é ausência de erro. Nenhum teste deve ser executado
em produção — rode em ambiente de staging/local ou dentro de uma janela de
manutenção.