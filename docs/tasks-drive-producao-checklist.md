# Checklist de produção — Tarefas + Google Drive

## Objetivo
Validar o único ponto que não pode ser comprovado por fixtures: sessão real, destino físico e permissões herdadas no Google Drive.

## Pré-condições
- PR #177 presente em main.
- Migration de Tarefas aplicada.
- Edge Function drive-files publicada.
- Usuário de teste autenticado e vinculado à equipe.
- Não alterar permissões de pastas públicas usadas pelo site.

## Teste autenticado
1. Entrar no admin com uma conta real da equipe.
2. Criar uma tarefa com título `QA Drive <data-hora>` e direcioná-la para outro integrante, quando disponível.
3. Anexar um arquivo pequeno e não sensível, por exemplo `qa-drive.txt`.
4. Confirmar na interface que a tarefa foi criada e o anexo aparece na central/detalhes.
5. No Drive, confirmar o destino `04_EQUIPE/<criador>/TAREFAS/<título - código>`.
6. Confirmar que trocar o responsável não move a pasta e não altera `created_by`.
7. Abrir o anexo pelo sistema e confirmar que o conteúdo corresponde ao arquivo enviado.
8. Repetir um upload após uma falha/retry controlada e confirmar que não há arquivo físico duplicado.
9. Excluir a tarefa e confirmar que a linha some do sistema; verificar arquivo/pasta na lixeira do Drive ou job de limpeza pendente.

## Permissões
A pasta `04_EQUIPE` e a pasta individual do criador não devem herdar compartilhamento público ou por link. Verificar no Google Drive “Gerenciar acesso”:
- Acesso geral restrito, salvo regra institucional deliberada.
- Nenhum grupo/usuário inesperado herdado.
- O arquivo de teste não abre em janela anônima sem autenticação.
- A conta autorizada esperada consegue acessar.

Não automatizar a remoção de permissões herdadas neste estágio: a mesma árvore do Drive pode conter conteúdo com política diferente. Corrigir permissões somente após identificar a origem do compartilhamento.

## Critério de aceite
O fluxo é considerado validado em produção quando criação, upload, leitura, retry, exclusão/limpeza e permissões reais passam com uma conta autenticada, sem duplicação e sem exposição pública involuntária.
