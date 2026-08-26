import { useMemo, useState, type Key } from "react";
import {
  Alert,
  Card,
  DatePicker,
  Empty,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
  Typography,
  type TableColumnsType,
} from "antd";
import {
  DownloadOutlined,
  FilePdfOutlined,
  SearchOutlined,
} from "@ant-design/icons";
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
import { ActionButton } from "@/shared/components/permission/ActionButton";
import { useHasPermission } from "@/shared/components/permission";
import { warrantyPiiText } from "@/modules/warranty/constants";
import { fetchWarehouses } from "@/modules/master-data/services/warehouse.service";
import {
  useMvpAgencies,
  useMvpDefects,
} from "@/modules/master-data/hooks/use-mvp-master";
import { fetchPrinterConfigs } from "@/modules/outbound/services/mvpOutboundService";
import { formatDate, formatDateTime } from "@/shared/utils/format-date";

const { Text } = Typography;

type Raw = Record<string, unknown>;
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

type SelectOption = { value: string; label: string };

const PII_REASON_MIN_LENGTH = 5;
const EXPORT_ROW_LIMIT = 10000;

type ReportConfig = {
  label: string;
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
    endpoint: API_ENDPOINTS.REPORTS_INVENTORY_BALANCE,
    exportEndpoint: API_ENDPOINTS.REPORTS_INVENTORY_BALANCE_EXPORT_EXCEL,
    fileStem: "bao-cao-ton-kho-hien-tai",
    reportCode: "inventory-balance",
  },
  xnt: {
    label: "Nhập-Xuất-Tồn",
    endpoint: API_ENDPOINTS.REPORTS_XNT_ENHANCED,
    exportEndpoint: API_ENDPOINTS.REPORTS_XNT_ENHANCED_EXPORT_EXCEL,
    rowsKey: "lines",
    fileStem: "bao-cao-xnt",
    dateFilter: true,
    reportCode: "inventory-xnt",
  },
  "document-history": {
    label: "Lịch sử nhập/xuất",
    endpoint: API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY,
    exportEndpoint: API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY_EXPORT_EXCEL,
    fileStem: "lich-su-phieu",
    dateFilter: true,
    reportCode: "document-history",
  },
  "movement-trace": {
    label: "Biến động / Truy vết",
    endpoint: API_ENDPOINTS.REPORTS_MOVEMENT_TRACE,
    exportEndpoint: API_ENDPOINTS.REPORTS_MOVEMENT_TRACE_EXPORT_EXCEL,
    fileStem: "movement-trace",
    dateFilter: true,
    reportCode: "movement-trace",
  },
  "import-match": {
    label: "Đối soát toa",
    endpoint: API_ENDPOINTS.REPORTS_IMPORT_MATCH,
    exportEndpoint: API_ENDPOINTS.REPORTS_IMPORT_MATCH_EXPORT_EXCEL,
    fileStem: "doi-soat-toa",
    dateFilter: true,
    reportCode: "import-match",
  },
  "label-log": {
    label: "Nhật ký nhãn đóng gói",
    endpoint: API_ENDPOINTS.REPORTS_LABEL_LOG,
    exportEndpoint: API_ENDPOINTS.REPORTS_LABEL_LOG_EXPORT_EXCEL,
    fileStem: "packing-label-log",
    dateFilter: true,
    reportCode: "label-log",
  },
  warranty: {
    label: "Bảo hành & linh kiện",
    endpoint: API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS,
    exportEndpoint: API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS_EXPORT_EXCEL,
    fileStem: "bao-cao-bao-hanh",
    dateFilter: true,
    reportCode: "warranty-defects",
  },
  "outbound-by-agency": {
    label: "Xuất theo nơi nhận",
    endpoint: API_ENDPOINTS.REPORTS_OUTBOUND_BY_AGENCY,
    exportEndpoint: API_ENDPOINTS.REPORTS_OUTBOUND_BY_AGENCY_EXPORT_EXCEL,
    fileStem: "xuat-theo-noi-nhan",
    dateFilter: true,
    reportCode: "outbound-by-agency",
  },
};

const DEFECT_SKU_TAB_KEY = "defect-sku" as const;
const DEFECT_SKU_TAB_LABEL = "Bệnh lỗi theo SKU";

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
  VALIDATED: "processing",
  PENDING_PRINT: "processing",
  RECEIVED: "processing",
  CHECKING: "processing",
  REPAIRING: "processing",
  CANCELLED: "error",
  REJECTED: "error",
  PRINT_FAILED: "error",
};

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

