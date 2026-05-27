# Plano do Milhão

Aplicativo de planejamento financeiro pessoal e patrimonial para brasileiros — individual ou casal — focado em construir patrimônio de forma responsável, segura e compreensível. O produto combina planejamento, educação financeira, comportamento, acompanhamento mensal, arquitetura patrimonial e alertas de risco. Não é simulador de juros compostos nem recomendação personalizada de investimento.

## Princípios

1. Fonte única de verdade: Supabase normalizado (plans, plan_members, assets, incomes, expenses, debts, monthly_tracking, monthly_member_tracking, milestones, insights_log).
2. Login obrigatório como porta de entrada. Suporte a e-mail + Google.
3. Modo do plano canônico: `individual` ou `casal`, persistido em `plans.mode`.
4. Nomes dinâmicos vindos de `plan_members.name`. Nada hardcoded.
5. Linguagem clara, humana, sem prometer retorno. Disclaimers obrigatórios.
6. Milestones disparam apenas por patrimônio realizado (`milestones.origin = 'realized'`).

## Stack

- Vite 5 + React 18 + TypeScript 5
- Tailwind CSS v3 + shadcn-ui + Radix
- React Router, TanStack Query, React Hook Form + Zod
- Recharts para projeções
- Supabase (auth, Postgres, edge functions) provisionado via Lovable Cloud
- Vitest + Testing Library para testes

## Scripts

```sh
npm install          # instala dependências
npm run dev          # dev server com HMR (porta 8080)
npm run build        # build de produção
npm run preview      # serve o build localmente
npm run lint         # ESLint (zero erros é critério de aceite)
npx vitest run       # roda a suíte de testes
```

## Arquitetura de dados

Fonte de verdade desejada: **tabelas Supabase normalizadas**. CRUD acontece via writers dedicados em `src/hooks/`:

- `usePlanWriter` → `plans` + `plan_members`
- `useAssetWriter` → `assets`
- `useIncomeWriter` → `incomes`
- `useExpenseWriter` → `expenses`
- `useDebtWriter` → `debts`
- `useMonthlyTrackingWriter` → `monthly_tracking` (+ `monthly_member_tracking` em curso)

Camada derivada única em `src/hooks/useFinancialCore.ts` calcula reserva, taxa de poupança, score de saúde, fase da jornada, projeções nominal/líquido/real e próximo melhor passo. Todas as telas leem dessa camada.

**localStorage e blob `user_financial_data`** existem apenas como **compatibilidade de migração** e cache offline. Não são fonte de verdade; `useCloudSync` os mantém em paralelo até a Fase 2.D consolidar os writers normalizados. `dataMigrationService` e `blobMigrationService` migram dados antigos para o schema normalizado no primeiro login.

### Fonte de verdade (Fase 2.E)

- **Supabase normalizado é a fonte oficial de verdade** para dados financeiros. Todo CRUD novo passa pelos writers (`usePlanWriter`, `useAssetWriter`, `useIncomeWriter`, `useExpenseWriter`, `useDebtWriter`, `useMonthlyTrackingWriter`).
- **`user_financial_data` (blob JSONB) é legado controlado**. Não há mais autosave contínuo: o blob só é escrito em pontos explícitos de migração (handleUseLocal do diálogo de conflito e primeiro upload de cache local quando o usuário ainda não tem dados na nuvem) e zerado pelo `resetService`.
- **localStorage é cache e preferência**. Continua guardando `plano-do-milhao-v6` / `plano-do-milhao-app-v7` para uso offline e migração, mas nunca sobrescreve dados normalizados carregados do Supabase no login.
- Ao logar, a hidratação das tabelas normalizadas vence sobre o cache local. Se as tabelas estiverem vazias e o blob legado tiver dados, o `BlobMigrationDialog` oferece a migração uma única vez.
- O flag por usuário `plano-do-milhao-migration-done:<uid>` marca a migração como resolvida e impede que o mesmo blob seja reimportado em sessões futuras. O `resetService` limpa esse flag junto com o resto do cache do produto.

## Fluxo básico do usuário

1. Login ou cadastro (e-mail, Google).
2. Migração silenciosa de dados locais legados, se houver.
3. Wizard de perfil financeiro (modo, participantes, objetivo, aportes).
4. Home como central de decisão: rotina do mês, CTA "Registrar aporte", gargalo principal e próximo passo.
5. Plano (Aportes, Estrutura, Simular, Projeção, Saúde, Jornada, Hábitos, Patrimônio, Concentração, Governança).
6. Histórico (Meses, Gastos, Renda, Dívidas) e Perfil (Aprender, Glossário, Radar, Investir, Exportar, Dados).

## Operações destrutivas

"Resetar plano" exige confirmação explícita (`AlertDialog` + digitar `RESETAR`) e usa `resetService` + RPC `reset_user_plan_data` para limpar Supabase, offline queue (`offlineQueue` + dead-letter) e todas as chaves de `localStorage` (atuais, legadas e backups). Autenticação é preservada.

## Testes

Vitest + Testing Library cobrem os fluxos críticos de dados. Rodar tudo:

```sh
npx vitest run        # CI / one-shot
npx vitest            # modo watch durante desenvolvimento
npx vitest run path/to/file.test.ts  # arquivo específico
```

Fluxos cobertos hoje (não removíveis sem substituição):

- **Writers e `member_id`** (`src/hooks/__tests__/writerPayload.memberId.test.ts`): updates parciais de asset/income/expense/debt não apagam `member_id` existente.
- **RPCs transacionais** (`src/hooks/__tests__/transactionalRpcs.test.ts`, `planWriterModeSwitch.test.ts`): `upsert_plan_with_members` e `upsert_month_with_members` são chamadas com o payload correto; alternar individual ↔ casal preserva titular e desativa parceiro via RPC (não apaga histórico).
- **Reset destrutivo** (`src/lib/services/__tests__/resetService.test.ts`): RPC `reset_user_plan_data`, fila offline e todas as chaves de `localStorage` do produto (incluindo milestones celebrados) são limpas; chaves de outros sistemas são preservadas; idempotente em re-execução; falha de RPC não bloqueia limpeza local.
- **Migração blob → tabelas** (`src/lib/services/__tests__/blobMigrationService.test.ts`): blob legado só migra quando as tabelas normalizadas estão vazias para o plano (dados normalizados vencem); erros são propagados por categoria sem abortar as demais.
- **Ciclo de vida de dados** (`src/hooks/__tests__/useDataLifecycle.test.tsx`): boot sem usuário não toca a nuvem; auto-save não dispara antes da hidratação (anti race).
- **Premissas financeiras** (`src/lib/__tests__/financialAssumptions.test.ts`, `financialEngine.test.ts`): defaults centralizados, override por plano, override explícito de UI, projeção nominal/líquido/real coerente.
- **Serviços derivados** (`src/lib/services/__tests__/`): `projectionService` (nominal ≥ líquido ≥ real, renda passiva pela regra dos 4%), `milestoneService` (celebra só marcos realizados, sem repetição), `allocationService` (concentração + cobertura FGC/soberano), `auditService` (audit_log + product_events em paralelo, fail-soft).

## Mais informações

Este projeto é gerenciado pela [Lovable](https://lovable.dev). Edits feitos no Lovable são commitados automaticamente. Para deploy: abrir o projeto e usar Share → Publish. Domínio customizado em Project → Settings → Domains.
