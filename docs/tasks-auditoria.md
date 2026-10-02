# Auditoria e correção do módulo de tarefas

## Evidências em 02/10/2026

O fluxo ativo é `calendar2026`, utilizado por AdminTarefas, Kanban, Anexos e Relatórios. CalendarPro e tasksService são caminhos antigos; o ponto de exclusão do serviço antigo também foi encaminhado ao backend único.

| Prioridade | Problema confirmado | Correção |
| --- | --- | --- |
| Crítica | Vite substituía React Query por um shim sem `getQueriesData`, `setQueryData`, `refetch`, staleTime e callbacks com variáveis. A criação gravava a linha, mas a invalidação disparava novas cargas em cascata; a exclusão e o Kanban podiam lançar erro após a gravação. | Biblioteca oficial com versão fixa e lockfile; invalidação por chave e cache real. |
| Crítica | Banco conectado não tinha política DELETE para tasks. A API podia retornar zero linhas sem erro. | Política para criador/admin e confirmação explícita de linha excluída. |
| Alta | A tabela task_comments não existia no banco conectado. A tela consultava-a e falhava ao carregar detalhes/comentar. | Migration cria tabela, índice, grants e RLS de autor/tarefa. |
| Alta | Criação de pasta era fire-and-forget; falhas apareciam apenas no console. Upload e criação disputavam o mesmo destino. | Etapa explícita depois de salvar, ID conservado para retry e lease persistente para pasta. |
| Alta | Pasta ia para `05_INTEGRANTES/<responsável>`, divergindo do criador logado e da arquitetura documentada. | Novas pastas em `04_EQUIPE/<criador>/TAREFAS/<título - código>`. |
| Alta | Exclusão tentava remover cada arquivo como o usuário solicitante; anexos enviados por outros integrantes bloqueavam o criador. Também removia arquivos antes de confirmar DELETE. | Backend verifica criador/admin, registra outbox e confirma DELETE antes de enviar anexos/pasta à lixeira. |
| Alta | Central de anexos usava a consulta resumida do calendário, que retorna arrays de anexos vazios; arquivos do Drive eram abertos como Storage. | Consulta própria paginada combina Drive e legados; abertura unificada de Drive, Storage e links. |
| Alta | Políticas permissivas de leitura/INSERT permitiam acesso global e criador forjado; N:N permitia conceder acesso próprio. | Guardas restritivos preservam acesso de criador/responsáveis/admin e impedem atribuições N:N por terceiros. Identidade/pasta protegidas no UPDATE. |
| Média | Colaborador criava para outro responsável e não via a própria tarefa por filtro local. | A consulta usa o escopo definido pelo RLS, incluindo criador e responsáveis N:N, sem filtros locais divergentes. |
| Média | Modal sem captura de foco, fechamento por Escape ou bloqueio durante envio; possíveis submissões simultâneas. | Dialog Radix, bloqueio da operação completa, feedback por etapa, áreas de toque e altura dinâmica. |
| Média | Uploads sem limite de concorrência, timer não liberado, UI de erro confundida com lista vazia. | Dois uploads simultâneos, validação 50 MB, timer liberado e erros com retry. |
| Média | Kanban não passava teamMembers à coluna, causando falha quando havia cartões. | Prop adicionada e verificação TypeScript do módulo. |

## Contrato de pastas

A identidade é `tasks.created_by`, resolvida para equipe pelo login na criação. Trocar responsável não troca criador nem pasta. A criação e o upload usam `prepareTaskFolder`; o ID é persistido em `tasks.drive_folder_id`. Pastas antigas já vinculadas são reutilizadas para preservar arquivos, sem mudança automática de local. O código curto diferencia tarefas de mesmo título. A pasta de integrante reutiliza o nome humano; integrantes homônimos ainda exigem cuidado no cadastro/arquitetura futura.