function rowsOf(data: Raw | undefined, key: "rows" | "lines" = "rows"): Raw[] {
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

function columnsFor(
  report: ReportKey,
  canViewPii: boolean,
): TableColumnsType<Raw> {
  switch (report) {
    case "inventory-balance":
      return [
        { title: "Kho", dataIndex: "warehouse_code", width: 100 },
        {
          title: "Mã SKU",
          dataIndex: "product_code",
          width: 140,
          fixed: "left",
        },
        { title: "Tên SKU", dataIndex: "product_name", width: 220 },
        { title: "Nhóm hàng", dataIndex: "category", width: 140 },
        {
          title: "Trạng thái",
          dataIndex: "stock_status",
          width: 150,
          render: (value) => <Tag>{stockStatusLabel(value)}</Tag>,
        },
        {
          title: "Tồn kho",
          dataIndex: "on_hand_qty",
          align: "right",
          render: fmt,
        },
        {
          title: "Khả dụng",
          dataIndex: "available_qty",
          align: "right",
          render: fmt,
        },
        {
          title: "Số sê-ri",
          dataIndex: "serial_qty",
          align: "right",
          render: fmt,
        },
        {
          title: "Trong khay/thùng",
          dataIndex: "box_qty",
          align: "right",
          render: fmt,
        },
        { title: "Vị trí gợi ý", dataIndex: "location_hint", width: 150 },
        {
          title: "Sổ tồn kho",
          dataIndex: "ledger_qty",
          align: "right",
          render: fmt,
        },
        {
          title: "Chênh lệch",
          dataIndex: "variance",
          align: "right",
          render: (v) => (n(v) === 0 ? "0" : <Tag color="error">{fmt(v)}</Tag>),
        },
        {
          title: "Đối soát",
          dataIndex: "reconciliation_status",
          width: 150,
          render: (v) => {
            const status = text(v, "");
            const color =
              status === "MATCH"
                ? "success"
                : status === "NOT_APPLICABLE"
                  ? "default"
                  : "error";
            return (
              <Tag color={color}>{businessLabel(RECONCILE_LABELS, status)}</Tag>
            );
          },
        },
        {
          title: "Cập nhật",
          dataIndex: "updated_at",
          width: 170,
          render: fmtDateTime,
        },
      ];
    case "xnt":
      return [
        { title: "Kho", dataIndex: "warehouse_code", width: 100 },
        {
          title: "Mã SKU",
          dataIndex: "product_code",
          width: 140,
          fixed: "left",
        },
        { title: "Tên SKU", dataIndex: "product_name", width: 210 },
        {
          title: "Trạng thái tồn",
          dataIndex: "stock_status",
          width: 140,
          render: (value) => stockStatusLabel(value),
        },
        { title: "Đầu kỳ", dataIndex: "opening", align: "right", render: fmt },
        {
          title: "Nhập",
          children: [
            {
              title: "Tổng phát sinh",
              dataIndex: "receipt_gross",
              align: "right",
              render: (_: unknown, row: Raw) =>
                fmt(row.receipt_gross ?? row.receipt),
            },
            {
              title: "Đã đảo",
              dataIndex: "receipt_reversal",
              align: "right",
              render: fmt,
            },
            {
              title: "Thuần",
              dataIndex: "receipt_net",
              align: "right",
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
              render: (_: unknown, row: Raw) =>
                fmt(row.issue_gross ?? row.issue),
            },
            {
              title: "Đã đảo",
              dataIndex: "issue_reversal",
              align: "right",
              render: fmt,
            },
            {
              title: "Thuần",
              dataIndex: "issue_net",
              align: "right",
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
              render: (_: unknown, row: Raw) =>
                fmt(row.component_issue_gross ?? row.component_issue),
            },
            {
              title: "Đã đảo",
              dataIndex: "component_issue_reversal",
              align: "right",
              render: fmt,
            },
            {
              title: "Thuần",
              dataIndex: "component_issue_net",
              align: "right",
              render: (_: unknown, row: Raw) =>
                fmt(row.component_issue_net ?? row.component_issue),
            },
          ],
        },
        {
          title: "Điều chỉnh thuần",
          dataIndex: "reversal_net",
          align: "right",
          render: fmt,
        },
        { title: "Cuối kỳ", dataIndex: "closing", align: "right", render: fmt },
      ];
    case "document-history":
      return [
        {
          title: "Số phiếu",
          dataIndex: "document_no",
          width: 160,
          fixed: "left",
        },
        {
          title: "Loại",
          dataIndex: "doc_type",
          width: 120,
          render: (value) =>
            businessLabel(SOURCE_DOCUMENT_TYPE_LABELS, text(value, "")),
        },
        { title: "Kho", dataIndex: "warehouse_code", width: 100 },
        { title: "Đối tác/Nơi nhận", dataIndex: "counterpart", width: 200 },
        {
          title: "Ngày",
          dataIndex: "document_date",
          width: 120,
          render: fmtDate,
        },
        {
          title: "Trạng thái",
          dataIndex: "status",
          width: 130,
          render: statusTag,
        },
        { title: "Người tạo", dataIndex: "created_by_name", width: 140 },
        { title: "Người ghi nhận", dataIndex: "posted_by_name", width: 140 },
        {
          title: "Thời điểm ghi nhận",
          dataIndex: "posted_at",
          width: 170,
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
        },
        {
          title: "Thời gian",
          dataIndex: "occurred_at",
          width: 170,
          render: fmtDateTime,
        },
        {
          title: "Loại",
          dataIndex: "movement_type",
          width: 150,
          render: (v) => {
            const raw = text(v, "");
            return (
              <Tag color={MOVEMENT_COLORS[raw]}>
                {businessLabel(MOVEMENT_LABELS, raw)}
              </Tag>
            );
          },
        },
        { title: "Kho", dataIndex: "warehouse_code", width: 100 },
        { title: "SKU", dataIndex: "product_code", width: 130 },
        { title: "Tên SKU", dataIndex: "product_name", width: 190 },
        { title: "SL Δ", dataIndex: "qty_delta", align: "right", render: fmt },
        { title: "Mã vật lý", dataIndex: "physical_code", width: 170 },
        { title: "Người thực hiện", dataIndex: "actor", width: 150 },
        {
          title: "Nguồn",
          dataIndex: "source_type",
          width: 150,
          render: (value) =>
            businessLabel(SOURCE_DOCUMENT_TYPE_LABELS, text(value, "")),
        },
        {
          title: "Biến động gốc",
          dataIndex: "original_movement_id",
          width: 180,
        },
        {
          title: "Chuỗi điều chỉnh",
          dataIndex: "correction_chain_id",
          width: 180,
        },
      ];
    case "import-match":
      return [
        {
          title: "Phiếu toa",
          dataIndex: "source_request_no",
          width: 160,
          fixed: "left",
          render: (v) => text(v),
        },
        {
          title: "Phiên bản",
          dataIndex: "source_version",
          width: 90,
          align: "right",
          render: (v) => (v === null || v === undefined ? "—" : `v${n(v)}`),
        },
        {
          title: "Dòng",
          dataIndex: "row_no",
          width: 70,
          align: "right",
          render: (v) => (v === null || v === undefined ? "—" : fmt(v)),
        },
        { title: "Mã SKU", dataIndex: "sku_code", width: 150 },
        {
          title: "Tên SKU",
          dataIndex: "sku_name",
          width: 200,
          ellipsis: true,
        },
        {
          title: "Yêu cầu",
          dataIndex: "required_qty",
          align: "right",
          render: fmt,
        },
        {
          title: "Đã đối chiếu",
          dataIndex: "matched_qty",
          align: "right",
          render: fmt,
        },
        {
          title: "Đã quét",
          dataIndex: "scanned_qty",
          align: "right",
          render: fmt,
        },
        {
          title: "Đã ghi nhận",
          dataIndex: "posted_qty",
          align: "right",
          render: fmt,
        },
        {
          title: "Kiểm tra",
          dataIndex: "validation_status",
          width: 130,
          render: statusTag,
        },
        { title: "Phiếu xuất", dataIndex: "outbound_no", width: 150 },
        {
          title: "Lô nhập",
          dataIndex: "import_no",
          width: 150,
        },
        {
          title: "Tệp nguồn",
          dataIndex: "source_file_name",
          width: 200,
          ellipsis: true,
        },
        {
          title: "Trạng thái lô nhập",
          dataIndex: "import_status",
          width: 150,
          render: statusTag,
        },
        { title: "Người tải lên", dataIndex: "uploaded_by_name", width: 150 },
        { title: "Người sử dụng", dataIndex: "consumed_by_name", width: 150 },
      ];
    case "label-log":
      return [
        {
          title: "Phiếu xuất",
          dataIndex: "outbound_no",
          width: 160,
          fixed: "left",
        },
        {
          title: "Mã nhãn đóng gói",
          dataIndex: "label_code",
          width: 180,
          ellipsis: true,
          render: (v) => text(v),
        },
        {
          title: "Mã bản lưu nhãn",
          dataIndex: "id",
          width: 150,
          ellipsis: true,
          render: (v) => text(v),
        },
        {
          title: "Ngày",
          dataIndex: "outbound_date",
          width: 120,
          render: fmtDate,
        },
        { title: "Nơi nhận", dataIndex: "recipient", width: 180 },
        {
          title: "Số nhãn",
          dataIndex: "label_count",
          width: 90,
          align: "right",
          render: fmt,
        },
        {
          title: "Sản phẩm",
          dataIndex: "item_count",
          width: 90,
          align: "right",
          render: fmt,
        },
        {
          title: "SKU",
          dataIndex: "sku_count",
          width: 80,
          align: "right",
          render: fmt,
        },
        {
          title: "Tóm tắt SKU",
          dataIndex: "sku_summary",
          width: 240,
          ellipsis: true,
        },
        {
          title: "Trạng thái",
          dataIndex: "status",
          width: 130,
          render: statusTag,
        },
        {
          title: "Đã dán",
          dataIndex: "applied",
          width: 90,
          render: (v) => (
            <Tag color={v ? "success" : "warning"}>{v ? "CÓ" : "CHƯA"}</Tag>
          ),
        },
        {
          title: "Máy in",
          dataIndex: "printer_name",
          width: 170,
          render: (_: unknown, row: Raw) =>
            text(row.printer_name || row.printer_code),
        },
        { title: "Người in", dataIndex: "printed_by_name", width: 150 },
        {
          title: "Lần in",
          dataIndex: "total_attempts",
          width: 80,
          align: "right",
          render: fmt,
        },
        {
          title: "Lỗi in",
          dataIndex: "failed_count",
          width: 80,
          align: "right",
          render: fmt,
        },
        {
          title: "In lại",
          dataIndex: "reprint_count",
          width: 80,
          align: "right",
          render: fmt,
        },
        {
          title: "Lần in gần nhất",
          dataIndex: "last_attempt_at",
          width: 170,
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
        },
        {
          title: "Nhận diện",
          dataIndex: "identification_status",
          width: 170,
          render: (value) =>
            businessLabel(
              WARRANTY_IDENTIFICATION_STATUS_LABELS,
              text(value, ""),
            ),
        },
        { title: "SKU/Mẫu sản phẩm", dataIndex: "model", width: 170 },
        { title: "Bệnh/lỗi", dataIndex: "defect", width: 180 },
        {
          title: "Linh kiện đã xuất",
          dataIndex: "components_issued",
          width: 200,
        },
        {
          title: "Trạng thái",
          dataIndex: "status",
          width: 130,
          render: statusTag,
        },
        {
          title: "Ngày mua",
          dataIndex: "purchase_date",
          width: 130,
          render: fmtDate,
        },
        {
          title: "Ngày nhận",
          dataIndex: "received_at",
          width: 170,
          render: fmtDateTime,
        },
        {
          title: "Ngày trả khách",
          dataIndex: "returned_at",
          width: 170,
          render: fmtDateTime,
        },
        {
          title: "Thời gian xử lý",
          dataIndex: "turnaround_days",
          width: 120,
          align: "right",
          render: (value: number | null | undefined) =>
            value === null || value === undefined ? "—" : `${value} ngày`,
        },
        {
          title: "Khách hàng",
          dataIndex: "customer_name",
          width: 150,
          render: (value: unknown) =>
            warrantyPiiText(text(value, ""), canViewPii, "name") || "—",
        },
        {
          title: "SĐT",
          dataIndex: "customer_phone",
          width: 130,
          render: (value: unknown) =>
            warrantyPiiText(text(value, ""), canViewPii, "phone") || "—",
        },
        {
          title: "Địa chỉ",
          dataIndex: "customer_address",
          width: 200,
          ellipsis: true,
          render: (value: unknown) =>
            warrantyPiiText(text(value, ""), canViewPii, "address") || "—",
        },
        {
          title: "Cập nhật",
          dataIndex: "updated_at",
          width: 170,
          render: fmtDateTime,
        },
      ];
    case "outbound-by-agency":
      return [
        { title: "Phiếu toa", dataIndex: "source_request_no", width: 150 },
        { title: "Mã nơi nhận", dataIndex: "agency_code", width: 130 },
        { title: "Nơi nhận", dataIndex: "agency_name", width: 190 },
        { title: "Địa chỉ", dataIndex: "address", width: 220, ellipsis: true },
        { title: "Liên hệ", dataIndex: "contact_masked", width: 130 },
        { title: "Mã SKU", dataIndex: "product_code", width: 130 },
        { title: "Tên SKU", dataIndex: "product_name", width: 200 },
        { title: "Phiếu", dataIndex: "outbound_no", width: 150 },
        {
          title: "Ngày",
          dataIndex: "document_date",
          width: 120,
          render: fmtDate,
        },
        {
          title: "SL yêu cầu",
          dataIndex: "required_qty",
          align: "right",
          render: fmt,
        },
        {
          title: "SL xuất",
          dataIndex: "scanned_qty",
          align: "right",
          render: fmt,
        },
      ];
    case "defect-sku":
      return [];
  }
}

function DocumentLines({ lines }: { lines: Raw[] }) {
  return (
    <Table<Raw>
      size="small"
      pagination={false}
      rowKey={(row) => text(row.id ?? row.line_no)}
      dataSource={lines}
      scroll={{ x: "max-content" }}
      columns={[
        { title: "Dòng", dataIndex: "line_no", width: 70, align: "right" },
        { title: "Mã SKU", dataIndex: "product_code", width: 160 },
        { title: "Tên SKU", dataIndex: "product_name" },
        {
          title: "Kế hoạch",
          dataIndex: "expected_qty",
          width: 110,
          align: "right",
          render: fmt,
        },
        {
          title: "Đã quét",
          dataIndex: "scanned_qty",
          width: 110,
          align: "right",
          render: fmt,
        },
        {
          title: "Đã ghi nhận",
          dataIndex: "posted_qty",
          width: 110,
          align: "right",
          render: fmt,
        },
      ]}
    />
  );
}

function statusTag(value: unknown) {
  const status = text(value, "");
  return (
    <Tag color={STATUS_COLORS[status] ?? "default"}>
      {reportStatusLabel(value)}
    </Tag>
  );
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
    <Space wrap style={{ marginBottom: 12 }}>
      {tags.map(([label, value, color]) => (
        <Tag key={label} color={color}>
          {label}: {fmt(value)}
        </Tag>
      ))}
    </Space>
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);

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
  const maxCount = Math.max(1, ...rows.map((row) => n(row.case_count)));

  const columns: TableColumnsType<Raw> = [
    { title: "SKU", dataIndex: "sku_code", width: 160 },
    { title: "Tên SKU", dataIndex: "sku_name", width: 220 },
    { title: "Mã bệnh/lỗi", dataIndex: "defect_code", width: 150 },
    { title: "Bệnh/lỗi", dataIndex: "defect_name", width: 230 },
    {
      title: "Số case",
      dataIndex: "case_count",
      width: 100,
      align: "right",
      render: (value) => n(value).toLocaleString("vi-VN"),
    },
  ];

  return (
    <Space orientation="vertical" size={14} style={{ width: "100%" }}>
      <Card size="small">
        <Space wrap>
          <DatePicker.RangePicker
            value={period}
            format="DD/MM/YYYY"
            onChange={(value) => {
              if (value?.[0] && value?.[1]) setPeriod([value[0], value[1]]);
            }}
          />
          <Select
            allowClear
            showSearch
            mode="multiple"
            maxTagCount="responsive"
            optionFilterProp="label"
            style={{ minWidth: 300 }}
            placeholder="Bệnh/lỗi (chọn được nhiều)"
            value={defectIds}
            options={defectOptions}
            loading={defectsQuery.isLoading}
            onChange={setDefectIds}
          />
        </Space>
      </Card>

      {query.isError ? (
        <ApiErrorAlert
          error={query.error}
          title="Không tải được thống kê bệnh/lỗi theo SKU"
          onRetry={() => query.refetch()}
        />
      ) : null}

      <Card size="small" title="Biểu đồ bệnh/lỗi theo SKU">
        {rows.length === 0 && !query.isLoading ? (
          <Empty description="Chưa có dữ liệu trong khoảng thời gian đã chọn" />
        ) : (
          <Space orientation="vertical" size={10} style={{ width: "100%" }}>
            {rows.slice(0, 20).map((row) => {
              const count = n(row.case_count);
              const percent = Math.max(
                4,
                Math.round((count / maxCount) * 100),
              );
              return (
                <div key={`${text(row.sku_id, "")}-${text(row.defect_id, "")}`}>
                  <Space
                    style={{ width: "100%", justifyContent: "space-between" }}
                  >
                    <Text>
                      <strong>{text(row.sku_code)}</strong> ·{" "}
                      {text(row.defect_name)}
                    </Text>
                    <Text>{count} case</Text>
                  </Space>
                  <div
                    aria-label={`${count} case`}
                    style={{
                      height: 10,
                      width: `${percent}%`,
                      maxWidth: "100%",
                      background: "currentColor",
                      opacity: 0.35,
                      borderRadius: 6,
                    }}
                  />
                </div>
              );
            })}
          </Space>
        )}
      </Card>

      <Table<Raw>
        rowKey={(row) => `${text(row.sku_id, "")}-${text(row.defect_id, "")}`}
        loading={query.isLoading || query.isFetching}
        columns={columns}
        dataSource={rows}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          fixed: true,
        }}
        pagination={{ pageSize: 10, showSizeChanger: false }}
        scroll={{ x: 860 }}
      />
    </Space>
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
  const [selectedRowKeys, setSelectedRowKeys] = useState<Key[]>([]);
  const [defectSelectedRowKeys, setDefectSelectedRowKeys] = useState<Key[]>(
    [],
  );
  const [agencySelectedRowKeys, setAgencySelectedRowKeys] = useState<Key[]>(
    [],
  );

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
      const downloadUrl = text(job.download_url, "");
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
        `Đã xuất ${format.toUpperCase()} theo đúng bộ lọc hiện tại (${fmt(job.row_count)} dòng).`,
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

  const columns = useMemo<TableColumnsType<Raw>>(
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

  return (
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-01"
      data-testid="wwhn-258-report-screen"
    >

      <Tabs
        activeKey={report}
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
          setSelectedRowKeys([]);
          setDefectSelectedRowKeys([]);
          setAgencySelectedRowKeys([]);
        }}
        items={[
          ...(Object.keys(CONFIG) as GenericReportKey[]).map((key) => ({
            key,
            label: CONFIG[key].label,
          })),
          { key: DEFECT_SKU_TAB_KEY, label: DEFECT_SKU_TAB_LABEL },
        ]}
      />

      {isDefectSkuTab ? (
        <DefectSkuReport />
      ) : (
        <>
      <div className="toolbar" style={{ flexWrap: "wrap" }}>
        {config.dateFilter ? (
          <DatePicker.RangePicker
            value={period}
            status={invalidPeriod ? "error" : undefined}
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
          <Input
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 230 }}
            placeholder={
              report === "movement-trace"
                ? "Mã vật lý / mã vạch"
                : report === "warranty"
                  ? "SKU / mẫu sản phẩm"
                  : "Từ khóa"
            }
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              resetPage();
            }}
          />
        ) : null}

        {statusOptions.length ? (
          <Select
            allowClear
            style={{ width: 190 }}
            placeholder="Trạng thái"
            value={status}
            onChange={(value) => {
              setStatus(value);
              resetPage();
            }}
            options={statusOptions.map((value) => ({
              value,
              label: statusOptionLabel(value),
            }))}
          />
        ) : null}

        {["inventory-balance", "xnt", "movement-trace"].includes(report) ? (
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 210 }}
            placeholder="Kho"
            value={warehouseId}
            loading={warehouses.loading}
            options={warehouses.options}
            onChange={(value) => {
              setWarehouseId(value);
              resetPage();
            }}
          />
        ) : null}

        {report === "inventory-balance" ? (
          <DatePicker
            allowClear
            style={{ width: 190 }}
            placeholder="Chốt số liệu tại ngày"
            value={asOf}
            disabledDate={(current) =>
              current && current.isAfter(dayjs(), "day")
            }
            onChange={(value) => {
              setAsOf(value);
              resetPage();
            }}
          />
        ) : null}

        {report === "import-match" ? (
          <Input
            allowClear
            style={{ width: 180 }}
            placeholder="Mã SKU"
            value={skuCode}
            onChange={(event) => {
              setSkuCode(event.target.value);
              resetPage();
            }}
          />
        ) : null}

        {report === "inventory-balance" || report === "xnt" ? (
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 210 }}
            placeholder="Nhóm hàng"
            value={categoryId}
            loading={categories.loading}
            options={categories.options}
            onChange={(value) => {
              setCategoryId(value);
              resetPage();
            }}
          />
        ) : null}

        {report === "document-history" ? (
          <Select
            style={{ width: 150 }}
            value={docType}
            onChange={(value) => {
              setDocType(value);
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
          <Select
            allowClear
            style={{ width: 190 }}
            placeholder="Loại biến động"
            value={movementType}
            onChange={(value) => {
              setMovementType(value);
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
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 210 }}
              placeholder="Máy in"
              value={printerId}
              loading={printers.loading}
              options={printers.options}
              onChange={(value) => {
                setPrinterId(value);
                resetPage();
              }}
            />
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              style={{ width: 200 }}
              placeholder="Người in"
              value={actorId}
              loading={actors.loading}
              options={actors.options}
              onChange={(value) => {
                setActorId(value);
                resetPage();
              }}
            />
          </>
        ) : null}

        {report === "warranty" ? (
          <>
            <Select
              allowClear
              showSearch
              mode="multiple"
              maxTagCount="responsive"
              optionFilterProp="label"
              style={{ minWidth: 210 }}
              placeholder="Bệnh / lỗi (chọn được nhiều)"
              value={defectIds}
              loading={defects.isLoading}
              options={defectOptions}
              onChange={(value) => {
                setDefectIds(value);
                resetPage();
              }}
            />
            <Select
              allowClear
              style={{ width: 220 }}
              placeholder="Nhận diện"
              value={identification}
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
                setIdentification(value);
                resetPage();
              }}
            />
          </>
        ) : null}

        {report === "outbound-by-agency" || report === "document-history" ? (
          <Select
            allowClear
            showSearch
            optionFilterProp="label"
            style={{ width: 230 }}
            placeholder="Nơi nhận"
            value={agencyId}
            loading={agencies.isLoading}
            options={agencyOptions}
            onChange={(value) => {
              setAgencyId(value);
              resetPage();
            }}
          />
        ) : null}

        {report === "warranty" && canExportPii ? (
          <Input
            allowClear
            data-testid="report-pii-reason"
            style={{ width: 260 }}
            maxLength={500}
            status={piiReasonInvalid ? "error" : undefined}
            placeholder={`Lý do xuất PII (≥ ${PII_REASON_MIN_LENGTH} ký tự; bỏ trống = che thông tin)`}
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
          module="reports"
          action="export"
          permissionCode="REPORT_EXPORT"
          mode="disable"
          icon={<DownloadOutlined />}
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
          module="reports"
          action="export"
          permissionCode="REPORT_EXPORT"
          mode="disable"
          type="primary"
          icon={<FilePdfOutlined />}
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
      </div>

      {invalidPeriod && config.dateFilter ? (
        <Alert
          type="error"
          showIcon
          style={{ marginBottom: 12 }}
          title="Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc."
        />
      ) : null}
      {report === "warranty" ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={
            canExportPii
              ? `Khách hàng/SĐT/địa chỉ hiển thị ở dạng đã che. Tệp xuất chỉ chứa PII thô khi bạn nhập lý do (≥ ${PII_REASON_MIN_LENGTH} ký tự); mọi lần xuất đều được ghi nhật ký.`
              : "Khách hàng/SĐT/địa chỉ hiển thị ở dạng đã che. Tài khoản của bạn không có quyền xuất PII nên tệp xuất luôn che thông tin; cần PII thô hãy liên hệ quản trị để được cấp quyền."
          }
        />
      ) : null}
      {piiReasonInvalid ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={`Lý do xuất PII phải có ít nhất ${PII_REASON_MIN_LENGTH} ký tự. Bỏ trống nếu chỉ cần tệp đã che thông tin.`}
        />
      ) : null}
      {exceedsExportRowLimit ? (
        <div {...uiStateProps(UI_STATE.DISABLED, "report-export-row-limit")}>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            title={`Bộ lọc hiện tại có ${fmt(total)} dòng — vượt giới hạn ${fmt(EXPORT_ROW_LIMIT)} dòng mỗi tệp. Thu hẹp khoảng ngày hoặc bộ lọc trước khi xuất.`}
          />
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
          <Alert
            type="error"
            showIcon
            closable
            onClose={() => setExportDenied(null)}
            style={{ marginBottom: 12 }}
            title="Xuất báo cáo bị từ chối quyền."
            description={exportDenied}
          />
        </div>
      ) : null}
      {query.data?.data_scope === "WAREHOUSE_SCOPED" ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={`Số liệu đã giới hạn theo phạm vi kho của tài khoản (${
            Array.isArray(query.data.scope_warehouse_ids)
              ? query.data.scope_warehouse_ids.length
              : 0
          } kho). Đây không phải tổng toàn hệ thống; tệp xuất dùng đúng phạm vi này.`}
        />
      ) : null}
      {report === "inventory-balance" && query.data?.as_of_snapshot ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={`Đang xem ảnh chụp theo sổ tồn kho tại ${text(query.data.as_of)}. Cột "Tồn kho" là số dư tại mốc đó, nên đối soát sổ tồn kho với số dư hiện tại không áp dụng.`}
        />
      ) : null}
      {report === "document-history" ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title="Mở rộng từng phiếu để xem tầng dòng: kế hoạch / đã quét / đã ghi nhận. Số đã ghi nhận lấy từ biến động tồn kho chính thức."
        />
      ) : null}
      {report === "outbound-by-agency" ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title="Nơi nhận chỉ là chiều báo cáo, không phải một nhóm tồn kho riêng."
        />
      ) : null}
      {report === "label-log" ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 12 }}
          title="Quy tắc hiện hành: đúng 01 nhãn đóng gói cho mỗi phiếu/lô xuất."
        />
      ) : null}

      <Summary report={report} data={query.data} />

      {query.isError ? (
        <ApiErrorAlert
          error={query.error}
          title={`Không tải được ${config.label}`}
          onRetry={() => query.refetch()}
          style={{ marginBottom: 12 }}
        />
      ) : null}

      <TableLoadingBanner loading={query.isLoading || query.isFetching} />
      <Table<Raw>
        rowKey="__rowKey"
        dataSource={rows}
        columns={columns}
        rowSelection={{
          selectedRowKeys,
          onChange: setSelectedRowKeys,
          fixed: true,
        }}
        loading={query.isLoading || query.isFetching}
        scroll={{ x: "max-content" }}
        expandable={
          report === "document-history"
            ? {
                rowExpandable: (row) =>
                  Array.isArray(row.lines) && row.lines.length > 0,
                expandedRowRender: (row) => (
                  <DocumentLines lines={row.lines as Raw[]} />
                ),
              }
            : undefined
        }
        pagination={{
          current: n(pagination.current_page, page),
          pageSize: n(pagination.per_page, perPage),
          total,
          showSizeChanger: false,
          showTotal: (value) => `Tổng ${fmt(value)} bản ghi`,
          onChange: (next) => setPage(next),
        }}
        locale={{
          emptyText: tableEmptyText(
            query.isError ? query.error : null,
            "Không có dữ liệu theo bộ lọc",
          ),
        }}
      />

      {report === "warranty" && Array.isArray(query.data?.by_defect) ? (
        <Table<Raw>
          style={{ marginTop: 16 }}
          size="small"
          pagination={false}
          scroll={{ x: "max-content" }}
          rowKey={(row) => text(row.defect)}
          dataSource={query.data.by_defect as Raw[]}
          rowSelection={{
            selectedRowKeys: defectSelectedRowKeys,
            onChange: setDefectSelectedRowKeys,
            fixed: true,
          }}
          columns={[
            {
              title: "STT",
              key: "__stt",
              width: 64,
              fixed: "left",
              render: (_value: unknown, _row: Raw, index: number) =>
                mvpRowNumber(1, 1, index),
            },
            { title: "Bệnh / lỗi", dataIndex: "defect" },
            {
              title: "Ca bảo hành",
              dataIndex: "total",
              align: "right",
              render: fmt,
            },
            {
              title: "Đang xử lý",
              dataIndex: "processing",
              align: "right",
              render: fmt,
            },
            {
              title: "Đã trả",
              dataIndex: "returned",
              align: "right",
              render: fmt,
            },
            {
              title: "Đã hủy",
              dataIndex: "cancelled",
              align: "right",
              render: fmt,
            },
            {
              title: "Tiếp nhận tạm",
              dataIndex: "temp_only",
              align: "right",
              render: fmt,
            },
          ]}
        />
      ) : null}

      {report === "outbound-by-agency" &&
      Array.isArray(query.data?.by_agency) ? (
        <Table<Raw>
          style={{ marginTop: 16 }}
          size="small"
          pagination={false}
          scroll={{ x: "max-content" }}
          rowKey={(row) => text(row.agency_code)}
          dataSource={query.data.by_agency as Raw[]}
          rowSelection={{
            selectedRowKeys: agencySelectedRowKeys,
            onChange: setAgencySelectedRowKeys,
            fixed: true,
          }}
          columns={[
            {
              title: "STT",
              key: "__stt",
              width: 64,
              fixed: "left",
              render: (_value: unknown, _row: Raw, index: number) =>
                mvpRowNumber(1, 1, index),
            },
            { title: "Mã nơi nhận", dataIndex: "agency_code" },
            { title: "Nơi nhận", dataIndex: "agency_name" },
            {
              title: "Số phiếu",
              dataIndex: "document_count",
              align: "right",
              render: fmt,
            },
            {
              title: "Tổng SL xuất",
              dataIndex: "total_issued_qty",
              align: "right",
              render: fmt,
            },
            {
              title: "Số SKU",
              dataIndex: "sku_count",
              align: "right",
              render: fmt,
            },
          ]}
        />
      ) : null}
        </>
      )}
    </div>
  );
}
