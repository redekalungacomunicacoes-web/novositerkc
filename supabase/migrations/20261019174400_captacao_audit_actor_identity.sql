-- Keep the audit trail attributable even when the account has no equipe link.
create or replace function public.captacao_audit_change()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_row jsonb; v_id uuid; v_edital_id uuid; v_actor uuid := auth.uid(); v_name text;
begin
  v_row := case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
  v_id := (v_row->>'id')::uuid;
  v_edital_id := coalesce(nullif(v_row->>'edital_id','')::uuid, v_id);
  select e.nome into v_name from public.equipe e where e.user_id=v_actor and coalesce(e.ativo,true) limit 1;
  insert into public.captacao_auditoria(entity,entity_id,edital_id,action,actor_id,actor_name,detail,changes)
  values (tg_table_name,v_id,v_edital_id,lower(tg_op),v_actor,coalesce(v_name, case when v_actor is not null then 'Usuário ' || left(v_actor::text,8) else 'Sistema' end),coalesce(v_row->>'protocol',v_row->>'title',v_row->>'description',v_row->>'file_name',''),
    jsonb_build_object('before',case when tg_op='INSERT' then null else to_jsonb(old) end,'after',case when tg_op='DELETE' then null else to_jsonb(new) end));
  if tg_op='DELETE' then return old; end if;
  return new;
end;
$$;
revoke all on function public.captacao_audit_change() from public, anon, authenticated;