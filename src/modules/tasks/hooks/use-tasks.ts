import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tasksService } from '@/modules/tasks/services/tasks.service';
import type {
  TaskListParams,
  CreateTaskPayload,
} from '@/modules/tasks/services/tasks.service';

export const TASKS_QUERY_KEY = 'tasks';

export const useTasks = (params?: TaskListParams) => {
  return useQuery({
    queryKey: [TASKS_QUERY_KEY, params],
    queryFn: () => tasksService.list(params),
  });
};

/**
 * Hook lấy chi tiết công việc mới nhất từ BE (GET /tasks/{id}), dùng khi mở
 * detail drawer để tránh hiển thị dữ liệu cũ/thiếu field so với item trong
 * danh sách (list response có thể stale hoặc thiếu field so với detail).
 */
export const useTask = (taskId: number | null) => {
  return useQuery({
    queryKey: [TASKS_QUERY_KEY, 'detail', taskId],
    queryFn: () => tasksService.getById(taskId!),
    enabled: taskId != null,
  });
};

export const useCreateTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTaskPayload) => tasksService.create(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
    },
  });
};

export const useApproveTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tasksService.approve(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
    },
  });
};

export const useRejectTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: number; reason?: string }) =>
      tasksService.reject(id, reason),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
    },
  });
};

export const useStartTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tasksService.start(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
    },
  });
};

export const useSubmitTaskForReview = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => tasksService.submitForReview(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
    },
  });
};

/**
 * Hook xử lý hủy công việc (wireframe P0: cancel)
 * Chỉ role có quyền mới thấy nút hủy.
 */
export const useCancelTask = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, note }: { id: number; note?: string }) =>
      tasksService.cancel(id, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_QUERY_KEY] });
    },
  });
};

/**
 * Hook lấy lịch sử trạng thái công việc (timeline)
 * Wireframe mapping: GET /tasks/{id}/histories
 */
export const useTaskHistory = (taskId: number | null) => {
  return useQuery({
    queryKey: [TASKS_QUERY_KEY, 'history', taskId],
    queryFn: () => tasksService.getHistory(taskId!),
    enabled: taskId != null,
  });
};
