-- =========================================================
-- REDE KALUNGA - ESTRUTURA DE TAREFAS, ANEXOS E NOTIFICAÇÕES
-- Compatível com Supabase (PostgreSQL)
-- =========================================================

-- Extensões úteis
create extension if not exists pgcrypto;

-- =========================================================
-- 1) ENUMS
-- =========================================================

do $$
begin
  if not exists (select 1 from pg_type where typname = 'task_status') then
    create type public.task_status as enum (
      'pendente',
      'em_andamento',
      'concluida',
      'cancelada'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'task_priority') then
    create type public.task_priority as enum (
      'baixa',
      'media',
      'alta',
      'urgente'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'attachment_type') then
    create type public.attachment_type as enum (
      'link',
      'foto',
      'pdf',
      'video',
      'documento',
      'arquivo'
    );
  end if;

  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type public.notification_type as enum (
      'nova_tarefa',
      'tarefa_atualizada',
      'prazo_proximo',
      'comentario',
      'anexo_adicionado'
    );
  end if;
end $$;

-- =========================================================
-- 2) PERFIS / INTEGRANTES
-- Usa auth.users como base e cria perfil complementar
-- =========================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text,
  email text unique,
  avatar_url text,
  cargo text,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Atualização automática de updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

-- =========================================================
-- 3) TAREFAS
-- =========================================================

create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  data_tarefa date not null,
  hora_inicio time,
  hora_fim time,
  status public.task_status not null default 'pendente',
  prioridade public.task_priority not null default 'media',

  -- quem criou
  created_by uuid references public.profiles(id) on delete set null,

  -- integrante responsável
  assigned_to uuid references public.profiles(id) on delete set null,

  -- observações de calendário
  local text,
  link_reuniao text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists trg_tasks_updated_at on public.tasks;
create trigger trg_tasks_updated_at
before update on public.tasks
for each row
execute function public.set_updated_at();

create index if not exists idx_tasks_data_tarefa on public.tasks(data_tarefa);
create index if not exists idx_tasks_assigned_to on public.tasks(assigned_to);
create index if not exists idx_tasks_status on public.tasks(status);

-- =========================================================
-- 4) ANEXOS DA TAREFA
-- IMPORTANTE:
-- O arquivo em si vai para o Supabase Storage.
-- Aqui ficam apenas os metadados.
-- =========================================================

create table if not exists public.task_attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks(id) on delete cascade,

  tipo public.attachment_type not null default 'arquivo',

  -- para links externos
  external_url text,

  -- para arquivos no Supabase Storage
  storage_bucket text default 'task-files',
  storage_path text,
  file_name text,
  mime_type text,
  file_size bigint,

  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint chk_attachment_source check (
    external_url is not null
    or storage_path is not null
  )
);

create index if not exists idx_task_attachments_task_id on public.task_attachments(task_id);

-- =========================================================
-- 5) NOTIFICAÇÕES
-- =========================================================

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete cascade,

  tipo public.notification_type not null,
  titulo text not null,
  mensagem text not null,

  lida boolean not null default false,
  enviada boolean not null default false,

  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_lida on public.notifications(lida);
create index if not exists idx_notifications_task_id on public.notifications(task_id);

-- =========================================================
-- 6) FUNÇÃO PARA GERAR NOTIFICAÇÃO AUTOMÁTICA
-- Quando uma tarefa é criada com responsável
-- ou quando o responsável é alterado
-- =========================================================

create or replace function public.notify_task_assignment()
returns trigger
language plpgsql
as $$
begin
  -- nova tarefa já com responsável
  if tg_op = 'INSERT' then
    if new.assigned_to is not null then
      insert into public.notifications (
        user_id,
        task_id,
        tipo,
        titulo,
        mensagem
      )
      values (
        new.assigned_to,
        new.id,
        'nova_tarefa',
        'Nova tarefa atribuída',
        'Você recebeu a tarefa: ' || new.titulo
      );
    end if;
    return new;
  end if;

  -- alteração de responsável
  if tg_op = 'UPDATE' then
    if new.assigned_to is distinct from old.assigned_to
       and new.assigned_to is not null then
      insert into public.notifications (
        user_id,
        task_id,
        tipo,
        titulo,
        mensagem
      )
      values (
        new.assigned_to,
        new.id,
        'tarefa_atualizada',
        'Tarefa atribuída/reatribuída',
        'Você foi definido como responsável pela tarefa: ' || new.titulo
      );
    end if;
    return new;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_notify_task_assignment_insert on public.tasks;
create trigger trg_notify_task_assignment_insert
after insert on public.tasks
for each row
execute function public.notify_task_assignment();

drop trigger if exists trg_notify_task_assignment_update on public.tasks;
create trigger trg_notify_task_assignment_update
after update on public.tasks
for each row
execute function public.notify_task_assignment();

-- =========================================================
-- 7) BUCKET DE STORAGE PARA ANEXOS
-- Arquivos reais: foto, pdf, vídeo, documento...
-- =========================================================

insert into storage.buckets (id, name, public)
values ('task-files', 'task-files', false)
on conflict (id) do nothing;

-- =========================================================
-- 8) ROW LEVEL SECURITY
-- =========================================================

alter table public.profiles enable row level security;
alter table public.tasks enable row level security;
alter table public.task_attachments enable row level security;
alter table public.notifications enable row level security;

