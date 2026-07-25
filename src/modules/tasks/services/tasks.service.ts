import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import { buildListSearchParams } from '@/shared/utils/list-query-params';
import { usersService } from '@/modules/users/services/users.service';
import type { ApiMeta } from '@/shared/types/api-response';
import type { User } from '@/modules/users/types/users.types';
import type { Department } from '@/modules/departments/types/departments.types';

/**
 * Raw task response from BE (real API fields, xác minh trực tiếp qua
 * astrodev.test8.io.vn 2026-07-06). BE KHÔNG có field `assigner_dept_id` —
 * gửi field này lên khi tạo/sửa task bị BE âm thầm bỏ qua (không lỗi, không
 * lưu). List và detail đều trả kèm relation object `creator`/`assignee`/
 * `approver`/`assignee_dept` (không cần gọi thêm API users/departments để
 * enrich tên hiển thị).
 *
 * QUAN TRỌNG — ID-space: `assignee_id` và `approver_id` là employee id (FK
 * vào bảng employees), KHÔNG PHẢI user id. Xác nhận trực tiếp trên BE thật
 * (2026-07-14): relation `assignee`/`approver` trả về có shape Employee đầy
 * đủ (code, cccd, gender, employee_status, manager_id...) và có task thật
 * với approver_id trùng employee.id nhưng employee đó có user_id = null
 * (không có tài khoản đăng nhập) — chỉ có thể xảy ra nếu approver_id tham
 * chiếu employees.id, không phải users.id. FE (TasksPage) phải chọn từ danh
 * sách employee cho các field này, không dùng user list.
 */
export interface TaskFromApi {
  id: number;
  code: string;
  type?: 'task' | 'coordination';
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'P0' | 'P1' | 'P2';
  status:
    | 'new'
    | 'assigned'
    | 'processing'
    | 'pending_approval'
    | 'completed'
    | 'rejected'
    | 'cancel'
    | 'overdue';
  due_date: string;
  creator_id?: number | null;
  creator_dept_id?: number | null;
  assignee_id?: number | null;
  assignee_dept_id?: number | null;
  approver_id?: number | null;
  actual_done_date?: string | null;
  reject_reason?: string | null;
  result_file_url?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  // Relation object thật trả kèm từ BE (list & detail)
  creator?: { id: number; email?: string | null } | null;
  assignee?: {
    id: number;
    full_name?: string | null;
    email?: string | null;
  } | null;
  approver?: {
    id: number;
    full_name?: string | null;
    email?: string | null;
  } | null;
  assignee_dept?: { id: number; name?: string | null } | null;
}

/**
 * Task after mapping from API - includes computed display fields.
 */
export interface Task {
  id: number;
  code: string;
  type?: 'task' | 'coordination';
  title: string;
  description?: string;
  priority: 'low' | 'medium' | 'high' | 'P0' | 'P1' | 'P2';
  status:
    | 'new'
    | 'assigned'
    | 'processing'
    | 'pending_approval'
    | 'completed'
    | 'rejected'
    | 'cancel'
    | 'overdue';
  due_date: string;
  creator_id?: number | null;
  creator_dept_id?: number | null;
  assignee_id?: number | null;
  assignee_dept_id?: number | null;
  approver_id?: number | null;
  actual_done_date?: string | null;
  reject_reason?: string | null;
  result_file_url?: string | null;
  deleted_at?: string | null;
  created_at: string;
  updated_at: string;
  // Computed display fields (ưu tiên lấy từ relation object BE trả kèm,
  // fallback sang tra cứu users/departments nếu API không kèm relation)
  creator_name?: string;
  assignee_name?: string;
  assignee_dept_name?: string;
  approver_name?: string;
  // Computed: quá hạn là trạng thái hiển thị, không lưu cứng (theo wireframe)
  is_overdue?: boolean;
}

export interface TaskListParams {
  page?: number;
  per_page?: number;
  keyword?: string;
  status?: string;
  priority?: string;
  assignee_id?: number;
  // Không có trong Swagger (GET /tasks chỉ liệt kê page/limit/q), nhưng đã
  // verify trực tiếp trên BE thật (astrodev.test8.io.vn, 2026-07-12): filter
  // theo assignee_dept_id hoạt động thật ở server (khác với query param lạ bị
  // BE bỏ qua hoàn toàn) — an toàn để gửi lên thay vì chỉ lọc client-side.
  assignee_dept_id?: number;
}

