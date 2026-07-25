import { http } from '@/shared/api/http';
import { API_ENDPOINTS } from '@/shared/api/endpoints';
import { buildListSearchParams } from '@/shared/utils/list-query-params';
import type {
  OrgUnit,
  OrgUnitTreeNode,
  OrgUnitStatus,
} from '@/modules/org-units/types/org-units.types';
import type { OrgUnitFormValues } from '@/modules/org-units/schemas/org-unit.schema';
import {
  remap,
  remapTree,
  toPayload,
  type OrgUnitFromApi,
  type OrgUnitTreeNodeFromApi,
} from '@/modules/org-units/utils/org-units.mapper';
async function getTree(): Promise<OrgUnitTreeNode[]> {
  const data = await http.get<OrgUnitTreeNodeFromApi[]>(
    `${API_ENDPOINTS.ORG_UNITS}/tree`,
  );
  return remapTree(data);
}

async function list(): Promise<OrgUnit[]> {
  const data = await http.get<OrgUnitFromApi[]>(API_ENDPOINTS.ORG_UNITS);
  return data.map(remap);
}

/**
 * BE dùng soft-delete scope mặc định (Laravel) cho `/org_units` và
 * `/org_units/tree` — cả 2 endpoint đó tự động loại bỏ đơn vị đã xóa mềm/lưu
 * trữ, kể cả không truyền `status`. Chỉ endpoint riêng này mới trả về chúng
 * (xác minh thật qua API 2026-07-08: `/org_units/tree` trả 13/13 node đều
 * `deleted_at: null`, trong khi `/org_units/trashed` trả về các bản ghi có
 * `deleted_at` set mà 2 endpoint kia không hề có).
 */
async function trashed(): Promise<OrgUnit[]> {
  const data = await http.get<OrgUnitFromApi[]>(
    `${API_ENDPOINTS.ORG_UNITS}/trashed`,
  );
  return data.map(remap);
}

export interface OrgUnitListParams {
  page?: number;
  per_page?: number;
  keyword?: string;
  unit_type?: string;
  province?: string;
  status?: OrgUnitStatus;
  company?: number;
}

/** Params cho dropdown Công ty (unit_type = cong_ty_me / cong_ty_con). */
export interface CompaniesListParams {
  q?: string;
  per_page?: number;
  page?: number;
}

/**
 * BE chỉ nhận status dạng số nguyên 0/1 (0: ngừng hoạt động, 1: hoạt động).
 * FE có thêm 2 trạng thái phái sinh (soft_deleted, archived) mà BE không có
 * khái niệm tương ứng ở param này — với 2 trạng thái đó, không gửi status
 * lên BE, để lọc client-side đảm nhiệm (xem clientFilterParams + filterOrgUnits).
 */
function toBeStatusParam(status: OrgUnitStatus | undefined): 0 | 1 | undefined {
  if (status === 'active') return 1;
  if (status === 'inactive') return 0;
  return undefined;
}

/**
 * Danh sách đơn vị phân trang (flat, không có `children`) — cho use-case cần
 * danh sách phẳng (search-as-you-type, picker...). OrgUnitsPage (table view)
 * KHÔNG dùng hàm này vì cần giữ cấu trúc cây cha-con (sổ/thu công ty
 * con/chi nhánh) — xem comment trong use-org-units-filter.ts.
 *
 * BE thực nhận (đã xác nhận qua Swagger `/api/documentation` + test trực
 * tiếp API 2026-07-09, tài khoản Super Admin): `page`, `limit`, `q`,
 * `unit_type`, `status`. Test trực tiếp còn cho thấy `keyword` cũng được BE
 * chấp nhận như alias không chính thức của `q` (không có trong swagger) —
 * nên KHÔNG dựa vào `keyword`, chỉ dùng `q` vì đó là tên tham số chính thức.
 * `sort_by`/`sort_order` KHÔNG được BE hỗ trợ cho endpoint này (test thực tế:
 * đổi sort_order từ asc sang desc không làm thay đổi thứ tự trả về) nên cố
 * tình không có trong `OrgUnitListParams`.
 * `province`/`company` vẫn lọc phía client (xem clientFilterParams +
 * filterOrgUnits): test trực tiếp 2026-07-09 từng xác nhận BE trả lỗi 500 khi
 * giá trị `province` có dấu tiếng Việt — retest 2026-07-12 cho thấy BE đã fix
 * (không còn 500, filter đúng), nhưng vẫn KHÔNG gửi param này lên server vì
 * `company`/`company_id` vẫn bị BE bỏ qua hoàn toàn (luôn trả toàn bộ danh
 * sách bất kể giá trị), và endpoint này chỉ dùng để lấy `tableCompanyOptions`
 * chứ không dùng làm nguồn dữ liệu/phân trang cho bảng (xem OrgUnitsPage.tsx
 * + use-org-units-filter.ts) — nên việc BE có hỗ trợ `province` hay không
 * không ảnh hưởng đến tính đúng đắn của tính năng filter.
 */
