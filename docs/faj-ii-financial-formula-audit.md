# Auditoria financeira FAJ II
Fonte: XLSX oficial, leitura openpyxl com fórmulas e valores em cache (não recalculados).
Seis abas: 1_DADOS DE IDENTIFICAÇÃO, 2_PLANO_DE_TRABALHO, 3_SUSTENTABILIDADE, 4_EQUIPE, 5_ORCAMENTO_RUBRICAS, LISTAS. Total: 86 fórmulas (15, 40, 31 nas três abas financeiras).
## Sustentabilidade
B22:D25: SUMIFS sobre F3:F18 (valor), E3:E18 (ano), G3:G18 (status). Status exatos: Confirmado – recurso recebido; Confirmado – a receber; Em negociação; Potencial doador / prospecção.
B23 e B24 usam 2026 em vez de 2025: divergência confirmada, não alterar original. B26:D26 somam COUNTIFS de registros positivos confirmados, excluindo B="FAJ"; não contam financiadores distintos.
Cache recebido 2025/26/27: 242581.07 / 316745 / 0; a receber: 0 / 0 / 100000; prospecção: 0 / 75000 / 75000. Validações E3:E18 anos 2025–2027, F3:F18 não negativo, G3:G18 status.
## Equipe
F2:F17: =IF(OR(C2="",E2=""),"",(N(C2)+N(D2))*E2) (referências relativas). H2:H17: =IF(N(F2)>0,N(G2)/F2,""). F18=SUM(F2:F11), G18=SUM(G2:G11), H18=IF(F18>0,G18/F18,""). C22=COUNTA(A2:A17)-1: cache 9, dez registros preenchidos; investigar subtração. C23=F18, C24=G18, C25=F18-G18, C26=H18. Cache 96000, 65700, 30300, 68.4375%. Totais excluem linhas 12–17 mesmo com fórmulas: risco ao adicionar equipe. Validações G2:G17 G2<=N(F2), C2:D17 não negativo, E2:E17 mínimo 1.
## Orçamento
C7='4_EQUIPE'!F18; D7='4_EQUIPE'!G18. E7:E17 =IF(AND(N(C7)=0,N(D7)=0),"",N(C7)-N(D7)); F7:F17 =IF(N(C7)>0,N(D7)/C7,""). C18:E18 somam linhas 7–17; F18=IF(C18>0,D18/C18,""). B21=C18, B22=D18, B23='4_EQUIPE'!F18. Cache 250000 total, 150000 FAJ, 100000 outras fontes, 60%. D8:D17 valida D8<=N(C8); C8:C17 não negativo. Eventos: preservar 31000 e investigar descrição de alimentação sem duplicar.
## Integração
Usar financial_data existente para rascunhos versionados, sem criar lançamentos de caixa a partir de orçamento ou prospecção. Campos manuais separados dos derivados; equipe alimenta pessoal automaticamente. Para linhas adicionais, explicitar diferença entre reprodução literal e cálculo dinâmico proposto; não corrigir divergências silenciosamente. Vinculação a fundos, projetos e movimentações existentes ainda requer validação. Nenhuma migration ou publicação nesta etapa. Testes de compilação e integração pendentes.

## Conferência do original e implementação no painel

A leitura do XLSX original no Drive confirmou as seis abas, 86 fórmulas e os valores em cache de C18:F18 da aba de orçamento: R$ 250.000,00, R$ 150.000,00, R$ 100.000,00 e 60%. A planilha foi aberta somente para leitura. Os valores conferidos são orçamento previsto e não são importados como receitas ou movimentos.

O painel agrupa a sustentabilidade pelo ano de cada registro (incluindo 2025 nos dois status afetados), conta cada linha de equipe identificada e recalcula pessoal com todas as linhas válidas. A rubrica de pessoal recebe os totais derivados da equipe. Campos monetários vazios permanecem sem valor e zero é explícito. A participação FAJ fica em branco quando o valor informado de alguma rubrica está incompleto ou excede o custo previsto. A preparação de arquivos continua usando cópias de modelos e ainda não aplica as correções a um documento exportado.

O mapeamento aceita cópias legadas com uma aba adicional de apresentação. Em exportações, as fórmulas compartilhadas B23:C23, B24:C24 e F18:G18 são desagrupadas para preservar os resultados individuais de cada célula. Os critérios de 2026 em C23 e C24 permanecem intactos.
