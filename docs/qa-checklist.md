# Checklist de regressão manual — Plano do Milhão

Use este roteiro antes de cada release (beta profissional). Cada item deve ser
validado manualmente em ambiente real (Supabase normalizado + cache local).
Marque ✅ / ❌ no PR ou na issue de release.

> Comandos oficiais de CI: `npm ci && npm run lint && npm test && npm run build`.

## 0. Cockpit mensal premium
- [ ] Card "Resumo do mês" mostra mês corrente, planejado, realizado, faltam e % de execução.
- [ ] Em modo casal, aparece progresso por participante usando nomes reais.
- [ ] Status muda corretamente entre `Sem meta`, `Aguardando aporte`, `Em andamento` e `Mês no alvo`.
- [ ] Score de Disciplina (0..100) aparece com tooltip explicando o cálculo e **não** promete retorno financeiro.
- [ ] Score sobe ao registrar aporte do mês corrente e cair se o histórico estiver vazio.
- [ ] "Próxima Melhor Ação" muda conforme o contexto: pendência do mês → registrar aporte; mês fechado → revisar próximo mês; patrimônio antigo → atualizar patrimônio; premissas faltando → revisar projeção.
- [ ] Card "Marcos patrimoniais" mostra marco atual, próximo marco, % da jornada e ritmo, sem emojis.
- [ ] Após registrar um aporte via QuickDeposit e refresh, valores do resumo persistem (RPC + normalizado).

## 1. Primeiro acesso
- [ ] Abrir o app deslogado redireciona para `AuthPage`.
- [ ] Cadastro novo por e-mail funciona (recebe confirmação se exigida).
- [ ] Login com Google funciona.
- [ ] Tela de "Resetar senha" volta para o login após sucesso.

## 2. Aceite de termos (ConsentGate)
- [ ] Após o primeiro login o `ConsentGate` aparece bloqueando o app.
- [ ] Sem aceitar **Termos / Privacidade** e **Aviso educacional**, o botão "Aceitar e continuar" fica desabilitado.
- [ ] Clicar em "Sair da conta" desloga e volta para `AuthPage`.
- [ ] Após aceitar, `legal_consents` registra três linhas: `terms`, `privacy` e `educational_disclaimer` na versão vigente.
- [ ] Subindo `CONSENT_VERSIONS.terms` o gate volta a aparecer na próxima sessão.
- [ ] Forçar erro de persistência (ex.: RLS) mostra mensagem genérica ("Não foi possível registrar o aceite agora…") — nunca o texto cru do Supabase.

## 2.1 Projeção e premissas (Projection Realistic)
- [ ] Card "Premissas usadas no cálculo" mostra retorno, inflação, IR e CDB exatamente iguais aos do `core.assumptions` aplicados ao gráfico.
- [ ] Alterar `assumption_inflation` no plano muda a curva Real e o cenário "Inflação alta".
- [ ] Linha de meta no gráfico (`ReferenceLine`) está posicionada em `config.targetAmount` — não em R$ 1M fixo.
- [ ] Texto educacional referencia a meta do plano (ex.: "R$ 500 mil"), nunca "R$ 1 milhão" hardcoded quando a meta é outra.
- [ ] Disclaimer educacional aparece no topo da projeção.

## 2.2 Mensagens de erro seguras
- [ ] Reset com falha de RPC mostra mensagem amigável (sem expor `error.message` cru do Postgres).
- [ ] `useMonthlyTrackingWriter.upsertMonth` em falha exibe mensagem genérica/acionável e mantém o log técnico apenas no console (`logger`).
- [ ] AuthPage não exibe `error.message` cru em fluxo de signup desconhecido.

## 3. Criação de plano individual
- [ ] Wizard pede nome, idade, objetivo e aporte.
- [ ] `plans.mode = 'individual'`, `plan_members` tem exatamente 1 ativo com `is_primary = true`.
- [ ] Home usa linguagem singular (sem "casal", sem "parceiro").
- [ ] Histórico mostra apenas o titular (nome real, nunca "Pessoa 1").

## 4. Criação de plano casal
- [ ] Wizard pede nomes/idades dos dois participantes.
- [ ] `plans.mode = 'casal'`, `plan_members` tem 2 ativos (`titular` + `parceiro`).
- [ ] Tentar salvar casal sem parceiro retorna erro claro vindo da RPC v2.
- [ ] Home mostra cockpit com progresso por membro.

## 5. Alteração de casal para individual
- [ ] Trocar para individual mantém o titular ativo e marca o parceiro como `is_active = false` (histórico preservado).
- [ ] Linguagem da UI volta para singular sem reload manual.
- [ ] Voltar para casal reativa o parceiro existente em vez de criar duplicado.

## 6. Registro de aporte (QuickDeposit)
- [ ] QuickDeposit grava via `trackingActions.updateMonth` e RPC `upsert_month_with_members`.
- [ ] Valor aparece em `monthly_member_tracking` com `plan_member_id` correto.
- [ ] Home atualiza "aporte realizado" / "falta aportar" imediatamente.
- [ ] Em modo casal, registro por membro respeita o titular selecionado.

