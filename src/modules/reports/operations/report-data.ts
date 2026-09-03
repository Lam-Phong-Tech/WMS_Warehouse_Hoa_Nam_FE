import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { listOf, n, text, type Raw, type SelectOption } from "./report-format";

/**
 * Nguồn dữ liệu của trang Báo cáo vận hành.
 *
 * Quy ước xuyên suốt: các báo cáo `/reports/*` chỉ cắt trang khi client GỬI
 * `per_page`. Trang này CỐ Ý bỏ `per_page` để nhận trọn tập đã lọc, vì biểu đồ
 * và bảng ở cùng một mục buộc phải tính trên CÙNG một tập dòng — nếu để server
 * cắt trang cho bảng thì chart sẽ mô tả một tập khác với bảng ngay bên dưới nó,
 * và không có cách nào để người đọc phát hiện ra sự lệch đó. Phân trang chuyển
 * về client (`useClientPagination`).
 */

/** Endpoint chưa có trong API_ENDPOINTS (route BE đã tồn tại, xem routes/api.php). */
export const OPERATIONS_REPORT_ENDPOINTS = {
  XNT_DAILY: "/reports/inventory-xnt-daily",
  OUTBOUND_BY_RECIPIENT: "/reports/outbound-by-recipient",
  WARRANTY_DEFECT_SKU_BREAKDOWN: "/reports/warranty-defect-sku-breakdown",
  WARRANTY_COMPONENT_USAGE: "/reports/warranty-component-usage",
} as const;

const STALE_MS = 60_000;

function cleanParams(params: Raw): Raw {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) =>
        value !== undefined &&
        value !== null &&
        value !== "" &&
        !(Array.isArray(value) && value.length === 0),
    ),
  );
}

// ── Danh mục dùng chung ──────────────────────────────────────────────────

export type SkuCatalogEntry = {
  sku_id: string;
  sku_code: string;
  sku_name: string;
  sku_type: "PRODUCT" | "COMPONENT";
  /**
   * Đơn vị tính của SKU (`products.unit`) — cột "Đơn vị" của RPT-01. Không
   * endpoint `/reports/*` nào trả trường này nên danh mục là nguồn duy nhất;
   * rỗng khi master data chưa khai (màn hiển thị `EMPTY_TEXT`).
   */
  unit: string;
  category_id: string | null;
  min_stock: number | null;
  max_stock: number | null;
};

const SKU_PAGE_SIZE = 200;
/** Trần vòng lặp phân trang — 10 trang × 200 = 2.000 SKU, đủ cho danh mục hiện tại. */
const SKU_MAX_PAGES = 10;

async function fetchAllSkus(): Promise<SkuCatalogEntry[]> {
  const all: SkuCatalogEntry[] = [];
  for (let page = 1; page <= SKU_MAX_PAGES; page += 1) {
    const result = await http.getPage<Raw[]>(API_ENDPOINTS.PRODUCTS, {
      params: { page, per_page: SKU_PAGE_SIZE },
    });
    const rows = Array.isArray(result.data) ? result.data : [];
    for (const row of rows) {
      const code = text(row.sku_code ?? row.code, "");
      if (code === "") continue;
      all.push({
        sku_id: text(row.sku_id ?? row.id, ""),
        sku_code: code,
        sku_name: text(row.sku_name ?? row.name, ""),
        sku_type:
          text(row.sku_type, "PRODUCT") === "COMPONENT"
            ? "COMPONENT"
            : "PRODUCT",
        unit: text(row.unit ?? row.uom, ""),
        category_id: row.category_id ? String(row.category_id) : null,
        min_stock:
          row.min_stock === null || row.min_stock === undefined
            ? null
            : n(row.min_stock),
        max_stock:
          row.max_stock === null || row.max_stock === undefined
            ? null
            : n(row.max_stock),
      });
    }
    const lastPage = n(result.meta?.last_page, 1);
    if (page >= lastPage || rows.length === 0) break;
  }
  return all;
}

