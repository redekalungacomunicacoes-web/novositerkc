-- 001: permite publicar a equipe completa (seção `team_members`) na prestação de contas.
-- Edita a função atual por substituição de texto (3 edições). Se alguma edição não for
-- encontrada, aborta sem alterar nada. Se já aplicada, não faz nada.
-- Validada em dry-run com rollback no projeto yycfqeymdsjyulexwrlb. NÃO aplicada.
do $migration$
declare d text; n text;
begin
  select pg_get_functiondef('public.set_finance_accountability_publication(uuid,timestamptz,timestamptz,text,jsonb)'::regprocedure) into d;
  if position('team_members' in d) > 0 then return; end if;

  n := replace(d, $a$when 'team' then array['label','total','faj','other','count','roleComment','relationshipComment']$a$,
    $a$when 'team' then array['label','total','faj','other','count','roleComment','relationshipComment']
        when 'team_members' then array['name','relationship','monthly','months','faj','charges','notes']$a$);
  if n = d then raise exception 'Edição 1 não encontrada'; end if; d := n;

  n := replace(d, $a$'year','count','question'$a$, $a$'year','count','monthly','months','charges','question'$a$);
  if n = d then raise exception 'Edição 2 não encontrada'; end if; d := n;

  n := replace(d, $a$or (section.key = 'narrative' and jsonb_array_length(section.value) <> 4)$a$,
    $a$or (section.key = 'team_members' and jsonb_array_length(section.value) > 40)
         or (section.key = 'narrative' and jsonb_array_length(section.value) <> 4)$a$);
  if n = d then raise exception 'Edição 3 não encontrada'; end if; d := n;

  execute d;
end $migration$;
