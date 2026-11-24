# FAJ — II Ciclo: mapa do formulário narrativo

Fonte analisada: **Formulário Narrativo - II Ciclo - Rede Kalunga Comunicações.docx**, 8 páginas. Este documento registra a estrutura observada no arquivo recebido; não substitui nem altera o modelo oficial.

## Regras de preservação

- O DOCX oficial deve ser mantido como arquivo-base, sem reconstruir sua identidade visual.
- O painel RKC coleta os dados uma única vez.
- A geração do DOCX deve preencher uma cópia do modelo oficial, preservando ordem, títulos, perguntas, tabelas, estilos, imagens e paginação sempre que tecnicamente possível.
- Respostas já preenchidas no arquivo recebido são dados desta prestação, não valores fixos para futuras prestações.
- Campos sem conteúdo no modelo continuam disponíveis para preenchimento; não inventar respostas.

## 1. Informações institucionais

Campos identificados:
- Nome da organização
- Pessoa responsável pelo preenchimento
- Cargo
- Email (o documento apresenta duas linhas de email)
- Valor solicitado para o próximo ciclo
- Data do preenchimento

O valor solicitado deve ser armazenado numericamente e formatado em moeda no DOCX. A data deve ser armazenada como data, sem texto digitado manualmente.

## 2. Perguntas narrativas

Preservar integralmente os enunciados e textos auxiliares do documento.

### Pergunta 1
**O que significa desenvolvimento institucional para a sua organização e o que vocês desejam alcançar nesse sentido em 2027?**

Orientação do formulário: relacionar a intenção à missão da organização, à realidade do território e aos valores que orientam o jornalismo, incluindo interesse público, diversidade, equidade e independência editorial.

Campo de resposta: texto longo.

### Pergunta 2
**Quais mudanças institucionais vocês pretendem priorizar em 2027 e por que elas são importantes para a organização?**

Orientação do formulário: considerar aspectos como organização da equipe, governança, planejamento, processos administrativos, gestão financeira e sustentabilidade; não é necessário contemplar todos.

Campo de resposta: texto longo.

### Pergunta 3
**Como vocês pretendem colocar essas prioridades em prática ao longo de 2027?**

Orientação do formulário: descrever ações, responsabilidades, recursos e apoios necessários, incluindo mentorias, encontros e trocas na rede do Travessias quando pertinente, além dos obstáculos previstos.

Campo de resposta: texto longo.

### Pergunta 4
**Ao final de 2027, que mudanças concretas permitiriam reconhecer que a organização se desenvolveu institucionalmente?**

Orientação do formulário: explicar sinais ou evidências a acompanhar e como essas mudanças contribuem para a continuidade da organização, qualidade e regularidade da produção jornalística e relação com a comunidade local.

Campo de resposta: texto longo.

## 3. Impacto e Engajamento

O formulário apresenta uma tabela com estas colunas:
- Canal/Formato
- Indicador utilizado
- Resultado no período de 2025
- Resultado no período de 2026 (atual)
- Variação entre os períodos
- Observações

Canais/formatos listados no documento:
1. Instagram
2. Facebook
3. TikTok
4. LinkedIn
5. Site ou Portal
6. Podcast ou Conteúdo audiovisual
7. Jornal impresso / conteúdos impressos
8. Newsletters
9. Outros canais de transmissão

Indicadores descritos no próprio formulário:
- Instagram, Facebook, TikTok e LinkedIn: número de seguidores; interações com as publicações; alcance e visualizações dos conteúdos.
- Site ou Portal: números de visitantes.
- Podcast ou Conteúdo audiovisual: número de reproduções e número de ouvintes.
- Jornal impresso / conteúdos impressos: exemplares impressos e exemplares distribuídos.
- Newsletters: número de assinantes.
- Outros canais de transmissão: indicadores relevantes para a organização.

A tabela deve permitir múltiplos indicadores por canal, pois o formulário lista mais de um indicador para vários canais. Não presumir que a variação seja sempre uma porcentagem: preservar o valor/expressão informado e, quando calculada pelo sistema, mostrar também a regra de cálculo usada.

## 4. Imagens e elementos visuais

O documento contém dois espaços/legendas identificados como **Imagem Rede Integra 2026** dentro da resposta à Pergunta 1. A geração deve preservar as imagens do modelo original e não substituí-las por imagens genéricas.

## 5. Mapeamento de dados sugerido para o painel

- `institution.name`
- `institution.responsible_person`
- `institution.responsible_role`
- `institution.emails[]`
- `institution.requested_amount`
- `institution.filled_at`
- `narrative.question_1`
- `narrative.question_2`
- `narrative.question_3`
- `narrative.question_4`
- `impact.channels[]` com `channel`, `indicators[]`, `result_2025`, `result_2026`, `variation` e `observations`

Essas chaves são uma proposta interna de armazenamento; não alteram os rótulos nem a ordem do formulário oficial.

## 6. Pendência de validação

A planilha financeira oficial do FAJ II Ciclo ainda não foi localizada entre os arquivos disponíveis nesta etapa. Portanto, abas, células, fórmulas, validações, listas e dependências financeiras não estão mapeadas aqui. Não configurar nem gerar a planilha financeira até conferir o arquivo original.
