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
  - Arquivos binários em `storage` bucket `task-files`.
  - Metadados em `task_attachments`.
  - Links externos em `task_attachments` com `tipo = link`.
- Notificações são geradas no banco por trigger (`notify_task_assignment_v2`) para consistência mesmo fora do frontend.

## Tratamento de erros e validações

- Validações client-side:
  - Título obrigatório.
  - Data obrigatória.
  - Responsável obrigatório.
  - Hora fim >= hora início.
  - URLs externas válidas (`http://` ou `https://`).
- Erros de Supabase são exibidos no topo da tela de tarefas.
