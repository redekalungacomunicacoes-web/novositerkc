# Sincronização por prestação de contas

Requisito: cada prestação possui uma planilha Google Sheets própria, vinculada pelo ID imutável do arquivo, preservando o modelo oficial e a formatação institucional. Exportação XLSX permanece separada.

- Banco como registro central; planilha como interface adicional. Mapear campos editáveis por versão do modelo e identificador estável de linha; proteger fórmulas e totais derivados.
- Alterações do painel enfileiram atualização das células mapeadas. Alterações no Drive disparam leitura e comparação com último estado sincronizado; prever reconciliação periódica e renovação de notificações. Não presumir que notificações contenham valores.
- Comparar revisão e valores de base antes de gravar; conflitos simultâneos ficam pendentes de resolução, sem sobrescrita silenciosa. Usar operações idempotentes e histórico com origem, data e valores anteriores/novos.
- Validar tipos, permissões, rubricas e valores; preservar vazios e distinguir zero. Não criar movimentações de caixa a partir de orçamento ou prospecção. Vínculos de fundos existentes permanecem no sistema; não duplicar cadastros.
- Exibir estado da sincronização e erros; não publicar dados privados. Testar edição nos dois sentidos, conflitos, fórmulas, permissões, exportação e recuperação de falhas antes de ativar.

Estado: especificação de implementação; integração, permissões Google Sheets, testes e ativação ainda pendentes. Nenhuma migration ou publicação autorizada por este documento.
