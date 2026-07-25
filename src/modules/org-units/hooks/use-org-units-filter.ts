import { useMemo, useState } from 'react';
import { useTablePattern } from '@/shared/hooks/useTablePattern';
import type { OrgUnitListParams } from '@/modules/org-units/services/org-units.service';
import type { OrgUnitStatus } from '@/modules/org-units/types/org-units.types';

export interface OrgUnitsFilter {
  keyword: string;
  unitType: string | undefined;
  province: string | undefined;
  status: OrgUnitStatus | undefined;
  company: number | undefined;
  page: number;
  perPage: number;
}

export interface UseOrgUnitsFilterOptions {
  defaultPerPage?: number;
  /**
   * Giá trị `unitType` mặc định khi khởi tạo filter — dùng cho branch-mode
   * (`/org-units?mode=branch`) để màn mặc định chỉ hiện Chi nhánh thay vì
   * toàn bộ đơn vị tổ chức. `resetFilters` cũng quay về giá trị này (không
   * quay về `undefined`) vì đây là initialFilters của useTablePattern.
   */
  defaultUnitType?: string;
  /**
   * Khi truyền, khóa cứng `unitType` về giá trị này — `setFilterUnitType`
   * trở thành no-op và `filters.unitType` luôn trả về giá trị khóa, bất kể
   * state nội bộ. Dùng cho branch-mode (P1 fix: trước đây chỉ set default
   * nên user vẫn đổi được filter "Loại đơn vị" sang Công ty mẹ/con, dẫn tới
   * nguy cơ sửa nhầm bản ghi không phải chi nhánh trong khi form vẫn khóa
   * `lockedUnitType='chi_nhanh'`).
   */
  lockUnitType?: string;
}

export interface UseOrgUnitsFilterReturn {
  /** Filter state for tree view — client-side filter/sort/paginate (lọc cây). */
  filters: OrgUnitsFilter;
  setKeyword: (value: string) => void;
  setFilterUnitType: (value: string | undefined) => void;
  setFilterProvince: (value: string | undefined) => void;
  setFilterStatus: (value: OrgUnitStatus | undefined) => void;
  setFilterCompany: (value: number | undefined) => void;
  setPage: (page: number) => void;
  setPerPage: (perPage: number) => void;
  resetFilters: () => void;
  /** Params gửi lên BE cho listPaged (server-side table view). */
  serverParams: OrgUnitListParams;
  /** Params lọc client-side (tree view + export). */
  clientFilterParams: OrgUnitListParams;
  sortBy: string | undefined;
  sortOrder: 'asc' | 'desc' | undefined;
  setSortBy: (field: string | undefined) => void;
  setSortOrder: (order: 'asc' | 'desc' | undefined) => void;
  /** Danh sách công ty cha (unitType === 'cong_ty_me' hoặc 'cong_ty_con') để hiển thị trong dropdown filter. */
  companyOptions: { value: number; label: string }[];
}

const DEFAULT_PER_PAGE = 15;

/**
 * Filter hook cho OrgUnitsPage.
 *
 * Cả Tree view lẫn Table view đều lọc/sắp xếp/phân trang **client-side** trên
 * toàn bộ cây tải 1 lần từ `/org_units/tree` (xem `filteredTreeForTable`/
 * `sortedTreeForTable`/`pagedTreeForTable` trong OrgUnitsPage.tsx) — vì
 * `/org_units/tree` không hỗ trợ query param nào (luôn trả toàn bộ dataset,
 * không phân trang), nên filter theo province/company/status/unitType/keyword
 * đều đúng trên toàn bộ dữ liệu, không bị giới hạn trong 1 trang.
 *
 * `serverParams`/`listPaged` (endpoint phẳng `/org_units`) CHỈ còn dùng để lấy
 * `tableCompanyOptions` (dropdown "Công ty cha" ở view Bảng) — KHÔNG dùng làm
 * nguồn dữ liệu/phân trang cho bảng. Tuyệt đối không dùng `tableDataRaw` (kết
 * quả `listPaged`) làm nguồn filter/pagination cho bảng — dữ liệu đó chỉ là
 * 1 trang, filter trên đó sẽ bỏ sót bản ghi ở trang khác (P0 bug đã xảy ra
 * trước đây, xem git history OrgUnitsPage.tsx).
 *
 * ⚠️ BE limitation trên endpoint phẳng `/org_units` (đã xác nhận thực tế
 * 2026-07-09, riêng bug 500 với `province` có dấu đã kiểm tra lại 2026-07-12
 * và BE đã fix — không còn 500, filter đúng — nhưng vẫn KHÔNG dùng để phân
 * trang cho bảng vì `company` vẫn bị BE bỏ qua hoàn toàn):
 * - `/org_units` KHÔNG hỗ trợ sort_by/sort_order (test thực tế: đổi asc ↔ desc
 *   không làm thay đổi thứ tự trả về).
 * - `/org_units` KHÔNG hỗ trợ lọc `company`/`company_id` (BE bỏ qua param,
 *   luôn trả toàn bộ danh sách).
 * - `/org_units` KHÔNG có endpoint vừa phân trang vừa giữ cấu trúc cây.
 */
