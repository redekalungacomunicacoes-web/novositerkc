# Módulo de Calendário Administrativo

## Instalação

1. Garanta variáveis de ambiente no frontend:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
2. Rode as migrations do Supabase, incluindo:
   - `supabase/migrations/20260331120000_tasks_attachments_notifications.sql`
   - `supabase/migrations/20260331143000_admin_calendar_module_v2.sql`
3. Inicie o frontend:
   - `npm install`
   - `npm run dev`

## Decisões de arquitetura

- O calendário renderiza apenas o mês selecionado e consulta tasks por intervalo `YYYY-MM-DD` (início/fim do mês), reduzindo payload.
- O drawer lateral combina listagem da data + formulário para criação rápida.
- Upload de anexos:
  - Novos arquivos binários no Google Drive, em `04_EQUIPE/<criador>/TAREFAS/<título - código>`. O bucket `task-files` é mantido para leitura/limpeza de legados.
  - Metadados novos em `drive_files`; legados e links em `task_attachments`.
  - Links externos em `task_attachments` com `tipo = link`.
- A interface atual deriva avisos das tarefas do intervalo consultado. O banco conectado não possui os triggers de atribuição das migrations antigas.

## Tratamento de erros e validações

- Validações client-side:
  - Título obrigatório.
  - Data obrigatória.
  - Responsável obrigatório.
  - Hora fim >= hora início.
  - URLs externas válidas (`http://` ou `https://`).
- Erros de Supabase são exibidos no topo da tela de tarefas.

Consulte `tasks-auditoria.md` para contratos de criação, retry, exclusão, RLS e validação.