-- ---------------------------------------------------------
-- PROFILES POLICIES
-- ---------------------------------------------------------

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- ---------------------------------------------------------
-- TASKS POLICIES
-- Usuário autenticado pode:
-- - ver tarefas
-- - criar tarefas
-- - editar tarefa que criou ou que foi atribuída a ele
-- ---------------------------------------------------------

drop policy if exists "tasks_select_authenticated" on public.tasks;
create policy "tasks_select_authenticated"
on public.tasks
for select
to authenticated
using (true);

drop policy if exists "tasks_insert_authenticated" on public.tasks;
create policy "tasks_insert_authenticated"
on public.tasks
for insert
to authenticated
with check (auth.uid() = created_by);

drop policy if exists "tasks_update_creator_or_assigned" on public.tasks;
create policy "tasks_update_creator_or_assigned"
on public.tasks
for update
to authenticated
using (
  auth.uid() = created_by
  or auth.uid() = assigned_to
)
with check (
  auth.uid() = created_by
  or auth.uid() = assigned_to
);

drop policy if exists "tasks_delete_creator" on public.tasks;
create policy "tasks_delete_creator"
on public.tasks
for delete
to authenticated
using (auth.uid() = created_by);

-- ---------------------------------------------------------
-- ATTACHMENTS POLICIES
-- ---------------------------------------------------------

drop policy if exists "attachments_select_authenticated" on public.task_attachments;
create policy "attachments_select_authenticated"
on public.task_attachments
for select
to authenticated
using (true);

drop policy if exists "attachments_insert_authenticated" on public.task_attachments;
create policy "attachments_insert_authenticated"
on public.task_attachments
for insert
to authenticated
with check (auth.uid() = uploaded_by);

drop policy if exists "attachments_delete_uploader" on public.task_attachments;
create policy "attachments_delete_uploader"
on public.task_attachments
for delete
to authenticated
using (auth.uid() = uploaded_by);

-- ---------------------------------------------------------
-- NOTIFICATIONS POLICIES
-- Cada usuário só vê e altera as próprias notificações
-- ---------------------------------------------------------

drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own"
on public.notifications
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own"
on public.notifications
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

-- =========================================================
-- 9) STORAGE POLICIES
-- Os arquivos ficam dentro do bucket 'task-files'
-- Ajuste se quiser regras mais abertas ou mais restritas
-- =========================================================

drop policy if exists "task_files_read_authenticated" on storage.objects;
create policy "task_files_read_authenticated"
on storage.objects
for select
to authenticated
using (bucket_id = 'task-files');

drop policy if exists "task_files_insert_authenticated" on storage.objects;
create policy "task_files_insert_authenticated"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-files'
  and auth.role() = 'authenticated'
);

drop policy if exists "task_files_update_authenticated" on storage.objects;
create policy "task_files_update_authenticated"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'task-files'
  and auth.role() = 'authenticated'
)
with check (
  bucket_id = 'task-files'
  and auth.role() = 'authenticated'
);

drop policy if exists "task_files_delete_authenticated" on storage.objects;
create policy "task_files_delete_authenticated"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-files'
  and auth.role() = 'authenticated'
);

-- =========================================================
-- 10) VIEW OPCIONAL PARA CONSULTA COMPLETA
-- =========================================================

create or replace view public.v_tasks_full as
select
  t.id,
  t.titulo,
  t.descricao,
  t.data_tarefa,
  t.hora_inicio,
  t.hora_fim,
  t.status,
  t.prioridade,
  t.local,
  t.link_reuniao,
  t.created_at,
  t.updated_at,
  p1.nome as criado_por_nome,
  p1.email as criado_por_email,
  p2.nome as responsavel_nome,
  p2.email as responsavel_email
from public.tasks t
left join public.profiles p1 on p1.id = t.created_by
left join public.profiles p2 on p2.id = t.assigned_to;

-- =========================================================
-- 11) EXEMPLOS DE INSERT
-- =========================================================

-- Exemplo de tarefa:
-- insert into public.tasks (
--   titulo,
--   descricao,
--   data_tarefa,
--   hora_inicio,
--   hora_fim,
--   prioridade,
--   created_by,
--   assigned_to
-- ) values (
--   'Publicar matéria do site',
--   'Subir conteúdo com imagem, revisão final e link',
--   '2026-04-02',
--   '09:00',
--   '11:00',
--   'alta',
--   'UUID_DO_CRIADOR',
--   'UUID_DO_RESPONSAVEL'
-- );

-- Exemplo de anexo tipo link:
-- insert into public.task_attachments (
--   task_id,
--   tipo,
--   external_url,
--   uploaded_by
-- ) values (
--   'UUID_DA_TASK',
--   'link',
--   'https://exemplo.com/documento',
--   'UUID_DO_USUARIO'
-- );

-- Exemplo de arquivo enviado ao Storage:
-- insert into public.task_attachments (
--   task_id,
--   tipo,
--   storage_bucket,
--   storage_path,
--   file_name,
--   mime_type,
--   file_size,
--   uploaded_by
-- ) values (
--   'UUID_DA_TASK',
--   'pdf',
--   'task-files',
--   'tasks/UUID_DA_TASK/arquivo.pdf',
--   'arquivo.pdf',
--   'application/pdf',
--   245800,
--   'UUID_DO_USUARIO'
-- );
