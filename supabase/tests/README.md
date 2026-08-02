# Testes SQL reproduzíveis

Testes em SQL puro para invariantes que dependem do banco (portão editorial,
RLS de progresso educacional e RLS de ações). Cada arquivo abre uma transação,
define claims, executa os cenários e dá `ROLLBACK` — nenhum registro fica
persistido.

Executar contra o Postgres do projeto (usa `psql`):

```
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/editorial_publication_gate.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/learning_progress_rls.sql
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/user_action_state_rls.sql
```

Cada teste usa `DO $$ ... $$` com `RAISE EXCEPTION` para falhar de forma
determinística; sucesso é ausência de erro. Nenhum teste deve ser executado
em produção — rode em ambiente de staging/local ou dentro de uma janela de
manutenção.