export function useOrgUnitsFilter(
  options: UseOrgUnitsFilterOptions = {},
): UseOrgUnitsFilterReturn {
  const {
    defaultPerPage = DEFAULT_PER_PAGE,
    defaultUnitType,
    lockUnitType,
  } = options;

  const {
    filters: rawFilters,
    setFilter,
    page,
    setPage,
    pageSize: perPage,
    setPageSize: setPerPage,
    resetFilters: resetTableFilters,
  } = useTablePattern({
    initialPageSize: defaultPerPage,
    initialFilters: {
      keyword: '',
      ...(defaultUnitType ? { unitType: defaultUnitType } : {}),
    },
  });

  const [sortBy, setSortBy] = useState<string | undefined>();
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc' | undefined>();

  const keyword = (rawFilters.keyword as string) ?? '';
  const unitType = lockUnitType ?? (rawFilters.unitType as string | undefined);
  const province = rawFilters.province as string | undefined;
  const status = rawFilters.status as OrgUnitStatus | undefined;
  const company = rawFilters.company as number | undefined;

  const setKeyword = (value: string) => setFilter('keyword', value);
  const setFilterUnitType = (value: string | undefined) => {
    if (lockUnitType) return;
    setFilter('unitType', value);
  };
  const setFilterProvince = (value: string | undefined) =>
    setFilter('province', value);
  const setFilterStatus = (value: OrgUnitStatus | undefined) =>
    setFilter('status', value);
  const setFilterCompany = (value: number | undefined) =>
    setFilter('company', value);

  const filters: OrgUnitsFilter = useMemo(
    () => ({
      keyword,
      unitType,
      province,
      status,
      company,
      page,
      perPage,
    }),
    [keyword, unitType, province, status, company, page, perPage],
  );

  /** Params gửi lên BE cho listPaged (server-side). */
  const serverParams = useMemo<OrgUnitListParams>(() => {
    const params: OrgUnitListParams = { page, per_page: perPage };
    if (keyword) params.keyword = keyword;
    if (unitType) params.unit_type = unitType;
    if (status) params.status = status;
    // province: BE trả 500 với tiếng Việt, không gửi lên — lọc client-side
    // sort_by/sort_order: BE bỏ qua, không gửi lên (xem comment BE limitation)
    // company: lọc client-side trên flat list
    return params;
  }, [page, perPage, keyword, unitType, status]);

  /** Params lọc client-side (cho tree view + export). */
  const clientFilterParams = useMemo<OrgUnitListParams>(() => {
    const params: OrgUnitListParams = {};
    if (keyword) params.keyword = keyword;
    if (unitType) params.unit_type = unitType;
    if (province) params.province = province;
    if (status) params.status = status;
    if (company) params.company = company;
    return params;
  }, [keyword, unitType, province, status, company]);

  // Lấy danh sách công ty mẹ từ treeData (nếu có) — dùng cho dropdown filter "Công ty cha"
  // Hook này không có treeData, nên companyOptions sẽ được tính ở OrgUnitsPage và truyền xuống
  // Hoặc có thể nhận từ bên ngoài qua options. Tạm thời trả về mảng rỗng, page sẽ truyền vào.
  const companyOptions: { value: number; label: string }[] = [];

  return {
    filters,
    setKeyword,
    setFilterUnitType,
    setFilterProvince,
    setFilterStatus,
    setFilterCompany,
    setPage,
    setPerPage,
    resetFilters: resetTableFilters,
    serverParams,
    clientFilterParams,
    sortBy,
    sortOrder,
    setSortBy,
    setSortOrder,
    companyOptions,
  };
}