const ORG_UNIT_LIST_QUERY_KEY_MAP = { per_page: 'limit', keyword: 'q' };

async function listPaged(params: OrgUnitListParams): Promise<{
  data: OrgUnit[];
  meta: import('@/shared/types/api-response').ApiMeta;
}> {
  const sp = buildListSearchParams(params, ORG_UNIT_LIST_QUERY_KEY_MAP);
  if (params.unit_type) sp.set('unit_type', params.unit_type);
  const beStatus = toBeStatusParam(params.status);
  if (beStatus !== undefined) sp.set('status', String(beStatus));
  const qs = sp.toString();
  const url = qs ? `${API_ENDPOINTS.ORG_UNITS}?${qs}` : API_ENDPOINTS.ORG_UNITS;
  const result = await http.getPage<OrgUnitFromApi[]>(url);
  return { data: result.data.map(remap), meta: result.meta };
}

async function create(values: OrgUnitFormValues): Promise<OrgUnit> {
  const data = await http.post<OrgUnitFromApi>(
    API_ENDPOINTS.ORG_UNITS,
    toPayload(values),
  );
  return remap(data);
}

/**
 * Cập nhật đơn vị. API: PATCH /org_units/{id} — xác nhận qua OpenAPI spec
 * thật (`/docs?api-docs.json`, 2026-07-15): route chỉ đăng ký PATCH, không có
 * PUT. Trước đây gọi `http.put`, sai method so với BE thật (redflag P0-1).
 */
async function update(id: number, values: OrgUnitFormValues): Promise<OrgUnit> {
  const data = await http.patch<OrgUnitFromApi>(
    `${API_ENDPOINTS.ORG_UNITS}/${id}`,
    toPayload(values),
  );
  return remap(data);
}

export interface InactiveOrgUnitPayload {
  id: number;
  reason?: string;
}

/**
 * Vô hiệu hóa đơn vị (xóa mềm, vào thùng rác 14 ngày). API: DELETE
 * /org_units/{id}/soft-delete.
 *
 * Trước đây gọi PATCH /org_units/{id}/status ({status:0}), nhưng endpoint đó
 * chỉ set field status, KHÔNG set deleted_at — khiến PATCH /restore sau đó
 * luôn trả 404 (xem docs/api-evidence/org_units.md mục 4/4b, xác minh qua BE
 * thật 2026-07-03). DELETE /soft-delete mới thực sự set deleted_at và cho
 * phép restore hoạt động đúng.
 *
 * BE (BR-19, xác minh qua `api-docs.json` + test thật 2026-07-15): nếu đơn vị
 * còn đơn vị con/phòng ban/nhân sự đang hoạt động, BE trả 409 CONFIRM_REQUIRED
 * kèm preview số lượng ảnh hưởng, yêu cầu gửi lại body
 * `{ force_soft_delete_confirm: true }` để xác nhận cascade. `DeactivateOrgUnitModal`
 * đã bắt người dùng tick "Tôi đã đọc và hiểu quy định xóa mềm 14 ngày" (giải
 * thích rõ hệ quả cascade) trước khi bật nút "Xác nhận vô hiệu" — nên khi modal
 * đó submit, luôn gửi kèm `force_soft_delete_confirm: true` để không bị BE chặn
 * lại bằng 1 vòng xác nhận thứ hai mà FE không có cách nào gửi tiếp.
 */
async function inactive({ id, reason }: InactiveOrgUnitPayload): Promise<void> {
  return http.delete<void>(`${API_ENDPOINTS.ORG_UNITS}/${id}/soft-delete`, {
    data: { force_soft_delete_confirm: true, ...(reason ? { reason } : {}) },
  });
}

export interface UploadLogoResult {
  logo?: string | null;
  logo_url?: string | null;
  logo_path?: string | null;
}

/** Tải logo cho đơn vị (multipart). API: POST /org_units/{id}/logo. */
async function uploadLogo(id: number, file: File): Promise<UploadLogoResult> {
  const formData = new FormData();
  formData.append('logo', file);
  return http.post<UploadLogoResult>(
    `${API_ENDPOINTS.ORG_UNITS}/${id}/logo`,
    formData,
  );
}

