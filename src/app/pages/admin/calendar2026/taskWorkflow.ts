export interface ChecklistItem {
  id: string;
  task_id: string;
  title: string;
  note: string | null;
  position: number;
  completed_at: string | null;
  completed_by: string | null;
  assignee_id: string | null;
  due_date: string | null;
}
export interface FileLink {
  id: string;
  item_id: string | null;
  drive_file_id: string | null;
  legacy_attachment_id: string | null;
  purpose: "stage" | "final";
}
export interface WorkflowHistory {
  id: string;
  actor_id: string | null;
  event: string;
  detail: Record<string, unknown>;
  created_at: string;
}
export const deliveryTemplates: Record<string, string[]> = {
  "Texto ou pesquisa": [
    "Levantar e registrar fontes",
    "Produzir o texto ou pesquisa",
    "Verificar informações e referências",
    "Revisar o conteúdo",
    "Entregar a versão final",
  ],
  Design: [
    "Receber e conferir conteúdo",
    "Criar a peça",
    "Revisar a proposta",
    "Aplicar ajustes",
    "Exportar os arquivos finais",
  ],
  Fotografia: [
    "Preparar a captação",
    "Fotografar a ação",
    "Selecionar as imagens",
    "Tratar as fotografias",
    "Identificar créditos e entregar",
  ],
  "Vídeo ou áudio": [
    "Planejar roteiro e captação",
    "Captar vídeo ou áudio",
    "Editar o material",
    "Revisar a edição",
    "Finalizar e entregar",
  ],
  "Aula ou oficina": [
    "Definir objetivos",
    "Preparar materiais",
    "Realizar a atividade",
    "Registrar a atividade",
    "Avaliar os resultados",
  ],
  Coordenação: [
    "Planejar a ação",
    "Distribuir responsabilidades",
    "Acompanhar a execução",
    "Validar as entregas",
  ],
};
export function progressLabel(total = 0, completed = 0) {
  return total
    ? `${completed} de ${total} etapas concluídas · ${Math.round((completed / total) * 100)}%`
    : "Etapas ainda não definidas";
}
export const historyLabels: Record<string, string> = {
  add: "Etapa adicionada",
  edit: "Etapa alterada",
  delete: "Etapa removida (arquivos preservados)",
  order: "Etapas reordenadas",
  toggle: "Conclusão de etapa alterada",
  template: "Modelo aplicado",
  metadata: "Entrega, revisão ou bloqueio atualizado",
  collaborators: "Colaboradores atualizados",
  link: "Arquivo vinculado",
  unlink: "Arquivo desvinculado",
  file_unlinked: "Vínculo removido por movimentação ou exclusão do arquivo",
  review_requested: "Revisão solicitada",
  approved: "Entrega concluída",
  task_reopened: "Tarefa reaberta",
  status_changed: "Status alterado",
  reopen: "Motivo da reabertura registrado",
  review: "Entrega enviada para revisão",
  complete: "Conclusão registrada",
};
