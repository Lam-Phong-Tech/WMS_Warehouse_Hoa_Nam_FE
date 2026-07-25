import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import type { ApiMeta } from '@/shared/types/api-response';
import { buildListSearchParams } from '@/shared/utils/list-query-params';
import type {
  Employee,
  EmployeePayload,
  EmployeeStatusHistory,
  EmployeeStatusChangePayload,
  CreateAccountResult,
} from '@/modules/employees/types/employees.types';
import {
  remap,
  remapStatusHistory,
  type EmployeeFromApi,
  type EmployeeStatusHistoryFromApi,
} from './employee.mapper';

/**
 * Params server-side cho GET /employees.
 * BE cần hỗ trợ: page, per_page, keyword, org_unit_id, department_id,
 * position_id, employee_status, status, include[] = 'assignments'.
 * (Xác nhận qua swagger `/api/documentation` 2026-07-09: query param trạng
 * thái tài khoản đăng nhập tên là `status`, enum 0/1 — KHÔNG phải
 * `account_status`. Field dưới đây giữ tên `account_status` cho rõ nghĩa ở
 * phía FE, được map sang query key `status` khi serialize.)
 */
export interface EmployeeListParams {
  page?: number;
  per_page?: number;
  keyword?: string;
  org_unit_id?: number | null;
  department_id?: number | null;
  position_id?: number | null;
  employee_status?: string | null;
  account_status?: string | null;
  /** Nếu true, thêm include[]=assignments vào query để BE embed assignments. */
  include_assignments?: boolean;
  /** Trường sắp xếp phía backend (chỉ cột trực tiếp trên employees). */
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/** Kết quả import Excel: { created, errors } theo response BE. */
export interface EmployeeImportResult {
  created: number;
  errors: string[];
}

/**
 * Contract query GET /employees (xác nhận qua swagger 2026-07-09): BE dùng
 * đúng tên chuẩn `page`/`per_page`/`keyword`, không cần map đổi tên — khác
 * với departments/org-units/positions/companies/roles (dùng `limit`/`q`).
 */
const LIST_QUERY_KEY_MAP = {};

export const employeesService = {
  list(params?: { include_assignments?: boolean }): Promise<Employee[]> {
    const q = new URLSearchParams();
    if (params?.include_assignments) q.append('include[]', 'assignments');
    // BE phân trang mặc định GET /employees (per_page=15) kể cả khi không
    // truyền page/per_page — không phải "trả hết danh sách" như tên hàm gợi
    // ý. Các nơi gọi list() (TasksPage, OrgChartPage...) cần TOÀN BỘ nhân sự
    // để tính "phòng ban của tôi"/currentEmployeeId, nên phải ép per_page đủ
    // lớn, nếu không nhân sự nằm ngoài trang 1 (kể cả chính user hiện tại)
    // sẽ bị coi như "không tồn tại" → ẩn nhầm nút Bắt đầu/Gửi duyệt/Duyệt dù
    // nghiệp vụ đúng (phát hiện khi debug evidence UI thật, 2026-07-17).
    q.append('per_page', '1000');
    const queryString = q.toString();
    return http
      .get<
        EmployeeFromApi[]
      >(`${API_ENDPOINTS.EMPLOYEES}${queryString ? `?${queryString}` : ''}`)
      .then((data) => data.map(remap));
  },

  /**
   * Danh sách nhân sự có phân trang + filter server-side.
   * BE cần: GET /employees?page=&per_page=&keyword=&org_unit_id=&department_id=
   *   &position_id=&employee_status=&include[]=assignments
   * Response: { data: [], meta: { total, current_page, per_page, last_page } }
   */
  async listPaged(
    params: EmployeeListParams = {},
  ): Promise<{ data: Employee[]; meta: ApiMeta }> {
    const q = buildListSearchParams(params, LIST_QUERY_KEY_MAP);
    if (params.org_unit_id != null)
      q.set('org_unit_id', String(params.org_unit_id));
    if (params.department_id != null)
      q.set('department_id', String(params.department_id));
    if (params.position_id != null)
      q.set('position_id', String(params.position_id));
    if (params.employee_status != null)
      q.set('employee_status', String(params.employee_status));
    if (params.account_status != null) q.set('status', params.account_status);
    if (params.include_assignments) q.append('include[]', 'assignments');
    if (params.sort_by) q.set('sort_by', params.sort_by);
    if (params.sort_order) q.set('sort_order', params.sort_order);

    const { data, meta } = await http.getPage<EmployeeFromApi[]>(
      `${API_ENDPOINTS.EMPLOYEES}?${q}`,
    );
    return { data: data.map(remap), meta };
  },

  create(payload: EmployeePayload): Promise<Employee> {
    return http
      .post<EmployeeFromApi>(API_ENDPOINTS.EMPLOYEES, payload)
      .then(remap);
  },

  update(id: number, payload: EmployeePayload): Promise<Employee> {
    return http
      .put<EmployeeFromApi>(`${API_ENDPOINTS.EMPLOYEES}/${id}`, payload)
      .then(remap);
  },

  /**
   * Đổi trạng thái nhân sự. API doc thật (astrodev.test8.io.vn/api/documentation)
   * không có endpoint riêng PATCH /employees/{id}/status — đổi trạng thái đi qua
   * PUT /employees/{id} chung với các field employee_status, reason, effective_date.
   */
  changeStatus(
    id: number,
    payload: EmployeeStatusChangePayload,
  ): Promise<Employee> {
    return http
      .put<EmployeeFromApi>(`${API_ENDPOINTS.EMPLOYEES}/${id}`, {
        employee_status: payload.employee_status,
        reason: payload.note,
        effective_date: payload.effective_date,
      })
      .then(remap);
  },

  restore(id: number): Promise<Employee> {
    return http
      .patch<EmployeeFromApi>(
        `${API_ENDPOINTS.EMPLOYEES}/${id}/restore`,
        undefined,
      )
      .then(remap);
  },

  archive(id: number): Promise<void> {
    return http.delete<void>(`${API_ENDPOINTS.EMPLOYEES}/${id}/force-delete`);
  },

  /** Xóa mềm (set deleted_at) — nhân viên có thể khôi phục qua restore(). */
  softDelete(id: number): Promise<void> {
    return http.delete<void>(`${API_ENDPOINTS.EMPLOYEES}/${id}/soft-delete`);
  },

  /**
   * Cấp tài khoản đăng nhập cho nhân sự đã tồn tại.
   * Response thật KHÔNG phải Employee — `id` trả về là user id vừa tạo.
   * `password` để trống (undefined) → BE tự sinh mật khẩu mạnh ngẫu nhiên
   * (xem docs/employee-account-provisioning-flow.md mục 3) và trả kèm
   * `temporary_password` — chỉ trả về đúng 1 lần trong response này.
   */
  createAccount(id: number, password?: string): Promise<CreateAccountResult> {
    return http
      .post<{
        id: number;
        email: string;
        password_change_required: boolean;
        temporary_password: string;
        invite_link: string;
      }>(
        `${API_ENDPOINTS.EMPLOYEES}/${id}/account`,
        password ? { password } : {},
      )
      .then((data) => ({
        userId: data.id,
        email: data.email,
        passwordChangeRequired: data.password_change_required,
        temporaryPassword: data.temporary_password,
        inviteLink: data.invite_link,
      }));
  },

  /**
   * Cấp lại mật khẩu tạm cho tài khoản đã tồn tại (khóa do hết hạn 168h,
   * hoặc Admin/HR chủ động cấp lại).
   * POST /employees/{id}/account/reissue-temporary-credential
   * Không tạo tài khoản mới, giữ nguyên account_id.
   * Yêu cầu header Idempotency-Key (đã được thêm tự động bởi axios interceptor).
   */
  reissueTemporaryCredential(id: number): Promise<CreateAccountResult> {
    return http
      .post<{
        id: number;
        email: string;
        password_change_required: boolean;
        temporary_password: string;
        invite_link: string;
      }>(
        `${API_ENDPOINTS.EMPLOYEES}/${id}/account/reissue-temporary-credential`,
        {},
      )
      .then((data) => ({
        userId: data.id,
        email: data.email,
        passwordChangeRequired: data.password_change_required,
        temporaryPassword: data.temporary_password,
        inviteLink: data.invite_link,
      }));
  },

  /**
   * Danh sách nhân sự có thể được phân công làm người phụ trách.
   * GET /employees/assignable-employees?assignment_type=&org_unit_id=&department_id=
   *
   * assignment_type: 'department_manager' | 'org_unit_manager'
   * - department_manager: bắt buộc truyền department_id
   * - org_unit_manager: bắt buộc truyền org_unit_id
   *
   * Response: { success, data: [{ id, code, full_name, position, management_level }] }
   *
   * Lưu ý: BE đã fix lọc PENDING_PASSWORD_CHANGE (chỉ trả nhân sự ACTIVE thực sự),
   * FE không cần tự lọc thêm.
   */
  listAssignableEmployees(params: {
    assignment_type: 'department_manager' | 'org_unit_manager';
    department_id?: number;
    org_unit_id?: number;
  }): Promise<
    Array<{
      id: number;
      code: string;
      full_name: string;
      position: string;
      management_level: number;
    }>
  > {
    const q = new URLSearchParams();
    q.set('assignment_type', params.assignment_type);
    if (params.assignment_type === 'department_manager') {
      if (params.department_id == null) {
        throw new Error(
          'department_id bắt buộc khi assignment_type = department_manager',
        );
      }
      q.set('department_id', String(params.department_id));
    } else if (params.assignment_type === 'org_unit_manager') {
      if (params.org_unit_id == null) {
        throw new Error(
          'org_unit_id bắt buộc khi assignment_type = org_unit_manager',
        );
      }
      q.set('org_unit_id', String(params.org_unit_id));
    }

    return http
      .get<{
        success: boolean;
        data: Array<{
          id: number;
          code: string;
          full_name: string;
          position: string;
          management_level: number;
        }>;
      }>(`${API_ENDPOINTS.EMPLOYEES_ASSIGNABLE}?${q.toString()}`)
      .then((res) => res.data);
  },

  /**
   * Import danh sách nhân sự từ file Excel (POST /employees/import-excel,
   * multipart/form-data, field `file` bắt buộc — xác nhận qua Swagger thật,
   * 2026-07-05). Response: `{ created: number, errors: string[] }` — `errors`
   * là danh sách lỗi theo từng dòng dạng "Dòng N: <lý do>", không chặn các
   * dòng hợp lệ khác (import từng phần).
   */
  importExcel(file: File): Promise<{ created: number; errors: string[] }> {
    const formData = new FormData();
    formData.append('file', file);
    return http.post<{ created: number; errors: string[] }>(
      API_ENDPOINTS.EMPLOYEES_IMPORT_EXCEL,
      formData,
    );
  },

  async listStatusHistories(
    params: { page?: number; limit?: number; employee_id?: number } = {},
  ): Promise<{ data: EmployeeStatusHistory[]; meta: ApiMeta }> {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    if (params.employee_id) q.set('employee_id', String(params.employee_id));
    const queryString = q.toString();
    const { data, meta } = await http.getPage<EmployeeStatusHistoryFromApi[]>(
      `${API_ENDPOINTS.EMPLOYEE_STATUS_HISTORIES}${queryString ? `?${queryString}` : ''}`,
    );
    return { data: data.map(remapStatusHistory), meta };
  },

  /**
   * Danh sách nhân sự đã xóa mềm (deleted_at != null).
   * GET /employees/trashed?page=&per_page=&keyword=...
   * Response: { data: [], meta: { total, current_page, per_page, last_page } }
   */
  async listTrashed(
    params: EmployeeListParams = {},
  ): Promise<{ data: Employee[]; meta: ApiMeta }> {
    const q = buildListSearchParams(params, LIST_QUERY_KEY_MAP);
    if (params.org_unit_id != null)
      q.set('org_unit_id', String(params.org_unit_id));
    if (params.department_id != null)
      q.set('department_id', String(params.department_id));
    if (params.position_id != null)
      q.set('position_id', String(params.position_id));
    if (params.employee_status != null)
      q.set('employee_status', String(params.employee_status));
    if (params.account_status != null) q.set('status', params.account_status);
    if (params.include_assignments) q.append('include[]', 'assignments');
    if (params.sort_by) q.set('sort_by', params.sort_by);
    if (params.sort_order) q.set('sort_order', params.sort_order);

    const { data, meta } = await http.getPage<EmployeeFromApi[]>(
      `${API_ENDPOINTS.EMPLOYEES_TRASHED}?${q}`,
    );
    return { data: data.map(remap), meta };
  },

  /**
   * Chi tiết 1 bản ghi lịch sử trạng thái nhân sự.
   * GET /employee-status-histories/{id}
   */
  getStatusHistoryById(id: number): Promise<EmployeeStatusHistory> {
    return http
      .get<EmployeeStatusHistoryFromApi>(
        `${API_ENDPOINTS.EMPLOYEE_STATUS_HISTORIES}/${id}`,
      )
      .then(remapStatusHistory);
  },
};

export {
  useEmployees,
  useEmployeeList,
  useCreateEmployee,
  useUpdateEmployee,
  useChangeEmployeeStatus,
  useRestoreEmployee,
  useArchiveEmployee,
  useImportEmployeesExcel,
} from '@/modules/employees/hooks/use-employees';
