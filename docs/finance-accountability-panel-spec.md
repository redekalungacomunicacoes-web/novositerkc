# Especificação funcional — Painel de prestação de contas RKC

## Objetivo
Estender o módulo Financeiro existente para administrar prestações de contas vinculadas a editais e modelos oficiais versionados. Não criar um segundo cadastro financeiro nem duplicar fundos, projetos ou movimentações já existentes.

Esta especificação cobre o fluxo administrativo e a parte narrativa já mapeada do FAJ II Ciclo. A configuração financeira específica do FAJ permanece bloqueada até a conferência da planilha oficial.

## 1. Navegação do módulo
Adicionar ao módulo Financeiro uma área **Prestações de contas**, com estas visões:
1. **Visão geral** — prestações em rascunho, em revisão, aprovadas, publicadas e arquivadas; prazos e pendências.
2. **Modelos oficiais** — catálogo de instituições, editais, ciclos e versões dos modelos.
3. **Prestações** — lista pesquisável com edital/ciclo, fundo, projeto, período, responsável e situação.
4. **Histórico** — trilha de alterações e documentos gerados, acessível a quem tem permissão financeira.

Manter o padrão visual e a navegação do painel administrativo RKC.

## 2. Criar uma prestação
Fluxo proposto:
1. Selecionar o modelo oficial e sua versão ativa.
2. Selecionar um fundo já cadastrado no módulo Financeiro.
3. Selecionar o projeto relacionado, quando houver.
4. Informar título, código de referência e período da prestação.
5. Criar como rascunho e abrir o formulário de preenchimento.

Não criar automaticamente um segundo fundo ou projeto quando já existir um registro correspondente. Se faltar um cadastro necessário, permitir criá-lo no fluxo e reutilizar o registro recém-criado. Campos realmente desconhecidos ficam pendentes, sem valores inventados.

Uma prestação deve manter referência à versão exata do modelo usada na sua criação. Atualizar o modelo para uma versão futura não pode alterar prestações já abertas.

## 3. Formulário de preenchimento
Organizar o preenchimento em etapas, sem exigir que a pessoa abra ou edite diretamente o Excel ou o DOCX:
- **Identificação** — dados institucionais e responsáveis.
- **Financeiro** — dados e rubricas definidos pelo modelo oficial; integração com os registros existentes quando aplicável.
- **Plano de trabalho** — atividades, entregas e vínculos orçamentários, conforme o modelo.
- **Narrativa** — respostas às perguntas oficiais.
- **Impacto e engajamento** — canais, indicadores e resultados por período.
- **Documentos** — modelos originais, comprovantes e arquivos gerados.
- **Revisão** — pendências, validações e prévia dos documentos.

Salvar rascunhos sem exigir que todos os campos estejam preenchidos. Antes de enviar para revisão ou publicar, executar as validações obrigatórias específicas daquela versão do edital.

## 4. FAJ II Ciclo — campos narrativos mapeados

### Identificação institucional
- Nome da organização
- Pessoa responsável pelo preenchimento
- Cargo
- Emails (lista, pois o modelo apresenta duas linhas)
- Valor solicitado para o próximo ciclo
- Data do preenchimento

### Respostas narrativas
Armazenar separadamente as respostas integrais às quatro perguntas oficiais: narrative.question_1, narrative.question_2, narrative.question_3 e narrative.question_4.

O DOCX gerado deve manter os enunciados, orientações, ordem, tabelas, imagens, identidade visual e demais elementos do arquivo oficial. Preencher uma cópia do original; nunca sobrescrever o modelo-base.

### Impacto e engajamento
Estrutura flexível por canal e por indicador:
- canal/formato;
- um ou mais indicadores;
- resultado no período de 2025;
- resultado no período de 2026;
- variação informada ou calculada;
- observações.

Canais mapeados: Instagram, Facebook, TikTok, LinkedIn, Site ou Portal, Podcast ou Conteúdo audiovisual, Jornal impresso/conteúdos impressos, Newsletters e Outros canais de transmissão.

Não presumir que toda variação seja percentual. Quando houver cálculo automático, mostrar a fórmula/regra utilizada e permitir identificar valores informados manualmente.

## 5. Geração dos documentos oficiais
A geração deve ocorrer a partir dos dados salvos na prestação:
- **DOCX narrativo:** preencher uma cópia do modelo oficial, preservando estilos, textos fixos, tabelas, imagens e paginação sempre que tecnicamente possível.
- **Planilha financeira:** aguardar o mapeamento integral do XLSX oficial, incluindo abas, células de entrada, fórmulas, validações, listas, intervalos, células mescladas e dependências entre abas.
- **Anexos:** armazenar com nome, tipo, data, usuário responsável e relação com a prestação.

Cada geração cria um novo documento versionado, sem apagar o arquivo anterior. Registrar data, versão do modelo, usuário e checksum do arquivo gerado.

## 6. Situações e transições
- **Rascunho:** edição permitida.
- **Em revisão:** edição controlada; correções retornam à revisão com histórico.
- **Aprovada:** versão validada internamente, ainda não necessariamente pública.
- **Publicada:** disponibiliza somente a projeção pública aprovada.
- **Arquivada:** encerra o fluxo sem apagar registros ou documentos.

Toda transição deve registrar autor, data, ação e resumo. Não permitir publicação se faltarem campos obrigatórios, documentos exigidos ou aprovação definida pela RKC.

## 7. Transparência e proteção de dados
Não disponibilizar diretamente as tabelas administrativas nem os campos JSON integrais ao público.

A publicação deve usar uma projeção/visão segura com lista explícita de campos públicos e documentos individualmente aprovados. Por padrão, responsáveis, emails, dados pessoais, comprovantes e anexos internos permanecem privados.

Cada prestação publicada recebe um identificador/slug público permanente. Despublicar deve retirar o conteúdo do acesso público sem apagar o histórico interno.

## 8. Permissões
Acesso administrativo conforme os papéis já utilizados pelo RKC: admin_alfa, admin e financeiro, respeitando a matriz de permissões do painel.

A camada pública não deve depender de sessão administrativa nem herdar permissões de leitura das tabelas internas.

## 9. Critérios de aceite antes de produção
- O módulo atual de fundos, projetos e movimentações continua funcionando.
- Uma prestação referencia registros existentes, sem duplicá-los.
- Cada prestação mantém vínculo com a versão exata do modelo oficial.
- O preenchimento pode ser salvo parcialmente.
- A geração do DOCX preserva o modelo original.
- O XLSX só é configurado após auditoria do arquivo original.
- Documentos gerados e alterações anteriores permanecem no histórico.
- RLS e permissões são testadas com usuário financeiro, administrador e usuário sem permissão.
- A rota pública não expõe JSON privado nem anexos internos.
- Testes e revisão em ambiente controlado precedem qualquer aplicação de migration ou publicação.

## 10. Pendências bloqueadoras
1. Receber e auditar o XLSX oficial do FAJ II Ciclo.
2. Validar a migration com o schema real do projeto, inclusive a existência e assinatura de public.set_updated_at() e os tipos/relacionamentos de finance_funds e finance_projects.
3. Definir os campos/documentos que a RKC aprovará para publicação pública.
4. Implementar e testar a geração de DOCX/XLSX com cópias dos modelos oficiais.

Até a conclusão dessas etapas, a estrutura permanece em desenvolvimento e não deve ser aplicada ao banco de produção.