/**
 * Khôi phục đơn vị. API: PATCH /org_units/{id}/restore
 * P1.6: method đã đối chiếu với Postman contract (ERP API Contract - M0 M1
 * (P0+P1)_V2) — contract định nghĩa restore là PATCH, không phải PUT.
 */
async function restore(id: number): Promise<void> {
  return http.patch<void>(`${API_ENDPOINTS.ORG_UNITS}/${id}/restore`);
}

/**
 * Xóa vĩnh viễn đơn vị sau 14 ngày xóa mềm (BRD gọi là "archive").
 * API thật: DELETE /org_units/{id}/force-delete — không có route /archive
 * riêng (đã xác nhận qua OpenAPI spec + probe trực tiếp — 404).
 */
async function archive(id: number): Promise<void> {
  return http.delete<void>(`${API_ENDPOINTS.ORG_UNITS}/${id}/force-delete`);
}

/**
 * Response từ BE khi generate TMP code.
 * P0.4: đã xác nhận với BE — field chuẩn là `tax_code` (không phải `tmp_code`
 * như ghi nhầm trước đó trong API_EVIDENCE.md, đã sửa lại tài liệu).
 */
export interface GenerateTmpCodeResult {
  tax_code: string;
}

/**
 * Gọi BE để generate mã số thuế tạm (TMP-XXXXXX) unique toàn hệ thống.
 * POST /org_units/generate-tmp-code
 * BE trả về: { success, data: { tax_code: "TMP-000001" } }
 */
async function generateTmpCode(): Promise<string> {
  const result = await http.post<GenerateTmpCodeResult>(
    API_ENDPOINTS.ORG_UNITS_GENERATE_TMP,
  );
  if (!result.tax_code) {
    throw new Error(
      'BE không trả về mã tạm (thiếu field tax_code trong response)',
    );
  }
  return result.tax_code;
}

/** Response từ BE khi generate mã đơn vị/chi nhánh */
export interface GenerateCodeResult {
  code: string;
}

/**
 * Gọi BE để generate mã đơn vị (CTY-XXXX) hoặc mã chi nhánh (CN-XXXX) theo loại đơn vị.
 * POST /org_units/generate-code { unit_type }
 * BE trả về: { success, data: { code: "CN-0001" } }
 */
async function generateCode(unitType: string): Promise<string> {
  const result = await http.post<GenerateCodeResult>(
    API_ENDPOINTS.ORG_UNITS_GENERATE_CODE,
    { unit_type: unitType },
  );
  return result.code;
}

/** Thông tin doanh nghiệp trả về khi tra cứu MST từ Tổng Cục Thuế */
export interface CheckTaxCodeResult {
  tax_code: string;
  name: string;
  address: string;
  tax_department?: string;
  org_type?: string;
  status?: string;
}

/**
 * Tra cứu thông tin doanh nghiệp theo MST từ Tổng Cục Thuế để autofill.
 * GET /org_units/check-tax-code/{taxCode}
 */
async function checkTaxCode(taxCode: string): Promise<CheckTaxCodeResult> {
  return http.get<CheckTaxCodeResult>(
    `${API_ENDPOINTS.ORG_UNITS_CHECK_TAX_CODE}/${encodeURIComponent(taxCode)}`,
  );
}

/**
 * Danh sách Công ty mẹ/con (unit_type = cong_ty_me / cong_ty_con), chỉ active.
 * GET /org_units/companies?q=&per_page=&page=
 * Response: { success, data: [...], meta: {...}, links: {...} }
 */
async function listCompanies(params: CompaniesListParams = {}): Promise<{
  data: OrgUnit[];
  meta: import('@/shared/types/api-response').ApiMeta;
}> {
  const q = new URLSearchParams();
  if (params.q?.trim()) q.set('q', params.q.trim());
  if (params.per_page) q.set('per_page', String(params.per_page));
  if (params.page) q.set('page', String(params.page));
  const qs = q.toString();
  const url = qs
    ? `${API_ENDPOINTS.ORG_UNITS_COMPANIES}?${qs}`
    : API_ENDPOINTS.ORG_UNITS_COMPANIES;

  const result = await http.getPage<OrgUnitFromApi[]>(url);
  return { data: result.data.map(remap), meta: result.meta };
}

export const orgUnitsService = {
  getTree,
  list,
  trashed,
  listPaged,
  listCompanies,
  create,
  update,
  inactive,
  restore,
  archive,
  uploadLogo,
  generateTmpCode,
  generateCode,
  checkTaxCode,
};
