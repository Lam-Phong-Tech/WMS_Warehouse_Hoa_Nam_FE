import { useMemo, useState, type ReactElement, type ReactNode } from "react";
import {
  Box,
  Checkbox,
  Grid,
  Menu,
  MenuItem,
  Stack,
  UiAlert,
  UiButton,
  UiCard,
  UiDatePicker,
  UiDateRangePicker,
  UiDialog,
  UiPagination,
  UiSelect,
  UiStatusBadge,
  UiTabs,
  UiTabPanel,
  UiTextField,
  type UiStatusTone,
} from "@/shared/ui";
import {
  AuditOutlined,
  DownOutlined,
  ExportOutlined,
  FileSearchOutlined,
  HistoryOutlined,
  SafetyCertificateOutlined,
  StockOutlined,
  SwapOutlined,
  TagOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { useQuery } from "@tanstack/react-query";
import dayjs, { type Dayjs } from "dayjs";
import { toast } from "sonner";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import {
  getApiErrorMessage,
  isNoPermissionError,
} from "@/shared/api/api-error";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import {
  WMS_ACTION_PERMISSIONS,
  WMS_PERMISSION_CATALOG,
} from "@/shared/constants/wms-permissions";
import {
  INVENTORY_STOCK_STATUS_LABELS,
  MOVEMENT_TYPE_LABELS,
  RECONCILE_STATUS_LABELS,
  SOURCE_DOCUMENT_TYPE_LABELS,
  WARRANTY_IDENTIFICATION_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import {
  TableLoadingBanner,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";
import { useHasPermission } from "@/shared/components/permission";
import {
  ResponsiveDataTable,
  type ResponsiveTableColumn,
} from "@/shared/components/data-display/ResponsiveDataTable";
import type { ClientSortState } from "@/shared/components/data-display/useClientSort";
import { EmptyState } from "@/shared/components/data-display/EmptyState";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { useRowSelection } from "@/shared/hooks/useRowSelection";
import { warrantyPiiText } from "@/modules/warranty/constants";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import {
  useMvpAgencies,
  useMvpDefects,
} from "@/modules/master-data/hooks/use-mvp-master";
import { fetchPrinterConfigs } from "@/modules/outbound/services/mvpOutboundService";
import { formatDate, formatDateTime } from "@/shared/utils/format-date";
import { HorizontalBarChart } from "@/shared/components/charts/HorizontalBarChart";
import { BarChart } from "@/shared/components/charts/BarChart";
import { DonutChart } from "@/shared/components/charts/DonutChart";
import { DonutBreakdown } from "@/shared/components/charts/DonutBreakdown";
import { AreaChart } from "@/shared/components/charts/AreaChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import {
  ReportKpiCard,
  ReportKpiGrid,
  type ReportKpiTone,
} from "@/shared/components/reports/ReportKpiCard";
import {
  ReportChartPanel,
  ReportChartGrid,
} from "@/shared/components/reports/ReportChartPanel";

type Raw = Record<string, unknown>;

/**
 * Cột báo cáo dạng antd-like (title/dataIndex/sorter/children) — GIỮ NGUYÊN
 * shape này làm nguồn dữ liệu cột duy nhất: hợp đồng flow06 pin literal
 * `dataIndex:`/`sorter`/`title:` trong source, còn modal chi tiết dựng field
 * từ chính bộ cột. Bảng thật render qua ResponsiveDataTable bằng adapter
 * `toResponsiveColumns` bên dưới (Part 4: antd Table đã bị gỡ).
 */
interface ReportColumn {
  title: ReactNode;
  key?: string;
  dataIndex?: string;
  width?: number;
  align?: "left" | "right" | "center";
  /** Metadata từ thời antd (cột ghim) — adapter không dùng, giữ để đọc hiểu. */
  fixed?: "left" | "right";
  /** Metadata từ thời antd (cắt chữ "…") — ResponsiveDataTable tự wrap chữ. */
  ellipsis?: boolean;
  sortType?: ResponsiveTableColumn<Raw>["sortType"];
  sorter?: (a: Raw, b: Raw) => number;
  render?: (value: unknown, row: Raw, index: number) => ReactNode;
  children?: ReportColumn[];
}

/** Trải phẳng cột nhóm (cột có `children`, ví dụ Nhập/Xuất ở tab Nhập-Xuất-Tồn). */
function flattenReportColumns(
  columns: readonly ReportColumn[],
  parentTitle = "",
): Array<{ title: string; column: ReportColumn }> {
  return columns.flatMap((column) => {
    const ownTitle =
      typeof column.title === "string"
        ? column.title
        : String(column.key ?? "");
    const fullTitle = parentTitle ? `${parentTitle} · ${ownTitle}` : ownTitle;
    const children = column.children;
    if (children?.length) return flattenReportColumns(children, fullTitle);
    return [{ title: fullTitle, column }];
  });
}

/** Key ổn định cho một cột lá — dùng chung giữa adapter render và sort. */
function reportColumnKey(column: ReportColumn, leafIndex: number): string {
  return String(column.key ?? column.dataIndex ?? `col-${leafIndex}`);
}

/**
 * Adapter cột antd-like → ResponsiveDataTable: flatten cột nhóm về cột lá
 * (header mang đủ đường dẫn nhóm, vd "Nhập · Thuần"), giữ align/width, đánh
 * dấu `sortable` cho cột có `sorter` (sort có kiểm soát qua
 * `useReportColumnSort` — comparator antd cũ giữ nguyên từng ký tự).
 */
function toResponsiveColumns(
  columns: ReportColumn[],
  displayedRows: Raw[],
): ResponsiveTableColumn<Raw>[] {
  return flattenReportColumns(columns).map(({ title, column }, leafIndex) => ({
    key: reportColumnKey(column, leafIndex),
    header: title,
    align: column.align,
    width: column.width,
    sortable: Boolean(column.sorter),
    sortType: column.sortType,
    render: (row: Raw) => {
      const value = column.dataIndex ? row[column.dataIndex] : undefined;
      if (column.render) {
        return column.render(value, row, displayedRows.indexOf(row));
      }
      return (value ?? null) as ReactNode;
    },
  }));
}

/**
 * Sort client-side CÓ KIỂM SOÁT cho bảng báo cáo: bấm cột chạy đúng comparator
 * `sorter` của cột đó (giữ nguyên ngữ nghĩa localeCompare "vi"/numeric của
 * từng cột như antd Table cũ), chu kỳ asc → desc → bỏ sort, tie-break theo
 * thứ tự dòng gốc để sort ổn định.
 */
function useReportColumnSort(columns: ReportColumn[], rows: Raw[]) {
  const [sortState, setSortState] = useState<ClientSortState>({
    direction: undefined,
  });

  const onSortChange = (key: string) => {
    setSortState((prev) => {
      if (prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return { key: undefined, direction: undefined };
    });
  };

  const sortedRows = useMemo(() => {
    if (!sortState.key || !sortState.direction) return rows;
    const leaves = flattenReportColumns(columns);
    const match = leaves.find(
      ({ column }, leafIndex) =>
        reportColumnKey(column, leafIndex) === sortState.key,
    );
    const sorter = match?.column.sorter;
    if (!sorter) return rows;
    const decorated = rows.map((row, index) => ({ row, index }));
    decorated.sort((a, b) => {
      const cmp = sorter(a.row, b.row);
      if (cmp === 0) return a.index - b.index;
      return sortState.direction === "asc" ? cmp : -cmp;
    });
    return decorated.map((entry) => entry.row);
  }, [rows, columns, sortState]);

  return { sortedRows, sortState, onSortChange };
}

/**
 * Cột hiện NGOÀI bảng — cột STT luôn giữ. Báo cáo không khai trong
 * `PRIMARY_REPORT_FIELDS` thì giữ nguyên toàn bộ cột như trước.
 */
function primaryReportColumns(
  columns: ReportColumn[],
  report: ReportKey,
): ReportColumn[] {
  const allowed = PRIMARY_REPORT_FIELDS[report];
  if (!allowed) return columns;
  return columns.filter((column) => {
    if (column.key === "__stt") return true;
    return allowed.includes(column.dataIndex ?? String(column.key ?? ""));
  });
}

type GenericReportKey =
  | "inventory-balance"
  | "xnt"
  | "document-history"
  | "movement-trace"
  | "import-match"
  | "label-log"
  | "warranty"
  | "outbound-by-agency";
// "defect-sku" tự quản lý truy vấn/render riêng (biểu đồ + bảng), không đi
// qua pipeline CONFIG/export chung nên tách khỏi GenericReportKey.
type ReportKey = GenericReportKey | "defect-sku";

/**
 * Cột hiện NGOÀI bảng cho từng báo cáo.
 *
 * Các bảng báo cáo có 12–18 cột nên luôn tràn ngang: muốn đọc hết một dòng phải
 * kéo thanh cuộn dưới đáy. Khai báo tập trung ở đây (thay vì rải cờ trên hơn
 * 100 định nghĩa cột bên dưới) để cân đối lại bề rộng bảng chỉ phải sửa một chỗ.
 *
 * Nguyên tắc chọn: đủ để nhận ra dòng dữ liệu và so sánh nhanh giữa các dòng —
 * mã định danh, tên, ngày, trạng thái, số liệu chính. Thứ chỉ cần khi soi một
 * dòng cụ thể (UUID, người thao tác, tệp nguồn, số liệu phụ, thông tin cá nhân)
 * chuyển vào modal chi tiết mở bằng nút "Xem" ở cột Thao tác.
 *
 * Giá trị là `dataIndex` của cột (hoặc `key` nếu cột không có dataIndex).
 */
const PRIMARY_REPORT_FIELDS: Partial<Record<ReportKey, readonly string[]>> = {
  "inventory-balance": [
    "warehouse_code",
    "product_code",
    "product_name",
    "stock_status",
    "on_hand_qty",
    "available_qty",
    "updated_at",
  ],
  // "xnt" CỐ Ý không khai: tab Nhập-Xuất-Tồn là bảng ma trận, 9 cột số trong 3
  // nhóm Nhập/Xuất/Xuất linh kiện (tổng phát sinh · đã đảo · thuần) chính là nội
  // dung báo cáo — ẩn bớt là mất khả năng đối chiếu, và WWHN-240 có test khoá đủ
  // bộ cột nhóm này. Bù lại các cột số đều hẹp nên bảng ít tràn hơn các tab kia.
  "document-history": [
    "document_no",
    "doc_type",
    "warehouse_code",
    "counterpart",
    "document_date",
    "status",
  ],
  "movement-trace": [
    "occurred_at",
    "movement_type",
    "warehouse_code",
    "product_code",
    "product_name",
    "qty_delta",
  ],
  "import-match": [
    "source_request_no",
    "sku_code",
    "sku_name",
    "required_qty",
    "scanned_qty",
    "validation_status",
  ],
  "label-log": [
    "outbound_no",
    "label_code",
    "outbound_date",
    "recipient",
    "label_count",
    "status",
    "applied",
  ],
  warranty: [
    "case_no",
    "model",
    "defect",
    "status",
    "received_at",
    "turnaround_days",
  ],
  "outbound-by-agency": [
    "source_request_no",
    "agency_name",
    "product_code",
    "product_name",
    "document_date",
    "required_qty",
    "scanned_qty",
  ],
};

type SelectOption = { value: string; label: string };

const PII_REASON_MIN_LENGTH = 5;
const EXPORT_ROW_LIMIT = 10000;

type ReportConfig = {
  label: string;
  icon: ReactElement;
  endpoint: string;
  exportEndpoint: string;
  rowsKey?: "rows" | "lines";
  fileStem: string;
  dateFilter?: boolean;
  reportCode: string;
};

const CONFIG: Record<GenericReportKey, ReportConfig> = {
  "inventory-balance": {
    label: "Tồn kho",
    icon: <StockOutlined style={{ fontSize: 15 }} />,
    endpoint: API_ENDPOINTS.REPORTS_INVENTORY_BALANCE,
    exportEndpoint: API_ENDPOINTS.REPORTS_INVENTORY_BALANCE_EXPORT_EXCEL,
    fileStem: "bao-cao-ton-kho-hien-tai",
    reportCode: "inventory-balance",
  },
  xnt: {
    label: "Nhập-Xuất-Tồn",
    icon: <SwapOutlined style={{ fontSize: 15 }} />,
    endpoint: API_ENDPOINTS.REPORTS_XNT_ENHANCED,
    exportEndpoint: API_ENDPOINTS.REPORTS_XNT_ENHANCED_EXPORT_EXCEL,
    rowsKey: "lines",
    fileStem: "bao-cao-xnt",
    dateFilter: true,
    reportCode: "inventory-xnt",
  },
  "document-history": {
    label: "Lịch sử nhập/xuất",
    icon: <HistoryOutlined style={{ fontSize: 15 }} />,
    endpoint: API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY,
    exportEndpoint: API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY_EXPORT_EXCEL,
    fileStem: "lich-su-phieu",
    dateFilter: true,
    reportCode: "document-history",
  },
  "movement-trace": {
    label: "Biến động / Truy vết",
    icon: <FileSearchOutlined style={{ fontSize: 15 }} />,
    endpoint: API_ENDPOINTS.REPORTS_MOVEMENT_TRACE,
    exportEndpoint: API_ENDPOINTS.REPORTS_MOVEMENT_TRACE_EXPORT_EXCEL,
    fileStem: "movement-trace",
    dateFilter: true,
    reportCode: "movement-trace",
  },
  "import-match": {
    label: "Đối soát toa",
    icon: <AuditOutlined style={{ fontSize: 15 }} />,
    endpoint: API_ENDPOINTS.REPORTS_IMPORT_MATCH,
    exportEndpoint: API_ENDPOINTS.REPORTS_IMPORT_MATCH_EXPORT_EXCEL,
    fileStem: "doi-soat-toa",
    dateFilter: true,
    reportCode: "import-match",
  },
  "label-log": {
    label: "Nhật ký nhãn đóng gói",
    icon: <TagOutlined style={{ fontSize: 15 }} />,
    endpoint: API_ENDPOINTS.REPORTS_LABEL_LOG,
    exportEndpoint: API_ENDPOINTS.REPORTS_LABEL_LOG_EXPORT_EXCEL,
    fileStem: "packing-label-log",
    dateFilter: true,
    reportCode: "label-log",
  },
  warranty: {
    label: "Bảo hành & linh kiện",
    icon: <SafetyCertificateOutlined style={{ fontSize: 15 }} />,
    endpoint: API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS,
    exportEndpoint: API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS_EXPORT_EXCEL,
    fileStem: "bao-cao-bao-hanh",
    dateFilter: true,
    reportCode: "warranty-defects",
  },
  "outbound-by-agency": {
    label: "Xuất theo nơi nhận",
    icon: <ExportOutlined style={{ fontSize: 15 }} />,
    endpoint: API_ENDPOINTS.REPORTS_OUTBOUND_BY_AGENCY,
    exportEndpoint: API_ENDPOINTS.REPORTS_OUTBOUND_BY_AGENCY_EXPORT_EXCEL,
    fileStem: "xuat-theo-noi-nhan",
    dateFilter: true,
    reportCode: "outbound-by-agency",
  },
};

const DEFECT_SKU_TAB_KEY = "defect-sku" as const;
const DEFECT_SKU_TAB_LABEL = "Bệnh lỗi theo SKU";

/** Nhãn tab kèm icon (UiTabs nhận label ReactNode; icon shim aria-hidden). */
function ReportTabLabel({
  icon,
  text: labelText,
}: {
  icon: ReactNode;
  text: string;
}) {
  return (
    <Box
      component="span"
      sx={{ display: "inline-flex", alignItems: "center", gap: 0.75 }}
    >
      {icon}
      {labelText}
    </Box>
  );
}

const MOVEMENT_COLORS: Record<string, string> = {
  OPENING: "default",
  RECEIPT: "blue",
  ISSUE: "orange",
  COMPONENT_ISSUE: "purple",
  REVERSAL: "red",
};

const MOVEMENT_LABELS: Readonly<Record<string, string>> = {
  OPENING: "Tồn đầu kỳ",
  ...MOVEMENT_TYPE_LABELS,
};

const RECONCILE_LABELS: Readonly<Record<string, string>> = {
  ...RECONCILE_STATUS_LABELS,
  NOT_APPLICABLE: "Không áp dụng",
};

const REPORT_STATUS_LABELS: Readonly<Record<string, string>> = {
  DRAFT: "Nháp",
  SCANNING: "Đang quét",
  POSTED: "Đã ghi nhận",
  CANCELLED: "Đã hủy",
  UPLOADED: "Đã tải lên",
  VALIDATED: "Đã kiểm tra",
  CONSUMED: "Đã sử dụng",
  REJECTED: "Đã từ chối",
  PENDING_PRINT: "Chờ in",
  PRINTED: "Đã in",
  PRINT_FAILED: "In thất bại",
  RECEIVED: "Đã tiếp nhận",
  CHECKING: "Đang kiểm tra",
  REPAIRING: "Đang sửa chữa",
  COMPLETED: "Đã hoàn tất",
  RETURNED: "Đã trả khách",
  IDENTIFIED: WARRANTY_IDENTIFICATION_STATUS_LABELS.IDENTIFIED,
  TEMP_ONLY: WARRANTY_IDENTIFICATION_STATUS_LABELS.TEMP_ONLY,
};

const STATUS_COLORS: Record<string, string> = {
  POSTED: "success",
  PRINTED: "success",
  CONSUMED: "success",
  RETURNED: "success",
  COMPLETED: "success",
  SCANNING: "processing",
  // VALIDATED = dữ liệu đã qua kiểm tra và hợp lệ (đối soát toa: UPLOADED →
  // VALIDATED → CONSUMED, hoặc REJECTED nếu lỗi) — là một trạng thái đạt,
  // không phải "đang xử lý", nên tô xanh lá để khớp §5 (khớp màu OutboundIntakeModal).
  VALIDATED: "success",
  PENDING_PRINT: "processing",
  RECEIVED: "processing",
  CHECKING: "processing",
  REPAIRING: "processing",
  CANCELLED: "error",
  REJECTED: "error",
  PRINT_FAILED: "error",
};

/** Preset màu antd cũ → tone soft-tint của UiStatusBadge (fail-safe neutral). */
const ANTD_COLOR_TONE: Record<string, UiStatusTone> = {
  success: "success",
  green: "success",
  error: "error",
  red: "error",
  warning: "warning",
  orange: "warning",
  processing: "info",
  blue: "info",
  purple: "primary",
  default: "neutral",
};

function toneOf(color: string | undefined): UiStatusTone {
  return ANTD_COLOR_TONE[color ?? "default"] ?? "neutral";
}

const fmt = (value: unknown) =>
  new Intl.NumberFormat("vi-VN").format(Number(value ?? 0));
const text = (value: unknown, fallback = "-") =>
  value === null || value === undefined || value === ""
    ? fallback
    : String(value);
const n = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};
const fmtDate = (value: unknown) => formatDate(text(value, ""));
const fmtDateTime = (value: unknown) => formatDateTime(text(value, ""));

function rowsOf(
  data: Raw | undefined,
  key: "rows" | "lines" | "by_product" = "rows",
): Raw[] {
  const value = data?.[key];
  return Array.isArray(value) ? (value as Raw[]) : [];
}

function objectOf(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : {};
}

function stripApiPrefix(url: string): string {
  return url.replace(/^\/api\/v1/, "");
}

function createIdempotencyKey(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === "function") {
    return cryptoApi.randomUUID();
  }
  return `rpt-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

const REPORT_EXPORT_POLL_INTERVAL_MS = 1200;
const REPORT_EXPORT_POLL_TIMEOUT_MS = 60000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type ReportExportJobStatus = {
  export_job_id: string;
  status: "PENDING" | "PROCESSING" | "READY" | "FAILED";
  row_count: number | null;
  download_url: string | null;
  error_message: string | null;
};

/**
 * Checklist "Hiệu năng và triển khai" 27/08: POST /reports/export giờ chỉ tạo job (PENDING)
 * và dispatch nền — file thật chỉ sẵn sàng sau khi GenerateReportExportJob chạy xong. Poll
 * GET /reports/export/{id} tới khi READY (có download_url) hoặc FAILED.
 */
async function pollReportExportJob(
  jobId: string,
): Promise<ReportExportJobStatus> {
  const deadline = Date.now() + REPORT_EXPORT_POLL_TIMEOUT_MS;
  for (;;) {
    const status = await http.get<ReportExportJobStatus>(
      `/reports/export/${jobId}`,
    );
    if (status.status === "READY" || status.status === "FAILED") {
      return status;
    }
    if (Date.now() >= deadline) {
      throw new Error(
        "Export đang xử lý lâu hơn dự kiến; vui lòng thử lại sau ít phút.",
      );
    }
    await sleep(REPORT_EXPORT_POLL_INTERVAL_MS);
  }
}

function handleBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function useWarehouseOptions(): { options: SelectOption[]; loading: boolean } {
  const query = useQuery({
    queryKey: ["warehouses", "flow06-filter"],
    queryFn: () => fetchWarehouses({ status: "ACTIVE", per_page: 100 }),
  });
  return {
    loading: query.isLoading,
    options: (query.data ?? [])
      .map((row: Raw) => ({
        value: text(row.id ?? row.warehouse_id, ""),
        label: [row.code, row.name].filter(Boolean).join(" · "),
      }))
      .filter((row) => row.value !== ""),
  };
}

function usePrinterOptions(): { options: SelectOption[]; loading: boolean } {
  const query = useQuery({
    queryKey: ["printers", "flow06-filter"],
    queryFn: fetchPrinterConfigs,
  });
  return {
    loading: query.isLoading,
    options: (query.data ?? [])
      .filter((row) => row.status === "ACTIVE")
      .map((row) => ({ value: row.id, label: `${row.code} · ${row.name}` })),
  };
}

function useActorOptions(enabled: boolean): {
  options: SelectOption[];
  loading: boolean;
} {
  const query = useQuery({
    queryKey: ["users", "flow06-actor-filter"],
    queryFn: () =>
      http.getPage<Raw[]>(API_ENDPOINTS.USERS, {
        params: { status: "ACTIVE", per_page: 100 },
      }),
    enabled,
  });
  const rows = Array.isArray(query.data?.data) ? query.data.data : [];
  return {
    loading: query.isLoading,
    options: rows
      .map((row) => ({
        value: text(row.user_id ?? row.id, ""),
        label: text(row.display_name ?? row.username ?? row.email, "—"),
      }))
      .filter((row) => row.value !== ""),
  };
}

function useCategoryOptions(): { options: SelectOption[]; loading: boolean } {
  const query = useQuery({
    queryKey: ["product-categories", "flow06-filter"],
    queryFn: () =>
      http.getPage<Raw[]>(API_ENDPOINTS.PRODUCT_CATEGORIES, {
        params: { status: "ACTIVE", per_page: 100 },
      }),
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

function reportStatusLabel(value: unknown): string {
  return businessLabel(REPORT_STATUS_LABELS, text(value, ""));
}

function stockStatusLabel(value: unknown): string {
  return businessLabel(INVENTORY_STOCK_STATUS_LABELS, text(value, ""));
}

// AVAILABLE = khả dụng (tốt, xanh lá); QUARANTINE = đang chờ kiểm tra (cảnh
// báo, cam); NON_SELLABLE/DEFECTIVE = không dùng được (lỗi, đỏ).
const STOCK_STATUS_COLORS: Record<string, string> = {
  AVAILABLE: "success",
  QUARANTINE: "warning",
  NON_SELLABLE: "error",
  DEFECTIVE: "error",
};

function stockStatusTag(value: unknown) {
  const status = text(value, "");
  return (
    <UiStatusBadge
      tone={toneOf(STOCK_STATUS_COLORS[status])}
      label={stockStatusLabel(value)}
    />
  );
}

// IDENTIFIED = đã xác định được sản phẩm (hoàn tất bước nhận diện, xanh lá);
// TEMP_ONLY = mới tiếp nhận tạm, chưa xác định (cảnh báo, cam).
const IDENTIFICATION_STATUS_COLORS: Record<string, string> = {
  IDENTIFIED: "success",
  TEMP_ONLY: "warning",
};

function identificationStatusTag(value: unknown) {
  const status = text(value, "");
  return (
    <UiStatusBadge
      tone={toneOf(IDENTIFICATION_STATUS_COLORS[status])}
      label={businessLabel(WARRANTY_IDENTIFICATION_STATUS_LABELS, status)}
    />
  );
}

function columnsFor(report: ReportKey, canViewPii: boolean): ReportColumn[] {
  switch (report) {
    case "inventory-balance":
      return [
        {
          title: "Kho",
          dataIndex: "warehouse_code",
          width: 100,
          sorter: (a, b) =>
            text(a.warehouse_code, "").localeCompare(
              text(b.warehouse_code, ""),
              "vi",
            ),
        },
        {
          title: "Mã SKU",
          dataIndex: "product_code",
          width: 140,
          fixed: "left",
          sorter: (a, b) =>
            text(a.product_code, "").localeCompare(
              text(b.product_code, ""),
              "vi",
            ),
        },
        {
          title: "Tên SKU",
          dataIndex: "product_name",
          width: 220,
          sorter: (a, b) =>
            text(a.product_name, "").localeCompare(
              text(b.product_name, ""),
              "vi",
            ),
        },
        {
          title: "Nhóm hàng",
          dataIndex: "category",
          width: 140,
          sorter: (a, b) =>
            text(a.category, "").localeCompare(text(b.category, ""), "vi"),
        },
        {
          title: "Trạng thái",
          dataIndex: "stock_status",
          width: 150,
          sortType: "value",
          sorter: (a, b) =>
            text(a.stock_status, "").localeCompare(text(b.stock_status, "")),
          render: (value) => stockStatusTag(value),
        },
        {
          title: "Tồn kho",
          dataIndex: "on_hand_qty",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.on_hand_qty) - n(b.on_hand_qty),
          render: fmt,
        },
        {
          title: "Khả dụng",
          dataIndex: "available_qty",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.available_qty) - n(b.available_qty),
          render: fmt,
        },
        {
          title: "Số sê-ri",
          dataIndex: "serial_qty",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.serial_qty) - n(b.serial_qty),
          render: fmt,
        },
        {
          title: "Trong khay/thùng",
          dataIndex: "box_qty",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.box_qty) - n(b.box_qty),
          render: fmt,
        },
        {
          title: "Vị trí gợi ý",
          dataIndex: "location_hint",
          width: 150,
          sorter: (a, b) =>
            text(a.location_hint, "").localeCompare(
              text(b.location_hint, ""),
              "vi",
            ),
        },
        {
          title: "Sổ tồn kho",
          dataIndex: "ledger_qty",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.ledger_qty) - n(b.ledger_qty),
          render: fmt,
        },
        {
          title: "Chênh lệch",
          dataIndex: "variance",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.variance) - n(b.variance),
          render: (v) =>
            n(v) === 0 ? "0" : <UiStatusBadge tone="error" label={fmt(v)} />,
        },
        {
          title: "Đối soát",
          dataIndex: "reconciliation_status",
          width: 150,
          sortType: "value",
          sorter: (a, b) =>
            text(a.reconciliation_status, "").localeCompare(
              text(b.reconciliation_status, ""),
            ),
          render: (v) => {
            const status = text(v, "");
            const color =
              status === "MATCH"
                ? "success"
                : status === "NOT_APPLICABLE"
                  ? "default"
                  : "error";
            return (
              <UiStatusBadge
                tone={toneOf(color)}
                label={businessLabel(RECONCILE_LABELS, status)}
              />
            );
          },
        },
        {
          title: "Cập nhật",
          dataIndex: "updated_at",
          width: 170,
          sortType: "value",
          sorter: (a, b) =>
            new Date(text(a.updated_at, "")).getTime() -
            new Date(text(b.updated_at, "")).getTime(),
          render: fmtDateTime,
        },
      ];
    case "xnt":
      return [
        {
          title: "Kho",
          dataIndex: "warehouse_code",
          width: 100,
          sorter: (a, b) =>
            text(a.warehouse_code, "").localeCompare(
              text(b.warehouse_code, ""),
              "vi",
            ),
        },
        {
          title: "Mã SKU",
          dataIndex: "product_code",
          width: 140,
          fixed: "left",
          sorter: (a, b) =>
            text(a.product_code, "").localeCompare(
              text(b.product_code, ""),
              "vi",
            ),
        },
        {
          title: "Tên SKU",
          dataIndex: "product_name",
          width: 210,
          sorter: (a, b) =>
            text(a.product_name, "").localeCompare(
              text(b.product_name, ""),
              "vi",
            ),
        },
        {
          title: "Trạng thái tồn",
          dataIndex: "stock_status",
          width: 140,
          sortType: "value",
          sorter: (a, b) =>
            text(a.stock_status, "").localeCompare(text(b.stock_status, "")),
          render: (value) => stockStatusTag(value),
        },
        {
          title: "Đầu kỳ",
          dataIndex: "opening",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.opening) - n(b.opening),
          render: fmt,
        },
        {
          title: "Nhập",
          children: [
            {
              title: "Tổng phát sinh",
              dataIndex: "receipt_gross",
              align: "right",
              sorter: (a, b) =>
                n(a.receipt_gross ?? a.receipt) -
                n(b.receipt_gross ?? b.receipt),
              render: (_: unknown, row: Raw) =>
                fmt(row.receipt_gross ?? row.receipt),
            },
            {
              title: "Đã đảo",
              dataIndex: "receipt_reversal",
              align: "right",
              sorter: (a, b) => n(a.receipt_reversal) - n(b.receipt_reversal),
              render: fmt,
            },
            {
              title: "Thuần",
              dataIndex: "receipt_net",
              align: "right",
              sorter: (a, b) =>
                n(a.receipt_net ?? a.receipt) - n(b.receipt_net ?? b.receipt),
              render: (_: unknown, row: Raw) =>
                fmt(row.receipt_net ?? row.receipt),
            },
          ],
        },
        {
          title: "Xuất",
          children: [
            {
              title: "Tổng phát sinh",
              dataIndex: "issue_gross",
              align: "right",
              sorter: (a, b) =>
                n(a.issue_gross ?? a.issue) - n(b.issue_gross ?? b.issue),
              render: (_: unknown, row: Raw) =>
                fmt(row.issue_gross ?? row.issue),
            },
            {
              title: "Đã đảo",
              dataIndex: "issue_reversal",
              align: "right",
              sorter: (a, b) => n(a.issue_reversal) - n(b.issue_reversal),
              render: fmt,
            },
            {
              title: "Thuần",
              dataIndex: "issue_net",
              align: "right",
              sorter: (a, b) =>
                n(a.issue_net ?? a.issue) - n(b.issue_net ?? b.issue),
              render: (_: unknown, row: Raw) => fmt(row.issue_net ?? row.issue),
            },
          ],
        },
        {
          title: "Xuất linh kiện",
          children: [
            {
              title: "Tổng phát sinh",
              dataIndex: "component_issue_gross",
              align: "right",
              sorter: (a, b) =>
                n(a.component_issue_gross ?? a.component_issue) -
                n(b.component_issue_gross ?? b.component_issue),
              render: (_: unknown, row: Raw) =>
                fmt(row.component_issue_gross ?? row.component_issue),
            },
            {
              title: "Đã đảo",
              dataIndex: "component_issue_reversal",
              align: "right",
              sorter: (a, b) =>
                n(a.component_issue_reversal) - n(b.component_issue_reversal),
              render: fmt,
            },
            {
              title: "Thuần",
              dataIndex: "component_issue_net",
              align: "right",
              sorter: (a, b) =>
                n(a.component_issue_net ?? a.component_issue) -
                n(b.component_issue_net ?? b.component_issue),
              render: (_: unknown, row: Raw) =>
                fmt(row.component_issue_net ?? row.component_issue),
            },
          ],
        },
        {
          title: "Điều chỉnh thuần",
          dataIndex: "reversal_net",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.reversal_net) - n(b.reversal_net),
          render: fmt,
        },
        {
          title: "Cuối kỳ",
          dataIndex: "closing",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.closing) - n(b.closing),
          render: fmt,
        },
      ];
    case "document-history":
      return [
        {
          title: "Số phiếu",
          dataIndex: "document_no",
          width: 160,
          fixed: "left",
          sorter: (a, b) =>
            text(a.document_no, "").localeCompare(
              text(b.document_no, ""),
              "vi",
            ),
        },
        {
          title: "Loại",
          dataIndex: "doc_type",
          width: 120,
          sortType: "value",
          sorter: (a, b) =>
            text(a.doc_type, "").localeCompare(text(b.doc_type, "")),
          render: (value) =>
            businessLabel(SOURCE_DOCUMENT_TYPE_LABELS, text(value, "")),
        },
        {
          title: "Kho",
          dataIndex: "warehouse_code",
          width: 100,
          sorter: (a, b) =>
            text(a.warehouse_code, "").localeCompare(
              text(b.warehouse_code, ""),
              "vi",
            ),
        },
        {
          title: "Đối tác/Nơi nhận",
          dataIndex: "counterpart",
          width: 200,
          sorter: (a, b) =>
            text(a.counterpart, "").localeCompare(
              text(b.counterpart, ""),
              "vi",
            ),
        },
        {
          title: "Ngày",
          dataIndex: "document_date",
          width: 120,
          sortType: "value",
          sorter: (a, b) =>
            new Date(text(a.document_date, "")).getTime() -
            new Date(text(b.document_date, "")).getTime(),
          render: fmtDate,
        },
        {
          title: "Trạng thái",
          dataIndex: "status",
          width: 130,
          sortType: "value",
          sorter: (a, b) =>
            text(a.status, "").localeCompare(text(b.status, "")),
          render: statusTag,
        },
        {
          title: "Người tạo",
          dataIndex: "created_by_name",
          width: 140,
          sorter: (a, b) =>
            text(a.created_by_name, "").localeCompare(
              text(b.created_by_name, ""),
              "vi",
            ),
        },
        {
          title: "Người ghi nhận",
          dataIndex: "posted_by_name",
          width: 140,
          sorter: (a, b) =>
            text(a.posted_by_name, "").localeCompare(
              text(b.posted_by_name, ""),
              "vi",
            ),
        },
        {
          title: "Thời điểm ghi nhận",
          dataIndex: "posted_at",
          width: 170,
          sortType: "value",
          sorter: (a, b) =>
            new Date(text(a.posted_at, "")).getTime() -
            new Date(text(b.posted_at, "")).getTime(),
          render: fmtDateTime,
        },
      ];
    case "movement-trace":
      return [
        {
          title: "Mã biến động",
          dataIndex: "id",
          width: 190,
          fixed: "left",
          ellipsis: true,
          sorter: (a, b) => text(a.id, "").localeCompare(text(b.id, ""), "vi"),
        },
        {
          title: "Thời gian",
          dataIndex: "occurred_at",
          width: 170,
          sortType: "value",
          sorter: (a, b) =>
            new Date(text(a.occurred_at, "")).getTime() -
            new Date(text(b.occurred_at, "")).getTime(),
          render: fmtDateTime,
        },
        {
          title: "Loại",
          dataIndex: "movement_type",
          width: 150,
          sortType: "value",
          sorter: (a, b) =>
            text(a.movement_type, "").localeCompare(text(b.movement_type, "")),
          render: (v) => {
            const raw = text(v, "");
            return (
              <UiStatusBadge
                tone={toneOf(MOVEMENT_COLORS[raw])}
                label={businessLabel(MOVEMENT_LABELS, raw)}
              />
            );
          },
        },
        {
          title: "Kho",
          dataIndex: "warehouse_code",
          width: 100,
          sorter: (a, b) =>
            text(a.warehouse_code, "").localeCompare(
              text(b.warehouse_code, ""),
              "vi",
            ),
        },
        {
          title: "SKU",
          dataIndex: "product_code",
          width: 130,
          sorter: (a, b) =>
            text(a.product_code, "").localeCompare(
              text(b.product_code, ""),
              "vi",
            ),
        },
        {
          title: "Tên SKU",
          dataIndex: "product_name",
          width: 190,
          sorter: (a, b) =>
            text(a.product_name, "").localeCompare(
              text(b.product_name, ""),
              "vi",
            ),
        },
        {
          title: "SL Δ",
          dataIndex: "qty_delta",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.qty_delta) - n(b.qty_delta),
          render: fmt,
        },
        {
          title: "Mã vật lý",
          dataIndex: "physical_code",
          width: 170,
          sorter: (a, b) =>
            text(a.physical_code, "").localeCompare(
              text(b.physical_code, ""),
              "vi",
            ),
        },
        {
          title: "Người thực hiện",
          dataIndex: "actor",
          width: 150,
          sorter: (a, b) =>
            text(a.actor, "").localeCompare(text(b.actor, ""), "vi"),
        },
        {
          title: "Nguồn",
          dataIndex: "source_type",
          width: 150,
          sortType: "value",
          sorter: (a, b) =>
            text(a.source_type, "").localeCompare(text(b.source_type, "")),
          render: (value) =>
            businessLabel(SOURCE_DOCUMENT_TYPE_LABELS, text(value, "")),
        },
        {
          title: "Biến động gốc",
          dataIndex: "original_movement_id",
          width: 180,
          sorter: (a, b) =>
            text(a.original_movement_id, "").localeCompare(
              text(b.original_movement_id, ""),
              "vi",
            ),
        },
        {
          title: "Chuỗi điều chỉnh",
          dataIndex: "correction_chain_id",
          width: 180,
          sorter: (a, b) =>
            text(a.correction_chain_id, "").localeCompare(
              text(b.correction_chain_id, ""),
              "vi",
            ),
        },
      ];
    case "import-match":
      return [
        {
          title: "Phiếu toa",
          dataIndex: "source_request_no",
          // Mã phiếu toa là định danh chính của dòng và khá dài
          // ("TOA-SEED-IMPORT-ROW-001"), để hẹp là bị cắt ngay chữ đầu.
          width: 230,
          fixed: "left",
          sorter: (a, b) =>
            text(a.source_request_no, "").localeCompare(
              text(b.source_request_no, ""),
              "vi",
            ),
          render: (v) => text(v),
        },
        {
          title: "Phiên bản",
          dataIndex: "source_version",
          width: 90,
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.source_version) - n(b.source_version),
          render: (v) => (v === null || v === undefined ? "—" : `v${n(v)}`),
        },
        {
          title: "Dòng",
          dataIndex: "row_no",
          width: 70,
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.row_no) - n(b.row_no),
          render: (v) => (v === null || v === undefined ? "—" : fmt(v)),
        },
        {
          title: "Mã SKU",
          dataIndex: "sku_code",
          width: 150,
          sorter: (a, b) =>
            text(a.sku_code, "").localeCompare(text(b.sku_code, ""), "vi"),
        },
        {
          title: "Tên SKU",
          dataIndex: "sku_name",
          width: 200,
          ellipsis: true,
          sorter: (a, b) =>
            text(a.sku_name, "").localeCompare(text(b.sku_name, ""), "vi"),
        },
        {
          title: "Yêu cầu",
          dataIndex: "required_qty",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.required_qty) - n(b.required_qty),
          render: fmt,
        },
        {
          title: "Đã đối chiếu",
          dataIndex: "matched_qty",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.matched_qty) - n(b.matched_qty),
          render: fmt,
        },
        {
          title: "Đã quét",
          dataIndex: "scanned_qty",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.scanned_qty) - n(b.scanned_qty),
          render: fmt,
        },
        {
          title: "Đã ghi nhận",
          dataIndex: "posted_qty",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.posted_qty) - n(b.posted_qty),
          render: fmt,
        },
        {
          title: "Kiểm tra",
          dataIndex: "validation_status",
          width: 130,
          sortType: "value",
          sorter: (a, b) =>
            text(a.validation_status, "").localeCompare(
              text(b.validation_status, ""),
            ),
          render: statusTag,
        },
        {
          title: "Phiếu xuất",
          dataIndex: "outbound_no",
          width: 150,
          sorter: (a, b) =>
            text(a.outbound_no, "").localeCompare(
              text(b.outbound_no, ""),
              "vi",
            ),
        },
        {
          title: "Lô nhập",
          dataIndex: "import_no",
          width: 150,
          sorter: (a, b) =>
            text(a.import_no, "").localeCompare(text(b.import_no, ""), "vi"),
        },
        {
          title: "Tệp nguồn",
          dataIndex: "source_file_name",
          width: 200,
          ellipsis: true,
          sorter: (a, b) =>
            text(a.source_file_name, "").localeCompare(
              text(b.source_file_name, ""),
              "vi",
            ),
        },
        {
          title: "Trạng thái lô nhập",
          dataIndex: "import_status",
          width: 150,
          sortType: "value",
          sorter: (a, b) =>
            text(a.import_status, "").localeCompare(text(b.import_status, "")),
          render: statusTag,
        },
        {
          title: "Người tải lên",
          dataIndex: "uploaded_by_name",
          width: 150,
          sorter: (a, b) =>
            text(a.uploaded_by_name, "").localeCompare(
              text(b.uploaded_by_name, ""),
              "vi",
            ),
        },
        {
          title: "Người sử dụng",
          dataIndex: "consumed_by_name",
          width: 150,
          sorter: (a, b) =>
            text(a.consumed_by_name, "").localeCompare(
              text(b.consumed_by_name, ""),
              "vi",
            ),
        },
      ];
    case "label-log":
      return [
        {
          title: "Phiếu xuất",
          dataIndex: "outbound_no",
          width: 160,
          fixed: "left",
          sorter: (a, b) =>
            text(a.outbound_no, "").localeCompare(
              text(b.outbound_no, ""),
              "vi",
            ),
        },
        {
          title: "Mã nhãn đóng gói",
          dataIndex: "label_code",
          width: 180,
          ellipsis: true,
          sorter: (a, b) =>
            text(a.label_code, "").localeCompare(text(b.label_code, ""), "vi"),
          render: (v) => text(v),
        },
        {
          title: "Mã bản lưu nhãn",
          dataIndex: "id",
          width: 150,
          ellipsis: true,
          sorter: (a, b) => text(a.id, "").localeCompare(text(b.id, ""), "vi"),
          render: (v) => text(v),
        },
        {
          title: "Ngày",
          dataIndex: "outbound_date",
          width: 120,
          sortType: "value",
          sorter: (a, b) =>
            new Date(text(a.outbound_date, "")).getTime() -
            new Date(text(b.outbound_date, "")).getTime(),
          render: fmtDate,
        },
        {
          title: "Nơi nhận",
          dataIndex: "recipient",
          width: 180,
          sorter: (a, b) =>
            text(a.recipient, "").localeCompare(text(b.recipient, ""), "vi"),
        },
        {
          title: "Số nhãn",
          dataIndex: "label_count",
          width: 90,
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.label_count) - n(b.label_count),
          render: fmt,
        },
        {
          title: "Sản phẩm",
          dataIndex: "item_count",
          width: 90,
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.item_count) - n(b.item_count),
          render: fmt,
        },
        {
          title: "SKU",
          dataIndex: "sku_count",
          width: 80,
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.sku_count) - n(b.sku_count),
          render: fmt,
        },
        {
          title: "Tóm tắt SKU",
          dataIndex: "sku_summary",
          width: 240,
          ellipsis: true,
          sorter: (a, b) =>
            text(a.sku_summary, "").localeCompare(
              text(b.sku_summary, ""),
              "vi",
            ),
        },
        {
          title: "Trạng thái",
          dataIndex: "status",
          width: 130,
          sortType: "value",
          sorter: (a, b) =>
            text(a.status, "").localeCompare(text(b.status, "")),
          render: statusTag,
        },
        {
          title: "Đã dán",
          dataIndex: "applied",
          width: 90,
          sortType: "value",
          sorter: (a, b) =>
            Number(Boolean(a.applied)) - Number(Boolean(b.applied)),
          render: (v) => (
            <UiStatusBadge
              tone={v ? "success" : "warning"}
              label={v ? "CÓ" : "CHƯA"}
            />
          ),
        },
        {
          title: "Máy in",
          dataIndex: "printer_name",
          width: 170,
          sorter: (a, b) =>
            text(a.printer_name || a.printer_code, "").localeCompare(
              text(b.printer_name || b.printer_code, ""),
              "vi",
            ),
          render: (_: unknown, row: Raw) =>
            text(row.printer_name || row.printer_code),
        },
        {
          title: "Người in",
          dataIndex: "printed_by_name",
          width: 150,
          sorter: (a, b) =>
            text(a.printed_by_name, "").localeCompare(
              text(b.printed_by_name, ""),
              "vi",
            ),
        },
        {
          title: "Lần in",
          dataIndex: "total_attempts",
          width: 80,
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.total_attempts) - n(b.total_attempts),
          render: fmt,
        },
        {
          title: "Lỗi in",
          dataIndex: "failed_count",
          width: 80,
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.failed_count) - n(b.failed_count),
          render: fmt,
        },
        {
          title: "In lại",
          dataIndex: "reprint_count",
          width: 80,
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.reprint_count) - n(b.reprint_count),
          render: fmt,
        },
        {
          title: "Lần in gần nhất",
          dataIndex: "last_attempt_at",
          width: 170,
          sortType: "value",
          sorter: (a, b) =>
            new Date(text(a.last_attempt_at, "")).getTime() -
            new Date(text(b.last_attempt_at, "")).getTime(),
          render: fmtDateTime,
        },
      ];
    case "warranty":
      return [
        {
          title: "Ca bảo hành",
          dataIndex: "case_no",
          width: 160,
          fixed: "left",
          sorter: (a, b) =>
            text(a.case_no, "").localeCompare(text(b.case_no, ""), "vi"),
        },
        {
          title: "Nhận diện",
          dataIndex: "identification_status",
          width: 170,
          sortType: "value",
          sorter: (a, b) =>
            text(a.identification_status, "").localeCompare(
              text(b.identification_status, ""),
            ),
          render: (value) => identificationStatusTag(value),
        },
        {
          title: "SKU/Mẫu sản phẩm",
          dataIndex: "model",
          width: 170,
          sorter: (a, b) =>
            text(a.model, "").localeCompare(text(b.model, ""), "vi"),
        },
        {
          title: "Bệnh/lỗi",
          dataIndex: "defect",
          width: 180,
          sorter: (a, b) =>
            text(a.defect, "").localeCompare(text(b.defect, ""), "vi"),
        },
        {
          title: "Linh kiện đã xuất",
          dataIndex: "components_issued",
          width: 200,
          sorter: (a, b) =>
            text(a.components_issued, "").localeCompare(
              text(b.components_issued, ""),
              "vi",
            ),
        },
        {
          title: "Trạng thái",
          dataIndex: "status",
          width: 130,
          sortType: "value",
          sorter: (a, b) =>
            text(a.status, "").localeCompare(text(b.status, "")),
          render: statusTag,
        },
        {
          title: "Ngày mua",
          dataIndex: "purchase_date",
          width: 130,
          sortType: "value",
          sorter: (a, b) =>
            new Date(text(a.purchase_date, "")).getTime() -
            new Date(text(b.purchase_date, "")).getTime(),
          render: fmtDate,
        },
        {
          title: "Ngày nhận",
          dataIndex: "received_at",
          width: 170,
          sortType: "value",
          sorter: (a, b) =>
            new Date(text(a.received_at, "")).getTime() -
            new Date(text(b.received_at, "")).getTime(),
          render: fmtDateTime,
        },
        {
          title: "Ngày trả khách",
          dataIndex: "returned_at",
          width: 170,
          sortType: "value",
          sorter: (a, b) =>
            new Date(text(a.returned_at, "")).getTime() -
            new Date(text(b.returned_at, "")).getTime(),
          render: fmtDateTime,
        },
        {
          title: "Thời gian xử lý",
          dataIndex: "turnaround_days",
          width: 120,
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.turnaround_days) - n(b.turnaround_days),
          render: (value) =>
            value === null || value === undefined ? "—" : `${text(value)} ngày`,
        },
        {
          title: "Khách hàng",
          dataIndex: "customer_name",
          width: 150,
          sorter: (a, b) =>
            warrantyPiiText(
              text(a.customer_name, ""),
              canViewPii,
              "name",
            ).localeCompare(
              warrantyPiiText(text(b.customer_name, ""), canViewPii, "name"),
              "vi",
            ),
          render: (value: unknown) =>
            warrantyPiiText(text(value, ""), canViewPii, "name") || "—",
        },
        {
          title: "SĐT",
          dataIndex: "customer_phone",
          width: 130,
          sorter: (a, b) =>
            warrantyPiiText(
              text(a.customer_phone, ""),
              canViewPii,
              "phone",
            ).localeCompare(
              warrantyPiiText(text(b.customer_phone, ""), canViewPii, "phone"),
              "vi",
            ),
          render: (value: unknown) =>
            warrantyPiiText(text(value, ""), canViewPii, "phone") || "—",
        },
        {
          title: "Địa chỉ",
          dataIndex: "customer_address",
          width: 200,
          ellipsis: true,
          sorter: (a, b) =>
            warrantyPiiText(
              text(a.customer_address, ""),
              canViewPii,
              "address",
            ).localeCompare(
              warrantyPiiText(
                text(b.customer_address, ""),
                canViewPii,
                "address",
              ),
              "vi",
            ),
          render: (value: unknown) =>
            warrantyPiiText(text(value, ""), canViewPii, "address") || "—",
        },
        {
          title: "Cập nhật",
          dataIndex: "updated_at",
          width: 170,
          sortType: "value",
          sorter: (a, b) =>
            new Date(text(a.updated_at, "")).getTime() -
            new Date(text(b.updated_at, "")).getTime(),
          render: fmtDateTime,
        },
      ];
    case "outbound-by-agency":
      return [
        {
          title: "Phiếu toa",
          dataIndex: "source_request_no",
          width: 230,
          sorter: (a, b) =>
            text(a.source_request_no, "").localeCompare(
              text(b.source_request_no, ""),
              "vi",
            ),
        },
        {
          title: "Mã nơi nhận",
          dataIndex: "agency_code",
          width: 130,
          sorter: (a, b) =>
            text(a.agency_code, "").localeCompare(
              text(b.agency_code, ""),
              "vi",
            ),
        },
        {
          title: "Nơi nhận",
          dataIndex: "agency_name",
          width: 190,
          sorter: (a, b) =>
            text(a.agency_name, "").localeCompare(
              text(b.agency_name, ""),
              "vi",
            ),
        },
        {
          title: "Địa chỉ",
          dataIndex: "address",
          width: 220,
          ellipsis: true,
          sorter: (a, b) =>
            text(a.address, "").localeCompare(text(b.address, ""), "vi"),
        },
        {
          title: "Liên hệ",
          dataIndex: "contact_masked",
          width: 130,
          sorter: (a, b) =>
            text(a.contact_masked, "").localeCompare(
              text(b.contact_masked, ""),
              "vi",
            ),
        },
        {
          title: "Mã SKU",
          dataIndex: "product_code",
          width: 130,
          sorter: (a, b) =>
            text(a.product_code, "").localeCompare(
              text(b.product_code, ""),
              "vi",
            ),
        },
        {
          title: "Tên SKU",
          dataIndex: "product_name",
          width: 200,
          sorter: (a, b) =>
            text(a.product_name, "").localeCompare(
              text(b.product_name, ""),
              "vi",
            ),
        },
        {
          title: "Phiếu",
          dataIndex: "outbound_no",
          width: 150,
          sorter: (a, b) =>
            text(a.outbound_no, "").localeCompare(
              text(b.outbound_no, ""),
              "vi",
            ),
        },
        {
          title: "Ngày",
          dataIndex: "document_date",
          width: 120,
          sortType: "value",
          sorter: (a, b) =>
            new Date(text(a.document_date, "")).getTime() -
            new Date(text(b.document_date, "")).getTime(),
          render: fmtDate,
        },
        {
          title: "SL yêu cầu",
          dataIndex: "required_qty",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.required_qty) - n(b.required_qty),
          render: fmt,
        },
        {
          title: "SL xuất",
          dataIndex: "scanned_qty",
          align: "right",
          sortType: "value",
          sorter: (a, b) => n(a.scanned_qty) - n(b.scanned_qty),
          render: fmt,
        },
      ];
    case "defect-sku":
      return [];
  }
}
/**
 * Modal "Chi tiết dòng báo cáo" — dùng chung cho MỌI tab.
 *
 * Nội dung dựng thẳng từ bộ cột của tab đang xem (kể cả cột không hiện ngoài
 * bảng), tái dùng luôn `render` của từng cột nên tag trạng thái, ngày giờ, số
 * đã định dạng... hiện y hệt trong bảng. Nhờ vậy thêm/bớt cột ở `columnsFor`
 * là modal tự cập nhật, không phải viết modal riêng cho từng báo cáo.
 *
 * Part 4: phiếu Lịch sử nhập/xuất không còn expandable row (antd Table đã gỡ)
 * — tầng dòng (`DocumentLines`) chuyển vào modal này, mở bằng nút "Xem".
 */
function ReportRowDetailModal({
  title,
  columns,
  row,
  rowIndex,
  onClose,
}: {
  title: string;
  columns: ReportColumn[];
  row: Raw;
  rowIndex: number;
  onClose: () => void;
}) {
  const dialog = useDialogExit(onClose);
  const fields = flattenReportColumns(columns).filter(
    ({ column }) => column.key !== "__stt",
  );
  const documentLines = Array.isArray(row.lines) ? (row.lines as Raw[]) : [];

  return (
    <UiDialog
      {...dialog.dialogProps}
      maxWidth="md"
      fullWidth
      title={
        <Box sx={{ position: "relative", pr: 6 }}>
          {title}
          <ActionIconButton
            kind="close"
            onClick={dialog.close}
            sx={{ position: "absolute", right: -8, top: -4 }}
          />
        </Box>
      }
    >
      <Grid container spacing={2}>
        {fields.map(({ title: label, column }) => {
          const dataIndex = column.dataIndex;
          const value = dataIndex ? row[dataIndex] : undefined;
          const rendered = column.render
            ? column.render(value, row, rowIndex)
            : text(value, "—");
          return (
            <Grid
              key={String(column.key ?? dataIndex ?? label)}
              size={{ xs: 12, sm: 6 }}
            >
              <Box
                sx={{
                  typography: "caption",
                  color: "text.secondary",
                  display: "block",
                }}
              >
                {label}
              </Box>
              <Box sx={{ typography: "body2", wordBreak: "break-word" }}>
                {rendered === "" || rendered === null || rendered === undefined
                  ? "—"
                  : rendered}
              </Box>
            </Grid>
          );
        })}
      </Grid>
      {documentLines.length > 0 ? (
        <Box sx={{ mt: 2 }}>
          <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
            Tầng dòng của phiếu: kế hoạch / đã quét / đã ghi nhận
          </Box>
          <DocumentLines lines={documentLines} />
        </Box>
      ) : null}
    </UiDialog>
  );
}

function DocumentLines({ lines }: { lines: Raw[] }) {
  const columns: ResponsiveTableColumn<Raw>[] = [
    {
      key: "line_no",
      header: "Dòng",
      width: 70,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => n(row.line_no),
      render: (row) => (row.line_no ?? null) as ReactNode,
    },
    {
      key: "product_code",
      header: "Mã SKU",
      width: 160,
      sortAccessor: (row) => text(row.product_code, ""),
      render: (row) => (row.product_code ?? null) as ReactNode,
    },
    {
      key: "product_name",
      header: "Tên SKU",
      sortAccessor: (row) => text(row.product_name, ""),
      render: (row) => (row.product_name ?? null) as ReactNode,
    },
    {
      key: "expected_qty",
      header: "Kế hoạch",
      width: 110,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => n(row.expected_qty),
      render: (row) => fmt(row.expected_qty),
    },
    {
      key: "scanned_qty",
      header: "Đã quét",
      width: 110,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => n(row.scanned_qty),
      render: (row) => fmt(row.scanned_qty),
    },
    {
      key: "posted_qty",
      header: "Đã ghi nhận",
      width: 110,
      align: "right",
      sortType: "value",
      sortAccessor: (row) => n(row.posted_qty),
      render: (row) => fmt(row.posted_qty),
    },
  ];

  return (
    <ResponsiveDataTable<Raw>
      columns={columns}
      rows={lines}
      rowKey={(row) => text(row.id ?? row.line_no)}
      emptyText="Chưa có dòng nào"
    />
  );
}

function statusTag(value: unknown) {
  const status = text(value, "");
  return (
    <UiStatusBadge
      tone={toneOf(STATUS_COLORS[status] ?? "default")}
      label={reportStatusLabel(value)}
    />
  );
}

/**
 * Chọn nhiều giá trị cho bộ lọc (thay antd Select mode="multiple" — design
 * system chưa có multi-select điều khiển trực tiếp): nút mở Menu + Checkbox
 * từng lựa chọn, value contract string[] giữ nguyên như filter cũ.
 */
function MultiSelectFilter({
  value,
  onChange,
  options,
  placeholder,
  ariaLabel,
  minWidth = 210,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  options: SelectOption[];
  placeholder: string;
  ariaLabel: string;
  minWidth?: number;
}) {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  const selected = options.filter((option) => value.includes(option.value));
  const summary =
    selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0].label
        : `Đã chọn ${selected.length} mục`;

  const toggle = (optionValue: string) => {
    onChange(
      value.includes(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue],
    );
  };

  return (
    <>
      <UiButton
        appearance="outlined"
        color="secondary"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        endIcon={<DownOutlined style={{ fontSize: 12 }} />}
        onClick={(event) => setAnchorEl(event.currentTarget)}
        sx={{
          minWidth,
          justifyContent: "space-between",
          fontWeight: 400,
          textAlign: "left",
          color: selected.length === 0 ? "text.disabled" : "text.primary",
        }}
      >
        {summary}
      </UiButton>
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
      >
        {options.length === 0 ? (
          <MenuItem disabled>Không có lựa chọn</MenuItem>
        ) : (
          options.map((option) => (
            <MenuItem
              key={option.value}
              dense
              onClick={() => toggle(option.value)}
            >
              <Checkbox
                size="small"
                checked={value.includes(option.value)}
                tabIndex={-1}
                sx={{ p: 0.5, mr: 1 }}
              />
              {option.label}
            </MenuItem>
          ))
        )}
      </Menu>
    </>
  );
}

const KPI_TONE_CYCLE: ReportKpiTone[] = [
  "primary",
  "success",
  "warning",
  "info",
  "error",
];

/** antd Tag color (blue/green/error/...) → tone thẻ KPI; không map được thì
 * xoay vòng theo vị trí để các thẻ có màu sắc thay đổi, đỡ đơn điệu. */
function kpiToneFor(color: string | undefined, index: number): ReportKpiTone {
  switch (color) {
    case "success":
    case "green":
      return "success";
    case "error":
    case "red":
      return "error";
    case "warning":
    case "orange":
      return "warning";
    case "blue":
    case "processing":
      return "info";
    default:
      return KPI_TONE_CYCLE[index % KPI_TONE_CYCLE.length];
  }
}

function Summary({ report, data }: { report: ReportKey; data?: Raw }) {
  if (!data) return null;
  const summary = objectOf(data.summary);
  const tags: Array<[string, unknown, string?]> = [];
  switch (report) {
    case "inventory-balance":
      tags.push(
        ["Tổng dòng", summary.total_rows],
        ["Tồn kho", summary.total_on_hand, "blue"],
        ["Khả dụng", summary.total_available, "green"],
        [
          "Lệch sổ tồn kho",
          summary.mismatch_count,
          n(summary.mismatch_count) > 0 ? "error" : "success",
        ],
      );
      break;
    case "document-history":
      tags.push(
        ["Tổng", summary.total],
        ["Đã ghi nhận", summary.posted, "success"],
        ["Đang quét", summary.scanning, "processing"],
        ["Đã hủy", summary.cancelled, "error"],
      );
      break;
    case "movement-trace":
      tags.push(
        ["Biến động", summary.total_movements],
        ["Ảnh hưởng thuần", summary.net_effect, "blue"],
        ["Điều chỉnh", summary.reversal_count, "red"],
      );
      break;
    case "import-match":
      tags.push(
        ["Lô nhập", summary.total_batches],
        ["Dòng toa", summary.total_lines, "blue"],
        ["Khớp đủ", summary.fully_matched_lines, "success"],
        ["Dòng lỗi", summary.invalid_lines, "error"],
        ["SL yêu cầu", summary.total_required_qty],
        ["SL đã quét", summary.total_scanned_qty, "green"],
      );
      break;
    case "label-log":
      tags.push(
        ["Nhãn đóng gói", summary.total_labels],
        ["Đã in", summary.printed, "success"],
        ["Đã dán", summary.applied, "blue"],
        ["Lỗi", summary.failed, "error"],
        ["In lại", summary.reprinted, "warning"],
      );
      break;
    case "warranty":
      tags.push(
        ["Ca bảo hành", summary.total],
        ["Đang xử lý", summary.processing, "processing"],
        ["Đã trả", summary.returned, "success"],
        ["Đã hủy", summary.cancelled, "error"],
        ["Tiếp nhận tạm", summary.temp_only, "warning"],
      );
      break;
    case "outbound-by-agency":
      tags.push(
        ["Nơi nhận", summary.total_agencies],
        ["Phiếu", summary.total_documents, "blue"],
        ["Tổng xuất", summary.total_issued_qty, "green"],
      );
      break;
    default:
      break;
  }
  return tags.length ? (
    <ReportKpiGrid>
      {tags.map(([label, value, color], index) => (
        <ReportKpiCard
          key={label}
          label={label}
          value={fmt(value)}
          tone={kpiToneFor(color, index)}
        />
      ))}
    </ReportKpiGrid>
  ) : null;
}
function DefectSkuReport() {
  const [period, setPeriod] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, "day"),
    dayjs(),
  ]);
  // REQ-022/P2-04: lọc nhiều bệnh/lỗi cùng lúc — BE defectSkuBreakdown nhận
  // defect_ids[] (axios mặc định serialize mảng params thành defect_ids[]=...).
  const [defectIds, setDefectIds] = useState<string[]>([]);
  const [defectPage, setDefectPage] = useState(1);
  const [defectPageSize, setDefectPageSize] = useState(10);

  const defectsQuery = useQuery({
    queryKey: ["gd1", "defects"],
    queryFn: () =>
      http.getPage<Raw[]>("/defects", {
        params: { status: "ACTIVE", per_page: 200 },
      }),
  });
  const defectOptions: SelectOption[] = (
    Array.isArray(defectsQuery.data?.data) ? defectsQuery.data.data : []
  ).map((row) => ({
    value: text(row.defect_id, ""),
    label: `${text(row.defect_code, "")} · ${text(row.defect_name)}`,
  }));

  const defectSkuParams = {
    from_date: period[0].format("YYYY-MM-DD"),
    to_date: period[1].format("YYYY-MM-DD"),
    defect_ids: defectIds.length > 0 ? defectIds : undefined,
  };
  const query = useQuery({
    queryKey: ["gd1", "warranty-defect-sku", defectSkuParams],
    queryFn: () =>
      http.get<Raw>("/reports/warranty-defect-sku-breakdown", {
        params: defectSkuParams,
      }),
  });
  const rawRows = query.data?.rows ?? query.data;
  const rows = Array.isArray(rawRows) ? (rawRows as Raw[]) : [];
  // GĐ1 (2026-08-27): tab này trước đó không có KPI nào — tính thẳng từ rows
  // đã tải (không suy diễn tổng case, vì 1 case có thể xuất hiện ở nhiều dòng
  // SKU×lỗi — count distinct sku_id/defect_id là an toàn, không đếm trùng).
  const defectSkuDistinctSkuCount = new Set(
    rows.map((row) => text(row.sku_id, "")),
  ).size;
  const defectSkuDistinctDefectCount = new Set(
    rows.map((row) => text(row.defect_id, "")),
  ).size;
  const rawColumns: ReportColumn[] = [
    {
      title: "STT",
      key: "__stt",
      width: 64,
      fixed: "left",
      render: (_value: unknown, _row: Raw, index: number) =>
        mvpRowNumber(defectPage, defectPageSize, index),
    },
    {
      title: "SKU",
      dataIndex: "sku_code",
      width: 160,
      sorter: (a, b) =>
        text(a.sku_code, "").localeCompare(text(b.sku_code, ""), "vi"),
    },
    {
      title: "Tên SKU",
      dataIndex: "sku_name",
      width: 220,
      sorter: (a, b) =>
        text(a.sku_name, "").localeCompare(text(b.sku_name, ""), "vi"),
    },
    {
      title: "Mã bệnh/lỗi",
      dataIndex: "defect_code",
      width: 150,
      sorter: (a, b) =>
        text(a.defect_code, "").localeCompare(text(b.defect_code, ""), "vi"),
    },
    {
      title: "Bệnh/lỗi",
      dataIndex: "defect_name",
      width: 230,
      sorter: (a, b) =>
        text(a.defect_name, "").localeCompare(text(b.defect_name, ""), "vi"),
    },
    {
      title: "Số case",
      dataIndex: "case_count",
      width: 100,
      align: "right",
      sortType: "value",
      sorter: (a, b) => n(a.case_count) - n(b.case_count),
      render: (value) => n(value).toLocaleString("vi-VN"),
    },
  ];

  // Sort toàn bộ tập rồi mới cắt trang — đúng hành vi antd Table client-side.
  const { sortedRows, sortState, onSortChange } = useReportColumnSort(
    rawColumns,
    rows,
  );
  const pagedRows = sortedRows.slice(
    (defectPage - 1) * defectPageSize,
    defectPage * defectPageSize,
  );
  const rowKey = (row: Raw) =>
    `${text(row.sku_id, "")}-${text(row.defect_id, "")}`;
  const rowSelection = useRowSelection(pagedRows, rowKey);
  const responsiveColumns = toResponsiveColumns(rawColumns, pagedRows);

  return (
    <Stack spacing={1.75} sx={{ width: "100%" }}>
      <UiCard>
        <Stack
          direction="row"
          spacing={1}
          sx={{ flexWrap: "wrap", rowGap: 1, alignItems: "center" }}
        >
          <UiDateRangePicker
            value={period}
            format="DD/MM/YYYY"
            aria-label="Khoảng thời gian"
            onChange={(value) => {
              if (value?.[0] && value?.[1]) setPeriod([value[0], value[1]]);
            }}
          />
          <MultiSelectFilter
            minWidth={300}
            placeholder="Bệnh/lỗi (chọn được nhiều)"
            ariaLabel="Bệnh/lỗi"
            value={defectIds}
            options={defectOptions}
            onChange={setDefectIds}
          />
        </Stack>
      </UiCard>

      <ReportKpiGrid>
        <ReportKpiCard
          label="Số dòng SKU × lỗi"
          value={fmt(rows.length)}
          tone="primary"
          hint="Mỗi dòng là 1 cặp SKU-bệnh/lỗi trong tập lọc hiện tại"
        />
        <ReportKpiCard
          label="Số SKU khác nhau"
          value={fmt(defectSkuDistinctSkuCount)}
          tone="info"
        />
        <ReportKpiCard
          label="Số bệnh/lỗi khác nhau"
          value={fmt(defectSkuDistinctDefectCount)}
          tone="warning"
        />
      </ReportKpiGrid>

      {query.isError ? (
        <ApiErrorAlert
          error={query.error}
          title="Không tải được thống kê bệnh/lỗi theo SKU"
          onRetry={() => query.refetch()}
        />
      ) : null}

      <UiCard title="Biểu đồ bệnh/lỗi theo SKU">
        {rows.length === 0 && !query.isLoading ? (
          <EmptyState description="Chưa có dữ liệu trong khoảng thời gian đã chọn" />
        ) : (
          <HorizontalBarChart
            items={rows.map((row) => ({
              label: `${text(row.sku_code)} · ${text(row.defect_name)}`,
              value: n(row.case_count),
            }))}
            limit={20}
            valueFormatter={fmt}
          />
        )}
      </UiCard>

      <Box>
        <TableLoadingBanner loading={query.isLoading || query.isFetching} />
        <ResponsiveDataTable<Raw>
          columns={responsiveColumns}
          rows={pagedRows}
          rowKey={rowKey}
          rowSelection={rowSelection}
          loading={query.isLoading}
          emptyText="Không có dữ liệu"
          sortState={sortState}
          onSortChange={onSortChange}
        />
        <Box sx={{ mt: 1 }}>
          <UiPagination
            page={defectPage}
            pageSize={defectPageSize}
            total={sortedRows.length}
            onPageChange={setDefectPage}
            onPageSizeChange={(nextSize) => {
              setDefectPageSize(nextSize);
              setDefectPage(1);
            }}
          />
        </Box>
      </Box>
    </Stack>
  );
}
export default function AlignedReportsPage() {
  const [report, setReport] = useState<ReportKey>("inventory-balance");
  const [period, setPeriod] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, "day"),
    dayjs(),
  ]);
  const [keyword, setKeyword] = useState("");
  const [status, setStatus] = useState<string>();
  const [warehouseId, setWarehouseId] = useState<string>();
  const [agencyId, setAgencyId] = useState<string>();
  const [categoryId, setCategoryId] = useState<string>();
  const [printerId, setPrinterId] = useState<string>();
  const [actorId, setActorId] = useState<string>();
  const [skuCode, setSkuCode] = useState("");
  const [asOf, setAsOf] = useState<Dayjs | null>(null);
  // REQ-022/P2-04: BE /reports/warranty-defects (BaM1ReportController::
  // warrantyDefects) nhận defect_ids[] — cho lọc nhiều bệnh/lỗi cùng lúc.
  const [defectIds, setDefectIds] = useState<string[]>([]);
  const [identification, setIdentification] = useState<string>();
  const [movementType, setMovementType] = useState<string>();
  const [docType, setDocType] = useState<"all" | "inbound" | "outbound">("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  const [exportDenied, setExportDenied] = useState<string | null>(null);
  const [piiReason, setPiiReason] = useState("");
  // Dòng đang mở modal chi tiết (giữ cả index để cột STT/render theo vị trí
  // trong modal khớp với ngoài bảng).
  const [detailRow, setDetailRow] = useState<{
    row: Raw;
    index: number;
  } | null>(null);

  const warehouses = useWarehouseOptions();
  const printers = usePrinterOptions();
  const hasPermission = useHasPermission();
  const actors = useActorOptions(
    report === "label-log" &&
      hasPermission(WMS_PERMISSION_CATALOG.IAM_USER_VIEW),
  );
  const canViewPii = hasPermission(WMS_PERMISSION_CATALOG.WARRANTY_PII_VIEW);
  const canExportPii = hasPermission(
    WMS_PERMISSION_CATALOG.WARRANTY_PII_EXPORT,
  );
  const categories = useCategoryOptions();
  const agencies = useMvpAgencies({ status: "ACTIVE", per_page: 100 });
  const defects = useMvpDefects({ status: "ACTIVE", per_page: 100 });

  const isDefectSkuTab = report === DEFECT_SKU_TAB_KEY;
  const config =
    CONFIG[(isDefectSkuTab ? "inventory-balance" : report) as GenericReportKey];
  const invalidPeriod = period[0].isAfter(period[1], "day");
  const from = period[0].format("YYYY-MM-DD");
  const to = period[1].format("YYYY-MM-DD");
  const resetPage = () => setPage(1);

  const params = useMemo<Raw>(() => {
    const result: Raw = { page, per_page: perPage };
    if (config.dateFilter) {
      result.from_date = from;
      result.to_date = to;
    }
    if (report === "inventory-balance") {
      if (keyword.trim()) result.keyword = keyword.trim();
      if (status) result.stock_status = status;
      if (warehouseId) result.warehouse_id = warehouseId;
      if (categoryId) result.category_id = categoryId;
      if (asOf) result.as_of = asOf.format("YYYY-MM-DD");
    }
    if (report === "xnt") {
      if (keyword.trim()) result.keyword = keyword.trim();
      if (warehouseId) result.warehouse_id = warehouseId;
      if (categoryId) result.category_id = categoryId;
    }
    if (report === "document-history") {
      result.doc_type = docType;
      if (keyword.trim()) result.keyword = keyword.trim();
      if (status) result.status = status;
      if (agencyId) result.agency_id = agencyId;
    }
    if (report === "movement-trace") {
      if (keyword.trim()) result.code_value = keyword.trim();
      if (movementType) result.movement_type = movementType;
      if (warehouseId) result.warehouse_id = warehouseId;
    }
    if (report === "import-match") {
      if (keyword.trim()) result.keyword = keyword.trim();
      if (status) result.status = status;
      if (skuCode.trim()) result.sku_code = skuCode.trim();
    }
    if (report === "label-log") {
      if (keyword.trim()) result.keyword = keyword.trim();
      if (status) result.status = status;
      if (printerId) result.printer_id = printerId;
      if (actorId) result.actor_id = actorId;
    }
    if (report === "warranty") {
      if (status) result.status = status;
      // Axios mặc định serialize mảng thành defect_ids[]=a&defect_ids[]=b —
      // đúng dạng Laravel validate array; export POST gửi nguyên mảng JSON.
      if (defectIds.length > 0) result.defect_ids = defectIds;
      if (identification) result.identification_status = identification;
      if (keyword.trim()) result.model = keyword.trim();
    }
    if (report === "outbound-by-agency") {
      if (keyword.trim()) result.keyword = keyword.trim();
      if (agencyId) result.agency_id = agencyId;
    }
    return result;
  }, [
    report,
    config.dateFilter,
    from,
    to,
    keyword,
    status,
    warehouseId,
    agencyId,
    categoryId,
    printerId,
    actorId,
    skuCode,
    asOf,
    defectIds,
    identification,
    movementType,
    docType,
    page,
    perPage,
  ]);

  const query = useQuery({
    queryKey: ["flow06", report, params],
    queryFn: () => http.get<Raw>(config.endpoint, { params }),
    enabled: !isDefectSkuTab && (!config.dateFilter || !invalidPeriod),
    placeholderData: (previous) => previous,
  });

  const rows = rowsOf(query.data, config.rowsKey).map((row, index) => ({
    ...row,
    __rowKey:
      text(
        row.id ??
          row.outbound_no ??
          row.document_no ??
          row.import_no ??
          row.case_no,
        "",
      ) || `row-${index}`,
  }));
  const pagination = objectOf(query.data?.pagination);
  const total = n(pagination.total, rows.length);

  // --- Dữ liệu phụ cho biểu đồ Top-N / cơ cấu / xu hướng theo ngày. Các
  // report-level aggregate (by_defect, by_agency, by_sku, sku_type) đã được
  // BE tính đúng trên TOÀN BỘ tập lọc (không phân trang) nên chỉ cần đọc lại
  // từ query.data hoặc từ một truy vấn riêng KHÔNG kèm page/per_page — endpoint
  // chỉ cắt trang khi FE tự gửi per_page (paginateReport), nên bỏ hẳn tham số
  // đó là lấy được full dataset để Top-N không bị lệch theo trang hiện tại.
  const isInventoryTab = report === "inventory-balance";
  const isXntTab = report === "xnt";
  const isWarrantyTab = report === "warranty";

  const inventoryChartParams = useMemo<Raw>(() => {
    const result: Raw = {};
    if (keyword.trim()) result.keyword = keyword.trim();
    if (status) result.stock_status = status;
    if (warehouseId) result.warehouse_id = warehouseId;
    if (categoryId) result.category_id = categoryId;
    if (asOf) result.as_of = asOf.format("YYYY-MM-DD");
    return result;
  }, [keyword, status, warehouseId, categoryId, asOf]);
  const inventoryChartQuery = useQuery({
    queryKey: ["flow06-chart", "inventory-balance", inventoryChartParams],
    queryFn: () =>
      http.get<Raw>(CONFIG["inventory-balance"].endpoint, {
        params: inventoryChartParams,
      }),
    enabled: isInventoryTab,
    placeholderData: (previous) => previous,
  });
  const inventoryChartRows = rowsOf(inventoryChartQuery.data, "rows");
  const inventoryTopSku = [...inventoryChartRows]
    .sort((a, b) => n(b.available_qty) - n(a.available_qty))
    .slice(0, 10)
    .map((row) => ({
      label: text(row.product_code),
      value: n(row.available_qty),
    }));
  const SKU_TYPE_LABELS: Record<string, string> = {
    PRODUCT: "Thành phẩm",
    COMPONENT: "Linh kiện",
  };
  const inventoryTypeDonut = (() => {
    const totals = new Map<string, number>();
    inventoryChartRows.forEach((row) => {
      const rawType = text(row.sku_type, "");
      const key = SKU_TYPE_LABELS[rawType] ?? "Chưa phân loại";
      totals.set(key, (totals.get(key) ?? 0) + n(row.available_qty));
    });
    return [...totals.entries()]
      .filter(([, value]) => value > 0)
      .sort((a, b) => b[1] - a[1])
      .map(([label, value]) => ({ label, value }));
  })();

  const xntChartParams = useMemo<Raw>(() => {
    const result: Raw = { from_date: from, to_date: to };
    if (keyword.trim()) result.keyword = keyword.trim();
    if (warehouseId) result.warehouse_id = warehouseId;
    if (categoryId) result.category_id = categoryId;
    return result;
  }, [keyword, warehouseId, categoryId, from, to]);
  const xntChartQuery = useQuery({
    queryKey: ["flow06-chart", "xnt", xntChartParams],
    queryFn: () =>
      http.get<Raw>(CONFIG.xnt.endpoint, { params: xntChartParams }),
    enabled: isXntTab && !invalidPeriod,
    placeholderData: (previous) => previous,
  });
  const xntChartLines = rowsOf(xntChartQuery.data, "lines");
  const xntTopMovement = [...xntChartLines]
    .map((row) => ({
      label: text(row.product_code),
      receipt: n(row.receipt_net ?? row.receipt),
      issue:
        n(row.issue_net ?? row.issue) +
        n(row.component_issue_net ?? row.component_issue),
      opening: n(row.opening),
      closing: n(row.closing),
    }))
    .sort((a, b) => b.receipt + b.issue - (a.receipt + a.issue))
    .slice(0, 8);

  // GĐ1 Dashboard/Report "Top sản phẩm nhập/xuất" (BA 2026-08-27): by_product
  // đã gộp đúng theo SKU (bỏ chiều kho/stock_status), khác xntTopMovement ở
  // trên vốn lấy trực tiếp từng dòng lines[] nên 1 SKU có thể lặp lại nếu có
  // nhiều stock_status. Dùng cùng nguồn xntChartQuery, không gọi thêm API.
  const xntByProduct = rowsOf(xntChartQuery.data, "by_product").map((row) => ({
    label: text(row.product_name, text(row.product_code)),
    receipt: n(row.receipt_qty),
    issue: n(row.issue_qty),
  }));
  const xntTopIssue = [...xntByProduct]
    .sort((a, b) => b.issue - a.issue)
    .slice(0, 8)
    .map((row) => ({ label: row.label, value: row.issue }));
  const xntBottomIssue = xntByProduct
    .filter((row) => row.issue > 0)
    .sort((a, b) => a.issue - b.issue)
    .slice(0, 8)
    .map((row) => ({ label: row.label, value: row.issue }));
  const xntTopReceipt = [...xntByProduct]
    .sort((a, b) => b.receipt - a.receipt)
    .slice(0, 8)
    .map((row) => ({ label: row.label, value: row.receipt }));

  // RPT-XNT-02: chuỗi theo ngày (nguồn duy nhất có time-series thật) — dùng
  // cho cả 2 chart "Nhập/Xuất theo ngày" + "Tồn cuối theo ngày" VÀ cho 4 KPI
  // đầu tab, để KPI luôn khớp với đúng những gì 2 chart đang vẽ.
  const xntDailyParams = useMemo<Raw>(() => {
    const result: Raw = { from_date: from, to_date: to };
    if (keyword.trim()) result.keyword = keyword.trim();
    if (warehouseId) result.warehouse_id = warehouseId;
    if (categoryId) result.category_id = categoryId;
    return result;
  }, [keyword, warehouseId, categoryId, from, to]);
  const xntDailyQuery = useQuery({
    queryKey: ["flow06-chart", "xnt-daily", xntDailyParams],
    queryFn: () =>
      http.get<Raw>("/reports/inventory-xnt-daily", { params: xntDailyParams }),
    enabled: isXntTab && !invalidPeriod,
    placeholderData: (previous) => previous,
  });
  const xntDays = Array.isArray(xntDailyQuery.data?.days)
    ? (xntDailyQuery.data.days as Raw[])
    : [];
  const xntKpis = xntDays.reduce<{
    receipt: number;
    outbound: number;
    reversalNet: number;
    closing: number;
  }>(
    (acc, day) => ({
      receipt: acc.receipt + n(day.inbound_qty),
      outbound: acc.outbound + n(day.outbound_qty),
      reversalNet: acc.reversalNet + n(day.reversal_net),
      closing: n(day.closing_qty),
    }),
    { receipt: 0, outbound: 0, reversalNet: 0, closing: 0 },
  );

  const warrantyTopDefects = Array.isArray(query.data?.by_defect)
    ? (query.data.by_defect as Raw[])
        .map((row) => ({ label: text(row.defect), value: n(row.total) }))
        .sort((a, b) => b.value - a.value)
    : [];
  const warrantySummary = objectOf(query.data?.summary);
  const warrantyStatusDonut = (
    [
      {
        label: "Đang xử lý",
        value: n(warrantySummary.processing),
        color: CHART_COLORS.info,
      },
      {
        label: "Đã trả",
        value: n(warrantySummary.returned),
        color: CHART_COLORS.success,
      },
      {
        label: "Đã hủy",
        value: n(warrantySummary.cancelled),
        color: CHART_COLORS.danger,
      },
      {
        label: "Tiếp nhận tạm",
        value: n(warrantySummary.temp_only),
        color: CHART_COLORS.warning,
      },
    ] as Array<{ label: string; value: number; color: string }>
  ).filter((item) => item.value > 0);

  const warrantyComponentParams = useMemo<Raw>(
    () => ({
      from_date: from,
      to_date: to,
      defect_ids: defectIds.length > 0 ? defectIds : undefined,
    }),
    [from, to, defectIds],
  );
  const warrantyComponentQuery = useQuery({
    queryKey: [
      "flow06-chart",
      "warranty-component-usage",
      warrantyComponentParams,
    ],
    queryFn: () =>
      http.get<Raw>("/reports/warranty-component-usage", {
        params: warrantyComponentParams,
      }),
    enabled: isWarrantyTab && !invalidPeriod,
    placeholderData: (previous) => previous,
  });
  const warrantyComponentRows = rowsOf(warrantyComponentQuery.data, "rows");
  const warrantyComponentUsage = [...warrantyComponentRows]
    .map((row) => ({
      label: text(row.sku_code),
      value: n(row.total_issued_qty),
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);
  const warrantyComponentTotal = warrantyComponentRows.reduce(
    (sum, row) => sum + n(row.total_issued_qty),
    0,
  );

  const outboundTopSku = Array.isArray(query.data?.by_sku)
    ? (query.data.by_sku as Raw[])
        .map((row) => ({
          label: text(row.product_code),
          value: n(row.total_issued_qty),
        }))
        .sort((a, b) => b.value - a.value)
    : [];

  // --- Donut trạng thái cho 3 tab "chỉ bảng" — dùng đúng số liệu summary đã
  // fetch sẵn (không gọi thêm API), giúp thấy ngay cơ cấu thay vì phải cộng
  // nhẩm từ 4 con số rời rạc.
  const documentHistorySummary = objectOf(query.data?.summary);
  const documentHistoryDonut = (() => {
    const totalDocs = n(documentHistorySummary.total);
    const posted = n(documentHistorySummary.posted);
    const scanning = n(documentHistorySummary.scanning);
    const cancelled = n(documentHistorySummary.cancelled);
    const other = Math.max(0, totalDocs - posted - scanning - cancelled);
    return (
      [
        { label: "Đã ghi nhận", value: posted, color: CHART_COLORS.success },
        { label: "Đang quét", value: scanning, color: CHART_COLORS.info },
        { label: "Đã hủy", value: cancelled, color: CHART_COLORS.danger },
        { label: "Nháp / khác", value: other, color: CHART_COLORS.secondary },
      ] as Array<{ label: string; value: number; color: string }>
    ).filter((item) => item.value > 0);
  })();

  const importMatchSummary = objectOf(query.data?.summary);
  const importMatchDonut = (() => {
    const totalLines = n(importMatchSummary.total_lines);
    const matched = n(importMatchSummary.fully_matched_lines);
    const invalid = n(importMatchSummary.invalid_lines);
    const other = Math.max(0, totalLines - matched - invalid);
    return (
      [
        { label: "Khớp đủ", value: matched, color: CHART_COLORS.success },
        { label: "Dòng lỗi", value: invalid, color: CHART_COLORS.danger },
        {
          label: "Khớp một phần / đang xử lý",
          value: other,
          color: CHART_COLORS.warning,
        },
      ] as Array<{ label: string; value: number; color: string }>
    ).filter((item) => item.value > 0);
  })();

  const movementTypeDonut = Array.isArray(query.data?.by_movement_type)
    ? (query.data.by_movement_type as Raw[])
        .map((row) => ({
          label: businessLabel(MOVEMENT_LABELS, text(row.movement_type, "")),
          value: n(row.movement_count),
        }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value)
    : [];

  const labelLogSummary = objectOf(query.data?.summary);
  const labelLogDonut = (() => {
    const totalLabels = n(labelLogSummary.total_labels);
    const printed = n(labelLogSummary.printed);
    const failed = n(labelLogSummary.failed);
    const other = Math.max(0, totalLabels - printed - failed);
    return (
      [
        { label: "Đã in", value: printed, color: CHART_COLORS.success },
        { label: "In thất bại", value: failed, color: CHART_COLORS.danger },
        { label: "Chưa in", value: other, color: CHART_COLORS.secondary },
      ] as Array<{ label: string; value: number; color: string }>
    ).filter((item) => item.value > 0);
  })();

  const piiReasonTrimmed = piiReason.trim();
  const piiReasonInvalid =
    report === "warranty" &&
    canExportPii &&
    piiReasonTrimmed.length > 0 &&
    piiReasonTrimmed.length < PII_REASON_MIN_LENGTH;
  const exceedsExportRowLimit = total > EXPORT_ROW_LIMIT;

  const exportReport = async (format: "xlsx" | "pdf") => {
    if (config.dateFilter && invalidPeriod) return;
    if (piiReasonInvalid || exceedsExportRowLimit) return;
    setExporting(format);
    setExportDenied(null);
    try {
      assertWmsActionPermission(
        WMS_ACTION_PERMISSIONS.EXPORT_REPORT,
        "report export",
      );
      const { page: _page, per_page: _perPage, ...filters } = params;
      if (
        report === "warranty" &&
        canExportPii &&
        piiReasonTrimmed.length >= PII_REASON_MIN_LENGTH
      ) {
        filters.reason = piiReasonTrimmed;
      }

      const job = await http.post<Raw>(
        API_ENDPOINTS.REPORTS_EXPORT,
        { report_code: config.reportCode, format, filters },
        { headers: { "Idempotency-Key": createIdempotencyKey() } },
      );
      const jobId = text(job.export_job_id, "");
      if (!jobId) {
        throw new Error("Không nhận được export_job_id từ máy chủ.");
      }

      const finalStatus = await pollReportExportJob(jobId);
      if (finalStatus.status === "FAILED") {
        throw new Error(
          text(finalStatus.error_message, "Xuất báo cáo thất bại."),
        );
      }
      const downloadUrl = text(finalStatus.download_url, "");
      const { blob, fileName } = await http.downloadFile(
        downloadUrl ? stripApiPrefix(downloadUrl) : config.exportEndpoint,
        downloadUrl ? undefined : { params: { ...filters, format } },
      );
      const suffix = config.dateFilter ? `-${from}-${to}` : "";
      handleBlobDownload(
        blob,
        fileName ?? `${config.fileStem}${suffix}.${format}`,
      );
      toast.success(
        `Đã xuất ${format.toUpperCase()} theo đúng bộ lọc hiện tại (${fmt(finalStatus.row_count)} dòng).`,
      );
    } catch (error) {
      const message = getApiErrorMessage(error, "Xuất báo cáo thất bại.");
      if (isNoPermissionError(error)) setExportDenied(message);
      toast.error(message);
    } finally {
      setExporting(null);
    }
  };

  const agencyOptions: SelectOption[] = (agencies.data?.data ?? []).map(
    (row) => ({
      value: row.agency_id,
      label: `${row.agency_code} · ${row.agency_name}`,
    }),
  );
  const defectOptions: SelectOption[] = (defects.data?.data ?? []).map(
    (row) => ({ value: row.defect_id, label: row.defect_name }),
  );

  const statusOptions =
    report === "inventory-balance"
      ? ["AVAILABLE", "NON_SELLABLE", "DEFECTIVE", "QUARANTINE"]
      : report === "document-history"
        ? ["DRAFT", "SCANNING", "POSTED", "CANCELLED"]
        : report === "import-match"
          ? ["UPLOADED", "VALIDATED", "CONSUMED", "REJECTED"]
          : report === "label-log"
            ? ["PENDING_PRINT", "PRINTED", "PRINT_FAILED"]
            : report === "warranty"
              ? [
                  "RECEIVED",
                  "CHECKING",
                  "REPAIRING",
                  "COMPLETED",
                  "RETURNED",
                  "CANCELLED",
                ]
              : [];

  const statusOptionLabel = (value: string) =>
    report === "inventory-balance"
      ? businessLabel(INVENTORY_STOCK_STATUS_LABELS, value)
      : reportStatusLabel(value);

  // Bộ cột ĐẦY ĐỦ của tab đang xem — nguồn dữ liệu cho modal chi tiết.
  const allColumns = useMemo<ReportColumn[]>(
    () => [
      {
        title: "STT",
        key: "__stt",
        width: 64,
        fixed: "left",
        render: (_value: unknown, _row: Raw, index: number) =>
          mvpRowNumber(page, perPage, index),
      },
      ...columnsFor(report, canViewPii),
    ],
    [report, canViewPii, page, perPage],
  );

  // Ngoài bảng chỉ giữ cột thiết yếu + nút Xem (renderRowActions), để bảng
  // vừa khung không phải kéo ngang; phần còn lại xem trong modal chi tiết.
  const tableColumns = useMemo<ReportColumn[]>(
    () => primaryReportColumns(allColumns, report),
    [allColumns, report],
  );
  const { sortedRows, sortState, onSortChange } = useReportColumnSort(
    tableColumns,
    rows,
  );
  const responsiveColumns = toResponsiveColumns(tableColumns, sortedRows);
  const mainRowKey = (row: Raw) => text(row.__rowKey, "");
  const rowSelection = useRowSelection(rows, mainRowKey);

  const hasByAgency = Array.isArray(query.data?.by_agency);
  const byAgencyRows: Raw[] = hasByAgency
    ? (query.data?.by_agency as Raw[])
    : [];
  const byAgencyRawColumns: ReportColumn[] = [
    {
      title: "STT",
      key: "__stt",
      width: 64,
      fixed: "left",
      render: (_value: unknown, _row: Raw, index: number) =>
        mvpRowNumber(1, 1, index),
    },
    {
      title: "Mã nơi nhận",
      dataIndex: "agency_code",
      sorter: (a, b) =>
        text(a.agency_code, "").localeCompare(text(b.agency_code, ""), "vi"),
    },
    {
      title: "Nơi nhận",
      dataIndex: "agency_name",
      sorter: (a, b) =>
        text(a.agency_name, "").localeCompare(text(b.agency_name, ""), "vi"),
    },
    {
      title: "Số phiếu",
      dataIndex: "document_count",
      align: "right",
      sortType: "value",
      sorter: (a, b) => n(a.document_count) - n(b.document_count),
      render: fmt,
    },
    {
      title: "Tổng SL xuất",
      dataIndex: "total_issued_qty",
      align: "right",
      sortType: "value",
      sorter: (a, b) => n(a.total_issued_qty) - n(b.total_issued_qty),
      render: fmt,
    },
    {
      title: "Số SKU",
      dataIndex: "sku_count",
      align: "right",
      sortType: "value",
      sorter: (a, b) => n(a.sku_count) - n(b.sku_count),
      render: fmt,
    },
  ];
  const {
    sortedRows: byAgencySortedRows,
    sortState: byAgencySortState,
    onSortChange: onByAgencySortChange,
  } = useReportColumnSort(byAgencyRawColumns, byAgencyRows);
  const byAgencyColumns = toResponsiveColumns(
    byAgencyRawColumns,
    byAgencySortedRows,
  );
  const byAgencyRowKey = (row: Raw) => text(row.agency_code);
  const byAgencyRowSelection = useRowSelection(byAgencyRows, byAgencyRowKey);

  const tabItems = [
    ...(Object.keys(CONFIG) as GenericReportKey[]).map((key) => ({
      key,
      label: (
        <ReportTabLabel icon={CONFIG[key].icon} text={CONFIG[key].label} />
      ),
    })),
    {
      key: DEFECT_SKU_TAB_KEY,
      label: (
        <ReportTabLabel
          icon={<WarningOutlined style={{ fontSize: 15 }} />}
          text={DEFECT_SKU_TAB_LABEL}
        />
      ),
    },
  ];

  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-01"
      data-testid="wwhn-258-report-screen"
    >
      <Box sx={{ mb: 2 }}>
        <UiTabs
          value={report}
          aria-label="Nhóm báo cáo vận hành"
          items={tabItems}
          onChange={(key) => {
            setReport(key as ReportKey);
            setStatus(undefined);
            setKeyword("");
            setAgencyId(undefined);
            setPrinterId(undefined);
            setActorId(undefined);
            setCategoryId(undefined);
            setDefectIds([]);
            setIdentification(undefined);
            setMovementType(undefined);
            setSkuCode("");
            setAsOf(null);
            setPiiReason("");
            setExportDenied(null);
            setPage(1);
            rowSelection.clear();
            byAgencyRowSelection.clear();
          }}
        />
      </Box>

      {isDefectSkuTab ? (
        <UiTabPanel value={report}>
          <DefectSkuReport />
        </UiTabPanel>
      ) : (
        <UiTabPanel value={report}>
          <Box className="toolbar" sx={{ flexWrap: "wrap" }}>
            {config.dateFilter ? (
              <UiDateRangePicker
                value={period}
                aria-label="Khoảng thời gian"
                onChange={(value) => {
                  if (value?.[0] && value?.[1]) {
                    setPeriod([value[0], value[1]]);
                    resetPage();
                  }
                }}
              />
            ) : null}

            {[
              "inventory-balance",
              "xnt",
              "document-history",
              "movement-trace",
              "import-match",
              "label-log",
              "outbound-by-agency",
              "warranty",
            ].includes(report) ? (
              <SearchInput
                width={230}
                placeholder={
                  report === "movement-trace"
                    ? "Mã vật lý / mã vạch"
                    : report === "warranty"
                      ? "SKU / mẫu sản phẩm"
                      : "Từ khóa"
                }
                aria-label={
                  report === "movement-trace"
                    ? "Mã vật lý / mã vạch"
                    : report === "warranty"
                      ? "SKU / mẫu sản phẩm"
                      : "Từ khóa"
                }
                value={keyword}
                onChange={(value) => {
                  setKeyword(value);
                  resetPage();
                }}
              />
            ) : null}

            {statusOptions.length ? (
              <UiSelect
                minWidth={190}
                placeholder="Trạng thái"
                aria-label="Trạng thái"
                value={status ?? ""}
                onChange={(value) => {
                  setStatus(value || undefined);
                  resetPage();
                }}
                options={statusOptions.map((value) => ({
                  value,
                  label: statusOptionLabel(value),
                }))}
              />
            ) : null}

            {["inventory-balance", "xnt", "movement-trace"].includes(report) ? (
              <UiSelect
                minWidth={210}
                placeholder="Kho"
                aria-label="Kho"
                value={warehouseId ?? ""}
                options={warehouses.options}
                onChange={(value) => {
                  setWarehouseId(value || undefined);
                  resetPage();
                }}
              />
            ) : null}

            {report === "inventory-balance" ? (
              <UiDatePicker
                placeholder="Chốt số liệu tại ngày"
                aria-label="Chốt số liệu tại ngày"
                value={asOf}
                onChange={(value) => {
                  setAsOf(value);
                  resetPage();
                }}
              />
            ) : null}

            {report === "import-match" ? (
              <UiTextField
                sx={{ width: 180 }}
                placeholder="Mã SKU"
                slotProps={{ htmlInput: { "aria-label": "Mã SKU" } }}
                value={skuCode}
                onChange={(event) => {
                  setSkuCode(event.target.value);
                  resetPage();
                }}
              />
            ) : null}

            {report === "inventory-balance" || report === "xnt" ? (
              <UiSelect
                minWidth={210}
                placeholder="Nhóm hàng"
                aria-label="Nhóm hàng"
                value={categoryId ?? ""}
                options={categories.options}
                onChange={(value) => {
                  setCategoryId(value || undefined);
                  resetPage();
                }}
              />
            ) : null}

            {report === "document-history" ? (
              <UiSelect
                minWidth={150}
                aria-label="Loại phiếu"
                value={docType}
                onChange={(value) => {
                  setDocType(value as "all" | "inbound" | "outbound");
                  resetPage();
                }}
                options={[
                  { value: "all", label: "Tất cả phiếu" },
                  { value: "inbound", label: "Phiếu nhập" },
                  { value: "outbound", label: "Phiếu xuất" },
                ]}
              />
            ) : null}

            {report === "movement-trace" ? (
              <UiSelect
                minWidth={190}
                placeholder="Loại biến động"
                aria-label="Loại biến động"
                value={movementType ?? ""}
                onChange={(value) => {
                  setMovementType(value || undefined);
                  resetPage();
                }}
                options={[
                  "OPENING",
                  "RECEIPT",
                  "ISSUE",
                  "COMPONENT_ISSUE",
                  "REVERSAL",
                ].map((value) => ({
                  value,
                  label: businessLabel(MOVEMENT_LABELS, value),
                }))}
              />
            ) : null}

            {report === "label-log" ? (
              <>
                <UiSelect
                  minWidth={210}
                  placeholder="Máy in"
                  aria-label="Máy in"
                  value={printerId ?? ""}
                  options={printers.options}
                  onChange={(value) => {
                    setPrinterId(value || undefined);
                    resetPage();
                  }}
                />
                <UiSelect
                  minWidth={200}
                  placeholder="Người in"
                  aria-label="Người in"
                  value={actorId ?? ""}
                  options={actors.options}
                  onChange={(value) => {
                    setActorId(value || undefined);
                    resetPage();
                  }}
                />
              </>
            ) : null}

            {report === "warranty" ? (
              <>
                <MultiSelectFilter
                  minWidth={210}
                  placeholder="Bệnh / lỗi (chọn được nhiều)"
                  ariaLabel="Bệnh / lỗi"
                  value={defectIds}
                  options={defectOptions}
                  onChange={(value) => {
                    setDefectIds(value);
                    resetPage();
                  }}
                />
                <UiSelect
                  minWidth={220}
                  placeholder="Nhận diện"
                  aria-label="Nhận diện"
                  value={identification ?? ""}
                  options={[
                    {
                      value: "IDENTIFIED",
                      label: WARRANTY_IDENTIFICATION_STATUS_LABELS.IDENTIFIED,
                    },
                    {
                      value: "TEMP_ONLY",
                      label: WARRANTY_IDENTIFICATION_STATUS_LABELS.TEMP_ONLY,
                    },
                  ]}
                  onChange={(value) => {
                    setIdentification(value || undefined);
                    resetPage();
                  }}
                />
              </>
            ) : null}

            {report === "outbound-by-agency" ||
            report === "document-history" ? (
              <UiSelect
                minWidth={230}
                placeholder="Nơi nhận"
                aria-label="Nơi nhận"
                value={agencyId ?? ""}
                options={agencyOptions}
                onChange={(value) => {
                  setAgencyId(value || undefined);
                  resetPage();
                }}
              />
            ) : null}

            {report === "warranty" && canExportPii ? (
              <UiTextField
                sx={{ width: 260 }}
                error={piiReasonInvalid}
                placeholder={`Lý do xuất PII (≥ ${PII_REASON_MIN_LENGTH} ký tự; bỏ trống = che thông tin)`}
                slotProps={{
                  htmlInput: {
                    maxLength: 500,
                    "data-testid": "report-pii-reason",
                    "aria-label": "Lý do xuất dữ liệu PII",
                  },
                }}
                value={piiReason}
                onChange={(event) => setPiiReason(event.target.value)}
              />
            ) : null}

            <MvpPageSizeSelector
              value={perPage}
              onChange={(value) => {
                setPerPage(value);
                setPage(1);
              }}
            />
            <div className="spacer" />
            <ActionButton
              kind="exportExcel"
              module="reports"
              action="export"
              permissionCode="REPORT_EXPORT"
              mode="disable"
              loading={exporting === "xlsx"}
              disabled={
                Boolean(exporting) ||
                query.isLoading ||
                (config.dateFilter && invalidPeriod) ||
                piiReasonInvalid ||
                exceedsExportRowLimit
              }
              onClick={() => exportReport("xlsx")}
              disabledTooltip="Bạn cần quyền xuất báo cáo và bộ lọc hợp lệ"
            >
              Xuất XLSX
            </ActionButton>
            <ActionButton
              kind="exportPdf"
              module="reports"
              action="export"
              permissionCode="REPORT_EXPORT"
              mode="disable"
              loading={exporting === "pdf"}
              disabled={
                Boolean(exporting) ||
                query.isLoading ||
                (config.dateFilter && invalidPeriod) ||
                piiReasonInvalid ||
                exceedsExportRowLimit
              }
              onClick={() => exportReport("pdf")}
              disabledTooltip="Bạn cần quyền xuất báo cáo và bộ lọc hợp lệ"
            >
              Xuất PDF
            </ActionButton>
          </Box>

          {invalidPeriod && config.dateFilter ? (
            <Box sx={{ mb: 1.5 }}>
              <UiAlert tone="error">
                Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.
              </UiAlert>
            </Box>
          ) : null}
          {report === "warranty" ? (
            <Box sx={{ mb: 1.5 }}>
              <UiAlert tone="info">
                {canExportPii
                  ? `Khách hàng/SĐT/địa chỉ hiển thị ở dạng đã che. Tệp xuất chỉ chứa PII thô khi bạn nhập lý do (≥ ${PII_REASON_MIN_LENGTH} ký tự); mọi lần xuất đều được ghi nhật ký.`
                  : "Khách hàng/SĐT/địa chỉ hiển thị ở dạng đã che. Tài khoản của bạn không có quyền xuất PII nên tệp xuất luôn che thông tin; cần PII thô hãy liên hệ quản trị để được cấp quyền."}
              </UiAlert>
            </Box>
          ) : null}
          {piiReasonInvalid ? (
            <Box sx={{ mb: 1.5 }}>
              <UiAlert tone="warning">
                {`Lý do xuất PII phải có ít nhất ${PII_REASON_MIN_LENGTH} ký tự. Bỏ trống nếu chỉ cần tệp đã che thông tin.`}
              </UiAlert>
            </Box>
          ) : null}
          {exceedsExportRowLimit ? (
            <div
              {...uiStateProps(UI_STATE.DISABLED, "report-export-row-limit")}
            >
              <Box sx={{ mb: 1.5 }}>
                <UiAlert tone="warning">
                  {`Bộ lọc hiện tại có ${fmt(total)} dòng — vượt giới hạn ${fmt(EXPORT_ROW_LIMIT)} dòng mỗi tệp. Thu hẹp khoảng ngày hoặc bộ lọc trước khi xuất.`}
                </UiAlert>
              </Box>
            </div>
          ) : null}
          {exportDenied ? (
            <div
              {...uiStateProps(
                UI_STATE.PERMISSION_DENIED,
                "report-export-permission-denied",
              )}
              role="alert"
            >
              <Box sx={{ mb: 1.5 }}>
                <UiAlert
                  tone="error"
                  title="Xuất báo cáo bị từ chối quyền."
                  onClose={() => setExportDenied(null)}
                >
                  {exportDenied}
                </UiAlert>
              </Box>
            </div>
          ) : null}
          {query.data?.data_scope === "WAREHOUSE_SCOPED" ? (
            <Box sx={{ mb: 1.5 }}>
              <UiAlert tone="info">
                {`Số liệu đã giới hạn theo phạm vi kho của tài khoản (${
                  Array.isArray(query.data.scope_warehouse_ids)
                    ? query.data.scope_warehouse_ids.length
                    : 0
                } kho). Đây không phải tổng toàn hệ thống; tệp xuất dùng đúng phạm vi này.`}
              </UiAlert>
            </Box>
          ) : null}
          {report === "inventory-balance" && query.data?.as_of_snapshot ? (
            <Box sx={{ mb: 1.5 }}>
              <UiAlert tone="warning">
                {`Đang xem ảnh chụp theo sổ tồn kho tại ${text(query.data.as_of)}. Cột "Tồn kho" là số dư tại mốc đó, nên đối soát sổ tồn kho với số dư hiện tại không áp dụng.`}
              </UiAlert>
            </Box>
          ) : null}
          {report === "document-history" ? (
            <Box sx={{ mb: 1.5 }}>
              <UiAlert tone="info">
                Bấm "Xem" trên từng phiếu để xem tầng dòng: kế hoạch / đã quét /
                đã ghi nhận. Số đã ghi nhận lấy từ biến động tồn kho chính thức.
              </UiAlert>
            </Box>
          ) : null}
          {report === "outbound-by-agency" ? (
            <Box sx={{ mb: 1.5 }}>
              <UiAlert tone="info">
                Nơi nhận chỉ là chiều báo cáo, không phải một nhóm tồn kho
                riêng.
              </UiAlert>
            </Box>
          ) : null}
          {report === "label-log" ? (
            <Box sx={{ mb: 1.5 }}>
              <UiAlert tone="success">
                Quy tắc hiện hành: đúng 01 nhãn đóng gói cho mỗi phiếu/lô xuất.
              </UiAlert>
            </Box>
          ) : null}

          <Summary report={report} data={query.data} />

          {report === "inventory-balance" ? (
            <ReportChartGrid>
              <ReportChartPanel
                title="Top SKU có tồn khả dụng cao nhất"
                description="Xếp hạng theo số lượng khả dụng, trên toàn bộ tập lọc hiện tại."
              >
                {inventoryChartQuery.isLoading ? null : inventoryTopSku.length ===
                  0 ? (
                  <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                ) : (
                  <HorizontalBarChart
                    items={inventoryTopSku}
                    valueFormatter={fmt}
                  />
                )}
              </ReportChartPanel>
              <ReportChartPanel
                title="Cơ cấu tồn theo loại"
                description="So sánh tồn khả dụng giữa hàng thành phẩm và linh kiện rời."
              >
                {inventoryChartQuery.isLoading ? null : inventoryTypeDonut.length ===
                  0 ? (
                  <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                ) : (
                  <DonutChart
                    items={inventoryTypeDonut}
                    centerLabel="Tồn khả dụng"
                    valueFormatter={fmt}
                  />
                )}
              </ReportChartPanel>
            </ReportChartGrid>
          ) : null}

          {report === "xnt" ? (
            <>
              <ReportKpiGrid>
                <ReportKpiCard
                  label="Tổng nhập trong kỳ"
                  value={fmt(xntKpis.receipt)}
                  tone="info"
                  hint="Theo chuỗi ngày, trên toàn bộ tập lọc"
                />
                <ReportKpiCard
                  label="Tổng xuất trong kỳ"
                  value={fmt(xntKpis.outbound)}
                  tone="warning"
                  hint="Xuất hàng hóa + xuất linh kiện"
                />
                <ReportKpiCard
                  label="Reversal (ròng)"
                  value={fmt(xntKpis.reversalNet)}
                  tone={xntKpis.reversalNet < 0 ? "error" : "success"}
                  hint="Đối ứng phát sinh trong kỳ"
                />
                <ReportKpiCard
                  label="Tồn cuối kỳ"
                  value={fmt(xntKpis.closing)}
                  tone="primary"
                  hint="Tại ngày cuối kỳ đã chọn"
                />
              </ReportKpiGrid>
              <ReportChartGrid>
                <ReportChartPanel
                  title="Nhập / Xuất theo ngày"
                  description="Tổng lượng phát sinh mỗi ngày trong kỳ đã chọn."
                >
                  {xntDailyQuery.isLoading ? null : xntDays.length === 0 ? (
                    <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                  ) : (
                    <BarChart
                      categories={xntDays.map((day) => fmtDate(day.date))}
                      series={[
                        {
                          name: "Nhập",
                          data: xntDays.map((day) => n(day.inbound_qty)),
                          color: CHART_COLORS.primary,
                        },
                        {
                          name: "Xuất",
                          data: xntDays.map((day) => n(day.outbound_qty)),
                          color: CHART_COLORS.secondary,
                        },
                      ]}
                      valueFormatter={fmt}
                    />
                  )}
                </ReportChartPanel>
                <ReportChartPanel
                  title="Tồn cuối theo ngày"
                  description="Số dư luỹ kế cuối mỗi ngày trong kỳ đã chọn."
                >
                  {xntDailyQuery.isLoading ? null : xntDays.length === 0 ? (
                    <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                  ) : (
                    <AreaChart
                      categories={xntDays.map((day) => fmtDate(day.date))}
                      data={xntDays.map((day) => n(day.closing_qty))}
                      name="Tồn cuối"
                      valueFormatter={fmt}
                    />
                  )}
                </ReportChartPanel>
              </ReportChartGrid>
              <ReportChartGrid>
                <ReportChartPanel
                  title="Nhập / Xuất theo SKU"
                  description="Top SKU có tổng phát sinh nhập + xuất (thuần) cao nhất trong kỳ."
                >
                  {xntChartQuery.isLoading ? null : xntTopMovement.length ===
                    0 ? (
                    <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                  ) : (
                    <BarChart
                      categories={xntTopMovement.map((row) => row.label)}
                      series={[
                        {
                          name: "Nhập",
                          data: xntTopMovement.map((row) => row.receipt),
                          color: CHART_COLORS.primary,
                        },
                        {
                          name: "Xuất",
                          data: xntTopMovement.map((row) => row.issue),
                          color: CHART_COLORS.warning,
                        },
                      ]}
                      valueFormatter={fmt}
                    />
                  )}
                </ReportChartPanel>
                <ReportChartPanel
                  title="Tồn đầu / Tồn cuối theo SKU"
                  description="So sánh tồn đầu kỳ và tồn cuối kỳ của các SKU biến động nhiều nhất."
                >
                  {xntChartQuery.isLoading ? null : xntTopMovement.length ===
                    0 ? (
                    <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                  ) : (
                    <BarChart
                      categories={xntTopMovement.map((row) => row.label)}
                      series={[
                        {
                          name: "Tồn đầu kỳ",
                          data: xntTopMovement.map((row) => row.opening),
                          color: CHART_COLORS.secondary,
                        },
                        {
                          name: "Tồn cuối kỳ",
                          data: xntTopMovement.map((row) => row.closing),
                          color: CHART_COLORS.primary,
                        },
                      ]}
                      valueFormatter={fmt}
                    />
                  )}
                </ReportChartPanel>
              </ReportChartGrid>
              <ReportChartGrid>
                <ReportChartPanel
                  title="Top SP xuất nhiều nhất"
                  description="SKU có tổng SL xuất (net) cao nhất trong kỳ, gộp trên toàn bộ tập lọc."
                >
                  {xntChartQuery.isLoading ? null : xntTopIssue.length === 0 ? (
                    <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                  ) : (
                    <HorizontalBarChart
                      items={xntTopIssue}
                      valueFormatter={fmt}
                    />
                  )}
                </ReportChartPanel>
                <ReportChartPanel
                  title="Top SP nhập nhiều nhất"
                  description="SKU có tổng SL nhập (net) cao nhất trong kỳ, gộp trên toàn bộ tập lọc."
                >
                  {xntChartQuery.isLoading ? null : xntTopReceipt.length ===
                    0 ? (
                    <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                  ) : (
                    <HorizontalBarChart
                      items={xntTopReceipt}
                      valueFormatter={fmt}
                    />
                  )}
                </ReportChartPanel>
              </ReportChartGrid>
              <Box sx={{ mb: 2 }}>
                <ReportChartPanel
                  title="Top SP xuất ít nhất"
                  description="SKU có phát sinh xuất (>0) nhưng SL xuất thấp nhất trong kỳ — SKU không phát sinh xuất không tính vào đây."
                >
                  {xntChartQuery.isLoading ? null : xntBottomIssue.length ===
                    0 ? (
                    <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                  ) : (
                    <HorizontalBarChart
                      items={xntBottomIssue}
                      valueFormatter={fmt}
                    />
                  )}
                </ReportChartPanel>
              </Box>
            </>
          ) : null}

          {report === "warranty" ? (
            <>
              <Box sx={{ marginBottom: 2 }}>
                <ReportChartPanel
                  title="Cơ cấu trạng thái ca bảo hành"
                  description="Theo số liệu tóm tắt của bộ lọc hiện tại."
                >
                  {warrantyStatusDonut.length === 0 ? (
                    <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                  ) : (
                    <DonutBreakdown
                      items={warrantyStatusDonut}
                      centerLabel="Ca bảo hành"
                      valueFormatter={fmt}
                    />
                  )}
                </ReportChartPanel>
              </Box>
              <ReportChartGrid>
                <ReportChartPanel
                  title="Top bệnh/lỗi theo số ca"
                  description="Đếm distinct case theo bệnh/lỗi (một case nhiều lỗi được tính vào mỗi bệnh/lỗi)."
                >
                  {warrantyTopDefects.length === 0 ? (
                    <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                  ) : (
                    <HorizontalBarChart
                      items={warrantyTopDefects}
                      valueFormatter={fmt}
                    />
                  )}
                </ReportChartPanel>
                <ReportChartPanel
                  title="Top linh kiện sử dụng"
                  description={`Tổng linh kiện đã xuất (POSTED) trong kỳ: ${fmt(warrantyComponentTotal)} đơn vị.`}
                >
                  {warrantyComponentQuery.isLoading ? null : warrantyComponentUsage.length ===
                    0 ? (
                    <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                  ) : (
                    <HorizontalBarChart
                      items={warrantyComponentUsage}
                      valueFormatter={fmt}
                    />
                  )}
                </ReportChartPanel>
              </ReportChartGrid>
            </>
          ) : null}

          {report === "outbound-by-agency" ? (
            <ReportChartGrid>
              <ReportChartPanel
                title="Top nơi nhận theo SL xuất"
                description="Theo dữ liệu tổng hợp trả về cùng báo cáo (không phụ thuộc phân trang)."
              >
                {byAgencyRows.length > 0 ? (
                  <HorizontalBarChart
                    items={byAgencyRows.map((row) => ({
                      label: text(row.agency_name),
                      value: n(row.total_issued_qty),
                    }))}
                    valueFormatter={fmt}
                  />
                ) : (
                  <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                )}
              </ReportChartPanel>
              <ReportChartPanel
                title="Top SKU xuất ròng"
                description="Theo dữ liệu tổng hợp trả về cùng báo cáo (không phụ thuộc phân trang)."
              >
                {outboundTopSku.length === 0 ? (
                  <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                ) : (
                  <HorizontalBarChart
                    items={outboundTopSku}
                    valueFormatter={fmt}
                  />
                )}
              </ReportChartPanel>
            </ReportChartGrid>
          ) : null}

          {report === "movement-trace" ? (
            <Box sx={{ marginBottom: 2 }}>
              <ReportChartPanel
                title="Cơ cấu biến động theo loại"
                description="Đếm số dòng biến động theo movement_type, trên toàn bộ tập lọc (không phụ thuộc phân trang)."
              >
                {movementTypeDonut.length === 0 ? (
                  <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                ) : (
                  <DonutBreakdown
                    items={movementTypeDonut}
                    centerLabel="Biến động"
                    valueFormatter={fmt}
                  />
                )}
              </ReportChartPanel>
            </Box>
          ) : null}

          {report === "document-history" ? (
            <Box sx={{ marginBottom: 2 }}>
              <ReportChartPanel
                title="Cơ cấu trạng thái phiếu"
                description="Theo số liệu tóm tắt của bộ lọc hiện tại."
              >
                {documentHistoryDonut.length === 0 ? (
                  <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                ) : (
                  <DonutBreakdown
                    items={documentHistoryDonut}
                    centerLabel="Tổng phiếu"
                    valueFormatter={fmt}
                  />
                )}
              </ReportChartPanel>
            </Box>
          ) : null}

          {report === "import-match" ? (
            <Box sx={{ marginBottom: 2 }}>
              <ReportChartPanel
                title="Cơ cấu kết quả đối soát theo dòng toa"
                description="Theo số liệu tóm tắt của bộ lọc hiện tại."
              >
                {importMatchDonut.length === 0 ? (
                  <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                ) : (
                  <DonutBreakdown
                    items={importMatchDonut}
                    centerLabel="Tổng dòng"
                    valueFormatter={fmt}
                  />
                )}
              </ReportChartPanel>
            </Box>
          ) : null}

          {report === "label-log" ? (
            <Box sx={{ marginBottom: 2 }}>
              <ReportChartPanel
                title="Cơ cấu trạng thái in nhãn"
                description="Theo số liệu tóm tắt của bộ lọc hiện tại."
              >
                {labelLogDonut.length === 0 ? (
                  <EmptyState description="Chưa có dữ liệu để vẽ biểu đồ" />
                ) : (
                  <DonutBreakdown
                    items={labelLogDonut}
                    centerLabel="Tổng nhãn"
                    valueFormatter={fmt}
                  />
                )}
              </ReportChartPanel>
            </Box>
          ) : null}

          {query.isError ? (
            <Box sx={{ mb: 1.5 }}>
              <ApiErrorAlert
                error={query.error}
                title={`Không tải được ${config.label}`}
                onRetry={() => query.refetch()}
              />
            </Box>
          ) : null}

          <TableLoadingBanner loading={query.isLoading || query.isFetching} />
          <ResponsiveDataTable<Raw>
            columns={responsiveColumns}
            rows={sortedRows}
            rowKey={mainRowKey}
            rowSelection={rowSelection}
            // Chỉ khoá bảng khi tải lần đầu — isFetching đã có TableLoadingBanner
            // phía trên báo, tránh bảng trắng xoá mỗi lần đổi trang/lọc.
            loading={query.isLoading}
            sortState={sortState}
            onSortChange={onSortChange}
            emptyText={tableEmptyText(
              query.isError ? query.error : null,
              "Không có dữ liệu theo bộ lọc",
            )}
            renderRowActions={(row) => (
              <ActionButton
                kind="view"
                aria-label="Xem chi tiết dòng báo cáo"
                sx={{ whiteSpace: "nowrap" }}
                onClick={() =>
                  setDetailRow({ row, index: sortedRows.indexOf(row) })
                }
              />
            )}
          />
          <Box sx={{ mt: 1.5 }}>
            <UiPagination
              page={n(pagination.current_page, page)}
              pageSize={n(pagination.per_page, perPage)}
              total={total}
              onPageChange={(next) => setPage(next)}
            />
          </Box>

          {report === "outbound-by-agency" && hasByAgency ? (
            <Box sx={{ mt: 2 }}>
              <ResponsiveDataTable<Raw>
                columns={byAgencyColumns}
                rows={byAgencySortedRows}
                rowKey={byAgencyRowKey}
                rowSelection={byAgencyRowSelection}
                sortState={byAgencySortState}
                onSortChange={onByAgencySortChange}
                emptyText="Không có dữ liệu"
              />
            </Box>
          ) : null}

          {detailRow ? (
            <ReportRowDetailModal
              title={`Chi tiết — ${config.label}`}
              columns={allColumns}
              row={detailRow.row}
              rowIndex={detailRow.index}
              onClose={() => setDetailRow(null)}
            />
          ) : null}
        </UiTabPanel>
      )}
    </div>
  );
}