export type SkuCatalog = {
  entries: SkuCatalogEntry[];
  byCode: Map<string, SkuCatalogEntry>;
  byId: Map<string, SkuCatalogEntry>;
  /** Loại hàng của một mã SKU; `undefined` khi mã không có trong danh mục. */
  kindOfCode: (code: unknown) => "PRODUCT" | "COMPONENT" | undefined;
  kindOfId: (id: unknown) => "PRODUCT" | "COMPONENT" | undefined;
  loading: boolean;
  options: SelectOption[];
};

/**
 * Danh mục SKU đầy đủ — nguồn DUY NHẤT để trang này biết một dòng báo cáo là
 * "Sản phẩm" hay "Linh kiện" (mọi endpoint `/reports/*` chỉ trả `product_code`,
 * không trả `sku_type`), và là nguồn của định mức min/max ở mục 2.4.
 */
export function useSkuCatalog(): SkuCatalog {
  const query = useQuery({
    queryKey: ["rpt-ops", "sku-catalog"],
    queryFn: fetchAllSkus,
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const entries = query.data ?? [];
    const byCode = new Map(entries.map((entry) => [entry.sku_code, entry]));
    const byId = new Map(entries.map((entry) => [entry.sku_id, entry]));
    return {
      entries,
      byCode,
      byId,
      kindOfCode: (code: unknown) => byCode.get(text(code, ""))?.sku_type,
      kindOfId: (id: unknown) => byId.get(text(id, ""))?.sku_type,
      loading: query.isLoading,
      options: entries.map((entry) => ({
        value: entry.sku_id,
        label: `${entry.sku_code} · ${entry.sku_name}`,
      })),
    };
  }, [query.data, query.isLoading]);
}

export type UserDirectoryEntry = {
  user_id: string;
  name: string;
  department_id: string | null;
  department_name: string;
};

/**
 * Danh bạ người dùng + phòng ban. Các báo cáo chỉ trả TÊN người thực hiện
 * (`created_by_name`, `printed_by_name`...) chứ không trả `user_id`, nên bộ lọc
 * "Người thực hiện"/"Phòng ban" phải khớp qua tên hiển thị — map cả hai chiều
 * ở đây để chỗ dùng không phải tự đoán.
 */
export function useUserDirectory() {
  const query = useQuery({
    queryKey: ["rpt-ops", "user-directory"],
    queryFn: () =>
      http.getPage<Raw[]>(API_ENDPOINTS.USERS, {
        params: { per_page: 200 },
      }),
    staleTime: 5 * 60_000,
  });

  return useMemo(() => {
    const rows = Array.isArray(query.data?.data) ? query.data.data : [];
    const entries: UserDirectoryEntry[] = rows.map((row) => {
      const department = row.department as Raw | undefined;
      return {
        user_id: text(row.user_id ?? row.id, ""),
        name: text(row.display_name ?? row.username ?? row.email, ""),
        department_id: department?.department_id
          ? String(department.department_id)
          : row.department_id
            ? String(row.department_id)
            : null,
        department_name: text(
          department?.department_name ?? row.department_name,
          "",
        ),
      };
    });
    const byName = new Map(
      entries.filter((entry) => entry.name !== "").map((e) => [e.name, e]),
    );
    /** Tra tên theo user_id — cho những endpoint chỉ trả UUID actor. */
    const byId = new Map(
      entries
        .filter((entry) => entry.user_id !== "")
        .map((e) => [e.user_id, e]),
    );
    const departments = new Map<string, string>();
    for (const entry of entries) {
      if (entry.department_id && entry.department_name) {
        departments.set(entry.department_id, entry.department_name);
      }
    }
    return {
      entries,
      byName,
      loading: query.isLoading,
      actorOptions: entries
        .filter((entry) => entry.user_id !== "" && entry.name !== "")
        .map((entry) => ({ value: entry.user_id, label: entry.name })),
      /** Bộ lọc theo tên (báo cáo không trả user_id) — value chính là tên. */
      actorNameOptions: [...byName.keys()]
        .sort((a, b) => a.localeCompare(b, "vi"))
        .map((name) => ({ value: name, label: name })),
      departmentOptions: [...departments.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label, "vi")),
      departmentOfName: (name: unknown) =>
        byName.get(text(name, ""))?.department_id ?? null,
      departmentNameOfActor: (name: unknown) =>
        byName.get(text(name, ""))?.department_name ?? "",
      /**
       * UUID actor → tên hiển thị; không tra được thì trả "" (nơi hiển thị in
       * "Chưa có"). TUYỆT ĐỐI không trả lại UUID để rơi ra màn hình.
       */
      nameOfUserId: (id: unknown) => byId.get(text(id, ""))?.name ?? "",
    };
  }, [query.data, query.isLoading]);
}

