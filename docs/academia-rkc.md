# Academia RKC — auditoria, arquitetura e ativação

## Diagnóstico antes da implementação

Base auditada: `2295c2781059ea834353d516694f4835e0de6759`, branch `main`.
A cópia local começou limpa. Antes da entrega, a branch foi atualizada sobre `efd698c5f486991618b11991bc116d5d01087004`, preservando as correções de tarefas e Financeiro recebidas durante o trabalho. Há um PR aberto de Google Drive (`#147`), ainda em rascunho; esta implementação não incorpora nem altera esse trabalho.

A aplicação usa React 18, TypeScript, Vite 6, React Router 7, Tailwind 4 e componentes Radix. O Admin tem layout compartilhado, sidebar desktop e navegação móvel. As páginas são carregadas por `lazy`, com proteção por loaders. O deploy existente usa GitHub Pages e `npm ci` / `npm run build` na branch `main`.

A autenticação existente é Supabase Auth. `roles` / `user_roles` são a fonte de permissões e `equipe.user_id` conecta o integrante a `auth.users.id`. `profiles` aparece no histórico financeiro e de tarefas, mas não é reutilizado como identidade acadêmica: não há nova tabela de usuários. Os cinco perfis do painel são `admin_alfa`, `admin`, `editor`, `autor` e `financeiro`.

O repositório contém migrations incrementais, mas não um baseline completo do schema remoto nem credenciais de execução do banco. A auditoria foi feita sobre os arquivos versionados; não equivale a uma inspeção do Supabase em produção. Antes de aplicar a migration, confirmar `equipe(id,user_id,nome)`, `roles(id,name)` e `user_roles(user_id,role_id)` no ambiente de destino.

As imagens do site usam buckets públicos do Supabase Storage; o módulo de tarefas tem armazenamento privado. A Academia reutiliza esse serviço com um bucket privado `academy`, pois conteúdo interno não deve ser enviado aos buckets públicos. O núcleo Google Drive ainda está no PR #147: não se presume que ele esteja operacional. Vídeos acima de 50 MB são referências HTTPS a um provedor com controle de acesso adequado; nenhum binário é salvo nas tabelas.

**Play Moments:** o texto anexado pede comparação com um repositório/diretório de referência, mas nenhum foi anexado ou identificado. Os repositórios disponíveis no conector são `novositerkc` e `rkcintegrado`; não foi feita uma auditoria fictícia da Play Moments. Os conceitos de curso/módulo/aula, questões sequenciais, tentativas, progresso e revisão seguem a especificação. Autenticação, identidade visual, esquema de usuários e layout de outro produto não são copiados.

## Mapa técnico e ordem de implementação

1. Schema relacional, constraints, índices, funções e RLS.
2. Tipos, serviço de acesso ao Supabase, hook de carregamento e permissões existentes.
3. Rotas e menu no Admin desktop/móvel.
4. Gestão de cursos, módulos, aulas, materiais, categorias, instrutores e publicação.
5. Matrículas, catálogo, Minha Academia, leitura/player, conclusão explícita e retomada.
6. Atividades/avaliações, questões uma por vez, tentativas e correção no servidor.
7. Contribuições, revisão editorial e compartilhamento aprovado.
8. Dashboard, relatórios por integrante/curso, pendências e CSV.
9. Checagem TypeScript/lint, testes de SQL/RLS, build e testes de interface.

### Tabelas e relacionamentos

