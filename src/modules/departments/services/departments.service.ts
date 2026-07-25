import type { ApiMeta } from '@/shared/types/api-response';
import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import { buildListSearchParams } from '@/shared/utils/list-query-params';
import type {
  Department,
  DepartmentTreeNode,
} from '../types/departments.types';
import type { DepartmentFormValues } from '../schemas/department.schema';
import {
  remap as mapDepartment,
  remapTree,
  toPayload as toDepartmentPayload,
  type DepartmentFromApi,
  type DepartmentTreeNodeFromApi,
} from './departments.mapper';

export interface DepartmentListParams {
  page?: number;
  per_page?: number;
  q?: string;
  keyword?: string;
  org_unit_id?: number;
  status?: number;
  /** Trường sắp xếp phía backend (chỉ cột trực tiếp: "code" | "name"). */
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

/**
 * Contract query GET /departments — BE dùng `limit` (không phải `per_page`)
 * và `q` (không phải `keyword`), giống org-units/companies/roles. Xem
 * `docs/api-evidence/departments.md`.
 */
const LIST_QUERY_KEY_MAP = { per_page: 'limit', keyword: 'q' };

export const departmentsService = {
  async getDepartments(): Promise<Department[]> {
    const data = await http.get<DepartmentFromApi[]>(API_ENDPOINTS.DEPARTMENTS);
    return data.map(mapDepartment);
  },

  async getDepartment(id: number): Promise<Department> {
    const data = await http.get<DepartmentFromApi>(
      `${API_ENDPOINTS.DEPARTMENTS}/${id}`,
    );
    return mapDepartment(data);
  },

  async createDepartment(values: DepartmentFormValues): Promise<Department> {
    const data = await http.post<DepartmentFromApi>(
      API_ENDPOINTS.DEPARTMENTS,
      toDepartmentPayload(values),
    );
    return mapDepartment(data);
  },

  async updateDepartment(
    id: number,
    values: DepartmentFormValues,
  ): Promise<Department> {
    const data = await http.put<DepartmentFromApi>(
      `${API_ENDPOINTS.DEPARTMENTS}/${id}`,
      toDepartmentPayload(values),
    );
    return mapDepartment(data);
  },

  /**
   * Vô hiệu hóa / kích hoạt lại phòng ban. Không có endpoint riêng
   * PUT /departments/{id}/inactive — theo API doc thật (astrodev.test8.io.vn),
   * đổi trạng thái active/inactive đi qua PUT /departments/{id} với field
   * status (0 = inactive, 1 = active), giống model của Employee.
   *
   * BE validate PUT y hệt POST — org_unit_id/department_type/name vẫn bắt
   * buộc dù chỉ đổi status (đã xác nhận qua lỗi 422 thực tế khi PUT chỉ gửi
   * { status }). Vì vậy phải gửi kèm toàn bộ dữ liệu hiện có của phòng ban,
   * không chỉ mỗi field status.
   */
  async setDepartmentActive(
    dept: Department,
    active: boolean,
  ): Promise<Department> {
    const data = await http.put<DepartmentFromApi>(
      `${API_ENDPOINTS.DEPARTMENTS}/${dept.id}`,
      {
        org_unit_id: dept.orgUnitId,
        code: dept.code,
        department_type: dept.departmentType,
        name: dept.name,
        parent_id: dept.parentId,
        manager_employee_id: dept.managerId,
        description: dept.note ?? null,
        status: active ? 1 : 0,
      },
    );
    return mapDepartment(data);
  },

  /** Xóa mềm phòng ban (vào thùng rác 14 ngày). DELETE /departments/{id}/soft-delete */
  async softDeleteDepartment(id: number): Promise<void> {
    return http.delete<void>(`${API_ENDPOINTS.DEPARTMENTS}/${id}/soft-delete`);
  },

  /** Khôi phục phòng ban đã xóa mềm. PATCH /departments/{id}/restore */
  async restoreDepartment(id: number): Promise<Department> {
    const data = await http.patch<DepartmentFromApi>(
      `${API_ENDPOINTS.DEPARTMENTS}/${id}/restore`,
      undefined,
    );
    return mapDepartment(data);
  },

  /** Xóa vĩnh viễn phòng ban. DELETE /departments/{id}/force-delete */
  async forceDeleteDepartment(id: number): Promise<void> {
    return http.delete<void>(`${API_ENDPOINTS.DEPARTMENTS}/${id}/force-delete`);
  },

  // ─────────────────────────────────────────────────────────────────────────
  // Backward-compatible aliases (used by hooks & pages)
  // ─────────────────────────────────────────────────────────────────────────

  /** @alias getDepartments */
  list: async function (): Promise<Department[]> {
    return departmentsService.getDepartments();
  },

  /** @alias getDepartment */
  getById: async function (id: number): Promise<Department> {
    return departmentsService.getDepartment(id);
  },

  /** @alias createDepartment */
  create: async function (values: DepartmentFormValues): Promise<Department> {
    return departmentsService.createDepartment(values);
  },

  /** @alias updateDepartment */
  update: async function (
    id: number,
    values: DepartmentFormValues,
  ): Promise<Department> {
    return departmentsService.updateDepartment(id, values);
  },

  /** @alias setDepartmentActive */
  inactive: async function (dept: Department): Promise<Department> {
    return departmentsService.setDepartmentActive(dept, false);
  },

  /** @alias setDepartmentActive */
  activate: async function (dept: Department): Promise<Department> {
    return departmentsService.setDepartmentActive(dept, true);
  },

  /** @alias softDeleteDepartment */
  softDelete: async function (id: number): Promise<void> {
    return departmentsService.softDeleteDepartment(id);
  },

  /** @alias restoreDepartment */
  restore: async function (id: number): Promise<Department> {
    return departmentsService.restoreDepartment(id);
  },

  /** @alias forceDeleteDepartment */
  forceDelete: async function (id: number): Promise<void> {
    return departmentsService.forceDeleteDepartment(id);
  },

  // Placeholder for methods that were in original service but not yet migrated:
  /** Danh sách có phân trang */
  listPaged: async function (
    params: DepartmentListParams = {},
  ): Promise<{ data: Department[]; meta: ApiMeta }> {
    const q = buildListSearchParams(params, LIST_QUERY_KEY_MAP);
    if (params.org_unit_id != null)
      q.set('org_unit_id', String(params.org_unit_id));
    if (params.status != null) q.set('status', String(params.status));
    if (params.sort_by) q.set('sort_by', params.sort_by);
    if (params.sort_order) q.set('sort_order', params.sort_order);

    const { data, meta } = await http.getPage<DepartmentFromApi[]>(
      `${API_ENDPOINTS.DEPARTMENTS}?${q}`,
    );
    return { data: data.map(mapDepartment), meta };
  },

  /** Cây phòng ban. GET /departments/tree */
  getTree: async function (): Promise<DepartmentTreeNode[]> {
    const data = await http.get<DepartmentTreeNodeFromApi[]>(
      `${API_ENDPOINTS.DEPARTMENTS}/tree`,
    );
    return remapTree(data);
  },

  /** Tự sinh mã phòng ban/nhóm tổ. POST /departments/generate-code */
  generateCode: async function (departmentType: string): Promise<string> {
    const result = await http.post<{ code: string }>(
      `${API_ENDPOINTS.DEPARTMENTS}/generate-code`,
      { department_type: departmentType },
    );
    return result.code;
  },
};