## 7. Marcação de mês como concluído
- [ ] Toggle "concluído" persiste em `monthly_tracking.status = 'completed'`.
- [ ] Status reflete na timeline e no cockpit da Home.
- [ ] Desmarcar volta para `partial` ou `pending` conforme o realizado.

## 8. Refresh após aporte
- [ ] F5 mantém o aporte recém-gravado.
- [ ] Nenhum dado do `user_financial_data` (blob legado) sobrescreve o mês normalizado.

## 9. Refresh após concluir mês
- [ ] F5 mantém o status `completed`.
- [ ] Streak / cockpit refletem o estado pós-refresh.

## 10. Reset completo
- [ ] Diálogo exige digitar `RESETAR` (case-insensitive).
- [ ] Reset apaga `plans`, `plan_members`, `assets`, `incomes`, `expenses`, `debts`, `monthly_tracking`, `monthly_member_tracking`, `milestones`, `insights_log`, `education_progress` e zera `user_financial_data`.
- [ ] localStorage do produto (atual, legado, backups e `milestones-celebrated`) fica limpo.
- [ ] Offline queue e dead-letter ficam vazias.
- [ ] Toast de sucesso aparece; se a auditoria crítica falhar, aparece o toast `warning` "Plano resetado, mas a auditoria falhou".
- [ ] Página recarrega automaticamente e o usuário continua autenticado.

## 11. Login novamente após reset
- [ ] Re-login não ressuscita dados antigos (nenhum cache local volta).
- [ ] Wizard inicial aparece novamente.
- [ ] `ConsentGate` continua respeitando o último aceite (não volta sem motivo).

## 12. Modo offline
- [ ] Cortar a rede mostra `OfflineBanner`.
- [ ] Edições continuam funcionando localmente.
- [ ] Operações ficam enfileiradas na `offlineQueue` (IndexedDB).

## 13. Replay após voltar online
- [ ] Religar a rede dispara replay automático.
- [ ] Updates parciais **não** apagam `member_id` existente na nuvem (verificar em `assets`, `incomes`, `expenses`, `debts`).
- [ ] Merge `create + update` preserva o `member_id` original.
- [ ] Itens replayados saem da fila e aparecem no Supabase.

## 14. Dead-letter de payload inválido
- [ ] Criar asset offline sem `plan_id` ou sem `member_id` válido vai para dead-letter (não insere no banco).
- [ ] Toast de erro descreve o motivo ("missing titular", etc.).
- [ ] Itens da dead-letter sobrevivem ao reload e podem ser inspecionados.

## 15. Migração de blob legado
- [ ] Usuário com `user_financial_data` populado e tabelas normalizadas **vazias** vê o `BlobMigrationDialog` uma única vez.
- [ ] Aceitar migra os dados para `plans` / `plan_members` / `assets` / etc.
- [ ] Após a migração, `plano-do-milhao-migration-done:<uid>` é marcado e o diálogo não volta.
- [ ] Usuário com tabelas normalizadas já populadas **não** vê o diálogo (normalizado vence sobre o blob).

## Critérios de aceite finais
- `npm ci` passa em instalação limpa.
- `npm run lint` passa com 0 erros.
- `npm test` passa (Vitest one-shot).
- `npm run build` passa.
- Todas as 15 seções acima validadas no ambiente alvo.

## 16. Sprint P0 — Hardening de execução mensal
- [ ] **QuickDeposit casal com dois aportes**: abrir QuickDeposit em modo casal,
      preencher valor para os dois titulares, salvar uma única vez. Verificar
      no DevTools que **apenas uma** request `rpc/upsert_month_with_members`
      sai e que ambos os `plan_member_id` aparecem no payload.
- [ ] **Refresh após salvar QuickDeposit**: depois do salvamento bem-sucedido,
      recarregar a página. Os dois aportes devem persistir na aba Histórico →
      Meses, sem perda do primeiro membro.
- [ ] **Falha de persistência**: simular falha (devtools offline + sem rede ⇒
      enfileira; ou rede instável ⇒ toast de erro). Modal NÃO deve fechar em
      caso de erro e o toast deve ser genérico ("Não conseguimos salvar").
- [ ] **Próxima Melhor Ação · Revisar próximo mês**: com mês corrente fechado e
      patrimônio recente, o CTA "Revisar próximo mês" deve abrir a aba
      Histórico → Meses (tracker), **não** voltar para Home.
- [ ] **Milestone respeita meta do plano**: definir `targetAmount` ≠ R$ 1M
      (ex.: R$ 300k). O cartão "Marcos patrimoniais" deve mostrar a meta como
      último marco e "Jornada" calculada sobre `targetAmount`, sem promessa
      de retorno.
- [ ] **MonthsToNext não usa monthsToTargetNominal**: quando o próximo marco
      é R$ 100k mas a meta é R$ 1M, o prazo exibido deve corresponder ao
      cruzamento dos R$ 100k (ou "estimativa indisponível"), nunca o prazo
      até a meta final.