A tarefa é persistida primeiro. Depois, a tela prepara a pasta, envia comentários/arquivos e links. Em falha conserva taskId e os itens pendentes. Repetir não cria outra tarefa nem reenvia os itens concluídos. Um token de upload por arquivo e índice único no banco permitem recuperar o resultado de envio cuja resposta se perdeu, sem conservar dois arquivos físicos. Em disputa, o segundo arquivo físico é enviado à lixeira após a confirmação da metadata já existente. O lease por raiz serializa a descoberta/criação dos diretórios compartilhados entre tarefas diferentes. O lease de pasta expira em 120 segundos; pedidos simultâneos aguardam o ID e informam retry quando necessário.

## Exclusão e recuperação

`task-delete` exige criador ou `is_team_admin()`. O outbox backend-only `task_cleanup_jobs` registra arquivos e destino antes da exclusão. Nenhum arquivo é removido se DELETE não retornar a tarefa. Depois do DELETE, remove arquivos de qualquer participante, Storage legado e pasta. Falha de Drive conserva job pending e a UI informa limpeza pendente. `task-cleanup` permite retry pelo solicitante/admin; `task-cleanup-pending` retenta até cinco jobs ao acessar uma área de tarefas. O backend verifica que a tarefa realmente não existe antes de limpar.

A exclusão física e o banco não têm transação distribuída. O outbox garante rastreabilidade e retomada; não promete execução no Google quando a integração está indisponível. Jobs devem ser monitorados, especialmente se o usuário não voltar à área. Arquivos externos não são apagados. Anexos do Drive são enviados à lixeira.

## Desempenho e experiência

Calendário e notificações usam RLS como fonte de autorização, eliminando buscas repetidas de identidade/permissão em cada consulta. Calendário e Kanban mantêm consulta por intervalo, paginação de 500 linhas e detalhes sob demanda. Equipe e identidade têm staleTime de cinco minutos; tarefas e detalhes, 30 segundos. A troca de usuário limpa o cache. Central busca metadados em lotes de 100 tarefas e páginas de 500 anexos, sem download de binários nem consulta de comentários. Central ainda consulta todo o histórico autorizado; paginação de tarefas na interface e busca no servidor ficam como melhoria futura para histórico muito grande.

Navegação e formulário têm layout responsivo; cabeçalho do calendário quebra linha em telas estreitas. O modal usa 94dvh, mantém foco, admite Escape, bloqueia fechamento durante envio e apresenta erros/etapas. Estado de carregar detalhes é diferente de ausência de anexos. O layout mensal no celular continua compacto, com detalhes acessíveis pelo dia.

## Validação

- TypeScript do módulo; build de produção; Deno check da função; testes PGlite de RLS e contratos de backend.
- Testes de criação de pasta para criador diferente do responsável, reuse de pasta, exclusão sem permissão/zero rows, arquivos de outro participante e recuperação após falha do Drive.
- Script Playwright com fixtures para 390, 768 e 1440 pixels: criação, retry da pasta sem duplicação, central, Escape, exclusão, ausência de overflow e erros de JavaScript.
- Regressão da Academia; nenhuma tarefa real ou arquivo real foi apagado nos testes.

As fixtures verificam comportamento controlado. As permissões nativas do Drive também precisam de conferência: visibility=private no Supabase não torna privada uma pasta que herda um compartilhamento público. Antes da publicação, conferir acesso restrito de 04_EQUIPE e dos destinos das tarefas. Upload autenticado real e o destino físico no Drive precisam de validação de sessão com um arquivo de teste; os testes não substituem essa conferência.

## Situação da entrega

Mudanças preparadas em branch/PR. A migration de produção foi bloqueada pela revisão automática por falta de autorização explícita para alterar banco e permissões. Não foi aplicada, a Edge Function não foi publicada e main não foi alterada. Publicação exige aprovação do usuário e deve seguir migration -> deploy drive-files com todos os arquivos shared -> merge/deploy do frontend.

## Capturas com dados de teste

As capturas usam fixtures, sem arquivos ou informações da produção.

- [Formulário mobile (390 px)](tasks-ui/mobile.png)
- [Formulário tablet (768 px)](tasks-ui/tablet.png)
- [Formulário desktop (1440 px)](tasks-ui/desktop.png)
- [Central de anexos mobile](tasks-ui/anexos-mobile.png)
