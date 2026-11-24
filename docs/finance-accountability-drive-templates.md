# Modelos oficiais no Drive financeiro

Etapa de cópia, ainda sem preenchimento automático. Usar arquivos DOCX/XLSX em branco, aprovados, sem dados de outra prestação. Não publicar modelos preenchidos no GitHub.

Destino de origem proposto: FINANCEIRO/MODELOS_OFICIAIS, com acesso limitado. Os campos spreadsheet_template_path e narrative_template_path guardam IDs do Drive (não URLs). Cadastro administrativo dos IDs e validação das permissões ainda pendentes. Os modelos são copiados sem conversão para DOCUMENTOS_OFICIAIS, preservando o formato original. Não sobrescrever cópias existentes. A chave appProperties permite retomar uma cópia após falha de registro.

Antes de publicar: testar autorização, acesso restrito, recuperação após falha, duas chamadas concorrentes, formatos, preservação das fórmulas e conteúdo, ausência de alterações nos originais. Implementar preenchimento e histórico auditável em etapa separada. Não usar modelos preenchidos com dados pessoais ou financeiros de outra prestação.