| Tabelas | Relação / finalidade |
| --- | --- |
| `academy_categories` | Categoria de cursos |
| `academy_courses` | Curso, visibilidade, acesso, preço futuro, disponibilidade e publicação |
| `academy_modules` | Curso → módulos ordenados |
| `academy_lessons` | Módulo/curso → aulas; FK composta impede aulas no curso errado |
| `academy_materials` | Curso/aula → referências HTTPS ou arquivos privados |
| `academy_instructors` | `equipe.id` ou nome externo, sem novo login |
| `academy_course_instructors` | N:N de instrutores e cursos, com edição explicitamente delegada |
| `academy_enrollments` | Curso + `auth.users.id`, matrícula única, origem, obrigatoriedade, retomada e conclusão |
| `academy_progress` | Matrícula + aula, início e conclusão explícita; FKs compostas validam o curso |
| `academy_activities` | Atividade ou avaliação, opcionalmente ligada à aula, nota mínima e tentativas |
| `academy_questions` | Questões, alternativas, pontos, ordem e tempo recomendado |
| `academy_answer_keys` | Gabaritos separados; nenhum SELECT para alunos |
| `academy_attempts` / `academy_answers` | Tentativa, resposta, tempo informado, pontuação, acerto e revisão |
| `academy_contributions` | Autor, conteúdo, referência, rascunho/revisão/aprovação/devolução e auditoria |
| `academy_learning_paths` / `academy_learning_path_courses` | Fundação futura de trilhas; sem interface na V1 |
| `academy_certificates` | Fundação de emissão e validação; sem emissão de PDF na V1 |
| `academy_settings` | Nome e mensagem de boas-vindas |

### Rotas e componentes

| Rota | Experiência |
| --- | --- |
| `/admin/academia` | Minha Academia, catálogo e contribuições; gestão conforme papel |
| `/admin/academia/cursos/:courseId` | Apresentação, módulos, materiais e atividades gerais |
| `/admin/academia/cursos/:courseId/aulas/:lessonId` | Leitor/player, prática contextual, conclusão e atividades da aula |

`Academia.tsx` integra navegação, dashboard e painéis de gestão. `Study.tsx` contém leitor/player e execução sequencial de questões. `components.tsx` reutiliza Button, Dialog, Input e Textarea do projeto e compõe cards, progresso e arquivos assinados. `fields.ts` define os formulários; `types.ts`, `service.ts` e `useAcademy.ts` isolam contratos e acesso aos dados.

### Permissões

| Perfil | Acesso |
| --- | --- |
| Todos os cinco papéis do Admin | Menu Academia, catálogo autorizado, matrícula de livre adesão, próprio estudo/progresso/tentativas e contribuições |
| `admin` e `admin_alfa` | Gestão completa, matrículas, categorias, instrutores, revisão editorial e relatórios |
| Instrutor interno com `can_edit` no curso | Conteúdo, questões, correção e relatórios daquele curso; não pode atribuir instrutores ou ampliar a própria permissão |
| Instrutor externo | Perfil para apresentação; sem acesso de login delegado na V1 |
| Anônimo / usuário sem papel no Admin | Nenhum acesso à Academia |

Courses manuais são lidos por alunos matriculados; cursos de adesão/automáticos publicados podem ser consultados pelos papéis do painel dentro da disponibilidade. Rascunhos e gabaritos não são expostos a alunos. O banco impede escrita direta de progresso e tentativas: RPCs verificam propriedade e curso. Administradores não precisam ser vinculados à equipe para estudar com sua conta existente.

## Como ativar

Migration: `supabase/migrations/20261001180000_academia_rkc.sql`.
Ela cria somente objetos `academy_*`, adiciona um bucket privado e três políticas específicas nesse bucket. Não remove tabelas, dados, políticas ou funcionalidades existentes. Usa uma transação e não semeia cursos/conteúdos fictícios.

1. Conferir as dependências de identidade no Supabase de destino.
2. Aplicar a migration pelo fluxo SQL/migrations do projeto. Ela é versionada, de execução única; não reaplicar manualmente após sucesso.
3. Confirmar RLS e policies do bucket privado. Auditar políticas anteriores genéricas de `storage.objects`: políticas permissivas que aceitem qualquer bucket podem alargar o acesso e precisam ser corrigidas no ambiente real.
4. Integrar o PR e deixar o workflow existente compilar/publicar o frontend.
5. Entrar com `admin` ou `admin_alfa`, abrir Academia, cadastrar categorias/instrutores, criar curso em rascunho e completar o conteúdo.
6. Criar módulos, aulas e materiais. Salvar o curso antes de enviar capa; uploads exigem ID do curso existente.
7. Criar atividades em rascunho, cadastrar questões/gabaritos, depois publicar atividades e aulas.
8. Publicar o curso como interno; escolher matrícula manual, livre adesão ou automática ao iniciar.
9. Matricular integrantes manualmente quando necessário; testar também `editor`, `autor` e `financeiro`.

