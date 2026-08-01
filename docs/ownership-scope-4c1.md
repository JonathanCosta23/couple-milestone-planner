# Ownership financeiro canônico — Passo 4.c.1

## Escopo

As tabelas `assets`, `income`, `expenses` e `debts` possuem dois campos de
propriedade que devem ser interpretados em conjunto:

- `member_id`
- `ownership_scope`

Valores de `ownership_scope`:

- `individual`: pertence a um participante identificado e exige `member_id`;
- `shared`: pertence ao plano e exige `member_id = null`;
- `needs_review`: origem ambígua ou legada e exige `member_id = null`.

`member_id = null` isoladamente não significa compartilhado.

A interface ainda não cria `shared`. O valor existe no contrato para a fase de
resolução explícita, mas o 4.c.1 produz somente `individual` e `needs_review`.

## Backfill

A migration `20260801215000_4c1_ownership_scope.sql` executa preflight antes de
alterar qualquer propriedade.

Regras:

1. Registro com `member_id` válido permanece ligado ao mesmo membro e recebe
   `individual`, inclusive quando o membro está `removed`.
2. Registro sem membro em plano individual recebe o único titular ativo e
   `individual`.
3. Registro sem membro em plano casal permanece sem membro e recebe
   `needs_review`.
4. Nenhum registro é transformado automaticamente em `shared`.
5. Corrupção cross-plan, cross-user ou membro inexistente aborta a migration.
6. Plano estruturalmente inconsistente também aborta a migration.

Nenhum registro financeiro é excluído e nenhum valor monetário é alterado.

## Novas escritas

Creates financeiros normais precisam enviar explicitamente:

```json
{
  "plan_id": "uuid",
  "member_id": "uuid",
  "ownership_scope": "individual"
}
```

O cliente não envia `user_id`. O trigger `enforce_financial_ownership` deriva
o usuário do plano e valida:

- autenticação;
- ownership do plano;
- membro existente;
- membro do mesmo plano e usuário;
- membro ativo quando a propriedade é criada ou alterada;
- coerência entre `ownership_scope` e `member_id`.

Updates de valor, categoria, vencimento e demais campos financeiros omitem os
dois campos de ownership e preservam o vínculo existente. Isso permite manter
histórico de participantes removidos sem permitir novas movimentações para eles.

## Blob legado

A migração assistida cobre investimentos, renda, gastos e dívidas.

- Participante inequivocamente identificado: `individual`.
- Plano com um único membro ativo: `individual`.
- Ambiguidade em casal: `needs_review`.

Nunca há fallback automático para titular, parceiro ou `shared`.

O resumo da migração informa:

- registros criados por categoria;
- `individualCreated`;
- `needsReviewCreated`;
- `ignored`;
- erros amigáveis.

## Fila offline

Creates de `asset`, `income`, `expense` e `debt` só entram em replay quando
possuem:

- `plan_id`;
- `member_id`;
- `ownership_scope = individual`.

Writes antigos ou incompletos não recebem default e devem ir para dead-letter.
Updates comuns removem `user_id` e `plan_id` do payload e preservam ownership
quando o usuário não solicitou troca de responsável.

## Auditoria

O backfill e os writers registram somente metadados estruturais:

- entidade;
- `record_id`;
- scope anterior e novo;
- presença ou ausência de `member_id`;
- origem (`backfill` ou `writer`).

Não registrar:

- valores financeiros;
- nomes;
- CPF ou `cpf_last4`;
- HMAC;
- conteúdo integral do registro.

## Resumo de revisão

A RPC `get_plan_ownership_review_summary_v1(plan_id)` retorna somente:

- `plan_id`;
- contagens `needs_review` por tabela;
- FGC sem holder;
- presença de blob legado;
- `total_needs_review`.

Não retorna nomes, valores, identidade ou conteúdo de blob.

## Validação de staging

Ordem obrigatória:

1. aplicar a migration em cópia/staging;
2. registrar todos os `NOTICE` do preflight;
3. confirmar `shared = 0` após backfill;
4. executar:

```bash
psql -v ON_ERROR_STOP=1 -f supabase/tests/ownership_scope_4c1.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/plan_member_lifecycle.sql
psql -v ON_ERROR_STOP=1 -f supabase/tests/plan_privileges_hardening.sql
```

5. executar typecheck, lint, Vitest, build, CI e os 11 testes Deno de
   `member-identity`;
6. somente depois retirar o PR do modo draft.
