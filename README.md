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

## Fluxo básico do usuário

1. Login ou cadastro (e-mail, Google).
2. Migração silenciosa de dados locais legados, se houver.
3. Wizard de perfil financeiro (modo, participantes, objetivo, aportes).
4. Home como central de decisão: rotina do mês, CTA "Registrar aporte", gargalo principal e próximo passo.
5. Plano (Aportes, Estrutura, Simular, Projeção, Saúde, Jornada, Hábitos, Patrimônio, Concentração, Governança).
6. Histórico (Meses, Gastos, Renda, Dívidas) e Perfil (Aprender, Glossário, Radar, Investir, Exportar, Dados).

## Operações destrutivas

"Resetar plano" exige confirmação explícita (`AlertDialog` + digitar `RESETAR`) e usa `resetService` + RPC `reset_user_plan_data` para limpar Supabase, offline queue (`offlineQueue` + dead-letter) e todas as chaves de `localStorage` (atuais, legadas e backups). Autenticação é preservada.

## Mais informações

Este projeto é gerenciado pela [Lovable](https://lovable.dev). Edits feitos no Lovable são commitados automaticamente. Para deploy: abrir o projeto e usar Share → Publish. Domínio customizado em Project → Settings → Domains.
