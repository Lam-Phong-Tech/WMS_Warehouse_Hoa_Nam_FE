import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';

/**
 * Kho hàng — chỉ các field cần cho picker/scope selector (BR data-scope theo
 * kho). Swagger `GET /warehouses` ghi response lồng `{ data: { current_page,
 * data: [...], total } }`, nhưng test trực tiếp trên BE thật
 * (astrodev.test8.io.vn, tài khoản Super Admin, 2026-07-11) cho thấy shape
 * thật là chuẩn `{ data: Warehouse[], meta: { current_page, per_page,
 * total, ... } }` giống các module khác (org-units, departments...) —
 * Swagger ở đây không khớp BE thật.
 */
export interface Warehouse {
  id: number;
  code: string;
  name: string;
  warehouse_type?: 'main' | 'branch' | 'sub';
  company_id?: number;
  branch_id?: number | null;
  status?: number;
}

/**
 * Danh sách kho cho picker (không phân trang UI) — dùng `limit` lớn để lấy
 * toàn bộ trong 1 lần gọi, giống cách `ScopeSelector` đang làm với org units.
 */
async function list(): Promise<Warehouse[]> {
  const { data } = await http.getPage<Warehouse[]>(
    `${API_ENDPOINTS.WAREHOUSES}?limit=1000`,
  );
  return data ?? [];
}

export const warehousesService = {
  list,
};