**A migration não foi executada no Supabase remoto.** A existência do arquivo ou a integração do PR não ativa as tabelas no banco. Sem a migration, a interface exibe orientação e permite tentar novamente.

## Regras acadêmicas da V1

- Abrir uma aula registra início e retomada, nunca conclusão automática. O botão de concluir grava a conclusão individual.
- Progresso usa aulas publicadas obrigatórias; se não houver obrigatórias, usa todas as aulas publicadas. Soma também atividades/avaliações publicadas obrigatórias. Zero etapas = 0%, nunca curso concluído.
- Atividades opcionais não bloqueiam conclusão. Aulas opcionais ficam fora do denominador quando existem obrigatórias.
- Questões objetivas são corrigidas no servidor. A nota enviada pelo cliente é ignorada. Discursivas e práticas aguardam correção do instrutor/admin.
- O gabarito de escolha deve ser o texto exato da alternativa; verdadeiro/falso usa `verdadeiro` ou `falso`; resposta curta usa correspondência sem distinguir maiúsculas, com remoção de espaços externos.
- Questões/gabaritos de atividades publicadas ou com tentativas não podem ser alterados. Use rascunho antes da aplicação ou crie nova atividade para preservar o histórico.
- Tempo por questão é recomendado e o tempo utilizado é informado pelo cliente. Não é um temporizador obrigatório nem proteção contra fraude na V1.
- Contribuições aprovadas entram no mural interno de conhecimento. Não viram aulas publicadas automaticamente.
- Competências de cursos concluídos aparecem no histórico interno. Não são publicadas no portfólio público.
- Cursos públicos, pagamentos, trilhas, certificados, grupos/funções, turmas e envio de arquivos em atividades são evolução futura. O banco contempla os fundamentos aplicáveis; a V1 não anuncia checkout ou emissão de certificado disponíveis.
- Alterações no currículo publicado recalculam o progresso por suas etapas atuais. Para preservar formações históricas, criar novo curso em vez de alterar o conjunto de etapas de um curso já aplicado.
- Arquivos privados têm links assinados de 15 minutos; reabrir a página renova o link. Ao abandonar um formulário após upload, o arquivo pode ficar órfão; a remoção operacional pode ser feita no Storage, sem exclusão automática de material referenciado.

## Validação

```sh
npm ci
npm run typecheck:academia
npm run lint:academia
npm run test:academia
npm run build
```

Não existiam scripts de TypeScript, lint ou testes no projeto. As checagens adicionadas abrangem o módulo acadêmico e suas dependências importadas; não alegam validar todos os módulos legados com lint/TypeScript estrito. As ferramentas adicionadas são dependências de desenvolvimento.

Os testes de banco executam a migration real sobre PostgreSQL via PGlite, com fixture mínima para os schemas de identidade/Storage do Supabase. Validam RLS usando os papéis `authenticated` e `anon`, os cinco papéis do painel, alunos distintos e instrutor delegado. Isso não substitui a verificação do schema/policies reais de produção.

O primeiro build encontrou JSX em `Financeiro/routes.ts`. A correção desse erro entrou na branch principal pelo PR #150 durante o trabalho; esta implementação foi atualizada sobre ela e preserva o arquivo do Financeiro. A leitura de papéis agora aceita a associação Supabase como objeto ou array, mantendo a mesma regra de autorização.

### Resultado dos checks desta entrega

TypeScript do módulo, lint, nove testes de PostgreSQL/RLS e build de produção passaram. A interface foi exercitada em Chromium com respostas Supabase simuladas e identificadas como fixtures de teste: os cinco papéis no desktop (1280 px), criação de curso, aula/conclusão/atividade em celular (390 px), ausência de rolagem horizontal e mensagem de migration ausente. As fixtures não são inseridas no banco da RKC. O estudo e os testes visuais não foram executados contra contas ou dados reais de produção.
