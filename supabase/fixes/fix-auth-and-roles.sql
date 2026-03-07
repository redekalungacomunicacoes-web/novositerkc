-- Saneamento de autenticação e permissões (fonte principal: roles + user_roles)
-- Executar como usuário com permissão de leitura/escrita em auth.users e tabelas públicas.

begin;

-- 1) Normalizar email_login
update public.equipe
set email_login = lower(trim(email_login))
where email_login is not null
  and email_login <> lower(trim(email_login));

-- 2) Vincular equipe.user_id com auth.users por email_login
update public.equipe e
set user_id = u.id
from auth.users u
where e.email_login is not null
  and lower(trim(e.email_login)) = lower(trim(u.email))
  and (e.user_id is distinct from u.id);

-- 3) Diagnóstico: integrantes com email_login sem usuário no auth
-- Resultado esperado: zero linhas
select e.id as equipe_id, e.nome, e.email_login
from public.equipe e
left join auth.users u on lower(trim(e.email_login)) = lower(trim(u.email))
where e.email_login is not null
  and u.id is null
order by e.nome;

-- 4) Diagnóstico: usuários auth sem vínculo em equipe
select u.id as user_id, u.email
from auth.users u
left join public.equipe e on e.user_id = u.id
where e.id is null
order by u.email;

-- 5) Diagnóstico: conflitos de email_login duplicado em equipe
select lower(trim(email_login)) as email_normalizado, count(*) as total
from public.equipe
where email_login is not null
group by lower(trim(email_login))
having count(*) > 1
order by total desc, email_normalizado;

-- 6) Diagnóstico: user_id compartilhado por múltiplos integrantes
select user_id, count(*) as total_integrantes,
       string_agg(nome, ', ' order by nome) as integrantes
from public.equipe
where user_id is not null
group by user_id
having count(*) > 1
order by total_integrantes desc;

-- 7) Diagnóstico: usuários vinculados sem role
select e.id as equipe_id, e.nome, e.user_id, e.email_login
from public.equipe e
left join public.user_roles ur on ur.user_id = e.user_id
where e.user_id is not null
group by e.id, e.nome, e.user_id, e.email_login
having count(ur.role_id) = 0
order by e.nome;

-- 8) (Opcional) Seed de role autor para usuários vinculados sem role
-- Descomente para aplicar automaticamente.
-- insert into public.user_roles (user_id, role_id)
-- select distinct e.user_id, r.id
-- from public.equipe e
-- cross join public.roles r
-- left join public.user_roles ur on ur.user_id = e.user_id
-- where e.user_id is not null
--   and r.name = 'autor'
--   and ur.user_id is null;

commit;
