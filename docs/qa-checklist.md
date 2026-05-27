# Checklist de regressão manual — Plano do Milhão

Use este roteiro antes de cada release (beta profissional). Cada item deve ser
validado manualmente em ambiente real (Supabase normalizado + cache local).
Marque ✅ / ❌ no PR ou na issue de release.

> Comandos oficiais de CI: `npm ci && npm run lint && npm test && npm run build`.

## 1. Primeiro acesso
- [ ] Abrir o app deslogado redireciona para `AuthPage`.
- [ ] Cadastro novo por e-mail funciona (recebe confirmação se exigida).
- [ ] Login com Google funciona.
- [ ] Tela de "Resetar senha" volta para o login após sucesso.

## 2. Aceite de termos (ConsentGate)
- [ ] Após o primeiro login o `ConsentGate` aparece bloqueando o app.
- [ ] Sem aceitar **Termos** e **Aviso educacional**, o botão "Aceitar e continuar" fica desabilitado.
- [ ] Clicar em "Sair da conta" desloga e volta para `AuthPage`.
- [ ] Após aceitar, o registro aparece em `legal_consents` com `consent_type` + `version`.
- [ ] Subindo `CONSENT_VERSIONS.terms` o gate volta a aparecer na próxima sessão.

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