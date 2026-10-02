# Auditoria e correção do banner da Academia — 02/10/2026

## Causa confirmada

O log da função `drive-files`, em 02/10/2026 às 13:58:56 UTC, retornava `P0001: Arquivo do Drive incompatível com este curso ou aula.` O código de main já separava os dois tipos, mas a função publicada v18 e o contrato SQL publicado estavam desatualizados. `academy_commit_drive` tratava `cover` e `banner` juntos, atribuindo o banner a `cover_drive_file_id`; o trigger de integridade da capa corretamente recusava o tipo banner.

A migração antiga `20261002024000_academia_course_banner.sql` também continha delimitadores `do $ / end $`, corrigidos para `$$`. O teste agora executa essas migrações de verdade, em vez de apenas verificar o upload simulado.

## Comportamento corrigido

- Banner independente, vinculado em `banner_drive_file_id` e na pasta `BANNER`; a capa mantém `CAPA` e seu campo atual.
- Componente `CourseBannerUpload` usa o transporte autenticado da capa. Selecionar a imagem inicia o envio imediatamente.
- Falha preserva a seleção e a prévia. Nova tentativa reutiliza o identificador do envio; fila em execução fica bloqueada entre instâncias. Sucesso só é refletido após confirmação do banco.
- Trocar o banner confirma o novo antes de arquivar e limpar o anterior; falha na limpeza mantém uma versão arquivada disponível para remoção. Remover banner exige confirmação e preserva a capa.
- Proteção contra envio/remoção simultâneos na interface e serialização/idempotência no banco. Referência de banner valida curso, tipo, escopo privado e estado ativo.
- Layout do editor no celular impede corte horizontal das ações e da apresentação.

## Publicação e evidências

1. Aplicada a migração existente `academia_banner_persistence_repair` no projeto `yycfqeymdsjyulexwrlb`.
2. Aplicada a nova `academia_banner_integrity`, com ACL exclusiva de service_role para commit e validação de referência.
3. Teste transacional no banco publicado: gravar banner, repetir a operação sem duplicar, substituir, rejeitar capa como banner e remover preservando a capa. Todos os dados de teste foram revertidos. Conferência posterior confirmou a mesma capa e nenhum banner de teste persistido.
4. Republicada `drive-files` v19, ACTIVE, JWT obrigatório. Conferidas todas as fontes TypeScript publicadas contra os arquivos de main, incluindo as correções de tarefas e central.
5. Frontend é publicado pelo workflow Pages depois do merge. Consultar a PR e o resultado do workflow para a confirmação do deploy.

## Validação

TypeScript de Academia/tarefas, lint Academia, build; 30 testes Academia, 15 tarefas e 6 central. O teste SQL cobre migrações, independência capa/banner, substituição, replay, estado removido e permissões. Playwright cobre upload automático, falha, retry com o mesmo token, download da prévia privada, troca/remoção e editor sem corte horizontal, incluindo 390 px e 1440 px. CI também verifica Deno. Capturas no artefato `academia-ui-evidence`.

Limite: não foi utilizado um login real do usuário para enviar uma imagem pelo navegador ao Drive. O banco publicado foi testado diretamente; Drive/HTTP e interface foram exercitados com fixtures. A consulta de advisors não apontou novos problemas nos objetos modificados; há avisos preexistentes fora do escopo (financeiro, newsletter e views legadas), listados pelo [linter do Supabase](https://supabase.com/docs/guides/database/database-linter).
