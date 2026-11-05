begin;
-- A página /quem-somos usa joins com drive_files para fotos públicas.
-- Expor somente as colunas não sensíveis necessárias; as políticas RLS
-- continuam impedindo acesso a documentos e arquivos privados.
grant select (id, public_slug) on table public.drive_files to anon;

-- O guard de academia chama funções restritas a usuários autenticados.
-- A regra academy_drive_anon_read_guard já impede leitura anônima
-- dos registros do módulo 'academy'.
alter policy academy_drive_read_guard on public.drive_files to authenticated;

notify pgrst, 'reload schema';
commit;
