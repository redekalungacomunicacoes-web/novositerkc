# Academia RKC: autoria e Drive

## Entrega e estado

Alterações propostas na branch `feat/academia-drive-autoria`, baseada na main `0ebe21ff55f353e41aa3df57febe3b394ae218bc`. Não houve merge, aplicação de SQL, criação de pasta, upload real nem deploy destas melhorias.

Academia fica por último no menu compartilhado de desktop/mobile. A navegação secundária passa a ter Minha Academia, Cursos publicados, Editar meus cursos e um grupo de gestão. A confirmação de gravação dura quatro segundos e é limpa ao trocar área, curso ou rota.

A biblioteca mostra capa, descrição, autor, categoria e contagem de módulos/aulas, sem ações de edição. Editar meus cursos filtra `created_by = auth.uid()`, inclusive para administradores. A gestão separada preserva admin/admin_alfa e os instrutores com `can_edit` explicitamente atribuído. Os cinco perfis existentes podem criar cursos próprios. RLS valida inserção, autoria imutável, edição, materiais e leitura. Matrícula continua governando progresso/atividades; a leitura de publicados internos não depende mais da modalidade de matrícula. Disponibilidade e restrições administrativas existentes permanecem.

## Projeto e comparação do banco

Em 01/10/2026, o bundle publicado em `https://kalungacomunicacoes.org/assets/index-BfzTjuE7.js` referenciava `https://yycfqeymdsjyulexwrlb.supabase.co`. Isso confirma o projeto "Back-End Site"; o ref antigo de `utils/supabase/info.tsx` não é usado pelo cliente atual em `src/lib/supabase.ts`.

O histórico remoto retornou vazio. Existem 35 migrations na main; a PR #151 adiciona outras duas, enquanto esta branch adiciona somente o delta da Academia. Nenhum `db push` ou `migration repair` foi executado.

| Área | Schema observado | O que falta para este trabalho |
| --- | --- | --- |
| Academia original | As 19 tabelas, RLS ligado em todas, helpers e políticas da migration original existem. Há um curso, com autor preenchido. `academy_can_edit` ainda só admite admin/instrutor atribuído; `academy_can_read` ainda depende de matrícula nos cursos manuais. | Aplicar o delta revisado; não reaplicar a migration de criação. |
| Drive | `drive_files` existe com RLS ligado. Há política de leitura ampla para authenticated e política pública. | Colunas acadêmicas, vínculos, políticas restritivas, leases e RPCs atômicas. `access_scope` de drive_files, usado pela PR #151, também está ausente. |
| Tarefas | `context_type`, `context_id`, `progress`, `drive_folder_id`, `data_inicio` e `data_fim` existem. | Outros objetos da PR #151 não foram reconciliados. Não fazer merge dessa PR inteira como dependência. |
| Histórico antigo | Grande parte das tabelas/funções declaradas existe, apesar do histórico vazio. A inspeção de presença encontrou divergências em funções/tabelas antigas de tarefas/financeiro. | Comparação integral das definições de outros módulos permanece pendente; presença de objeto não comprova equivalência nem autoriza marcar uma migration aplicada. |

As funções `finance_compute_total`, `finance_movements_prepare_row`, `is_task_admin`, `notify_task_assignment_v2`, `notify_task_comment` e a tabela `task_comments`, declaradas em arquivos antigos, não apareceram no inventário público. Há outros objetos correspondentes no banco. Não alterar outros módulos ou preencher o histórico com base nesse inventário.