export interface CreateTaskPayload {
  type: 'task' | 'coordination';
  title: string;
  description?: string;
  priority: 'P0' | 'P1' | 'P2';
  assignee_id?: number | null;
  assignee_dept_id?: number | null;
  approver_id?: number | null;
  due_date: string;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  priority?: 'P0' | 'P1' | 'P2';
  assignee_id?: number | null;
  assignee_dept_id?: number | null;
  approver_id?: number | null;
  due_date?: string;
  status?: string;
}

/**
 * Task history entry from GET /tasks/{id}/histories
 * Theo wireframe mapping: trạng thái, người thao tác, thời điểm, ghi chú.
 * BE đã bổ sung field `created_by_name` để hiển thị tên người tạo bản ghi
 * lịch sử (không cần traverse relation actor nếu có sẵn).
 */
export interface TaskHistoryEntry {
  id: number;
  task_id: number;
  from_status?: string | null;
  to_status: string;
  note?: string | null;
  created_at: string;
  /** Tên người thao tác do BE trả trực tiếp (ưu tiên hơn actor object) */
  created_by_name?: string | null;
  actor?: {
    id: number;
    full_name?: string | null;
    email?: string | null;
  } | null;
}

/**
 * Map raw API task response to UI-friendly Task with computed display names.
 * Ưu tiên relation object (`creator`/`assignee`/`approver`/`assignee_dept`)
 * mà BE trả kèm sẵn trong response thật (list & detail) — xác minh trực tiếp
 * 2026-07-06. Tham số `users`/`departments` chỉ dùng làm fallback khi API nào
 * đó không kèm relation.
 */
export function mapTaskFromApi(
  task: TaskFromApi,
  users: User[] = [],
  departments: Department[] = [],
): Task {
  const creatorFallback = users.find((u) => u.id === task.creator_id);
  const assigneeFallback = users.find((u) => u.id === task.assignee_id);
  const deptFallback = departments.find((d) => d.id === task.assignee_dept_id);
  const approverFallback = users.find((u) => u.id === task.approver_id);

  // Quá hạn = hiển thị tự động (không lưu state) — wireframe I
  // Nếu có due_date và trạng thái chưa kết thúc (completed/cancel) thì tính overdue
  const isOverdue = (() => {
    if (!task.due_date) return false;
    if (task.status === 'completed' || task.status === 'cancel') return false;
    const now = new Date();
    const due = new Date(task.due_date);
    return due < now;
  })();

  return {
    ...task,
    creator_name:
      creatorFallback?.name ||
      task.creator?.email ||
      creatorFallback?.email ||
      (task.creator_id ? `User #${task.creator_id}` : undefined),
    assignee_name:
      task.assignee?.full_name ||
      task.assignee?.email ||
      assigneeFallback?.name ||
      assigneeFallback?.email ||
      (task.assignee_id ? `User #${task.assignee_id}` : undefined),
    assignee_dept_name:
      task.assignee_dept?.name ||
      deptFallback?.name ||
      (task.assignee_dept_id ? `Dept #${task.assignee_dept_id}` : undefined),
    approver_name:
      task.approver?.full_name ||
      task.approver?.email ||
      approverFallback?.name ||
      approverFallback?.email ||
      (task.approver_id ? `User #${task.approver_id}` : undefined),
    is_overdue: isOverdue,
  };
}

/**
 * Tra danh sách users để enrich tên hiển thị (creator_name...) — best-effort,
 * không được chặn màn Tasks nếu user hiện tại không có quyền xem
 * GET /users (permission scope tách biệt với /tasks). Trả về [] khi lỗi,
 * mapTaskFromApi() đã có fallback hiển thị (relation object BE / `User #id`).
 */
async function fetchUsersSafely(): Promise<User[]> {
  try {
    return await usersService.list();
  } catch {
    return [];
  }
}

