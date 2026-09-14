import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/app/components/ui/alert-dialog";
import { useDeleteTaskMutation } from "./useTaskQueries";

export function TaskDeleteDialog({ taskId, open, onOpenChange, onDeleted }: {
  taskId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleted?: () => void;
}) {
  const deletion = useDeleteTaskMutation();

  async function confirmDeletion(event: React.MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    try {
      await deletion.mutateAsync(taskId);
      toast.success("Tarefa excluída com sucesso.");
      onOpenChange(false);
      onDeleted?.();
    } catch (error) {
      console.error("[tarefas:excluir] não foi possível excluir a tarefa", error);
      toast.error(error instanceof Error ? error.message : "Não foi possível excluir a tarefa.");
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="border-rose-100 bg-white text-slate-900 dark:border-rose-900 dark:bg-emerald-950 dark:text-white">
        <AlertDialogHeader>
          <AlertDialogTitle>Excluir tarefa?</AlertDialogTitle>
          <AlertDialogDescription>
            Esta ação não pode ser desfeita. A tarefa, seus comentários e anexos associados serão removidos.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletion.isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            disabled={deletion.isPending}
            onClick={(event) => void confirmDeletion(event)}
            className="bg-rose-600 text-white hover:bg-rose-700 focus:ring-rose-500"
          >
            {deletion.isPending ? "Excluindo…" : "Excluir tarefa"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
