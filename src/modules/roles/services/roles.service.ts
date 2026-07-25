import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import { buildListSearchParams } from '@/shared/utils/list-query-params';
import type {
  Role,
  RolePayload,
  RoleSyncPermissionsPayload,
} from '../types/roles.types';
import type { ApiMeta } from '@/shared/types/api-response';

export interface RoleListParams {
  page?: number;
  per_page?: number;
  search?: string;
}

/**
 * GET /roles hỗ trợ phân trang thật (page/limit) + search — xác minh qua
 * Swagger thật (`page`, `limit`, `search` params) và API thật (meta trả về
 * current_page/per_page/last_page/total). Trước đây gọi không kèm param nào
 * và dùng `http.get` (bỏ luôn `meta`) — chỉ "chạy đúng" vì số vai trò hiện có
 * (12) nằm gọn trong per_page mặc định (15) của BE; vượt quá số đó sẽ bị cắt
 * âm thầm không cảnh báo. Đổi sang `http.getPage` để giữ `meta.total` cho UI
 * phân trang thật.
 */
const getRoles = (
  params: RoleListParams = {},
): Promise<{ data: Role[]; meta: ApiMeta }> => {
  const sp = buildListSearchParams(params, { per_page: 'limit' });
  if (params.search) sp.set('search', params.search);
  const qs = sp.toString();
  const url = qs ? `${API_ENDPOINTS.ROLES}?${qs}` : API_ENDPOINTS.ROLES;
  return http.getPage<Role[]>(url);
};

const getRole = (id: number) => {
  return http.get<Role>(`${API_ENDPOINTS.ROLES}/${id}`);
};

const createRole = (payload: RolePayload) => {
  return http.post<Role>(API_ENDPOINTS.ROLES, payload);
};

/**
 * Cập nhật vai trò. API thật: PUT /roles/{id} (Swagger: "Sửa vai trò",
 * có requestBody, responses 200/400/401/403/404/500).
 * Đã xác minh trên BE `astrodev.test8.io.vn` (2026-07-10): route TỒN TẠI,
 * trả 200 cho role thường, 403 ACCESS_DENIED cho role hệ thống (Super Admin).
 * Không còn trả 405 (evidence cũ sai do test bằng base path /api thay vì /api/v1).
 */
const updateRole = (id: number, payload: RolePayload) => {
  return http.put<Role>(`${API_ENDPOINTS.ROLES}/${id}`, payload);
};

/**
 * Xóa mềm (vô hiệu hóa) vai trò. API thật: DELETE /roles/{id}/soft-delete.
 * Xác minh qua Swagger LIVE (`/docs?api-docs.json`, 2026-07-12): route DUY NHẤT
 * được khai báo cho xóa mềm role là `/roles/{id}/soft-delete` — khớp
 * `API_MAPPING_SHEET.md` và pattern dùng chung cho mọi module khác (org_units,
 * departments, positions, employees, warehouses, price-lists, tasks đều dùng
 * hậu tố `/soft-delete`). Trước đây gọi thẳng `DELETE /roles/{id}` (không hậu
 * tố) — route này KHÔNG có trong Swagger nhưng vẫn "chạy đúng" ở runtime (đã
 * test thật, cùng hiệu ứng soft-delete) vì trùng controller method; đây là
 * route không tài liệu hóa nên không đáng tin cậy để phụ thuộc lâu dài. Đã đổi
 * sang route chuẩn theo Swagger để đồng bộ code/docs/evidence (xem
 * `docs/api-evidence/roles.md`).
 */
const inactiveRole = (id: number): Promise<void> => {
  return http.delete<void>(`${API_ENDPOINTS.ROLES}/${id}/soft-delete`);
};

/** Khôi phục vai trò đã xóa mềm. API thật: PATCH /roles/{id}/restore. */
const restoreRole = (id: number): Promise<void> => {
  return http.patch<void>(`${API_ENDPOINTS.ROLES}/${id}/restore`);
};

/** Xóa vĩnh viễn vai trò. API thật: DELETE /roles/{id}/force-delete. */
const archiveRole = (id: number): Promise<void> => {
  return http.delete<void>(`${API_ENDPOINTS.ROLES}/${id}/force-delete`);
};

/**
 * Gán (sync) danh sách quyền cho vai trò.
 * POST /roles/{id}/permissions — gửi toàn bộ danh sách, BE sẽ thay thế.
 */
const syncPermissions = (id: number, payload: RoleSyncPermissionsPayload) => {
  return http.post<Role>(`${API_ENDPOINTS.ROLES}/${id}/permissions`, payload);
};

export const rolesService = {
  getRoles,
  getById: getRole,
  create: createRole,
  update: updateRole,
  delete: inactiveRole,
  restore: restoreRole,
  archive: archiveRole,
  syncPermissions,
};

// Re-export hooks
export {
  useRoles,
  useRole,
  useCreateRole,
  useUpdateRole,
  useDeleteRole,
  useRestoreRole,
  useArchiveRole,
  useSyncRolePermissions,
} from '@/modules/roles/hooks/use-roles';
