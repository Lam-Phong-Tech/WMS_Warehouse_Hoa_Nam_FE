import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import { buildListSearchParams } from '@/shared/utils/list-query-params';
import type { ApiMeta } from '@/shared/types/api-response';

/**
 * User-Role-Scope gán theo BR-17/BR-21:
 * - Vai trò KHÔNG chứa phạm vi dữ liệu
 * - Mỗi bản ghi gán = user + vai trò + phạm vi + effective date (từ - đến)
 * - Lưu ở bảng user_role_scopes
 */
export interface UserRoleScope {
  id: number;
  user_id: number;
  role_id: number;
  role_name?: string;
  org_unit_id?: number | null;
  department_id?: number | null;
  warehouse_id?: number | null;
  scope_type?: string;
  scope_name?: string;
  effect?: string;
  allow?: boolean;
  /** Vai trò đầy đủ (BE trả kèm quan hệ `role`, không trả `role_name` phẳng) */
  role?: { id: number; code: string; name: string } | null;
  /** Đơn vị/chi nhánh gắn với scope (BE trả kèm quan hệ, dùng để suy ra tên hiển thị) */
  org_unit?: { id: number; name: string } | null;
  /** Phòng ban gắn với scope (BE trả kèm quan hệ, dùng để suy ra tên hiển thị) */
  department?: { id: number; name: string } | null;
  /** Ngày bắt đầu hiệu lực (ISO date string) */
  effective_from?: string | null;
  /** Ngày kết thúc hiệu lực (null = vô thời hạn) */
  effective_to?: string | null;
  /** Lý do cấp/cấm */
  reason?: string | null;
  /** Trạng thái: 1 = active, 0 = inactive */
  status?: number;
  created_by?: number | null;
  updated_by?: number | null;
  /** Audit: ai thu hồi */
  revoked_by?: number | null;
  /** Audit: thời điểm thu hồi */
  revoked_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

/**
 * Direct Data Scope theo BR-17:
 * - Vùng dữ liệu cộng thêm/cấm thêm trực tiếp cho user
 * - KHÔNG gắn vai trò nào
 * - Có effect allow/deny, lý do, effective date, audit thu hồi
 */
export interface UserDataScope {
  id: number;
  user_id: number;
  /** 'org_unit' | 'department' | 'warehouse' | 'company' */
  scope_type: string;
  /**
   * ID phạm vi, chuẩn hoá cho UI dùng chung 1 field bất kể loại phạm vi.
   * BE thật KHÔNG trả `scope_id` — trả riêng `org_unit_id`/`department_id`/
   * `warehouse_id` tuỳ `scope_type` (xác nhận qua test trực tiếp trên BE,
   * 2026-07-04). `getUserDataScopes()` tự quy đổi các field đó về `scope_id`
   * để UI không phải rẽ nhánh theo scope_type khi hiển thị.
   */
  scope_id: number;
  scope_name?: string;
  /** true = allow (cho phép), false = deny (cấm) */
  allow: boolean;
  effect?: string;
  /** Lý do cấp/cấm */
  reason?: string | null;
  /** Ngày bắt đầu hiệu lực */
  effective_from?: string | null;
  /** Ngày kết thúc hiệu lực (null = vô thời hạn) */
  effective_to?: string | null;
  created_at?: string;
  updated_at?: string;
  /** Audit: ai thu hồi */
  revoked_by?: number | null;
  /** Audit: thời điểm thu hồi */
  revoked_at?: string | null;
  status?: number;
}

/**
 * Shape thật BE trả về cho user-data-scopes — dùng `org_unit_id`/
 * `department_id`/`warehouse_id` riêng biệt, KHÔNG có `scope_id` chung
 * (xác nhận qua test trực tiếp trên BE, 2026-07-04).
 */
type UserDataScopeFromApi = Omit<UserDataScope, 'scope_id'> & {
  org_unit_id?: number | null;
  department_id?: number | null;
  warehouse_id?: number | null;
  /** Đơn vị/chi nhánh gắn với scope (BE trả kèm quan hệ) */
  org_unit?: { id: number; name: string } | null;
  /** Phòng ban gắn với scope (BE trả kèm quan hệ) */
  department?: { id: number; name: string } | null;
};

/**
 * Payload gán/sửa vai trò qua PUT /users/{user_id}/role-scopes.
 * CHỈ gồm field mà BE thật sự nhận — xác nhận qua Swagger schema
 * `RoleScopeGrantRequest` + test trực tiếp (2026-07-03): gửi thêm
 * effective_from/effective_to/reason/allow/effect đều bị BE bỏ qua (lưu
 * null/mặc định "allow"), không có chỗ lưu ở endpoint này. KHÔNG thêm lại các
 * field đó trừ khi BE xác nhận đã bổ sung — xem docs/CHANGELOG.md.
 */
export interface AssignRoleToUserPayload {
  user_id: number;
  role_id: number;
  org_unit_id?: number | null;
  department_id?: number | null;
  warehouse_id?: number | null;
  scope_type?: string;
}

export interface DataScopePayload {
  user_id: number;
  scope_type: string;
  scope_id: number;
  allow: boolean;
  effect?: string;
  /** Lý do cấp/cấm (bắt buộc) */
  reason?: string | null;
  /** Ngày bắt đầu hiệu lực */
  effective_from?: string | null;
  /** Ngày kết thúc hiệu lực (null = vô thời hạn) */
  effective_to?: string | null;
}

/**
 * Nhãn hiển thị (tiếng Việt) + màu Tag cho từng scope_type, dùng chung ở
 * UserRoleScopesPage/UserDataScopesTable — trước đây UI hiển thị thẳng
 * scope_type thô (vd "he_thong") khiến admin không rõ đây là scope "Toàn hệ
 * thống". Nhận cả 2 dạng key (BE 'he_thong'/'kho'... và FE đã map
 * 'company'/'warehouse'...) vì các nơi gọi truyền vào không đồng nhất.
 */
export const SCOPE_TYPE_LABELS: Record<
  string,
  { label: string; color: string }
> = {
  he_thong: { label: 'Toàn hệ thống', color: 'purple' },
  cong_ty: { label: 'Công ty', color: 'geekblue' },
  company: { label: 'Công ty', color: 'geekblue' },
  chi_nhanh: { label: 'Chi nhánh', color: 'blue' },
  org_unit: { label: 'Chi nhánh', color: 'blue' },
  phong_ban: { label: 'Phòng ban', color: 'cyan' },
  department: { label: 'Phòng ban', color: 'cyan' },
  kho: { label: 'Kho', color: 'orange' },
  warehouse: { label: 'Kho', color: 'orange' },
};

export function getScopeTypeLabel(scopeType?: string): {
  label: string;
  color: string;
} {
  if (!scopeType) return { label: 'Toàn hệ thống', color: 'purple' };
  return SCOPE_TYPE_LABELS[scopeType] || { label: scopeType, color: 'default' };
}

/**
 * Tên hiển thị cho "phạm vi hiện tại" — BE chỉ trả `scope_name` cho org_unit/
 * department (xác nhận qua evidence, docs/api-evidence/user_role_scopes.md);
 * scope hệ thống (he_thong) không có scope_id nên luôn null, và warehouse có
 * thể null tuỳ dữ liệu. `warehouseMap` (id → tên kho) do component tự load
 * qua warehousesService để bù vào khi BE không trả tên.
 */
export function getScopeDisplayName(
  scope: {
    scope_type?: string;
    scope_name?: string;
    warehouse_id?: number | null;
  },
  warehouseMap?: Record<number, string>,
): string {
  if (scope.scope_type === 'he_thong' || !scope.scope_type)
    return 'Toàn hệ thống';
  if (scope.scope_name) return scope.scope_name;
  if (scope.warehouse_id) {
    return warehouseMap?.[scope.warehouse_id] || `Kho #${scope.warehouse_id}`;
  }
  return '—';
}

const mapScopeTypeToBackend = (type?: string): string => {
  if (!type) return 'he_thong';
  const mapping: Record<string, string> = {
    company: 'cong_ty',
    org_unit: 'chi_nhanh',
    department: 'phong_ban',
    warehouse: 'kho',
    chi_nhanh: 'chi_nhanh',
    phong_ban: 'phong_ban',
    he_thong: 'he_thong',
    cong_ty: 'cong_ty',
    kho: 'kho',
  };
  return mapping[type] || type;
};

const mapScopeTypeToFrontend = (type?: string): string => {
  if (!type) return 'he_thong';
  const mapping: Record<string, string> = {
    cong_ty: 'company',
    chi_nhanh: 'org_unit',
    phong_ban: 'department',
    kho: 'warehouse',
    company: 'company',
    org_unit: 'org_unit',
    department: 'department',
    warehouse: 'warehouse',
  };
  return mapping[type] || type;
};

export interface UserRoleScopeListParams {
  user_id?: number;
  page?: number;
  per_page?: number;
}

export const userRoleScopesService = {
  /**
   * Lấy danh sách role đã gán cho user (có thể lọc theo user_id).
   * GET /user-role-scopes hỗ trợ phân trang thật (page/per_page) — xác nhận
   * qua Swagger live + gọi API thật (2026-07-16): meta trả về
   * current_page/per_page/last_page/total. Trước đây gọi không kèm page/
   * per_page và bỏ luôn `meta`, khiến UI phải tự phân trang phía client
   * (không phản ánh đúng total thật từ BE).
   */
  async getUserRoles(
    params: UserRoleScopeListParams = {},
  ): Promise<{ data: UserRoleScope[]; meta: ApiMeta }> {
    const sp = buildListSearchParams(params);
    if (params.user_id) sp.set('user_id', String(params.user_id));
    const qs = sp.toString();
    const url = qs
      ? `${API_ENDPOINTS.USER_ROLE_SCOPES}?${qs}`
      : API_ENDPOINTS.USER_ROLE_SCOPES;
    const { data, meta } = await http.getPage<UserRoleScope[]>(url);
    return {
      data: (data || []).map((r) => ({
        ...r,
        role_name: r.role_name ?? r.role?.name,
        scope_name: r.scope_name ?? r.department?.name ?? r.org_unit?.name,
        scope_type: mapScopeTypeToFrontend(r.scope_type),
      })),
      meta,
    };
  },

  /** Gán role cho user bằng cách lấy danh sách hiện có, thêm và đồng bộ qua PUT /users/{user_id}/role-scopes */
  async assignRoleToUser(payload: AssignRoleToUserPayload): Promise<unknown> {
    const { data: current } = await userRoleScopesService.getUserRoles({
      user_id: payload.user_id,
      per_page: 100,
    });

    const grants = current
      .filter((r) => !r.revoked_at)
      .map((r) => ({
        role_id: r.role_id,
        scope_type: mapScopeTypeToBackend(r.scope_type),
        org_unit_id: r.org_unit_id || null,
        department_id: r.department_id || null,
        warehouse_id: r.warehouse_id || null,
      }));

    grants.push({
      role_id: payload.role_id,
      scope_type: mapScopeTypeToBackend(
        payload.scope_type ||
          (payload.warehouse_id
            ? 'warehouse'
            : payload.department_id
              ? 'department'
              : payload.org_unit_id
                ? 'org_unit'
                : 'he_thong'),
      ),
      org_unit_id: payload.org_unit_id || null,
      department_id: payload.department_id || null,
      warehouse_id: payload.warehouse_id || null,
    });

    return http.put<unknown>(`/users/${payload.user_id}/role-scopes`, {
      grants,
    });
  },

  /** Cập nhật role đã gán bằng cách lấy danh sách hiện có, thay thế phần tử và đồng bộ qua PUT /users/{user_id}/role-scopes */
  async updateRoleScope(
    id: number,
    payload: AssignRoleToUserPayload,
  ): Promise<unknown> {
    const { data: current } = await userRoleScopesService.getUserRoles({
      user_id: payload.user_id,
      per_page: 100,
    });

    const grants = current
      .filter((r) => !r.revoked_at)
      .map((r) => {
        if (r.id === id) {
          return {
            role_id: payload.role_id,
            scope_type: mapScopeTypeToBackend(
              payload.scope_type ||
                (payload.warehouse_id
                  ? 'warehouse'
                  : payload.department_id
                    ? 'department'
                    : payload.org_unit_id
                      ? 'org_unit'
                      : 'he_thong'),
            ),
            org_unit_id: payload.org_unit_id || null,
            department_id: payload.department_id || null,
            warehouse_id: payload.warehouse_id || null,
          };
        }
        return {
          role_id: r.role_id,
          scope_type: mapScopeTypeToBackend(r.scope_type),
          org_unit_id: r.org_unit_id || null,
          department_id: r.department_id || null,
          warehouse_id: r.warehouse_id || null,
        };
      });

    return http.put<unknown>(`/users/${payload.user_id}/role-scopes`, {
      grants,
    });
  },

  /**
   * Thu hồi role có ghi nhận audit. Gọi DELETE /user-role-scopes/{id}.
   * `reason` là optional theo contract BE (requestBody.required=false) nhưng
   * nên gửi khi có để khép kín audit thu hồi quyền.
   */
  async revokeRoleFromUser(id: number, reason?: string): Promise<unknown> {
    const url = `${API_ENDPOINTS.USER_ROLE_SCOPES}/${id}`;
    return reason
      ? http.delete<unknown>(url, { data: { reason } })
      : http.delete<unknown>(url);
  },

  /**
   * Đếm số nhân viên (distinct user) được gán cho TỪNG vai trò, dựa trên dữ
   * liệu thật từ bảng `user_role_scopes`.
   *
   * BE KHÔNG có trường `users_count`/`assigned_users_count` trong response
   * `/roles` (xác nhận qua Swagger + test trực tiếp 2026-07-09), và cũng KHÔNG
   * có endpoint thống kê role-user riêng. Do đó lấy 1 lần toàn bộ scopes
   * (per_page lớn) rồi group distinct `user_id` theo `role_id` ở FE — đây là
   * dữ liệu thật 100%, thay thế hoàn toàn hàm mock `getMockUsersCount()` cũ
   * từng bị đánh giá P0.1 (còn mock trong Role Permission Matrix).
   *
   * Chỉ tính các bản ghi active (chưa bị thu hồi `revoked_at` và `status=1`)
   * để khớp với số user thực tế còn hiệu lực.
   *
   * @returns map `{ [role_id]: số_nhân_viên_distinct }`
   */
  async getRoleUserCounts(): Promise<Record<number, number>> {
    const data = await http.get<UserRoleScope[]>(
      `${API_ENDPOINTS.USER_ROLE_SCOPES}?per_page=1000`,
    );
    const counts: Record<number, Set<number>> = {};
    for (const scope of data ?? []) {
      if (scope.revoked_at) continue;
      if (scope.status !== undefined && scope.status === 0) continue;
      if (scope.role_id == null || scope.user_id == null) continue;
      (counts[scope.role_id] ??= new Set()).add(scope.user_id);
    }
    const result: Record<number, number> = {};
    for (const [roleId, users] of Object.entries(counts)) {
      result[Number(roleId)] = users.size;
    }
    return result;
  },

  /** Lấy danh sách data scope trực tiếp của user */
  async getUserDataScopes(userId: number): Promise<UserDataScope[]> {
    const data = await http.get<UserDataScopeFromApi[]>(
      `${API_ENDPOINTS.USER_DATA_SCOPES}?user_id=${userId}`,
    );
    return (data || []).map((d) => {
      const { org_unit_id, department_id, warehouse_id, ...rest } = d;
      return {
        ...rest,
        scope_name: d.scope_name ?? d.department?.name ?? d.org_unit?.name,
        scope_type: mapScopeTypeToFrontend(d.scope_type),
        scope_id: (org_unit_id ?? department_id ?? warehouse_id) as number,
      };
    });
  },

  /**
   * Thêm data scope trực tiếp cho user.
   * BE thật KHÔNG nhận `scope_id` chung — bắt buộc đúng field theo `scope_type`
   * (xác nhận qua test trực tiếp trên BE, 2026-07-04):
   * - 'company'/'org_unit' (cong_ty/chi_nhanh) → org_unit_id
   * - 'department' (phong_ban) → department_id
   * - 'warehouse' (kho) → warehouse_id
   * Gửi `scope_id` (tên field cũ) luôn bị BE từ chối 400 VALIDATION_FAILED
   * dù các field khác hợp lệ — đây là bug thật đã sửa, không chỉ thiếu evidence.
   */
  async addDataScope(payload: DataScopePayload): Promise<UserDataScope> {
    const { scope_id, scope_type, allow, ...rest } = payload;
    const backendScopeType = mapScopeTypeToBackend(scope_type);
    const scopeIdField =
      scope_type === 'warehouse'
        ? 'warehouse_id'
        : scope_type === 'department'
          ? 'department_id'
          : 'org_unit_id'; // company | org_unit

    const body = {
      ...rest,
      scope_type: backendScopeType,
      effect: allow ? 'allow' : 'deny',
      [scopeIdField]: scope_id,
    };
    const created = await http.post<UserDataScopeFromApi>(
      API_ENDPOINTS.USER_DATA_SCOPES,
      body,
    );
    return {
      ...created,
      scope_type: mapScopeTypeToFrontend(created.scope_type),
      scope_id: (created.org_unit_id ??
        created.department_id ??
        created.warehouse_id) as number,
    };
  },

  /**
   * Thu hồi data scope. Gọi DELETE /user-data-scopes/{id}.
   * `reason` là optional theo contract BE nhưng nên gửi khi có để khép kín
   * audit thu hồi quyền.
   */
  async revokeDataScope(id: number, reason?: string): Promise<unknown> {
    const url = `${API_ENDPOINTS.USER_DATA_SCOPES}/${id}`;
    return reason
      ? http.delete<unknown>(url, { data: { reason } })
      : http.delete<unknown>(url);
  },
};
