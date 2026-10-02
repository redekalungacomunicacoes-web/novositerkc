# Entregas colaborativas RKC: implementação e validação

## Comportamento

Tarefas continuam independentes ou vinculadas a `projetos`. Descrição reúne objetivo/contexto; entrega esperada e critério de conclusão ficam nos detalhes. `task_assignees` armazena colaboradores, mantendo um responsável principal. Bloqueio não altera status. Não existem subtarefas recursivas, pesos ou percentual manual no novo fluxo.

Checklist permite título, observação, ordem por botões, responsável/prazo opcionais, conclusão atribuída pelo servidor e vínculos de anexos. Se um responsável de etapa é escolhido, ele também é incluído como colaborador. Os seis modelos podem ser editados antes da aplicação; sua aplicação copia etapas e exige acrescentar/substituir quando já existe checklist. Tokens de requisição e versão da tarefa previnem duplicações e sobrescritas concorrentes.

Percentual deriva da contagem de etapas; checklist vazio não recebe percentual. Chegar a 100% não conclui a tarefa. Responsável principal conclui sem revisão; com revisão definida, somente o revisor aprova uma tarefa em revisão. Ampliação/reabertura de uma entrega concluída exige reabrir a tarefa e registrar motivo. Tarefas concluídas antigas permanecem concluídas.

Referências gerais continuam no fluxo de anexos existente. Vínculos de etapa/entrega final apontam para `drive_files` ou `task_attachments`, sem cópia física. Remover etapa/desvincular preserva materiais gerais. Triggers removem vínculos incompatíveis ao mover, enviar à lixeira ou excluir arquivos. O diálogo da central informa esse efeito. Upload mantém limites e idempotência existentes; a função bloqueia novos uploads em tarefas concluídas.

## Permissões

| Ação | Autorização |
| --- | --- |
| Ler tarefa, anexos e comentar | Criador, responsável, colaboradores, revisor ou administrador, com vínculo ativo na equipe |
| Editar tarefa/organização, modelos e checklist; definir colaboradores e bloqueios; solicitar revisão/reabrir | Criador, responsável ou administrador |
| Concluir/reabrir uma etapa | Criador, responsável, colaboradores ou administrador; revisor precisa também ser colaborador |
| Enviar/vincular/desvincular materiais | Participantes, revisor ou administrador com acesso à tarefa |
| Concluir sem revisor | Responsável principal |
| Aprovar com revisor | Revisor definido, após solicitação de revisão e sem etapas pendentes |
| Excluir tarefa | Criador ou administrador, preservando o ciclo existente de limpeza do Drive |
| Excluir/renomear/mover arquivo físico | Permissões existentes de quem enviou/administrador e acesso ao destino |

A interface orienta; RLS, RPC transacional e triggers aplicam as regras. Novas tabelas são somente leitura para o cliente. A implementação privilegiada fica em schema privado, com identidade da sessão, autorização explícita, `search_path` fixo e ACL restrita. A view agregada usa `security_invoker=true`. Detalhes/histórico são carregados sob demanda, histórico limitado às 100 alterações recentes. Progresso de cards usa consulta agregada em lotes de 100 tarefas e atualização pontual no cache.

## Migrações e publicação

1. `20261002054210_tasks_collaborative_checklists.sql`: campos opcionais, itens, vínculos, histórico, idempotência, RLS, RPC e regras de status.
2. `20261002060239_tasks_workflow_function_acl.sql`: remove grants padrão de execução anônima e indexa vínculos de arquivos.
3. `20261002060419_tasks_workflow_legacy_bridge.sql`: importa uma eventual tabela antiga `task_checklist`, preservando IDs/conclusões e desativa escrita direta no fluxo antigo. No banco real essa tabela estava vazia e não era usada pelo frontend da main.

As três migrações foram aplicadas em `yycfqeymdsjyulexwrlb` (Back-End Site). Contagens antes/depois: 25 tarefas e 10 registros de arquivos; pastas e arquivos existentes não foram movidos ou recriados. Conferência de ACL: execução anônima da RPC negada, escrita direta em itens negada, RLS habilitada. A função `drive-files` foi publicada depois do banco: versão **17**, estado **ACTIVE**, JWT habilitado. O código remoto anterior foi comparado com main antes da atualização e suas dependências foram preservadas.

Um smoke test no PostgreSQL remoto executou criação, etapa, conclusão da etapa, 100% sem conclusão automática, definição de revisor, solicitação, aprovação e reabertura. Toda a transação foi revertida: nenhum dado de QA permaneceu (25 tarefas/10 arquivos).

Frontend é entregue pela PR. Até a integração e execução do workflow Pages, esta alteração **não está publicada no frontend**.

## Evidências

- `npm run typecheck:tasks` e `npm run typecheck:academia`: passaram.
- `npm run test:tasks`: 15 testes passaram, incluindo seis testes novos com PostgreSQL/PGlite e ACL, mais regressões de pasta, exclusão e upload.
- `node --test tests/file-center.test.mjs`: seis testes passaram.
- `npm run test:academia`: 28 testes passaram.
- `npm run build`: passou.
- `deno check --node-modules-dir=manual --config supabase/functions/drive-files/deno.json supabase/functions/drive-files/index.ts`: passou.
- Playwright de tarefas: passou em 390, 768 e 1440 px; criação/reenvio sem duplicação, arquivos/central, CRUD de etapas, ordem, progressos 0/33/50/67/100%, modelos com escolha explícita, vínculos sem cópias, bloqueios, solicitação de revisão, cache Kanban, foco, exclusão e ausência de overflow/erros JavaScript.
- Playwright da Academia: passou para os cinco perfis administrativos e para biblioteca/estudo no celular, sem overflow.
- Capturas são geradas em `/tmp/rkc-tasks-qa` e anexadas como artifact pelo workflow Validate Tasks.

## Limites

O smoke test remoto valida o contrato SQL real, mas não substitui uma sessão real do navegador. Upload/download/movimentação física no Drive não foram testados com uma conta real nesta sessão; testes de arquivos usam respostas simuladas e exercícios transacionais de vínculos. Datas de conclusão legadas sem timestamp são recuperadas do último timestamp disponível, sem inventar uma autoria não reconhecida.

O Advisor mostra achados anteriores fora desta implementação (financeiro sem RLS, views legadas e funções antigas). A nova tabela de tokens `task_workflow_requests` tem RLS sem políticas intencionalmente e é inacessível a clientes. Referência do aviso: https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy. Esses achados não foram tratados como motivo para modificar outros módulos.
