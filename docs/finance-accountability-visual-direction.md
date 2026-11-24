# Direção visual — Dashboard de Prestação de Contas RKC

## Decisão de produto
Implementar o dashboard diretamente no projeto RKC, sem depender de um protótipo Figma como etapa obrigatória. O Figma pode ser usado depois para refinamento visual, mas a implementação deve ser o artefato principal e já trabalhar com os componentes, rotas e dados reais.

## Conceito
**Transparência que se entende. Gestão que se acompanha.**

Uma interface institucional contemporânea, confiável e editorial, com a identidade RKC. Deve parecer uma plataforma de transparência de alto padrão, não um sistema contábil genérico nem um template SaaS sem personalidade.

## Identidade visual
- Verde profundo RKC como cor de marca e navegação: referência inicial #0F3D2E.
- Verde secundário mais claro para estados positivos e gráficos.
- Dourado/areia quente como acento editorial, em referência ao Cerrado e à identidade visual RKC: referência inicial #E7C98A / #F4EBD8.
- Fundo geral em tom marfim muito claro, cartões brancos, bordas discretas e sombras leves.
- Texto principal em carvão/verde quase preto; texto auxiliar em cinza quente.
- Usar a marca/logotipo oficial RKC disponível no projeto; não desenhar logotipo substituto nem inventar selo institucional.

## Layout desktop
1. Barra lateral fixa e elegante com marca RKC, nome do módulo, navegação e perfil/permissão do usuário.
2. Cabeçalho do conteúdo com breadcrumb, título "Transparência e Prestação de Contas", contexto do ciclo selecionado e ações primárias.
3. Faixa de contexto destacando edital/ciclo ativo, organização, período de referência e estado da prestação.
4. Grade de indicadores com cartões de hierarquia clara:
   - Recursos recebidos
   - Total executado
   - Saldo disponível
   - Percentual de execução
   - Prestações pendentes / em revisão
   Cada cartão deve ter rótulo, valor formatado, explicação curta e comparação temporal somente quando houver dados confiáveis.
5. Área analítica:
   - evolução de entradas e saídas por período;
   - execução orçamentária por rubrica;
   - distribuição de despesas por categoria;
   - andamento das prestações por situação.
6. Lista de projetos/prestações recentes com status, valor, período, atualização e acesso aos detalhes.
7. Bloco de transparência pública com estado de publicação, link público e indicação de quais documentos foram liberados.

## Layout mobile
- Navegação recolhível.
- Indicadores em cartões empilhados ou carrossel horizontal acessível.
- Gráficos responsivos sem cortar rótulos.
- Tabelas convertidas em cartões com informação prioritária.
- Ações primárias sempre visíveis e alvos de toque confortáveis.

## Páginas internas
- **Visão geral:** panorama financeiro e status de prestação.
- **Prestações de contas:** lista, filtros por edital, ciclo, fundo, projeto, período e situação.
- **Detalhe da prestação:** cabeçalho com status e progresso; abas Identificação, Financeiro, Plano de Trabalho, Narrativa, Impacto, Documentos e Histórico.
- **Modelos oficiais:** catálogo com instituição, edital, ciclo, versão e status; mostrar claramente qual versão está vinculada a cada prestação.
- **Transparência pública:** versão simplificada, acessível e responsiva, com indicadores, narrativa aprovada e documentos explicitamente liberados.

## Componentes e acabamento
- Tipografia com hierarquia editorial forte, títulos concisos e números em destaque.
- Espaçamento generoso e grid consistente.
- Cantos moderadamente arredondados (12–16 px), sem excesso de pílulas.
- Ícones lineares consistentes.
- Gráficos com legendas claras, tooltip acessível e cores semânticas; nunca depender só da cor para comunicar status.
- Estados de carregamento com skeletons, vazios com orientação objetiva e erros com mensagem acionável.
- Animações discretas e curtas; respeitar redução de movimento.
- Acessibilidade: contraste adequado, foco visível, navegação por teclado, rótulos para gráficos e formulários.

## Regras de dados e confiança
- Nunca inventar valores ou preencher cartões com números demonstrativos em produção.
- Em ausência de dados, mostrar estado vazio explícito, não zero enganoso.
- Exibir a data/hora da última atualização quando disponível.
- Distinguir claramente valores recebidos, comprometidos, pagos e saldo; não somar métricas incompatíveis.
- Não publicar dados pessoais, anexos privados, dados bancários ou JSON administrativo.
- A camada pública só mostra campos e arquivos autorizados para publicação.
- Indicadores de execução devem explicar a base de cálculo.
- Respeitar os modelos oficiais de cada edital; o dashboard apresenta dados, mas não modifica o layout dos documentos oficiais.

## Priorização para entrega curta
1. Primeiro, modernizar a visão geral já existente do Financeiro, mantendo os hooks e as operações atuais.
2. Em seguida, adicionar navegação e estados da área Prestações de Contas.
3. Integrar indicadores de prestação somente quando as consultas e as tabelas estiverem validadas.
4. Construir a visão pública depois de definir a lista de campos e documentos autorizados.
5. Não alterar produção nem aplicar migration sem revisão e teste.

## Referência de qualidade
O resultado deve combinar a clareza de um painel financeiro moderno com a confiança de um portal institucional de transparência. Priorizar legibilidade, consistência, rapidez e rastreabilidade acima de efeitos decorativos.
