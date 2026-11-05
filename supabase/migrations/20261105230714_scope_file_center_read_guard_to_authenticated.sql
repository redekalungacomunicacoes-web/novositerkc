begin;
-- O guard de file-center chama is_team_admin(), cujo EXECUTE não está
-- disponível para anon. Sua avaliação bloqueava joins de avatares públicos.
-- A regra file_center_anon_guard existente continua restringindo
-- todos os registros do módulo 'file-center' para visitantes.
alter policy file_center_read_guard on public.drive_files to authenticated;

notify pgrst, 'reload schema';
commit;
