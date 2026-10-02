# Painel de execução da tarefa

Ao abrir uma tarefa no calendário ou no Kanban, o painel ocupa uma área ampla e apresenta entrega esperada, critério, responsável, prazo, status e progresso com contagem. As operações de edição e exclusão continuam no menu da tarefa.

- **Executar:** checklist, modelos, ordenação por botões, observações e anexos recolhidos por etapa; bloqueios, revisão e conclusão ao lado no desktop.
- **Arquivos:** materiais pesquisáveis, uploads existentes e entrega final, mantendo as mesmas referências físicas do Drive.
- **Comentários e check-ins:** registro de avanços pela associação de comentários existente; autoria e data, em ordem mais recente primeiro.
- **Relatório:** contagens das etapas, materiais e registros, contexto original, revisor e histórico persistido.
- **Organização:** critérios, projeto, colaboração, revisão e bloqueio.

A navegação usa abas Radix com teclado e foco; controles de seções inativas ficam ocultos da navegação e os rascunhos permanecem ao trocar abas. As ações principais têm área mínima de toque de 44 px. O formulário de criação e o mecanismo de retomada de uploads permanecem iguais.

## Validação

- TypeScript de tarefas e Academia.
- Build Vite.
- 15 testes de tarefas (RPC/RLS em PostgreSQL PGlite, concorrência, revisão, checklist, modelos, links e regressões de upload).
- 6 testes de central de arquivos.
- 28 testes de Academia.
- Playwright com API simulada em 390, 768 e 1440 px: criação, falha e retomada sem duplicação, central, movimentação/exclusão, edição, checklist, revisão, busca de materiais, check-in persistido, rascunho entre abas, teclado, cache entre telas e ausência de overflow/erros JavaScript.
- O workflow `validate-tasks.yml` executa também Deno e disponibiliza capturas no artefato `tasks-ui-evidence`.

Não há migrações nem mudanças em funções nesta PR. Nenhum teste desta alteração utilizou conta real para enviar arquivos ao Google Drive. Publicação do frontend depende do merge e do deploy do repositório; abrir a PR não publica a mudança.