O Advisor remoto também mostrou problemas anteriores fora da Academia (por exemplo RLS desativado em finance_movements). Nenhuma alteração foi feita nesses módulos. Referência: [Advisor de RLS](https://supabase.com/docs/guides/database/database-linter?lint=0007_policy_exists_rls_disabled).

## Integração e destino

PR #151: aberta, draft, não merged, head `9fef23e9a35bc363e2f68d1a153e0345888bc380`. Foram reaproveitados somente `src/services/driveFiles.ts`, `_shared/google-drive.ts` e o handler `drive-files`, com extensões acadêmicas. A function publicada `drive-files` v2 difere do handler da PR e usa service_role sem as mesmas verificações por tarefa. Nenhuma function foi sobrescrita. `drive-media` não é usado para conteúdo da Academia.

A raiz informada pelo usuário é [RKC - SISTEMA DO SITE](https://drive.google.com/drive/folders/1Ua8aaikJEsyCSjhlVA-dpUHtuj_B2UcD), onde ficam também arquivos publicados no site. Portanto, a raiz pode manter acesso público de leitura; a validação da Academia não rejeita permissões públicas na raiz. A pasta `09_ACADEMIA` existe (ID `1CfwG9Hn8wKRDwI4AcdgAsaf_1DZg5kAw`) e a captura confirma “Limitar o acesso” ativado. Na mesma tela, a opção para editores alterarem permissões/compartilhamento também está ativa; a função não precisa desse poder. O perfil do Drive conectado é `playmomentsstudios@gmail.com` e o conector não consegue listar a pasta limitada, o que confirma que essa conta não recebeu acesso direto. A Edge Function usa OAuth refresh token quando configurado e service account apenas como fallback; não foi possível verificar qual identidade está configurada nos segredos do Supabase. A identidade ativa precisa ter Editor direto para que `canAddChildren` seja verdadeiro.

Antes de enviar:

1. Conferir se `GOOGLE_DRIVE_ROOT_FOLDER_ID` existente aponta à raiz acima. Não trocar OAuth ou usar o Drive pessoal da Play Moments.
2. Confirmar nome, tipo, propriedade e permissões pela integração existente. Um Shared Drive precisa ser identificado como RKC. Para pasta compartilhada da conta da própria RKC em Meu Drive, a configuração não secreta `GOOGLE_DRIVE_RKC_OWNER_EMAIL` deve corresponder ao proprietário real; não definir por suposição.
3. Reutilizar a única pasta existente entre `Academia` e `09_ACADEMIA`; se as duas existirem, bloquear por ambiguidade. Se nenhuma existir, bloquear e orientar a criação manual de `09_ACADEMIA`, com “Limitar o acesso” ativado antes do uso. O serviço nunca cria automaticamente essa pasta.
4. Confirmar que o campo `inheritedPermissionsDisabled` da pasta está ativo e que ela não tem permissões diretas `anyone`/`domain`. Conceder acesso Editor diretamente à identidade usada pela Edge Function. O helper usa o OAuth refresh token quando configurado e recorre à service account apenas sem OAuth; `capabilities.canAddChildren` confirma que a identidade ativa consegue gravar na pasta limitada. No conector Drive desta sessão, `playmomentsstudios@gmail.com` não tem acesso direto à `09_ACADEMIA`.
5. Validar a privacidade dos arquivos da Academia antes de confirmar o envio. A configuração de acesso público para outras pastas da raiz continua disponível para imagens, áudios e documentos publicados no site.

Hierarquia: `09_ACADEMIA/Cursos/<course UUID>/Capa` ou `Módulos/<module UUID>/Aulas/<lesson UUID>/Conteúdo|Materiais`. Títulos não fazem parte da chave da pasta. Arquivos gerais de curso usam `<course UUID>/Materiais`.

Capas, conteúdo de aula e múltiplos materiais passam por `drive-files`. A function verifica usuário, RLS e contexto, confirma o Drive, envia, confere privacidade e grava metadata + vínculo numa única RPC service-only. Leases evitam corridas; um upload UUID confirma/reutiliza a operação quando há resposta perdida. Falha de metadata desfaz o envio, sem anunciar sucesso. Substituição arquiva a versão anterior e tenta movê-la à lixeira; limpeza pendente fica visível apenas aos editores. Remoção atualiza vínculos e metadata. Conteúdo com arquivos ativos não é excluído silenciosamente.

A fila conserva arquivos e falhas durante navegação na Academia; um reload completo exige selecionar o arquivo novamente. Progresso é do envio HTTP; depois de 100%, o estado é "Confirmando gravação" até o backend confirmar Drive e banco. Downloads passam por RLS, retornam conteúdo autenticado com cache privado e usam Blob URLs locais revogadas; nenhum link público é gerado. Arquivos antigos de Storage permanecem legíveis, sem novos uploads nesse bucket. YouTube/Vimeo têm validação de domínio/ID e iframe de prévia.

## Verificações

- `npm ci --ignore-scripts`: passou, lockfile existente.
- `npm run typecheck:academia`: passou.
- `npm run lint:academia`: passou.
- `npm run build`: passou.
- `npm run test:academia`: **27 testes passaram** no run 13 (head `4df2a2003f17dfe4e1b7c8a056a417fc5db1894a`) do GitHub Actions. Testes PostgreSQL/PGlite reais de schema/RLS e testes com Google/Supabase HTTP simulados. Incluem autoria, leitores, admin/instrutor explícito, rascunhos, URLs inválidas, upload/download, erro do Google, rollback de metadata, substituição, remoção, retry e criação/reuso de pasta.
- `deno check --node-modules-dir=manual --config supabase/functions/drive-files/deno.json supabase/functions/drive-files/index.ts`: passou no run 13 com dependência Supabase fixada em 2.94.1, a versão do lockfile.
- Teste visual Playwright em GitHub Actions, no run 13 do head `4df2a2003f17dfe4e1b7c8a056a417fc5db1894a`: **passou**, incluindo os cinco perfis e mobile. O runner executou com Chromium; o bloqueio local de socket não se aplica ao resultado do CI.
- Upload/download real, acesso privado real, ID/reuso/criação real de `09_ACADEMIA`: **pendentes**, sem sessão de usuário RKC ou ferramentas de Drive expostas nesta sessão. Testes simulados não comprovam acesso ao Drive de produção.

## Publicação bloqueada

A main aciona GitHub Pages ao receber commits. Por isso esta entrega deve permanecer em PR draft até validar Drive real, aplicar **somente** `20261001194332_academia_autoria_drive.sql` com schema comparado e publicar o handler `drive-files` com seus arquivos compartilhados e `deno.json`. `verify_jwt` deve continuar true. Não publicar o frontend antes disso.

A ordem é: confirmar a raiz e a pasta pelo serviço existente → revisar/testar e aplicar o delta único → publicar a function validada → testar autor/leitor reais, upload, reabertura, download e erro → fazer merge e verificar o deploy. Não criar conteúdo fictício ou apagar o curso existente durante essa validação.

Arquivos principais: AdminSidebar/AdminLayout; Academia/Study/components/fields/service/types/useAcademy; DriveUploads/media; driveFiles; config/drive-files/deno.json e dois helpers; migration incremental; três suites de teste e runner visual; workflow validate-academia e esta documentação.
