# Prestação de contas por edital — arquitetura inicial

## Objetivo

Adicionar ao módulo Financeiro existente da RKC uma camada configurável de prestação de contas por edital, sem substituir fundos, projetos, orçamento ou movimentações já existentes.

## Decisões de arquitetura

1. **Fundo e projeto continuam sendo cadastros centrais.** Uma prestação pode se relacionar a um fundo, a um projeto, ou aos dois.
2. **Modelo oficial é versionado.** Cada instituição/ciclo pode ter sua própria planilha, documento narrativo, identidade visual, regras, campos, abas e fórmulas.
3. **Cada prestação é uma instância.** Ela aponta para uma versão específica do modelo e guarda dados financeiros e narrativos separados.
4. **Arquivos originais são preservados.** O sistema registra os caminhos dos modelos oficiais e dos documentos gerados. Não se deve sobrescrever um modelo antigo quando a instituição publicar uma nova versão.
5. **Dashboard é uma projeção dos dados.** Não será uma terceira fonte de preenchimento. Indicadores financeiros, de atividades e de impacto derivam dos dados da prestação.
6. **Publicação é explícita.** Nenhum relatório é público por padrão. A futura camada pública deverá expor apenas os campos e documentos aprovados.
7. **Histórico é obrigatório.** Alterações relevantes devem registrar ator, data, ação e snapshot.

## Primeira configuração: FAJ — II Ciclo

O FAJ II Ciclo será o primeiro modelo cadastrado. A configuração detalhada ainda precisa ser extraída e conferida aba por aba e campo por campo a partir dos arquivos oficiais.

O mapa de configuração deverá registrar:

- nome e versão do modelo;
- arquivos oficiais de planilha e formulário narrativo;
- abas e ordem original;
- campos, tipos, obrigatoriedade e opções;
- fórmulas e dependências entre abas;
- seções e perguntas narrativas;
- tabelas de indicadores;
- regras de preenchimento;
- identidade visual, cabeçalhos e logotipos.

## Relações principais

`finance_funds` 1:N `finance_projects` (quando aplicável)

`finance_reporting_templates` 1:N `finance_accountability_reports`

`finance_funds` 1:N `finance_accountability_reports`

`finance_projects` 1:N `finance_accountability_reports`

`finance_accountability_reports` 1:N `finance_accountability_documents`

`finance_accountability_reports` 1:N `finance_accountability_history`

## Tabelas adicionadas

- `finance_reporting_templates`: catálogo versionado dos modelos oficiais.
- `finance_accountability_reports`: prestações criadas a partir de um modelo.
- `finance_accountability_documents`: modelos originais, planilhas/documentos gerados e anexos.
- `finance_accountability_history`: trilha de auditoria com snapshots.

Os dados preenchidos são armazenados em JSONB inicialmente para permitir modelos com estruturas diferentes. A configuração do modelo define como interpretar esses dados. Campos que exigirem relatórios transversais ou cálculos frequentes poderão ganhar tabelas relacionais específicas numa etapa posterior, sem perder o vínculo com o modelo original.

## Segurança

As novas tabelas ficam com RLS habilitado. O acesso de gestão utiliza a função `public.can_manage_finance_accountability()`, que reconhece os papéis `admin_alfa`, `admin` e `financeiro` já existentes em `user_roles`/`roles`. Não há política de leitura pública nesta etapa. A publicação pública será implementada por uma projeção segura, nunca expondo diretamente os campos privados ou o JSON completo.

## Próxima etapa

1. Revisar a migration e aplicá-la primeiro em ambiente controlado.
2. Conferir o resultado das tabelas e políticas no Supabase.
3. Criar a interface de cadastro/versões dos modelos.
4. Configurar o FAJ II Ciclo sem inventar campos ou fórmulas.
5. Construir o formulário de prestação a partir dessa configuração.
6. Implementar geração fiel dos arquivos Excel e DOCX.
7. Só então montar o dashboard e a publicação pública.
