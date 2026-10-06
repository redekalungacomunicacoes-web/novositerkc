# Imagens institucionais no Drive

Os uploads de banner/território da Home, imagem principal do Quem Somos, logo e favicon passam pelo módulo `site` de `drive-files`. O backend valida a sessão, os papéis permitidos, a categoria, o tamanho (até 25 MB) e a assinatura do arquivo. SVG não é aceito neste fluxo; o seletor de favicon informa PNG/ICO.

O destino é `01_SITE/midias-ativas/<categoria>` na raiz institucional RKC. O SHA-256 e a categoria identificam um envio repetido; um lease serializa a descoberta de pastas e registro dos arquivos. Uma imagem já publicada nunca é sobrescrita ou excluída automaticamente. A seleção retorna uma URL que o formulário salva junto com as demais configurações.

Os campos existentes continuam em uso, inclusive `footer_logo_path` e `favicon_path`, agora compatíveis tanto com URL absoluta quanto com caminho legado do Storage. Isso permite implantação gradual e reversão sem mudança de schema.

## Migração de 6/10/2026

Cinco imagens ativas e a foto coletiva legada foram copiadas do backup para os destinos acima. A foto coletiva continua apenas no campo legado `about_team_image_url`; esta mudança não adiciona uma seção à página.

O snapshot anterior à migração fica em `maintenance.site_media_before_20261006`, sem acesso para anon/authenticated. Os objetos originais do Storage e os backups permanecem intactos. Os arquivos foram mantidos no tamanho original; a fotografia de território ainda pesa 10,86 MB. Otimização é uma etapa separada.

Validação: comparação SHA-256 entre os originais públicos do Storage e as respostas completas do proxy Drive; testes de autorização, formatos, idempotência e compatibilidade do resolvedor; TypeScript das páginas modificadas e build de produção. Não foi simulado login de um usuário real para validar um novo upload pela interface.

## Anexos privados pendentes

Os seis anexos legados de tarefas e dois do Financeiro não são movidos por esta alteração. As pastas `04_EQUIPE` e `05_FINANCEIRO` retornaram permissão `anyone:reader`; é necessário preparar destinos limitados antes de copiar documentos privados. O conector disponível não altera herança/permissões existentes. A correção exige a interface do Drive ou intervenção do proprietário. O fluxo financeiro atual é preservado até haver um destino privado validado.

Nenhuma limpeza de Storage faz parte desta alteração. Antes de excluir: confirmar a versão publicada, validar as referências ativas, verificar os demais consumidores e aprovar a lista definitiva.
