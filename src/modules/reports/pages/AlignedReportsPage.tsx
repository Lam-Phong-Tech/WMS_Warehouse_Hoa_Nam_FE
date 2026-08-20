import { useMemo, useState } from "react";
import {
  Alert,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
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
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
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

type Raw = Record<string, unknown>;
type ReportKey =
  | "inventory-balance"
  | "xnt"
  | "document-history"
  | "movement-trace"
  | "import-match"
  | "label-log"
  | "warranty"
  | "outbound-by-agency";

type SelectOption = { value: string; label: string };

/**
 * §13.8 Privacy Contract: "PII export requires warranty.pii.export + reason".
 * BE `AlignedWarrantyReportController::PII_REASON_MIN_LENGTH` từ chối reason ngắn
 * hơn 5 ký tự bằng 422 `PII_EXPORT_REASON_INVALID`; giữ cùng ngưỡng ở client để
 * người dùng không phải bấm export mới biết mình gõ thiếu.
 */
const PII_REASON_MIN_LENGTH = 5;

/**
 * BE chặn mọi file export quá 10.000 dòng bằng 422
 * `REPORT_EXPORT_ROW_LIMIT_EXCEEDED`. Màn hình biết `pagination.total` trước khi
 * bấm export nên phải cảnh báo trước, thay vì để người dùng chờ hết vòng tạo job
 * rồi mới nhận lỗi.
 */
const EXPORT_ROW_LIMIT = 10000;

type ReportConfig = {
  label: string;
  endpoint: string;
  exportEndpoint: string;
  rowsKey?: "rows" | "lines";
  fileStem: string;
  dateFilter?: boolean;
  /** report_code dùng cho Annex C createReportExport (POST /reports/export). */
  reportCode: string;
};

const CONFIG: Record<ReportKey, ReportConfig> = {
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
    label: "Movement / Trace",
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
    label: "Packing Label",
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

const MOVEMENT_COLORS: Record<string, string> = {
  OPENING: "default",
  RECEIPT: "blue",
  ISSUE: "orange",
  COMPONENT_ISSUE: "purple",
  REVERSAL: "red",
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

function rowsOf(data: Raw | undefined, key: "rows" | "lines" = "rows"): Raw[] {
  const value = data?.[key];
  return Array.isArray(value) ? (value as Raw[]) : [];
}

function objectOf(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Raw)
    : {};
}

/**
 * download_url của ExportJob là đường dẫn tuyệt đối `/api/v1/...`, còn axios đã
 * gắn sẵn baseURL kết thúc ở `/api/v1` nên phải cắt tiền tố để không gọi trùng.
 */
function stripApiPrefix(url: string): string {
  return url.replace(/^\/api\/v1/, "");
}

/** Annex C createReportExport yêu cầu Idempotency-Key cho mỗi lần tạo job. */
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

/** §13.10 RPT-LABEL-01 có filter "actor" — người thực hiện lần in nhãn. */
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

/** §13.10: RPT-INV-01 và RPT-XNT-01 đều lọc theo category. */
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
        // §13.10 RPT-INV-01: category, serial_qty, box_qty, location_hint.
        { title: "Nhóm hàng", dataIndex: "category", width: 140 },
        { title: "Trạng thái", dataIndex: "stock_status", width: 130 },
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
          title: "Serial",
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
          title: "Ledger",
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
          width: 130,
          render: (v) => {
            const status = text(v, "");
            // as_of quá khứ ⇒ NOT_APPLICABLE: ledger đã cắt theo mốc nên so với
            // balance hiện tại là vô nghĩa, không phải divergence.
            const color =
              status === "MATCH"
                ? "success"
                : status === "NOT_APPLICABLE"
                  ? "default"
                  : "error";
            return <Tag color={color}>{status || "-"}</Tag>;
          },
        },
        // §13.10 RPT-INV-01 liệt kê updated_at trong bộ cột bắt buộc.
        { title: "Cập nhật", dataIndex: "updated_at", width: 170 },
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
        { title: "Tồn", dataIndex: "stock_status", width: 120 },
        { title: "Đầu kỳ", dataIndex: "opening", align: "right", render: fmt },
        // WWHN-240 / BR-RPT-01..07 "hiển thị gross/net" + BR-REV-11 "report hiển thị
        // movement gốc, toàn bộ Reversal chain và net effect". Một cột "Reversal" gộp
        // hai chiều thì người đọc không biết Nhập/Xuất thực của kỳ là bao nhiêu, nên
        // mỗi chiều tách thành ba cột gross / đã đảo / thuần.
        {
          title: "Nhập",
          children: [
            {
              title: "Gross",
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
              title: "Gross",
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
          title: "Xuất LK",
          children: [
            {
              title: "Gross",
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
          title: "Reversal net",
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
        { title: "Loại", dataIndex: "doc_type", width: 100 },
        { title: "Kho", dataIndex: "warehouse_code", width: 100 },
        { title: "Đối tác/Nơi nhận", dataIndex: "counterpart", width: 200 },
        { title: "Ngày", dataIndex: "document_date", width: 120 },
        {
          title: "Trạng thái",
          dataIndex: "status",
          width: 120,
          render: statusTag,
        },
        { title: "Người tạo", dataIndex: "created_by_name", width: 140 },
        { title: "Người post", dataIndex: "posted_by_name", width: 140 },
        { title: "Posted at", dataIndex: "posted_at", width: 170 },
      ];
    case "movement-trace":
      return [
        // §13.10 RPT-MOV-01: movement_id là cột đầu tiên, khoá truy ngược ledger.
        {
          title: "Movement ID",
          dataIndex: "id",
          width: 190,
          fixed: "left",
          ellipsis: true,
        },
        {
          title: "Thời gian",
          dataIndex: "occurred_at",
          width: 170,
        },
        {
          title: "Loại",
          dataIndex: "movement_type",
          width: 130,
          render: (v) => (
            <Tag color={MOVEMENT_COLORS[text(v, "")]}>{text(v)}</Tag>
          ),
        },
        { title: "Kho", dataIndex: "warehouse_code", width: 100 },
        { title: "SKU", dataIndex: "product_code", width: 130 },
        { title: "Tên SKU", dataIndex: "product_name", width: 190 },
        { title: "SL Δ", dataIndex: "qty_delta", align: "right", render: fmt },
        { title: "Mã vật lý", dataIndex: "physical_code", width: 170 },
        // §13.10 RPT-MOV-01 yêu cầu cột actor.
        { title: "Người thực hiện", dataIndex: "actor", width: 150 },
        { title: "Nguồn", dataIndex: "source_type", width: 130 },
        {
          title: "Movement gốc",
          dataIndex: "original_movement_id",
          width: 180,
        },
        {
          title: "Correction chain",
          dataIndex: "correction_chain_id",
          width: 180,
        },
      ];
    case "import-match":
      // §13.10 RPT-OUT-MATCH-01: source_request_no, source_version, SKU,
      // required/matched/scanned, validation status — báo cáo ở tầng dòng của toa.
      return [
        {
          title: "Phiếu toa",
          dataIndex: "source_request_no",
          width: 160,
          fixed: "left",
          render: (v) => text(v),
        },
        {
          title: "Version",
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
          title: "Đã match",
          dataIndex: "matched_qty",
          align: "right",
          render: fmt,
        },
        {
          title: "Đã scan",
          dataIndex: "scanned_qty",
          align: "right",
          render: fmt,
        },
        {
          title: "Đã post",
          dataIndex: "posted_qty",
          align: "right",
          render: fmt,
        },
        {
          title: "Validation",
          dataIndex: "validation_status",
          width: 120,
          render: statusTag,
        },
        { title: "Phiếu xuất", dataIndex: "outbound_no", width: 150 },
        {
          title: "Batch",
          dataIndex: "import_no",
          width: 150,
        },
        {
          title: "File nguồn",
          dataIndex: "source_file_name",
          width: 200,
          ellipsis: true,
        },
        {
          title: "Trạng thái batch",
          dataIndex: "import_status",
          width: 140,
          render: statusTag,
        },
        { title: "Người upload", dataIndex: "uploaded_by_name", width: 150 },
        { title: "Người consume", dataIndex: "consumed_by_name", width: 150 },
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
          title: "Packing_Label",
          dataIndex: "label_code",
          width: 180,
          ellipsis: true,
          render: (v) => text(v),
        },
        {
          title: "Label_Snapshot",
          dataIndex: "id",
          width: 150,
          ellipsis: true,
          render: (v) => text(v),
        },
        { title: "Ngày", dataIndex: "outbound_date", width: 120 },
        { title: "Nơi nhận", dataIndex: "recipient", width: 180 },
        {
          title: "Số nhãn",
          dataIndex: "label_count",
          width: 90,
          align: "right",
          render: fmt,
        },
        {
          title: "Item",
          dataIndex: "item_count",
          width: 80,
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
        // §13.10 RPT-LABEL-01 columns: printer + actor của lần in gần nhất.
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
        { title: "Lần in gần nhất", dataIndex: "last_attempt_at", width: 170 },
      ];
    case "warranty":
      return [
        { title: "Case", dataIndex: "case_no", width: 160, fixed: "left" },
        { title: "Nhận diện", dataIndex: "identification_status", width: 120 },
        { title: "SKU/Model", dataIndex: "model", width: 170 },
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
        // §13.10 RPT-WAR-01 columns: received/returned + turnaround, purchase_date optional.
        { title: "Ngày mua", dataIndex: "purchase_date", width: 130 },
        { title: "Ngày nhận", dataIndex: "received_at", width: 170 },
        { title: "Ngày trả khách", dataIndex: "returned_at", width: 170 },
        {
          title: "Turnaround",
          dataIndex: "turnaround_days",
          width: 110,
          align: "right",
          render: (value: number | null | undefined) =>
            value === null || value === undefined ? "—" : `${value} ngày`,
        },
        // §13.8 + §13.10: cột khách hàng luôn hiển thị nhưng ở dạng đã mask
        // (N*** H*** / ******922 / "***, <địa giới cuối>"), không bao giờ PII thô.
        //
        // WWHN-258 · FE258-P1-04: trước đây ba cột này là `dataIndex` trần, tức là
        // đổ thẳng payload BE ra bảng. Mask khi đó chỉ là lời hứa của BE — hỏng
        // lớp đó (hoặc gọi qua một route chưa mask) là PII thô hiển thị ngay.
        // `warrantyPiiText` idempotent trên chuỗi BE đã mask nên gọi vô điều kiện
        // được, và fail-closed theo `warranty.pii.view` của chính actor.
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
        { title: "Cập nhật", dataIndex: "updated_at", width: 170 },
      ];
    case "outbound-by-agency":
      return [
        // §13.10 RPT-RECIPIENT-01: source_request_no là khoá trace về toa nguồn;
        // contact hiển thị dạng đã mask theo BR-EXP.
        { title: "Phiếu toa", dataIndex: "source_request_no", width: 150 },
        { title: "Mã nơi nhận", dataIndex: "agency_code", width: 130 },
        { title: "Nơi nhận", dataIndex: "agency_name", width: 190 },
        { title: "Địa chỉ", dataIndex: "address", width: 220, ellipsis: true },
        { title: "Liên hệ", dataIndex: "contact_masked", width: 130 },
        { title: "Mã SKU", dataIndex: "product_code", width: 130 },
        { title: "Tên SKU", dataIndex: "product_name", width: 200 },
        { title: "Phiếu", dataIndex: "outbound_no", width: 150 },
        { title: "Ngày", dataIndex: "document_date", width: 120 },
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
  }
}

/**
 * §13.10 RPT-IO-01 yêu cầu tầng dòng: line, expected/required, scanned/matched,
 * posted/issued. posted lấy từ movement authoritative nên cột này chính là bằng
 * chứng đối soát "Sum authoritative movements = posted/issued qty".
 */
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
          title: "Đã scan",
          dataIndex: "scanned_qty",
          width: 110,
          align: "right",
          render: fmt,
        },
        {
          title: "Đã post",
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
  return <Tag color={STATUS_COLORS[status] ?? "default"}>{status || "-"}</Tag>;
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
          "Lệch ledger",
          summary.mismatch_count,
          n(summary.mismatch_count) > 0 ? "error" : "success",
        ],
      );
      break;
    case "document-history":
      tags.push(
        ["Tổng", summary.total],
        ["POSTED", summary.posted, "success"],
        ["SCANNING", summary.scanning, "processing"],
        ["CANCELLED", summary.cancelled, "error"],
      );
      break;
    case "movement-trace":
      tags.push(
        ["Movement", summary.total_movements],
        ["Net effect", summary.net_effect, "blue"],
        ["Reversal", summary.reversal_count, "red"],
      );
      break;
    case "import-match":
      tags.push(
        ["Batch", summary.total_batches],
        ["Dòng toa", summary.total_lines, "blue"],
        ["Khớp đủ", summary.fully_matched_lines, "success"],
        ["Dòng lỗi", summary.invalid_lines, "error"],
        ["SL yêu cầu", summary.total_required_qty],
        ["SL đã scan", summary.total_scanned_qty, "green"],
      );
      break;
    case "label-log":
      tags.push(
        ["Packing Label", summary.total_labels],
        ["Đã in", summary.printed, "success"],
        ["Đã dán", summary.applied, "blue"],
        ["Lỗi", summary.failed, "error"],
        ["In lại", summary.reprinted, "warning"],
      );
      break;
    case "warranty":
      tags.push(
        ["Case", summary.total],
        ["Đang xử lý", summary.processing, "processing"],
        ["Đã trả", summary.returned, "success"],
        ["Đã hủy", summary.cancelled, "error"],
        ["TEMP_ONLY", summary.temp_only, "warning"],
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
  // §13.10 RPT-INV-01: "as_of inclusive" — chốt số liệu tại một mốc quá khứ.
  const [asOf, setAsOf] = useState<Dayjs | null>(null);
  const [defectId, setDefectId] = useState<string>();
  const [identification, setIdentification] = useState<string>();
  const [movementType, setMovementType] = useState<string>();
  const [docType, setDocType] = useState<"all" | "inbound" | "outbound">("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);
  /**
   * WWHN-258 · FE258-P1-04: 403 của export trước đây bị gom vào một `toast.error`
   * chung với lỗi mạng, nên bằng chứng QA2 không phân biệt được "bị từ chối
   * quyền" và "API hỏng". Surface riêng này phát `data-ui-state=permission-denied`
   * theo hợp đồng UI_STATE.
   */
  const [exportDenied, setExportDenied] = useState<string | null>(null);

  const [piiReason, setPiiReason] = useState("");

  const warehouses = useWarehouseOptions();
  const printers = usePrinterOptions();
  // Danh sách actor lấy từ /users nên chỉ tải khi actor có quyền đọc user; người
  // chỉ có report.view vẫn xem được báo cáo, chỉ là không lọc theo người in.
  const hasPermission = useHasPermission();
  const actors = useActorOptions(
    report === "label-log" &&
      hasPermission(WMS_PERMISSION_CATALOG.IAM_USER_VIEW),
  );
  // §13.8 / NFR-SRS-015: xem PII và xuất PII là HAI quyền tách rời. Trang báo cáo
  // phải hành xử khác nhau theo từng quyền, không gộp chung vào report.view.
  const canViewPii = hasPermission(WMS_PERMISSION_CATALOG.WARRANTY_PII_VIEW);
  const canExportPii = hasPermission(
    WMS_PERMISSION_CATALOG.WARRANTY_PII_EXPORT,
  );
  const categories = useCategoryOptions();
  const agencies = useMvpAgencies({ status: "ACTIVE", per_page: 100 });
  const defects = useMvpDefects({ status: "ACTIVE", per_page: 100 });

  const config = CONFIG[report];
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
    // §13.10: RPT-INV-01 lọc SKU/category/status + as_of; RPT-XNT-01 lọc SKU/category.
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
      // §13.10 RPT-IO-01 filters: date, SKU, status, agency recipient.
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
      // §13.10 RPT-OUT-MATCH-01 filters: request / date / SKU / status.
      if (keyword.trim()) result.keyword = keyword.trim();
      if (status) result.status = status;
      if (skuCode.trim()) result.sku_code = skuCode.trim();
    }
    if (report === "label-log") {
      // §13.10 RPT-LABEL-01 filters: date / printer / result / actor.
      if (keyword.trim()) result.keyword = keyword.trim();
      if (status) result.status = status;
      if (printerId) result.printer_id = printerId;
      if (actorId) result.actor_id = actorId;
    }
    if (report === "warranty") {
      if (status) result.status = status;
      if (defectId) result.defect_id = defectId;
      if (identification) result.identification_status = identification;
      // §13.10 RPT-WAR-01 filters: date, model, defect, status.
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
    defectId,
    identification,
    movementType,
    docType,
    page,
    perPage,
  ]);

  const query = useQuery({
    queryKey: ["flow06", report, params],
    queryFn: () => http.get<Raw>(config.endpoint, { params }),
    enabled: !config.dateFilter || !invalidPeriod,
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
      // BR-EXP-01..05: export là hành động riêng, phải chặn tại client trước khi
      // gọi mạng (BE vẫn là lớp enforce authoritative bằng permission report.export).
      assertWmsActionPermission(
        WMS_ACTION_PERMISSIONS.EXPORT_REPORT,
        "report export",
      );
      const { page: _page, per_page: _perPage, ...filters } = params;
      // §13.8: PII chỉ ra khỏi hệ thống khi có warranty.pii.export VÀ lý do.
      //
      // WWHN-258 · FE258-P1-04: fail-closed tại client. `reason` gửi kèm khi
      // actor KHÔNG có warranty.pii.export bị BE trả 403 PERMISSION_DENIED — tức
      // là lần export đó chắc chắn hỏng, sau khi đã kịp tạo job và ghi một bản
      // audit REPORT_EXPORT_REQUESTED vô nghĩa. Không có quyền thì không bao giờ
      // đính `reason`; file vẫn xuất được nhưng ở dạng đã mask.
      if (
        report === "warranty" &&
        canExportPii &&
        piiReasonTrimmed.length >= PII_REASON_MIN_LENGTH
      ) {
        filters.reason = piiReasonTrimmed;
      }

      // Annex D SCR-RPT-01 + Annex C createReportExport: hành động export đi qua
      // POST /reports/export để job được audit và có Idempotency-Key, sau đó tải
      // file theo download_url mà BE trả về (đã mang đúng bộ lọc đã gửi).
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
      // BR-EXP-03: ưu tiên tên file BE đặt vì chỉ nó mang timestamp phát hành.
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

  return (
    // WWHN-258 · FE258-P2-02: CSS của `.toolbar`/`.spacer` scoped dưới
    // `.hn-mvp-source-screen` (src/styles/hn-wms-source-screen.css). Class cũ
    // `reversal-page` không có định nghĩa nào, nên vào bằng route /reports
    // toolbar mất flex/gap/wrap — vỡ responsive 390px dù code "có vẻ" đã wrap.
    <div
      className="hn-mvp-source-screen"
      data-mvp-screen="RPT-01"
      data-testid="wwhn-258-report-screen"
    >
      <Alert
        showIcon
        type="info"
        style={{ marginBottom: 14 }}
        title="Flow 06 · Báo cáo vận hành"
        description="Dữ liệu trang được phân trang tại BE; XLSX/PDF giữ nguyên bộ lọc và được kiểm soát bằng report.export. Packing Label được báo cáo theo đúng 01 nhãn/phiếu-lô."
      />

      <Tabs
        activeKey={report}
        onChange={(key) => {
          setReport(key as ReportKey);
          setStatus(undefined);
          setKeyword("");
          // Bộ lọc chuyên biệt của từng báo cáo phải reset khi đổi tab, nếu không
          // filter cũ sẽ đi kèm request của báo cáo mới và làm sai phạm vi export.
          setAgencyId(undefined);
          setPrinterId(undefined);
          setActorId(undefined);
          setCategoryId(undefined);
          setDefectId(undefined);
          setIdentification(undefined);
          setMovementType(undefined);
          setSkuCode("");
          setAsOf(null);
          setPiiReason("");
          setExportDenied(null);
          setPage(1);
        }}
        items={(Object.keys(CONFIG) as ReportKey[]).map((key) => ({
          key,
          label: CONFIG[key].label,
        }))}
      />

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
          // §13.10 RPT-WAR-01 có filter "model" — dùng chung ô từ khóa.
          "warranty",
        ].includes(report) ? (
          <Input
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 230 }}
            placeholder={
              report === "movement-trace"
                ? "Mã vật lý / barcode"
                : report === "warranty"
                  ? "SKU / model"
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
            style={{ width: 170 }}
            placeholder="Trạng thái"
            value={status}
            onChange={(value) => {
              setStatus(value);
              resetPage();
            }}
            options={statusOptions.map((value) => ({ value, label: value }))}
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
            placeholder="Chốt số liệu (as_of)"
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
            style={{ width: 175 }}
            placeholder="Loại movement"
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
            ].map((value) => ({ value, label: value }))}
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
              optionFilterProp="label"
              style={{ width: 210 }}
              placeholder="Bệnh / lỗi"
              value={defectId}
              loading={defects.isLoading}
              options={defectOptions}
              onChange={(value) => {
                setDefectId(value);
                resetPage();
              }}
            />
            <Select
              allowClear
              style={{ width: 155 }}
              placeholder="Nhận diện"
              value={identification}
              options={[
                { value: "IDENTIFIED", label: "IDENTIFIED" },
                { value: "TEMP_ONLY", label: "TEMP_ONLY" },
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

        {/* §13.8: ô lý do chỉ có nghĩa với actor thực sự được xuất PII. Hiện nó cho
            người thiếu `warranty.pii.export` là mời họ vào một hành động BE chắc
            chắn trả 403 — xem FE258-P1-04. */}
        {report === "warranty" && canExportPii ? (
          <Input
            allowClear
            data-testid="report-pii-reason"
            style={{ width: 240 }}
            maxLength={500}
            status={piiReasonInvalid ? "error" : undefined}
            placeholder={`Lý do xuất PII (≥ ${PII_REASON_MIN_LENGTH} ký tự; bỏ trống = mask)`}
            value={piiReason}
            onChange={(event) => setPiiReason(event.target.value)}
          />
        ) : null}

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
          disabledTooltip="Cần report.export và bộ lọc hợp lệ"
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
          disabledTooltip="Cần report.export và bộ lọc hợp lệ"
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
              ? `Khách hàng/SĐT/địa chỉ hiển thị ở dạng đã mask. File export chỉ chứa PII thô khi bạn nhập lý do (≥ ${PII_REASON_MIN_LENGTH} ký tự); mọi lần export đều được audit kèm lý do.`
              : "Khách hàng/SĐT/địa chỉ hiển thị ở dạng đã mask. Tài khoản của bạn không có warranty.pii.export nên file export luôn ở dạng mask; cần PII thô hãy liên hệ quản trị để được cấp quyền."
          }
        />
      ) : null}
      {piiReasonInvalid ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={`Lý do xuất PII phải có ít nhất ${PII_REASON_MIN_LENGTH} ký tự (BE trả 422 PII_EXPORT_REASON_INVALID nếu ngắn hơn). Bỏ trống nếu chỉ cần file đã mask.`}
        />
      ) : null}
      {/* Thuộc tính trạng thái đặt trên `div` bao ngoài: antd v6 không chuyển tiếp
          prop lạ xuống DOM, nên `data-ui-state` gắn thẳng lên Alert sẽ biến mất. */}
      {exceedsExportRowLimit ? (
        <div {...uiStateProps(UI_STATE.DISABLED, "report-export-row-limit")}>
          <Alert
            type="warning"
            showIcon
            style={{ marginBottom: 12 }}
            title={`Bộ lọc hiện tại có ${fmt(total)} dòng — vượt trần ${fmt(EXPORT_ROW_LIMIT)} dòng/file của BE (422 REPORT_EXPORT_ROW_LIMIT_EXCEEDED). Thu hẹp khoảng ngày hoặc bộ lọc trước khi xuất.`}
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
            title="Export bị từ chối quyền (403)."
            description={exportDenied}
          />
        </div>
      ) : null}
      {/* WWHN-254 DEV254-P1-03/P1-04: BE nay cắt mọi báo cáo theo warehouse data-scope
          của người gọi. Người dùng bị giới hạn kho phải nhìn thấy điều đó, nếu không họ
          sẽ đọc một tổng cục bộ như tổng toàn hệ thống. */}
      {query.data?.data_scope === "WAREHOUSE_SCOPED" ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title={`Số liệu đã giới hạn theo phạm vi kho của tài khoản (${
            Array.isArray(query.data.scope_warehouse_ids)
              ? query.data.scope_warehouse_ids.length
              : 0
          } kho). Đây không phải tổng toàn hệ thống; file export dùng đúng phạm vi này.`}
        />
      ) : null}
      {report === "inventory-balance" && query.data?.as_of_snapshot ? (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 12 }}
          title={`Đang xem ảnh chụp theo sổ ledger tại ${text(query.data.as_of)}. Cột "Tồn kho" là số dư tại mốc đó, nên đối soát Ledger↔Balance hiện tại không áp dụng (NOT_APPLICABLE).`}
        />
      ) : null}
      {report === "document-history" ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title="Mở rộng từng phiếu để xem tầng dòng: kế hoạch / đã scan / đã post. Số đã post lấy từ movement authoritative."
        />
      ) : null}
      {report === "outbound-by-agency" ? (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 12 }}
          title="Agency chỉ là chiều báo cáo/nơi nhận, không phải stock bucket."
        />
      ) : null}
      {report === "label-log" ? (
        <Alert
          type="success"
          showIcon
          style={{ marginBottom: 12 }}
          title="Cardinality hiện hành: đúng 01 Packing Label cho mỗi phiếu/lô xuất."
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

      <MvpPageSizeSelector
        value={perPage}
        onChange={(value) => {
          setPerPage(value);
          setPage(1);
        }}
      />

      <TableLoadingBanner loading={query.isLoading || query.isFetching} />
      <Table<Raw>
        rowKey="__rowKey"
        dataSource={rows}
        columns={columnsFor(report, canViewPii)}
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
          // Annex D SCR-RPT-01: "360/768/1280+, no horizontal loss of critical
          // action". Bảng tổng hợp thiếu scroll sẽ đẩy ngang cả trang ở 390px.
          scroll={{ x: "max-content" }}
          rowKey={(row) => text(row.defect)}
          dataSource={query.data.by_defect as Raw[]}
          columns={[
            { title: "Bệnh / lỗi", dataIndex: "defect" },
            { title: "Case", dataIndex: "total", align: "right", render: fmt },
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
              title: "TEMP_ONLY",
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
          columns={[
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
    </div>
  );
}
