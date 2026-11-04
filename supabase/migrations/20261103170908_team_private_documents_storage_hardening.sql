begin;
-- Políticas globais antigas permitem UPDATE/DELETE a admins em qualquer bucket.
-- Impedir operações diretas especificamente no bucket de documentos internos.
-- A função protegida team-documents opera com service_role e registra auditoria.
drop policy if exists team_private_docs_block_direct_update on storage.objects;
create policy team_private_docs_block_direct_update
  on storage.objects as restrictive for update to authenticated
  using (bucket_id <> 'team-internal-docs')
  with check (bucket_id <> 'team-internal-docs');
drop policy if exists team_private_docs_block_direct_delete on storage.objects;
create policy team_private_docs_block_direct_delete
  on storage.objects as restrictive for delete to authenticated
  using (bucket_id <> 'team-internal-docs');
commit;
