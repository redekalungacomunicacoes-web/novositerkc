-- Academia interna RKC. Dependencies: auth.users, public.equipe(id,user_id),
-- public.roles(id,name), public.user_roles(user_id,role_id), Supabase Storage.
begin;
create or replace function public.academy_member() returns boolean
language sql stable security definer set search_path = public as $$
 select exists(select 1 from user_roles ur join roles r on r.id=ur.role_id
 where ur.user_id=auth.uid() and r.name in ('admin_alfa','admin','editor','autor','financeiro'));
$$;
create or replace function public.academy_admin() returns boolean
language sql stable security definer set search_path = public as $$
 select exists(select 1 from user_roles ur join roles r on r.id=ur.role_id
 where ur.user_id=auth.uid() and r.name in ('admin_alfa','admin'));
$$;
create table public.academy_categories (
 id uuid primary key default gen_random_uuid(), name text not null unique check(length(trim(name))>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.academy_courses (
 id uuid primary key default gen_random_uuid(), title text not null check(length(trim(title))>0),
 slug text not null unique check(slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'), summary text not null default '', description text not null default '',
 cover_path text, category_id uuid references public.academy_categories on delete set null,
 level text not null default 'iniciante' check(level in ('iniciante','intermediario','avancado')),
 hours numeric(8,2) not null default 0 check(hours>=0), objectives text not null default '',
 competencies text[] not null default '{}', audience text not null default '', prerequisites text not null default '',
 status text not null default 'draft' check(status in ('draft','review','published','archived')),
 visibility text not null default 'internal' check(visibility in ('internal','public')),
 access_mode text not null default 'internal' check(access_mode in ('internal','free','paid')),
 price numeric(12,2) not null default 0 check(price>=0), currency text not null default 'BRL',
 enrollment_mode text not null default 'manual' check(enrollment_mode in ('manual','self','automatic')),
 required boolean not null default false, position integer not null default 0,
 available_from timestamptz, available_until timestamptz, published_at timestamptz,
 created_by uuid references auth.users on delete set null default auth.uid(),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(available_until is null or available_from is null or available_until>available_from),
 check(access_mode='paid' or price=0)
);
create table public.academy_instructors (
 id uuid primary key default gen_random_uuid(), member_id uuid references public.equipe on delete restrict,
 external_name text, bio text not null default '', created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check((member_id is not null and external_name is null) or (member_id is null and external_name is not null and length(trim(external_name))>0)), unique(member_id)
);
create table public.academy_course_instructors (
 course_id uuid not null references public.academy_courses on delete cascade,
 instructor_id uuid not null references public.academy_instructors on delete cascade,
 can_edit boolean not null default false, primary key(course_id,instructor_id)
);
create table public.academy_modules (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.academy_courses on delete cascade,
 title text not null check(length(trim(title))>0), description text not null default '', position integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(id,course_id)
);
create table public.academy_lessons (
 id uuid primary key default gen_random_uuid(), course_id uuid not null, module_id uuid not null,
 title text not null check(length(trim(title))>0), description text not null default '', content text not null default '',
 type text not null default 'text' check(type in ('text','video','audio','image','pdf','document','presentation','link','mixed')),
 media_url text, media_path text, duration_minutes integer not null default 0 check(duration_minutes>=0),
 position integer not null default 0, required boolean not null default true,
 status text not null default 'draft' check(status in ('draft','published','archived')),
 context_route text check(context_route is null or context_route ~ '^/admin(/|$)'), context_feature text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(module_id,course_id) references public.academy_modules(id,course_id) on delete cascade, unique(id,course_id),
 check(media_url is null or media_url ~ '^https://')
);
create table public.academy_materials (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.academy_courses on delete cascade,
 lesson_id uuid, title text not null check(length(trim(title))>0), storage_path text, url text,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(lesson_id,course_id) references public.academy_lessons(id,course_id) on delete cascade,
 check((storage_path is not null) <> (url is not null)), check(url is null or url ~ '^https://')
);
create table public.academy_enrollments (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.academy_courses on delete restrict,
 user_id uuid not null references auth.users on delete cascade,
 source text not null default 'manual' check(source in ('manual','self','automatic')),
 required boolean not null default false, status text not null default 'active' check(status in ('active','cancelled')),
 enrolled_at timestamptz not null default now(), completed_at timestamptz, last_lesson_id uuid,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(course_id,user_id), unique(id,course_id),
 foreign key(last_lesson_id,course_id) references public.academy_lessons(id,course_id)
);
create table public.academy_progress (
 enrollment_id uuid not null, course_id uuid not null, lesson_id uuid not null,
 started_at timestamptz not null default now(), completed_at timestamptz, updated_at timestamptz not null default now(),
 primary key(enrollment_id,lesson_id),
 foreign key(enrollment_id,course_id) references public.academy_enrollments(id,course_id) on delete cascade,
 foreign key(lesson_id,course_id) references public.academy_lessons(id,course_id) on delete cascade
);
create table public.academy_activities (
 id uuid primary key default gen_random_uuid(), course_id uuid not null references public.academy_courses on delete cascade,
 lesson_id uuid, title text not null check(length(trim(title))>0), instructions text not null default '',
 kind text not null default 'activity' check(kind in ('activity','assessment')),
 required boolean not null default true, passing_score numeric not null default 70 check(passing_score between 0 and 100),
 max_attempts integer not null default 3 check(max_attempts between 1 and 100),
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 foreign key(lesson_id,course_id) references public.academy_lessons(id,course_id) on delete cascade, unique(id,course_id)
);
create table public.academy_questions (
 id uuid primary key default gen_random_uuid(), activity_id uuid not null references public.academy_activities on delete cascade,
 prompt text not null check(length(trim(prompt))>0), type text not null check(type in ('choice','boolean','short','essay','practical')),
 options text[] not null default '{}', points numeric not null default 1 check(points>0),
 position integer not null default 0, time_limit_seconds integer check(time_limit_seconds>0),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
-- Answer keys must never be returned with learner questions.
create table public.academy_answer_keys (
 question_id uuid primary key references public.academy_questions on delete cascade, answer text not null
);
create table public.academy_attempts (
 id uuid primary key default gen_random_uuid(), enrollment_id uuid not null, course_id uuid not null, activity_id uuid not null,
 attempt_number integer not null check(attempt_number>0), score numeric check(score between 0 and 100),
 status text not null check(status in ('pending','passed','failed')), submitted_at timestamptz not null default now(),
 reviewed_by uuid references auth.users on delete set null, reviewed_at timestamptz,
 unique(enrollment_id,activity_id,attempt_number),
 foreign key(enrollment_id,course_id) references public.academy_enrollments(id,course_id) on delete cascade,
 foreign key(activity_id,course_id) references public.academy_activities(id,course_id) on delete restrict
);
create table public.academy_answers (
 id uuid primary key default gen_random_uuid(), attempt_id uuid not null references public.academy_attempts on delete cascade,
 question_id uuid not null references public.academy_questions on delete restrict,
 answer text not null, correct boolean, points_awarded numeric, elapsed_seconds integer not null default 0 check(elapsed_seconds>=0),
 feedback text not null default '', created_at timestamptz not null default now(), unique(attempt_id,question_id)
);
create table public.academy_contributions (
 id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users on delete cascade default auth.uid(),
 course_id uuid references public.academy_courses on delete set null, title text not null check(length(trim(title))>0),
 content text not null, reference_url text check(reference_url is null or reference_url ~ '^https://'),
 status text not null default 'draft' check(status in ('draft','review','approved','rejected')),
 review_notes text not null default '', reviewed_by uuid references auth.users on delete set null, reviewed_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.academy_learning_paths (
 id uuid primary key default gen_random_uuid(), title text not null, description text not null default '',
 status text not null default 'draft' check(status in ('draft','published','archived')),
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.academy_learning_path_courses (
 path_id uuid not null references public.academy_learning_paths on delete cascade,
 course_id uuid not null references public.academy_courses on delete cascade, position integer not null default 0,
 primary key(path_id,course_id)
);
create table public.academy_certificates (
 id uuid primary key default gen_random_uuid(), enrollment_id uuid not null unique references public.academy_enrollments on delete restrict,
 validation_code uuid not null unique default gen_random_uuid(), hours numeric not null check(hours>=0),
 issued_at timestamptz not null default now(), storage_path text
);
create table public.academy_settings (
 id boolean primary key default true check(id), title text not null default 'Academia RKC',
 welcome_text text not null default 'Formação e conhecimento para a equipe RKC.',
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
insert into public.academy_settings(id) values(true);
create index on public.academy_courses(status,position);
create index on public.academy_modules(course_id,position);
create index on public.academy_lessons(course_id,module_id,position);
create index on public.academy_materials(course_id,lesson_id);
create index on public.academy_enrollments(user_id,status);
create index on public.academy_enrollments(course_id,status);
create index on public.academy_activities(course_id,lesson_id);
create index on public.academy_questions(activity_id,position);
create index on public.academy_attempts(enrollment_id,activity_id,status);
create index on public.academy_contributions(status,created_at);

create or replace function public.academy_can_edit(p_course uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select academy_admin() or (academy_member() and exists(
 select 1 from academy_course_instructors ci join academy_instructors i on i.id=ci.instructor_id
 join equipe e on e.id=i.member_id where ci.course_id=p_course and ci.can_edit and e.user_id=auth.uid()));
$$;
create or replace function public.academy_can_read(p_course uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select academy_can_edit(p_course) or (academy_member() and exists(
 select 1 from academy_courses c where c.id=p_course and c.status='published' and c.access_mode='internal'
 and (c.available_from is null or c.available_from<=now()) and (c.available_until is null or c.available_until>now())
 and (c.enrollment_mode in ('self','automatic') or exists(select 1 from academy_enrollments e
 where e.course_id=c.id and e.user_id=auth.uid() and e.status='active'))));
$$;
create or replace function public.academy_owns_enrollment(p_enrollment uuid) returns boolean
language sql stable security definer set search_path=public as $$
 select academy_member() and exists(select 1 from academy_enrollments e
 where e.id=p_enrollment and e.user_id=auth.uid() and e.status='active' and academy_can_read(e.course_id));
$$;
create or replace function public.academy_touch() returns trigger language plpgsql set search_path=public as $$
 begin new.updated_at=now(); return new; end;
$$;
create or replace function public.academy_course_publish() returns trigger language plpgsql set search_path=public as $$
 begin
 if new.status='published' then
 if new.visibility<>'internal' or new.access_mode<>'internal' then
 raise exception 'A V1 publica somente cursos internos. Acesso público será habilitado em uma próxima etapa.'; end if;
 if tg_op='INSERT' or old.status is distinct from new.status then new.published_at=now(); end if;
 end if;
 return new;
 end;
$$;
create trigger academy_course_publish before insert or update on public.academy_courses
for each row execute function public.academy_course_publish();

-- RLS: all admin-panel roles can study; admin/admin_alfa manage everything.
-- Instructors receive scoped editing only when explicitly assigned can_edit.
alter table public.academy_categories enable row level security;
grant select,insert,update,delete on public.academy_categories to authenticated;
alter table public.academy_courses enable row level security;
grant select,insert,update,delete on public.academy_courses to authenticated;
alter table public.academy_instructors enable row level security;
grant select,insert,update,delete on public.academy_instructors to authenticated;
alter table public.academy_course_instructors enable row level security;
grant select,insert,update,delete on public.academy_course_instructors to authenticated;
alter table public.academy_modules enable row level security;
grant select,insert,update,delete on public.academy_modules to authenticated;
alter table public.academy_lessons enable row level security;
grant select,insert,update,delete on public.academy_lessons to authenticated;
alter table public.academy_materials enable row level security;
grant select,insert,update,delete on public.academy_materials to authenticated;
alter table public.academy_enrollments enable row level security;
grant select,insert,update,delete on public.academy_enrollments to authenticated;
alter table public.academy_progress enable row level security;
grant select,insert,update,delete on public.academy_progress to authenticated;
alter table public.academy_activities enable row level security;
grant select,insert,update,delete on public.academy_activities to authenticated;
alter table public.academy_questions enable row level security;
grant select,insert,update,delete on public.academy_questions to authenticated;
alter table public.academy_answer_keys enable row level security;
grant select,insert,update,delete on public.academy_answer_keys to authenticated;
alter table public.academy_attempts enable row level security;
grant select,insert,update,delete on public.academy_attempts to authenticated;
alter table public.academy_answers enable row level security;
grant select,insert,update,delete on public.academy_answers to authenticated;
alter table public.academy_contributions enable row level security;
grant select,insert,update,delete on public.academy_contributions to authenticated;
alter table public.academy_learning_paths enable row level security;
grant select,insert,update,delete on public.academy_learning_paths to authenticated;
alter table public.academy_learning_path_courses enable row level security;
grant select,insert,update,delete on public.academy_learning_path_courses to authenticated;
alter table public.academy_certificates enable row level security;
grant select,insert,update,delete on public.academy_certificates to authenticated;
alter table public.academy_settings enable row level security;
grant select,insert,update,delete on public.academy_settings to authenticated;
create policy member_read on public.academy_categories for select to authenticated using(academy_member());
create policy admin_manage on public.academy_categories for all to authenticated using(academy_admin()) with check(academy_admin());
create policy member_read on public.academy_instructors for select to authenticated using(academy_member());
create policy admin_manage on public.academy_instructors for all to authenticated using(academy_admin()) with check(academy_admin());
create policy member_read on public.academy_settings for select to authenticated using(academy_member());
create policy admin_manage on public.academy_settings for all to authenticated using(academy_admin()) with check(academy_admin());
create policy course_read on public.academy_courses for select to authenticated using(academy_can_read(id));
create policy course_insert on public.academy_courses for insert to authenticated with check(academy_admin());
create policy course_update on public.academy_courses for update to authenticated using(academy_can_edit(id)) with check(academy_can_edit(id));
create policy course_delete on public.academy_courses for delete to authenticated using(academy_can_edit(id));
create policy course_read on public.academy_modules for select to authenticated using(academy_can_read(course_id));
create policy course_insert on public.academy_modules for insert to authenticated with check(academy_can_edit(course_id));
create policy course_update on public.academy_modules for update to authenticated using(academy_can_edit(course_id)) with check(academy_can_edit(course_id));
create policy course_delete on public.academy_modules for delete to authenticated using(academy_can_edit(course_id));
create policy course_read on public.academy_lessons for select to authenticated using(academy_can_read(course_id) and (status='published' or academy_can_edit(course_id)));
create policy course_insert on public.academy_lessons for insert to authenticated with check(academy_can_edit(course_id));
create policy course_update on public.academy_lessons for update to authenticated using(academy_can_edit(course_id)) with check(academy_can_edit(course_id));
create policy course_delete on public.academy_lessons for delete to authenticated using(academy_can_edit(course_id));
create policy course_read on public.academy_materials for select to authenticated using(academy_can_read(course_id) and (academy_can_edit(course_id) or lesson_id is null or exists(select 1 from academy_lessons l where l.id=lesson_id and l.status='published')));
create policy course_insert on public.academy_materials for insert to authenticated with check(academy_can_edit(course_id));
create policy course_update on public.academy_materials for update to authenticated using(academy_can_edit(course_id)) with check(academy_can_edit(course_id));
create policy course_delete on public.academy_materials for delete to authenticated using(academy_can_edit(course_id));
create policy course_read on public.academy_activities for select to authenticated using(academy_can_edit(course_id) or (academy_can_read(course_id) and status='published' and (lesson_id is null or exists(select 1 from academy_lessons l where l.id=lesson_id and l.status='published'))));
create policy course_insert on public.academy_activities for insert to authenticated with check(academy_can_edit(course_id));
create policy course_update on public.academy_activities for update to authenticated using(academy_can_edit(course_id)) with check(academy_can_edit(course_id));
create policy course_delete on public.academy_activities for delete to authenticated using(academy_can_edit(course_id));
create policy instructor_read on public.academy_course_instructors for select to authenticated using(academy_can_read(course_id));
create policy instructor_manage on public.academy_course_instructors for all to authenticated using(academy_admin()) with check(academy_admin());
create policy enrollment_read on public.academy_enrollments for select to authenticated using(user_id=auth.uid() and academy_member() or academy_can_edit(course_id));
create policy enrollment_insert on public.academy_enrollments for insert to authenticated with check(academy_admin());
create policy enrollment_update on public.academy_enrollments for update to authenticated using(academy_admin()) with check(academy_admin());
create policy progress_read on public.academy_progress for select to authenticated using(academy_owns_enrollment(enrollment_id) or academy_can_edit(course_id));
create policy attempt_read on public.academy_attempts for select to authenticated using(academy_owns_enrollment(enrollment_id) or academy_can_edit(course_id));
create policy answer_read on public.academy_answers for select to authenticated using(exists(select 1 from academy_attempts a where a.id=attempt_id));
create policy question_read on public.academy_questions for select to authenticated using(exists(select 1 from academy_activities a where a.id=activity_id));
create policy question_manage on public.academy_questions for all to authenticated using(exists(select 1 from academy_activities a where a.id=activity_id and academy_can_edit(a.course_id))) with check(exists(select 1 from academy_activities a where a.id=activity_id and academy_can_edit(a.course_id)));
create policy key_manage on public.academy_answer_keys for all to authenticated using(exists(select 1 from academy_questions q join academy_activities a on a.id=q.activity_id where q.id=question_id and academy_can_edit(a.course_id))) with check(exists(select 1 from academy_questions q join academy_activities a on a.id=q.activity_id where q.id=question_id and academy_can_edit(a.course_id)));
create policy contribution_read on public.academy_contributions for select to authenticated using(academy_admin() or (academy_member() and (user_id=auth.uid() or status='approved')));
create policy contribution_insert on public.academy_contributions for insert to authenticated with check(academy_member() and user_id=auth.uid() and status in ('draft','review') and reviewed_by is null and reviewed_at is null and review_notes='');
create policy contribution_update on public.academy_contributions for update to authenticated using(academy_admin() or (academy_member() and user_id=auth.uid() and status='draft')) with check(academy_admin() or (academy_member() and user_id=auth.uid() and status in ('draft','review') and reviewed_by is null and reviewed_at is null and review_notes=''));
create policy contribution_delete on public.academy_contributions for delete to authenticated using(academy_admin() or (academy_member() and user_id=auth.uid() and status='draft'));
create policy certificate_read on public.academy_certificates for select to authenticated using(exists(select 1 from academy_enrollments e where e.id=enrollment_id));
create policy certificate_manage on public.academy_certificates for all to authenticated using(academy_admin()) with check(academy_admin());
create policy paths_admin on public.academy_learning_paths for all to authenticated using(academy_admin()) with check(academy_admin());
create policy path_courses_admin on public.academy_learning_path_courses for all to authenticated using(academy_admin()) with check(academy_admin());
create trigger academy_touch before update on public.academy_categories for each row execute function public.academy_touch();
create trigger academy_touch before update on public.academy_courses for each row execute function public.academy_touch();
create trigger academy_touch before update on public.academy_instructors for each row execute function public.academy_touch();
create trigger academy_touch before update on public.academy_modules for each row execute function public.academy_touch();
create trigger academy_touch before update on public.academy_lessons for each row execute function public.academy_touch();
create trigger academy_touch before update on public.academy_materials for each row execute function public.academy_touch();
create trigger academy_touch before update on public.academy_enrollments for each row execute function public.academy_touch();
create trigger academy_touch before update on public.academy_activities for each row execute function public.academy_touch();
create trigger academy_touch before update on public.academy_questions for each row execute function public.academy_touch();
create trigger academy_touch before update on public.academy_contributions for each row execute function public.academy_touch();
create trigger academy_touch before update on public.academy_learning_paths for each row execute function public.academy_touch();
create trigger academy_touch before update on public.academy_settings for each row execute function public.academy_touch();

-- Required lessons (or all published lessons when none are required) and required
-- activities form the denominator. Empty courses cannot be completed.
create or replace function public.academy_units(p_enrollment uuid)
returns table(unit_id uuid, done boolean) language sql stable security definer set search_path=public as $$
 select l.id, exists(select 1 from academy_progress p where p.enrollment_id=e.id and p.lesson_id=l.id and p.completed_at is not null)
 from academy_enrollments e join academy_lessons l on l.course_id=e.course_id
 where e.id=p_enrollment and l.status='published' and (l.required or not exists(
 select 1 from academy_lessons r where r.course_id=e.course_id and r.status='published' and r.required))
 union all
 select a.id, exists(select 1 from academy_attempts t where t.enrollment_id=e.id and t.activity_id=a.id and t.status='passed')
 from academy_enrollments e join academy_activities a on a.course_id=e.course_id
 where e.id=p_enrollment and a.status='published' and a.required;
$$;
-- Internal helper: never callable by a client directly.
revoke all on function public.academy_units(uuid) from public,anon,authenticated;
create or replace function public.academy_refresh(p_enrollment uuid) returns void
language plpgsql security definer set search_path=public as $$
declare n integer; d integer;
begin
 select count(*),count(*) filter(where done) into n,d from academy_units(p_enrollment);
 update academy_enrollments set completed_at=case when n>0 and d=n then coalesce(completed_at,now()) else null end
 where id=p_enrollment;
end;
$$;
revoke all on function public.academy_refresh(uuid) from public,anon,authenticated;
create or replace function public.academy_enroll(p_course uuid) returns uuid
language plpgsql security definer set search_path=public as $$
declare c academy_courses; eid uuid;
begin
 select * into c from academy_courses where id=p_course;
 if not academy_member() or not academy_can_read(p_course) or c.status<>'published'
 or c.enrollment_mode not in ('self','automatic') then raise exception 'Matrícula não autorizada'; end if;
 insert into academy_enrollments(course_id,user_id,source,required) values(p_course,auth.uid(),
 case when c.enrollment_mode='automatic' then 'automatic' else 'self' end,c.required)
 on conflict(course_id,user_id) do nothing returning id into eid;
 select id into eid from academy_enrollments where course_id=p_course and user_id=auth.uid() and status='active';
 if eid is null then raise exception 'Matrícula cancelada. Solicite reativação ao administrador.'; end if;
 return eid;
end;
$$;
create or replace function public.academy_record_lesson(p_enrollment uuid,p_lesson uuid,p_complete boolean default false) returns void
language plpgsql security definer set search_path=public as $$
declare e academy_enrollments;
begin
 select * into e from academy_enrollments where id=p_enrollment for update;
 if not academy_owns_enrollment(p_enrollment) or not exists(select 1 from academy_lessons
 where id=p_lesson and course_id=e.course_id and status='published') then raise exception 'Aula não autorizada'; end if;
 insert into academy_progress(enrollment_id,course_id,lesson_id,completed_at) values(e.id,e.course_id,p_lesson,case when p_complete then now() end)
 on conflict(enrollment_id,lesson_id) do update set updated_at=now(),
 completed_at=case when p_complete then coalesce(academy_progress.completed_at,now()) else academy_progress.completed_at end;
 update academy_enrollments set last_lesson_id=p_lesson where id=e.id;
 perform academy_refresh(e.id);
end;
$$;
create or replace function public.academy_submit(p_enrollment uuid,p_activity uuid,p_answers jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare e academy_enrollments; a academy_activities; q academy_questions; item jsonb;
 aid uuid; attempt_n integer; key_answer text; awarded numeric; earned numeric:=0; total numeric:=0;
 needs_review boolean:=false; ok boolean; response text;
begin
 select * into e from academy_enrollments where id=p_enrollment for update;
 select * into a from academy_activities where id=p_activity and course_id=e.course_id and status='published';
 if not academy_owns_enrollment(p_enrollment) or a.id is null then raise exception 'Atividade não autorizada'; end if;
 select coalesce(max(attempt_number),0)+1 into attempt_n from academy_attempts where enrollment_id=e.id and activity_id=a.id;
 if attempt_n>a.max_attempts then raise exception 'Limite de tentativas atingido'; end if;
 if jsonb_typeof(p_answers)<>'array' or jsonb_array_length(p_answers)<>(select count(*) from academy_questions where activity_id=a.id)
 or jsonb_array_length(p_answers)=0 then raise exception 'Responda todas as questões'; end if;
 insert into academy_attempts(enrollment_id,course_id,activity_id,attempt_number,status)
 values(e.id,e.course_id,a.id,attempt_n,'pending') returning id into aid;
 for q in select * from academy_questions where activity_id=a.id order by position loop
 select x into item from jsonb_array_elements(p_answers) x where x->>'question_id'=q.id::text;
 response=trim(item->>'answer');
 if response is null or response='' or length(response)>10000 or
 (select count(*) from jsonb_array_elements(p_answers) x where x->>'question_id'=q.id::text)<>1 then raise exception 'Resposta inválida'; end if;
 total=total+q.points;
 if q.type in ('essay','practical') then needs_review=true; ok=null; awarded=null;
 else
 select answer into key_answer from academy_answer_keys where question_id=q.id;
 if key_answer is null then raise exception 'Atividade incompleta: falta gabarito'; end if;
 ok=lower(trim(key_answer))=lower(response); awarded=case when ok then q.points else 0 end; earned=earned+awarded;
 end if;
 insert into academy_answers(attempt_id,question_id,answer,correct,points_awarded,elapsed_seconds)
 values(aid,q.id,response,ok,awarded,greatest(0,least(86400,coalesce((item->>'elapsed_seconds')::integer,0))));
 end loop;
 update academy_attempts set score=case when needs_review then null else round(100*earned/total,2) end,
 status=case when needs_review then 'pending' when 100*earned/total>=a.passing_score then 'passed' else 'failed' end where id=aid;
 perform academy_refresh(e.id); return aid;
end;
$$;
create or replace function public.academy_review_attempt(p_attempt uuid,p_grades jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare t academy_attempts; a academy_activities; ans record; grade jsonb; earned numeric; total numeric;
begin
 select * into t from academy_attempts where id=p_attempt for update;
 if t.id is null or not academy_can_edit(t.course_id) then raise exception 'Revisão não autorizada'; end if;
 if t.status<>'pending' then raise exception 'Tentativa já revisada'; end if;
 select * into a from academy_activities where id=t.activity_id;
 for ans in select r.id,r.question_id,q.points from academy_answers r join academy_questions q on q.id=r.question_id
 where r.attempt_id=t.id and r.points_awarded is null loop
 select x into grade from jsonb_array_elements(p_grades) x where x->>'answer_id'=ans.id::text;
 if grade is null or (grade->>'points')::numeric is null or (grade->>'points')::numeric<0 or (grade->>'points')::numeric>ans.points then raise exception 'Pontuação inválida'; end if;
 update academy_answers set points_awarded=(grade->>'points')::numeric,
 correct=((grade->>'points')::numeric=ans.points),feedback=coalesce(grade->>'feedback','') where id=ans.id;
 end loop;
 select sum(r.points_awarded),sum(q.points) into earned,total from academy_answers r join academy_questions q on q.id=r.question_id where r.attempt_id=t.id;
 update academy_attempts set score=round(100*earned/total,2),status=case when 100*earned/total>=a.passing_score then 'passed' else 'failed' end,
 reviewed_by=auth.uid(),reviewed_at=now() where id=t.id;
 perform academy_refresh(t.enrollment_id);
end;
$$;
create or replace function public.academy_report() returns table(
 enrollment_id uuid,course_id uuid,user_id uuid,total_units bigint,completed_units bigint,progress integer,completed_at timestamptz,last_lesson_id uuid,course_title text,competencies text[],hours numeric
) language sql stable security definer set search_path=public as $$
 select e.id,e.course_id,e.user_id,u.n,u.d,case when u.n=0 then 0 else (100*u.d/u.n)::integer end,
 case when u.n>0 and u.n=u.d then coalesce(e.completed_at,greatest(e.enrolled_at,
 (select max(p.completed_at) from academy_progress p where p.enrollment_id=e.id),
 (select max(coalesce(t.reviewed_at,t.submitted_at)) from academy_attempts t where t.enrollment_id=e.id and t.status='passed'))) end,
 e.last_lesson_id,c.title,c.competencies,c.hours
 from academy_enrollments e join academy_courses c on c.id=e.course_id cross join lateral(select count(*) n,count(*) filter(where done) d from academy_units(e.id)) u
 where e.status='active' and ((e.user_id=auth.uid() and academy_member()) or academy_can_edit(e.course_id));
$$;
-- Published questions and answer keys cannot change under existing attempts.
create or replace function public.academy_guard_question() returns trigger
language plpgsql security definer set search_path=public as $$
declare aid uuid; qid uuid;
begin
 if tg_table_name='academy_answer_keys' then
 qid=case when tg_op='DELETE' then old.question_id else new.question_id end;
 select activity_id into aid from academy_questions where id=qid;
 else aid=case when tg_op='DELETE' then old.activity_id else new.activity_id end; end if;
 if exists(select 1 from academy_activities where id=aid and status='published')
 or exists(select 1 from academy_attempts where activity_id=aid) then
 raise exception 'Para alterar questões, use uma atividade em rascunho sem tentativas. Crie uma nova versão quando houver histórico.'; end if;
 if tg_op='UPDATE' and tg_table_name='academy_questions' then
 if exists(select 1 from academy_attempts where activity_id=old.activity_id) then raise exception 'Questão possui histórico'; end if; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end;
$$;
create trigger academy_guard_question before insert or update or delete on public.academy_questions for each row execute function public.academy_guard_question();
create trigger academy_guard_key before insert or update or delete on public.academy_answer_keys for each row execute function public.academy_guard_question();
create or replace function public.academy_guard_activity() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if tg_op='UPDATE' and exists(select 1 from academy_attempts where activity_id=old.id) and
 (new.passing_score<>old.passing_score or new.course_id<>old.course_id or new.kind<>old.kind) then
 raise exception 'Preserve as regras de uma atividade com tentativas. Crie uma nova versão.'; end if;
 if new.status='published' then
 if not exists(select 1 from academy_questions where activity_id=new.id) then raise exception 'Adicione questões antes de publicar a atividade'; end if;
 if exists(select 1 from academy_questions q left join academy_answer_keys k on k.question_id=q.id
 where q.activity_id=new.id and q.type in ('choice','boolean','short') and (k.answer is null or trim(k.answer)='' or
 (q.type='choice' and (cardinality(q.options)<2 or not k.answer=any(q.options))) or
 (q.type='boolean' and k.answer not in ('verdadeiro','falso')))) then raise exception 'Revise as alternativas e os gabaritos antes de publicar'; end if;
 end if;
 return new;
end;
$$;
create trigger academy_guard_activity before insert or update on public.academy_activities for each row execute function public.academy_guard_activity();

-- Atomic question + answer-key save, with explicit scoped authorization.
create or replace function public.academy_save_question(p_question jsonb,p_answer text) returns uuid
language plpgsql security definer set search_path=public as $$
declare qid uuid; aid uuid; old_aid uuid; cid uuid;
begin
 aid=(p_question->>'activity_id')::uuid; qid=coalesce((p_question->>'id')::uuid,gen_random_uuid());
 select course_id into cid from academy_activities where id=aid;
 if cid is null or not academy_can_edit(cid) then raise exception 'Questão não autorizada'; end if;
 select activity_id into old_aid from academy_questions where id=qid;
 if old_aid is not null and not exists(select 1 from academy_activities where id=old_aid and academy_can_edit(course_id)) then raise exception 'Questão não autorizada'; end if;
 insert into academy_questions(id,activity_id,prompt,type,options,points,position,time_limit_seconds)
 values(qid,aid,p_question->>'prompt',p_question->>'type',
 array(select jsonb_array_elements_text(coalesce(p_question->'options','[]'::jsonb))),
 coalesce((p_question->>'points')::numeric,1),coalesce((p_question->>'position')::integer,0),(p_question->>'time_limit_seconds')::integer)
 on conflict(id) do update set activity_id=excluded.activity_id,prompt=excluded.prompt,type=excluded.type,
 options=excluded.options,points=excluded.points,position=excluded.position,time_limit_seconds=excluded.time_limit_seconds;
 insert into academy_answer_keys(question_id,answer) values(qid,coalesce(p_answer,''))
 on conflict(question_id) do update set answer=excluded.answer;
 return qid;
end;
$$;
create or replace function public.academy_guard_enrollment() returns trigger
language plpgsql security definer set search_path=public as $$
begin
 if (new.user_id<>old.user_id or new.course_id<>old.course_id) and
 (exists(select 1 from academy_progress where enrollment_id=old.id) or exists(select 1 from academy_attempts where enrollment_id=old.id)) then
 raise exception 'Uma matrícula com histórico não pode ser transferida. Crie uma nova matrícula.'; end if;
 return new;
end;
$$;
create trigger academy_guard_enrollment before update on public.academy_enrollments for each row execute function public.academy_guard_enrollment();
-- Explicit execute grants: anonymous callers cannot invoke any academy helpers.
do $$ declare r record; begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname like 'academy_%' loop
 execute format('revoke all on function %s from public,anon,authenticated',r.signature);
 if r.signature::text !~ 'academy_(units|refresh|touch|course_publish|guard_question|guard_activity|guard_enrollment)\(' then
 execute format('grant execute on function %s to authenticated',r.signature); end if;
 end loop;
end $$;
-- Reuse Supabase Storage, but isolate private course assets from public site buckets.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('academy','academy',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','application/pdf','audio/mpeg','audio/ogg','audio/wav','video/mp4','video/webm','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.presentationml.presentation'])
on conflict(id) do nothing;
create policy academy_asset_read on storage.objects for select to authenticated using(
 bucket_id='academy' and exists(select 1 from public.academy_courses c where c.id::text=split_part(name,'/',1)
 and (public.academy_can_edit(c.id) or (public.academy_can_read(c.id) and (c.cover_path=name
 or exists(select 1 from public.academy_lessons l where l.course_id=c.id and l.media_path=name and l.status='published')
 or exists(select 1 from public.academy_materials m where m.course_id=c.id and m.storage_path=name))))));
create policy academy_asset_insert on storage.objects for insert to authenticated with check(
 bucket_id='academy' and exists(select 1 from public.academy_courses c where c.id::text=split_part(name,'/',1) and public.academy_can_edit(c.id)));
create policy academy_asset_delete on storage.objects for delete to authenticated using(
 bucket_id='academy' and exists(select 1 from public.academy_courses c where c.id::text=split_part(name,'/',1) and public.academy_can_edit(c.id)));
commit;