export const tasksService = {
  async list(
    params: TaskListParams = {},
  ): Promise<{ data: Task[]; meta: ApiMeta }> {
    const q = buildListSearchParams(params);
    if (params.status) q.set('status', params.status);
    if (params.priority) q.set('priority', params.priority);
    if (params.assignee_id) q.set('assignee_id', String(params.assignee_id));
    if (params.assignee_dept_id)
      q.set('assignee_dept_id', String(params.assignee_dept_id));
    if (params.keyword) q.set('keyword', params.keyword);

    const queryString = q.toString();
    const url = queryString
      ? `${API_ENDPOINTS.TASKS}?${queryString}`
      : API_ENDPOINTS.TASKS;
    const response = await http.getPage<TaskFromApi[]>(url);
    // Quan hệ `creator` BE trả kèm chỉ có {id, email} (không có tên) — tra
    // thêm danh sách users để hiển thị tên thay vì email. Không chặn màn
    // Tasks nếu user hiện tại không có quyền xem danh sách users (permission
    // scope khác nhau giữa /tasks và /users) — enrich name là best-effort,
    // không phải điều kiện để tasks load được.
    const users = await fetchUsersSafely();
    return {
      data: response.data.map((task) => mapTaskFromApi(task, users)),
      meta: response.meta,
    };
  },

  async create(payload: CreateTaskPayload): Promise<Task> {
    return http.post<Task>(API_ENDPOINTS.TASKS, payload);
  },

  /**
   * Method/path đã xác nhận trực tiếp trên BE thật (astrodev.test8.io.vn,
   * 2026-07-03): start/submit/approve/reject đều là POST, không phải PATCH
   * (PATCH bị BE trả 405 Method Not Allowed). Path submit cũng là `/submit`,
   * không phải `/submit-review` (404 not found nếu gọi path cũ). Reject nhận
   * field `note`, không phải `reason` (400 validation nếu gửi sai field) —
   * xem docs/CHANGELOG.md mục "Tasks workflow — sửa method/path/field sai".
   */
  async approve(id: number): Promise<Task> {
    return http.post<Task>(`${API_ENDPOINTS.TASKS}/${id}/approve`);
  },

  /**
   * Lý do từ chối là bắt buộc theo nghiệp vụ (người duyệt phải giải thích vì
   * sao từ chối) — chặn ở FE layer bằng exception thay vì chỉ dựa vào UI
   * disable nút, để không có đường gọi reject() nào (kể cả gọi thẳng service/
   * test) lọt qua được với note rỗng/toàn khoảng trắng.
   */
  async reject(id: number, note?: string): Promise<Task> {
    const trimmed = note?.trim();
    if (!trimmed) {
      throw new Error('Lý do từ chối là bắt buộc');
    }
    return http.post<Task>(`${API_ENDPOINTS.TASKS}/${id}/reject`, {
      note: trimmed,
    });
  },

  async start(id: number): Promise<Task> {
    return http.post<Task>(`${API_ENDPOINTS.TASKS}/${id}/start`);
  },

  async submitForReview(id: number): Promise<Task> {
    return http.post<Task>(`${API_ENDPOINTS.TASKS}/${id}/submit`);
  },

  /**
   * Hủy công việc (wireframe P0 mapping: PATCH /api/work-items/{id}/cancel
   * nhưng BE thật dùng POST pattern). Chỉ role có quyền mới được hủy.
   * FE gọi POST /tasks/{id}/cancel theo pattern chung của workflow tasks.
   */
  async cancel(id: number, note?: string): Promise<Task> {
    return http.post<Task>(
      `${API_ENDPOINTS.TASKS}/${id}/cancel`,
      note ? { note } : undefined,
    );
  },

  /**
   * Lấy chi tiết công việc theo ID.
   * BE đã hỗ trợ (xác minh Swagger), FE chưa wire UI — bổ sung để sẵn sàng.
   */
  async getById(id: number): Promise<Task> {
    const raw = await http.get<TaskFromApi>(`${API_ENDPOINTS.TASKS}/${id}`);
    const users = await fetchUsersSafely();
    return mapTaskFromApi(raw, users);
  },

  /**
   * Cập nhật công việc.
   * BE đã hỗ trợ (xác minh Swagger), FE chưa wire UI — bổ sung để sẵn sàng.
   */
  async update(id: number, payload: UpdateTaskPayload): Promise<Task> {
    return http.put<Task>(`${API_ENDPOINTS.TASKS}/${id}`, payload);
  },

  /**
   * Lấy lịch sử trạng thái công việc.
   * Wireframe mapping: GET /api/work-items/{id}/histories
   * BE xác minh qua Swagger: GET /tasks/{id}/histories
   */
  async getHistory(id: number): Promise<TaskHistoryEntry[]> {
    return http.get<TaskHistoryEntry[]>(
      `${API_ENDPOINTS.TASKS}/${id}/histories`,
    );
  },
};