export function useWarehouseOptions(): {
  options: SelectOption[];
  loading: boolean;
} {
  const query = useQuery({
    queryKey: ["rpt-ops", "warehouses"],
    queryFn: () =>
      http.getPage<Raw[]>(API_ENDPOINTS.WAREHOUSES, {
        params: { per_page: 100 },
      }),
    staleTime: 5 * 60_000,
  });
  const rows = Array.isArray(query.data?.data) ? query.data.data : [];
  return {
    loading: query.isLoading,
    options: rows
      .map((row) => ({
        value: text(row.id ?? row.warehouse_id, ""),
        label: [row.code, row.name].filter(Boolean).join(" · "),
      }))
      .filter((row) => row.value !== ""),
  };
}

export function useCategoryOptions(): {
  options: SelectOption[];
  loading: boolean;
} {
  const query = useQuery({
    queryKey: ["rpt-ops", "product-categories"],
    queryFn: () =>
      http.getPage<Raw[]>(API_ENDPOINTS.PRODUCT_CATEGORIES, {
        params: { status: "ACTIVE", per_page: 100 },
      }),
    staleTime: 5 * 60_000,
  });
  const rows = Array.isArray(query.data?.data) ? query.data.data : [];
  return {
    loading: query.isLoading,
    options: rows
      .map((row) => ({
        value: text(row.id ?? row.category_id, ""),
        label: [row.category_code, row.category_name]
          .filter(Boolean)
          .join(" · "),
      }))
      .filter((row) => row.value !== ""),
  };
}

export function usePrinterOptions(): {
  options: SelectOption[];
  loading: boolean;
} {
  const query = useQuery({
    queryKey: ["rpt-ops", "printer-configs"],
    queryFn: () =>
      http.getPage<Raw[]>(API_ENDPOINTS.PRINTER_CONFIGS, {
        params: { per_page: 100 },
      }),
    staleTime: 5 * 60_000,
  });
  const rows = Array.isArray(query.data?.data) ? query.data.data : [];
  return {
    loading: query.isLoading,
    options: rows
      .map((row) => ({
        value: text(row.id ?? row.printer_config_id, ""),
        label: [row.printer_code, row.printer_name].filter(Boolean).join(" · "),
      }))
      .filter((row) => row.value !== ""),
  };
}

export function useAgencyOptions() {
  const query = useQuery({
    queryKey: ["rpt-ops", "agencies"],
    queryFn: () =>
      http.getPage<Raw[]>(API_ENDPOINTS.AGENCIES, {
        params: { status: "ACTIVE", per_page: 200 },
      }),
    staleTime: 5 * 60_000,
  });
  const rows = Array.isArray(query.data?.data) ? query.data.data : [];
  const entries = rows.map((row) => ({
    agency_id: text(row.agency_id ?? row.id, ""),
    agency_code: text(row.agency_code, ""),
    agency_name: text(row.agency_name, ""),
    recipient_type: text(row.recipient_type, "AGENCY"),
    market: text(row.market, ""),
    region: text(row.region, ""),
  }));
  return {
    loading: query.isLoading,
    entries,
    options: entries
      .filter((entry) => entry.agency_id !== "")
      .map((entry) => ({
        value: entry.agency_id,
        label: `${entry.agency_code} · ${entry.agency_name}`,
      })),
    marketOptions: [...new Set(entries.map((e) => e.market).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "vi"))
      .map((value) => ({ value, label: value })),
    regionOptions: [...new Set(entries.map((e) => e.region).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, "vi"))
      .map((value) => ({ value, label: value })),
  };
}

