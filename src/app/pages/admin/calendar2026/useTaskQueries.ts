import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addTaskComment, createExternalAttachment, deleteTask, fetchNotifications, fetchTasks, fetchTeamMembers, getCurrentEquipeMember, getPermissionLevel, saveTask, updateTaskStatus, uploadTaskAttachment } from "./tasksApi";
import type { TaskInput, TaskStatus } from "./types";

export const taskKeys = {
  all: ["admin-tasks"] as const,
  members: ["admin-task-members"] as const,
  notifications: ["admin-task-notifications"] as const,
  currentMember: ["admin-task-current-member"] as const,
  permission: ["admin-task-permission"] as const,
  range: (start: string, end: string, assignee: string) => [...taskKeys.all, start, end, assignee] as const,
};

export function useTeamMembersQuery() {
  return useQuery({ queryKey: taskKeys.members, queryFn: fetchTeamMembers });
}

export function useCurrentMemberQuery() {
  return useQuery({ queryKey: taskKeys.currentMember, queryFn: getCurrentEquipeMember });
}

export function usePermissionQuery() {
  return useQuery({ queryKey: taskKeys.permission, queryFn: getPermissionLevel });
}

export function useTasksQuery(startDate: string, endDate: string, assignee: string) {
  return useQuery({ queryKey: taskKeys.range(startDate, endDate, assignee), queryFn: () => fetchTasks(startDate, endDate, { assignee }), enabled: Boolean(startDate && endDate) });
}

export function useNotificationsQuery() {
  return useQuery({ queryKey: taskKeys.notifications, queryFn: fetchNotifications });
}

export function useSaveTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, taskId }: { input: TaskInput; taskId?: string }) => saveTask(input, taskId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: deleteTask, onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }) });
}

export function useTaskStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) => updateTaskStatus(taskId, status),
    onMutate: async ({ taskId, status }) => {
      await queryClient.cancelQueries({ queryKey: taskKeys.all });
      const snapshots = queryClient.getQueriesData({ queryKey: taskKeys.all });
      snapshots.forEach(([queryKey, data]) => {
        if (!Array.isArray(data)) return;
        queryClient.setQueryData(queryKey, data.map((task) => task?.id === taskId ? { ...task, status, updatedAt: new Date().toISOString(), completedAt: status === "concluida" ? new Date().toISOString() : task.completedAt } : task));
      });
      return { snapshots };
    },
    onError: (_error, _variables, context) => {
      context?.snapshots.forEach(([queryKey, data]) => queryClient.setQueryData(queryKey, data));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }),
  });
}

export function useTaskCommentMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ taskId, comentario }: { taskId: string; comentario: string }) => addTaskComment(taskId, comentario), onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }) });
}

export function useTaskAttachmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ taskId, file }: { taskId: string; file: File }) => uploadTaskAttachment(taskId, file), onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }) });
}

export function useExternalAttachmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ taskId, url }: { taskId: string; url: string }) => createExternalAttachment(taskId, url), onSuccess: () => queryClient.invalidateQueries({ queryKey: taskKeys.all }) });
}
