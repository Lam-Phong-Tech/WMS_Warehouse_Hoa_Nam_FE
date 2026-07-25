import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import { buildListSearchParams } from '@/shared/utils/list-query-params';
import type { ApiMeta } from '@/shared/types/api-response';
import type {
  Position,
  PositionPayload,
} from '@/modules/positions/types/positions.types';
import type { PositionFormValues } from '@/modules/positions/schemas/position.schema';

function normalizeGrade(grade: unknown): string | null {
  if (grade == null || grade === '') return null;
  if (typeof grade === 'number') return `C${grade}`;
  if (typeof grade === 'string') {
    const trimmed = grade.trim();
    if (!trimmed) return null;
    if (/^c?\d+$/i.test(trimmed)) return `C${trimmed.replace(/^c/i, '')}`;
    return trimmed;
  }
  return null;
}

function normalizeGradeForApi(grade: number | undefined): string | undefined {
  if (grade === undefined) return undefined;
  return `C${grade}`;
}

// API có thể trả thêm trường; chỉ lấy những gì cần.
type PositionFromApi = {
  id: number;
  code: string;
  name: string;
  management_level?: number;
  description?: string | null;
  grade?: string | null;
  status?: number;
  employees_count?: number;
  deleted_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function remap(p: PositionFromApi): Position {
  return {
    id: p.id,
    code: p.code,
    name: p.name,
    management_level: p.management_level ?? 1,
    description: p.description ?? undefined,
    grade: normalizeGrade(p.grade) ?? null,
    // Không có status (vd trong assignment) → coi như đang hoạt động.
    active: p.status === undefined ? true : p.status === 1,
    employeeCount: p.employees_count,
    created_at: p.created_at ?? undefined,
    updated_at: p.updated_at ?? undefined,
  };
}

function toPayload(v: PositionFormValues): PositionPayload {
  return {
    code: v.code,
    name: v.name,
    management_level: v.management_level,
    description: v.description,
    grade: normalizeGradeForApi(v.grade),
    status: v.active ? 1 : 0,
  };
}

/** Helper: chuyển đổi status filter từ UI (active/inactive) sang định dạng BE (1/0) */
function mapStatusToApi(status: string | undefined): string | undefined {
  if (status === 'active') return '1';
  if (status === 'inactive') return '0';
  return undefined;
}

export interface PositionListParams {
  page?: number;
  per_page?: number;
  keyword?: string;
  status?: string;
  grade?: string;
  /** Trường sắp xếp phía backend (chỉ cột trực tiếp trên positions). */
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// Nơi cấu hình mọi lời gọi API của module positions (cửa công khai của module).
export const positionsService = {
  async list(): Promise<Position[]> {
    const data = await http.get<PositionFromApi[]>(API_ENDPOINTS.POSITIONS);
    return data.map(remap);
  },

  async listPaged(
    params: PositionListParams = {},
  ): Promise<{ data: Position[]; meta: ApiMeta }> {
    const q = buildListSearchParams(params);
    if (params.keyword?.trim()) q.set('q', params.keyword.trim());
    // Map status: 'active' -> '1', 'inactive' -> '0' (BE expects integer)
    const apiStatus = mapStatusToApi(params.status);
    if (apiStatus) q.set('status', apiStatus);
    if (params.grade) q.set('grade', params.grade);
    if (params.sort_by) q.set('sort_by', params.sort_by);
    if (params.sort_order) q.set('sort_order', params.sort_order);

    const { data, meta } = await http.getPage<PositionFromApi[]>(
      `${API_ENDPOINTS.POSITIONS}?${q.toString()}`,
    );
    return { data: data.map(remap), meta };
  },

  async exportXlsx(params: PositionListParams = {}): Promise<Blob> {
    const q = new URLSearchParams();
    if (params.keyword?.trim()) q.set('q', params.keyword.trim());
    const apiStatus = mapStatusToApi(params.status);
    if (apiStatus) q.set('status', apiStatus);
    if (params.grade) q.set('grade', params.grade);
    const url = q.toString()
      ? `${API_ENDPOINTS.POSITIONS_EXPORT}?${q.toString()}`
      : API_ENDPOINTS.POSITIONS_EXPORT;
    return http.downloadBlob(url);
  },

  async exportPdf(params: PositionListParams = {}): Promise<Blob> {
    const q = new URLSearchParams();
    if (params.keyword?.trim()) q.set('q', params.keyword.trim());
    const apiStatus = mapStatusToApi(params.status);
    if (apiStatus) q.set('status', apiStatus);
    if (params.grade) q.set('grade', params.grade);
    const url = q.toString()
      ? `${API_ENDPOINTS.POSITIONS_EXPORT_PDF}?${q.toString()}`
      : API_ENDPOINTS.POSITIONS_EXPORT_PDF;
    return http.downloadBlob(url);
  },

  /**
   * Danh sách chức vụ đã xóa mềm (deleted_at khác null).
   * GET /positions loại trừ các bản ghi này nên cần endpoint riêng
   * để có thể hiển thị và khôi phục qua UI.
   * Hỗ trợ đầy đủ filter: keyword, grade, sort để đồng bộ với UI.
   */
  async listTrashed(
    params: PositionListParams = {},
  ): Promise<{ data: Position[]; meta: ApiMeta }> {
    const q = buildListSearchParams(params);
    if (params.keyword?.trim()) q.set('q', params.keyword.trim());
    if (params.grade) q.set('grade', params.grade);
    if (params.sort_by) q.set('sort_by', params.sort_by);
    if (params.sort_order) q.set('sort_order', params.sort_order);
    const { data, meta } = await http.getPage<PositionFromApi[]>(
      `${API_ENDPOINTS.POSITIONS_TRASHED}?${q.toString()}`,
    );
    return { data: data.map(remap), meta };
  },

  async getById(id: number): Promise<Position> {
    const data = await http.get<PositionFromApi>(
      `${API_ENDPOINTS.POSITIONS}/${id}`,
    );
    return remap(data);
  },

  async create(values: PositionFormValues): Promise<Position> {
    const data = await http.post<PositionFromApi>(
      API_ENDPOINTS.POSITIONS,
      toPayload(values),
    );
    return remap(data);
  },

  async update(id: number, values: PositionFormValues): Promise<Position> {
    const data = await http.put<PositionFromApi>(
      `${API_ENDPOINTS.POSITIONS}/${id}`,
      toPayload(values),
    );
    return remap(data);
  },

  /** Xóa mềm chức vụ. API: DELETE /positions/{id}/soft-delete */
  async inactive(id: number): Promise<void> {
    return http.delete<void>(`${API_ENDPOINTS.POSITIONS}/${id}/soft-delete`);
  },

  /** Khôi phục chức vụ đã xóa mềm. API: PATCH /positions/{id}/restore */
  async restore(id: number): Promise<Position> {
    const data = await http.patch<PositionFromApi>(
      `${API_ENDPOINTS.POSITIONS}/${id}/restore`,
    );
    return remap(data);
  },
};

export {
  usePositions,
  usePositionById,
  useCreatePosition,
  useUpdatePosition,
  useDeletePosition,
  useInactivePosition,
} from '@/modules/positions/hooks/use-positions';
