# FAJ II Ciclo — correspondência das fontes com o portal

Fonte financeira: **FAJ II Ciclo — Planilha financeira oficial preenchida — Rede Kalunga**. Fonte narrativa: **FAJ II Ciclo — Formulário narrativo oficial — Rede Kalunga (cópia de trabalho)**.

| Campo ou faixa de origem | Componente público ou tratamento |
| --- | --- |
| Identificação B3 e B6, orçamento B2:B4 | Capa, apresentação institucional e referência do orçamento. |
| Identificação B4:B5 e pergunta cadastral sem resposta em A7 | Dados de contato e identificação operacional seguem no cadastro restrito. B7 está vazio na cópia auditada. |
| Plano A3:G14 | Atividades e cronograma com objetivo, atividade/entrega, resultado esperado, indicador/evidência, período, rubrica e observações. |
| Plano A16:A17 | Instrução do formulário sobre vinculação das atividades às rubricas. A relação aparece no plano e dentro da rubrica quando os nomes coincidem. |
| Sustentabilidade A3:I18 | Filtros por ano, situação, financiador e tipo. A tabela preserva os registros e permite abrir finalidade, projeto/pesquisa, entrada e observações. |
| Sustentabilidade A20:D25 e B29:B30 | Totais por ano e situação, variações, mudanças, riscos e captação. Os totais são reconciliados com os registros. |
| Sustentabilidade A26:D26 | Contagem oficial de financiadores confirmados fora do FAJ. |
| Sustentabilidade A32:A35, equipe A28:A32, orçamento A28:A30 | Instruções do formulário identificadas como tais na própria seção. |
| Equipe A2:I11, F18:H18 e C22:C26 | Custos e participação agregados para 10 integrantes. Os registros individuais seguem no cadastro restrito. |
| Orçamento A7:G18, B21:B23 e B26 | Valores previstos, 11 rubricas em gráfico e tabela, descrições, observações, valores de conferência e mudanças em relação ao orçamento aprovado. |
| Comentários em sustentabilidade C2/D2, equipe A1/B1 e orçamento A8:A17 | 14 comentários de célula, com texto integral e rótulo próprio. |
| Aba LISTAS | Vocabulário interno de validação da planilha, inclusive categorias não utilizadas. Os valores efetivamente usados aparecem nos registros e nos filtros. |
| DOCX: identificação | Organização, valor solicitado e data de preenchimento. Contatos e identificação pessoal do responsável seguem no documento de trabalho. |
| DOCX: perguntas 1 a 4 | Enunciados, instruções e respostas integrais. Resultados e perspectivas leva à quarta resposta. |
| DOCX: registros embutidos | As duas marcas aparecem no cabeçalho a partir dos ativos institucionais existentes. O pacote local vincula as sete fotografias e uma captura de gestão às perguntas e parágrafos de origem. Revise autorização de imagem e dados visíveis na captura antes de selecioná-la para divulgação. |
| DOCX: comparativo 2025 × 2026 | Nove canais/formatos, indicadores, dois recortes, variação oficial e observações. Os textos do comparativo permanecem completos. O gráfico só usa métricas numéricas com períodos anuais equivalentes explicitamente informados. |

## Preparar a versão para revisão

1. Execute `python scripts/prepare-faj-editorial.py original.xlsx original.docx pasta-de-revisao` em ambiente com `openpyxl`. O script lê os originais, valida os totais financeiros e gera uma projeção JSON, os arquivos de imagem originais e um manifesto com a posição das mídias.
2. No cadastro financeiro da prestação, abra **Publicação de transparência** e carregue `conteudo-faj.json` em **Conteúdo das fontes e imagens para revisão**. Selecione e confira cada seção. Use o manifesto para associar a legenda, a descrição e a posição de cada imagem aprovada.
3. Confira a versão candidata com as fontes e registre a revisão antes de publicar. A área pública lê somente a versão revisada. A imagem só se torna legível para visitantes anônimos quando referenciada por uma publicação ativa. A migração do armazenamento precisa estar aplicada no ambiente antes do envio dos arquivos.

A planilha traz o período previsto de renovação de dezembro de 2026 a novembro de 2027. O relatório narrativo descreve ações em 2027 e o plano usa meses relativos e datas de calendário. As duas referências foram preservadas. Em particular, o plano registra “Meses 3 a 12 (fevereiro a novembro de 2027)” em uma atividade. O portal exibe o texto original no cronograma.
