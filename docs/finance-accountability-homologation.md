# Homologação das prestações FAJ II Ciclo

Use um projeto Supabase isolado com credenciais de teste e os mesmos pré-requisitos do painel Financeiro. Aplique as migrations do repositório em ordem, incluindo as de prestações, prazo, histórico, revisão, sincronização e exportação. Publique a função `drive-files` no projeto de homologação. Configure o frontend com a URL e a chave pública desse projeto, mantendo as chaves administrativas exclusivamente no servidor.

## Google Drive e modelos

- Configure a conta de serviço e a raiz institucional de homologação segundo as variáveis da integração existente. Habilite Drive e Google Sheets para a conta de serviço.
- Em `FINANCEIRO`, configure acesso limitado diretamente em `PRESTACOES_DE_CONTAS` e `MODELOS_OFICIAIS`. Conceda acesso apenas à equipe de teste autorizada. O backend valida a pasta antes de enviar arquivos.
- Cadastre cópias oficiais **em branco** revisadas na versão FAJ. Use os IDs do XLSX e do DOCX em `spreadsheet_template_path` e `narrative_template_path`. Configure `structure.faj_exports.xlsx_clean_template_sha256` e `structure.faj_exports.docx_clean_template_sha256` com os SHA-256 das cópias revisadas.
- Configure `structure.google_sheets_template_id` com o ID da cópia nativa em branco com as sete abas oficiais. Ela precisa preservar a estrutura, os campos, as fórmulas e as validações exigidas. O vínculo recusa uma planilha com dados de outra prestação.
- Confira os marcadores obrigatórios do DOCX em `faj-office-export.ts`. Insira-os na cópia revisada, nas posições oficiais. Preserve o documento original.
- A sincronização em segundo plano ocorre enquanto o rascunho está aberto e visível. O banco impede sobrescrita concorrente por revisão ou dados esperados. A operação no Sheets é verificada antes e depois da escrita, mas a API não oferece uma escrita condicional por versão da célula. Edite o mesmo campo em apenas uma interface durante a gravação.

## Aceite e publicação

Execute o build, as verificações TypeScript e Deno e os testes de regras locais. Em homologação, crie uma prestação privada e vincule fundo e projeto. Preencha e reabra o rascunho. Verifique escrita nos dois sentidos, conflito, repetição de uma operação e acesso por perfil. Gere o XLSX, o DOCX e o PDF consolidado, abra os arquivos pelo Drive, confira conteúdo, fórmulas e permissões e registre revisão, aprovação e entrega.

Somente após o aceite e autorização específica, aplique as migrations na produção, configure os modelos e permissões de produção, publique a função e disponibilize o frontend pela infraestrutura oficial. Preserve uma revisão anterior para rollback do código e mantenha os dados e o histórico.