export function useDefectOptions(): {
  options: SelectOption[];
  loading: boolean;
} {
  const query = useQuery({
    queryKey: ["rpt-ops", "defects"],
    queryFn: () =>
      http.getPage<Raw[]>(API_ENDPOINTS.DEFECT_CATALOGS, {
        params: { status: "ACTIVE", per_page: 200 },
      }),
    staleTime: 5 * 60_000,
  });
  const rows = Array.isArray(query.data?.data) ? query.data.data : [];
  return {
    loading: query.isLoading,
    options: rows
      .map((row) => ({
        value: text(row.defect_id ?? row.id, ""),
        label: [row.defect_code, row.defect_name].filter(Boolean).join(" · "),
      }))
      .filter((row) => row.value !== ""),
  };
}

// ── Báo cáo ──────────────────────────────────────────────────────────────

type PeriodArgs = { from: string; to: string; enabled?: boolean };

/** Nhập-Xuất-Tồn cả kỳ (gross/reversal/net theo SKU × kho × trạng thái). */
export function useXntReport({ from, to, enabled = true }: PeriodArgs) {
  return useQuery({
    queryKey: ["rpt-ops", "xnt", from, to],
    queryFn: () =>
      http.get<Raw>(API_ENDPOINTS.REPORTS_XNT_ENHANCED, {
        params: { from_date: from, to_date: to },
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Chuỗi Nhập/Xuất/Tồn cuối theo NGÀY. */
export function useXntDaily({ from, to, enabled = true }: PeriodArgs) {
  return useQuery({
    queryKey: ["rpt-ops", "xnt-daily", from, to],
    queryFn: () =>
      http.get<Raw>(OPERATIONS_REPORT_ENDPOINTS.XNT_DAILY, {
        params: { from_date: from, to_date: to },
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Lịch sử chứng từ nhập/xuất kèm tầng dòng SKU. */
export function useDocumentHistory({
  from,
  to,
  docType = "all",
  enabled = true,
}: PeriodArgs & { docType?: "all" | "inbound" | "outbound" }) {
  return useQuery({
    queryKey: ["rpt-ops", "document-history", from, to, docType],
    queryFn: () =>
      http.get<Raw>(API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY, {
        params: { from_date: from, to_date: to, doc_type: docType },
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/**
 * Phiếu hoàn trả / điều chỉnh (Reversal).
 *
 * `/reports/document-history` chỉ đọc bảng `stock_documents` (doc_type
 * receipt/issue) nên KHÔNG bao giờ trả phiếu Reversal — mà mục 1.4 yêu cầu
 * "Nhập / Xuất / Reversal" trong cùng một bảng. Lấy thêm từ nguồn canonical
 * `/reversal-documents` rồi hợp nhất ở tầng FE.
 */
export function useReversalDocuments({ from, to, enabled = true }: PeriodArgs) {
  return useQuery({
    queryKey: ["rpt-ops", "reversal-documents", from, to],
    queryFn: () =>
      http.getPage<Raw[]>(API_ENDPOINTS.REVERSAL_DOCUMENTS, {
        params: { from_date: from, to_date: to, per_page: 200 },
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Sổ biến động tồn kho (movement ledger) — nguồn của mọi drill-down. */
export function useMovementTrace({
  from,
  to,
  movementType,
  warehouseId,
  codeValue,
  enabled = true,
}: PeriodArgs & {
  movementType?: string;
  warehouseId?: string;
  codeValue?: string;
}) {
  const params = cleanParams({
    from_date: from,
    to_date: to,
    movement_type: movementType,
    warehouse_id: warehouseId,
    code_value: codeValue,
  });
  return useQuery({
    queryKey: ["rpt-ops", "movement-trace", params],
    queryFn: () =>
      http.get<Raw>(API_ENDPOINTS.REPORTS_MOVEMENT_TRACE, { params }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Tồn kho hiện tại theo SKU × kho × trạng thái, kèm cột đối soát sổ ↔ số dư. */
export function useInventoryBalance({
  warehouseId,
  categoryId,
  asOf,
  enabled = true,
}: {
  warehouseId?: string;
  categoryId?: string;
  /**
   * §13.10 RPT-INV-01 "chốt số liệu tại ngày": số dư đọc theo ảnh chụp sổ tồn
   * kho tại mốc này. Khi có as_of thì cột đối soát KHÔNG áp dụng (BE trả
   * reconciliation_status = NOT_APPLICABLE) — so số dư quá khứ với sổ hiện tại
   * là phép so vô nghĩa.
   */
  asOf?: string;
  enabled?: boolean;
}) {
  const params = cleanParams({
    warehouse_id: warehouseId,
    category_id: categoryId,
    as_of: asOf,
  });
  return useQuery({
    queryKey: ["rpt-ops", "inventory-balance", params],
    queryFn: () =>
      http.get<Raw>(API_ENDPOINTS.REPORTS_INVENTORY_BALANCE, { params }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Đối soát Balance ↔ Movement (4 phép kiểm) — nguồn của mục 2.2/2.3. */
export function useInventoryReconciliation({
  warehouseId,
  enabled = true,
}: {
  warehouseId?: string;
  enabled?: boolean;
}) {
  const params = cleanParams({ warehouse_id: warehouseId });
  return useQuery({
    queryKey: ["rpt-ops", "inventory-reconciliation", params],
    queryFn: () =>
      http.get<Raw>(API_ENDPOINTS.INVENTORY_RECONCILIATION, { params }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Đối soát toa Excel: tầng dòng SKU + tổng hợp theo batch upload. */
export function useImportMatch({ from, to, enabled = true }: PeriodArgs) {
  return useQuery({
    queryKey: ["rpt-ops", "import-match", from, to],
    queryFn: () =>
      http.get<Raw>(API_ENDPOINTS.REPORTS_IMPORT_MATCH, {
        params: { from_date: from, to_date: to },
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Import báo cáo SKU (Excel) — tổng dòng / hợp lệ / lỗi theo từng lần nộp. */
export function useSkuImportReports({ enabled = true }: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["rpt-ops", "sku-import-reports"],
    queryFn: () =>
      http.getPage<Raw[]>(API_ENDPOINTS.SKU_IMPORT_REPORTS, {
        params: { per_page: 100 },
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Nhật ký nhãn đóng gói: kết quả in, số lần in/in lại, máy in, người in. */
export function useLabelLog({ from, to, enabled = true }: PeriodArgs) {
  return useQuery({
    queryKey: ["rpt-ops", "label-log", from, to],
    queryFn: () =>
      http.get<Raw>(API_ENDPOINTS.REPORTS_LABEL_LOG, {
        params: { from_date: from, to_date: to },
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Trần vòng lặp phân trang cho các endpoint bảo hành (max 100/trang ở BE). */
const WARRANTY_PAGE_SIZE = 100;
const WARRANTY_MAX_PAGES = 10;

/**
 * Hồ sơ bảo hành + bệnh/lỗi (N:N) + tổng hợp theo bệnh/lỗi.
 *
 * `/reports/warranty-defects` cắt trang ở TẦNG SQL (trần 100/trang) nên không
 * có cách bỏ phân trang như các báo cáo khác — phải cuốn hết trang, nếu không
 * donut 6.1 và bảng 6.6 sẽ mô tả hai tập hồ sơ khác nhau.
 */
export function useWarrantyReport({
  from,
  to,
  status,
  defectIds,
  model,
  enabled = true,
}: PeriodArgs & {
  status?: string;
  defectIds?: string[];
  /** §13.10 RPT-WAR-01: lọc theo SKU/mẫu sản phẩm ngay ở máy chủ. */
  model?: string;
}) {
  const baseParams = cleanParams({
    from_date: from,
    to_date: to,
    status,
    defect_ids: defectIds,
    model,
  });
  return useQuery({
    queryKey: ["rpt-ops", "warranty-defects", baseParams],
    queryFn: async () => {
      const rows: Raw[] = [];
      let first: Raw = {};
      for (let page = 1; page <= WARRANTY_MAX_PAGES; page += 1) {
        const payload = await http.get<Raw>(
          API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS,
          { params: { ...baseParams, page, per_page: WARRANTY_PAGE_SIZE } },
        );
        if (page === 1) first = payload;
        const pageRows = listOf(payload.rows);
        rows.push(...pageRows);
        const lastPage = n(
          (payload.pagination as Raw | undefined)?.last_page,
          1,
        );
        if (page >= lastPage || pageRows.length === 0) break;
      }
      return { ...first, rows } as Raw;
    },
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/**
 * Danh sách hồ sơ bảo hành thô — nguồn duy nhất có `created_by` (người phụ
 * trách) và `item_id`, hai thứ `/reports/warranty-defects` không trả.
 */
export function useWarrantyCases({ enabled = true }: { enabled?: boolean }) {
  return useQuery({
    queryKey: ["rpt-ops", "warranty-cases"],
    queryFn: async () => {
      const rows: Raw[] = [];
      for (let page = 1; page <= WARRANTY_MAX_PAGES; page += 1) {
        const result = await http.getPage<Raw[]>(API_ENDPOINTS.WARRANTY_CASES, {
          params: { page, per_page: WARRANTY_PAGE_SIZE },
        });
        const pageRows = Array.isArray(result.data) ? result.data : [];
        rows.push(...pageRows);
        if (page >= n(result.meta?.last_page, 1) || pageRows.length === 0)
          break;
      }
      return rows;
    },
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Phiếu xuất linh kiện bảo hành — nối case ↔ chứng từ xuất ở mục 6.5. */
export function useComponentIssueDocuments({
  enabled = true,
}: {
  enabled?: boolean;
}) {
  return useQuery({
    queryKey: ["rpt-ops", "component-issue-documents"],
    queryFn: async () => {
      const rows: Raw[] = [];
      for (let page = 1; page <= WARRANTY_MAX_PAGES; page += 1) {
        const result = await http.getPage<Raw[]>(
          API_ENDPOINTS.COMPONENT_ISSUE_DOCUMENTS,
          { params: { page, per_page: WARRANTY_PAGE_SIZE } },
        );
        const pageRows = Array.isArray(result.data) ? result.data : [];
        rows.push(...pageRows);
        if (page >= n(result.meta?.last_page, 1) || pageRows.length === 0)
          break;
      }
      return rows;
    },
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Bệnh/lỗi × SKU (mục 6.3). */
export function useDefectSkuBreakdown({
  from,
  to,
  skuIds,
  defectIds,
  enabled = true,
}: PeriodArgs & { skuIds?: string[]; defectIds?: string[] }) {
  const params = cleanParams({
    from_date: from,
    to_date: to,
    sku_ids: skuIds,
    defect_ids: defectIds,
  });
  return useQuery({
    queryKey: ["rpt-ops", "defect-sku-breakdown", params],
    queryFn: () =>
      http.get<Raw>(OPERATIONS_REPORT_ENDPOINTS.WARRANTY_DEFECT_SKU_BREAKDOWN, {
        params,
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Linh kiện đã xuất cho bảo hành (mục 6.4). */
export function useComponentUsage({
  from,
  to,
  defectIds,
  enabled = true,
}: PeriodArgs & { defectIds?: string[] }) {
  const params = cleanParams({
    from_date: from,
    to_date: to,
    defect_ids: defectIds,
  });
  return useQuery({
    queryKey: ["rpt-ops", "component-usage", params],
    queryFn: () =>
      http.get<Raw>(OPERATIONS_REPORT_ENDPOINTS.WARRANTY_COMPONENT_USAGE, {
        params,
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Xuất hàng theo người nhận / đại lý (tab 7). */
export function useOutboundByRecipient({
  from,
  to,
  recipientType,
  recipientId,
  market,
  region,
  skuCode,
  enabled = true,
}: PeriodArgs & {
  recipientType?: string;
  recipientId?: string;
  market?: string;
  region?: string;
  skuCode?: string;
}) {
  const baseParams = cleanParams({
    from_date: from,
    to_date: to,
    recipient_type: recipientType,
    recipient_id: recipientId,
    market,
    region,
    sku_code: skuCode,
  });
  return useQuery({
    queryKey: ["rpt-ops", "outbound-by-recipient", baseParams],
    queryFn: async () => {
      // Endpoint này cắt trang ở tầng SQL (trần 100/trang) nên phải cuốn hết
      // trang: chart xu hướng theo ngày và bảng chi tiết đều cần TOÀN BỘ dòng,
      // còn `by_sku`/`by_recipient` thì máy chủ đã gộp sẵn trên cả tập.
      const rows: Raw[] = [];
      let first: Raw = {};
      for (let page = 1; page <= WARRANTY_MAX_PAGES; page += 1) {
        const payload = await http.get<Raw>(
          OPERATIONS_REPORT_ENDPOINTS.OUTBOUND_BY_RECIPIENT,
          { params: { ...baseParams, page, per_page: WARRANTY_PAGE_SIZE } },
        );
        if (page === 1) first = payload;
        const pageRows = listOf(payload.rows);
        rows.push(...pageRows);
        const lastPage = n(
          (payload.pagination as Raw | undefined)?.last_page,
          1,
        );
        if (page >= lastPage || pageRows.length === 0) break;
      }
      return { ...first, rows } as Raw;
    },
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Xuất theo nơi nhận từ sổ chứng từ — dùng để bù chiều "Reversal" cho tab 7. */
export function useOutboundByAgency({ from, to, enabled = true }: PeriodArgs) {
  return useQuery({
    queryKey: ["rpt-ops", "outbound-by-agency", from, to],
    queryFn: () =>
      http.get<Raw>(API_ENDPOINTS.REPORTS_OUTBOUND_BY_AGENCY, {
        params: { from_date: from, to_date: to },
      }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Vòng đời một mã vật lý / serial / SKU (mục 3.2). */
export function useTraceByCode(code: string) {
  const trimmed = code.trim();
  return useQuery({
    queryKey: ["rpt-ops", "trace-by-code", trimmed],
    queryFn: () =>
      http.get<Raw>(API_ENDPOINTS.STOCK_MOVEMENT_TRACE_BY_CODE, {
        params: { code: trimmed },
      }),
    enabled: trimmed.length > 0,
    staleTime: STALE_MS,
  });
}

/** Danh sách item instance (máy/linh kiện có serial) cho mục 3.1. */
export function useItemInstances({
  keyword,
  skuId,
  itemStatus,
  enabled = true,
}: {
  keyword?: string;
  skuId?: string;
  itemStatus?: string;
  enabled?: boolean;
}) {
  const params = cleanParams({
    search: keyword,
    sku_id: skuId,
    item_status: itemStatus,
    per_page: 100,
  });
  return useQuery({
    queryKey: ["rpt-ops", "item-instances", params],
    queryFn: () => http.getPage<Raw[]>(API_ENDPOINTS.ITEMS, { params }),
    enabled,
    staleTime: STALE_MS,
    placeholderData: (previous) => previous,
  });
}

/** Rút `rows`/`lines` của một payload báo cáo bất kể tên khóa. */
export function reportRows(data: Raw | undefined, key = "rows"): Raw[] {
  if (!data) return [];
  return listOf(data[key]);
}
