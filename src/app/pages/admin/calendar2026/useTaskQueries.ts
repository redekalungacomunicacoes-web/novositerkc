import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addTaskComment, createExternalAttachment, deleteTask, deleteTaskAttachment, fetchAttachmentCenter, fetchNotifications, fetchTaskDetails, fetchTasks, fetchTeamMembers, getCurrentEquipeMember, getPermissionLevel, saveTask, updateTaskStatus, uploadTaskAttachment } from "./tasksApi";
import type { CalendarTask, TaskAttachment, TaskInput, TaskStatus } from "./types";

export const taskKeys = {
  all: ["admin-tasks"] as const,
  attachments: ["admin-tasks", "attachments"] as const,
  members: ["admin-task-members"] as const,
  notifications: ["admin-task-notifications"] as const,
  currentMember: ["admin-task-current-member"] as const,
  permission: ["admin-task-permission"] as const,
  detail: (taskId: string) => [...taskKeys.all, "detail", taskId] as const,
  range: (start: string, end: string, assignee: string) => [...taskKeys.all, start, end, assignee] as const,
};

function replaceTaskInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  updatedTask: Pick<CalendarTask, "id" | "status"> & { updated_at?: string },
) {
  queryClient.getQueriesData({ queryKey: taskKeys.all }).forEach(([queryKey, data]) => {
    if (!Array.isArray(data)) return;
    queryClient.setQueryData(queryKey, data.map((task) => {
      if (task?.id !== updatedTask.id) return task;
      const { updated_at, ...changes } = updatedTask;
      return {
        ...task,
        ...changes,
        updatedAt: updated_at ?? task.updatedAt,
        completedAt: changes.status === "concluida" ? updated_at ?? task.completedAt ?? new Date().toISOString() : null,
      };
    }));
  });
}

export function useTeamMembersQuery() {
  return useQuery({ queryKey: taskKeys.members, queryFn: fetchTeamMembers, staleTime: 300_000 });
}

export function useCurrentMemberQuery() {
  return useQuery({ queryKey: taskKeys.currentMember, queryFn: getCurrentEquipeMember, staleTime: 300_000 });
}

export function usePermissionQuery() {
  return useQuery({ queryKey: taskKeys.permission, queryFn: getPermissionLevel, staleTime: 300_000 });
}

export function useTasksQuery(startDate: string, endDate: string, assignee: string) {
  return useQuery({ queryKey: taskKeys.range(startDate, endDate, assignee), queryFn: () => fetchTasks(startDate, endDate, { assignee }), enabled: Boolean(startDate && endDate), staleTime: 30_000, placeholderData: (previous) => previous });
}

export function useAttachmentCenterQuery() {
  return useQuery({ queryKey: taskKeys.attachments, queryFn: fetchAttachmentCenter, staleTime: 30_000 });
}

export function useTaskDetailsQuery(taskId?: string | null) {
  return useQuery({
    queryKey: taskKeys.detail(taskId || "none"),
    queryFn: () => fetchTaskDetails(taskId!),
    enabled: Boolean(taskId),
    staleTime: 30_000,
  });
}

export function useNotificationsQuery() {
  return useQuery({ queryKey: taskKeys.notifications, queryFn: fetchNotifications });
}

export function useSaveTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, taskId }: { input: TaskInput; taskId?: string }) => saveTask(input, taskId),
    onSuccess: () => { void queryClient.invalidateQueries({ queryKey: taskKeys.all }); void queryClient.invalidateQueries({ queryKey: taskKeys.notifications }); },
  });
}

export function useDeleteTaskMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteTask,
    onSuccess: (_data, taskId) => {
      queryClient.getQueriesData({ queryKey: taskKeys.all }).forEach(([queryKey, data]) => {
        if (Array.isArray(data)) queryClient.setQueryData(queryKey, data.filter((task) => task?.id !== taskId));
      });
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
      void queryClient.invalidateQueries({ queryKey: taskKeys.notifications });
    },
  });
}

export function useTaskStatusMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ taskId, status, oldStatus }: { taskId: string; status: TaskStatus; oldStatus?: TaskStatus }) => updateTaskStatus(taskId, status, oldStatus),
    onSuccess: (updatedTask) => {
      replaceTaskInCache(queryClient, updatedTask);
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
      void queryClient.invalidateQueries({ queryKey: taskKeys.notifications });
    },
  });
}

export function useTaskCommentMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ taskId, comentario }: { taskId: string; comentario: string }) => addTaskComment(taskId, comentario), onSuccess: (_data, variables) => {
    void queryClient.invalidateQueries({ queryKey: taskKeys.detail(variables.taskId) });
    void queryClient.invalidateQueries({ queryKey: taskKeys.notifications });
  } });
}

export function useTaskAttachmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ taskId, file }: { taskId: string; file: File }) => uploadTaskAttachment(taskId, file), onSuccess: (_data, variables) => {
    void queryClient.invalidateQueries({ queryKey: taskKeys.detail(variables.taskId) });
    void queryClient.invalidateQueries({ queryKey: taskKeys.attachments });
  } });
}

export function useExternalAttachmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({ mutationFn: ({ taskId, url }: { taskId: string; url: string }) => createExternalAttachment(taskId, url), onSuccess: (_data, variables) => {
    void queryClient.invalidateQueries({ queryKey: taskKeys.detail(variables.taskId) });
    void queryClient.invalidateQueries({ queryKey: taskKeys.attachments });
  } });
}

export function useDeleteTaskAttachmentMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (attachment: Pick<TaskAttachment, "id" | "file_url">) => deleteTaskAttachment(attachment),
    onSuccess: (_data, attachment) => {
      void queryClient.invalidateQueries({ queryKey: taskKeys.all });
      const entries = queryClient.getQueriesData<{ attachments?: TaskAttachment[] }>({ queryKey: taskKeys.all });
      entries.forEach(([queryKey, data]) => {
        if (!data || Array.isArray(data) || !Array.isArray(data.attachments)) return;
        queryClient.setQueryData(queryKey, { ...data, attachments: data.attachments.filter((item) => item.id !== attachment.id) });
      });
    },
  });
}
