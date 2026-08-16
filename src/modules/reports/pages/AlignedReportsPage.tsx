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
import { getApiErrorMessage } from "@/shared/api/api-error";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import { ActionButton } from "@/shared/components/permission/ActionButton";
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

type ReportConfig = {
  label: string;
  endpoint: string;
  exportEndpoint: string;
  rowsKey?: "rows" | "lines";
  fileStem: string;
  dateFilter?: boolean;
};

const CONFIG: Record<ReportKey, ReportConfig> = {
  "inventory-balance": {
    label: "Tồn kho",
    endpoint: API_ENDPOINTS.REPORTS_INVENTORY_BALANCE,
    exportEndpoint: API_ENDPOINTS.REPORTS_INVENTORY_BALANCE_EXPORT_EXCEL,
    fileStem: "bao-cao-ton-kho-hien-tai",
  },
  xnt: {
    label: "Nhập-Xuất-Tồn",
    endpoint: API_ENDPOINTS.REPORTS_XNT_ENHANCED,
    exportEndpoint: API_ENDPOINTS.REPORTS_XNT_ENHANCED_EXPORT_EXCEL,
    rowsKey: "lines",
    fileStem: "bao-cao-xnt",
    dateFilter: true,
  },
  "document-history": {
    label: "Lịch sử nhập/xuất",
    endpoint: API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY,
    exportEndpoint: API_ENDPOINTS.REPORTS_DOCUMENT_HISTORY_EXPORT_EXCEL,
    fileStem: "lich-su-phieu",
    dateFilter: true,
  },
  "movement-trace": {
    label: "Movement / Trace",
    endpoint: API_ENDPOINTS.REPORTS_MOVEMENT_TRACE,
    exportEndpoint: API_ENDPOINTS.REPORTS_MOVEMENT_TRACE_EXPORT_EXCEL,
    fileStem: "movement-trace",
    dateFilter: true,
  },
  "import-match": {
    label: "Đối soát toa",
    endpoint: API_ENDPOINTS.REPORTS_IMPORT_MATCH,
    exportEndpoint: API_ENDPOINTS.REPORTS_IMPORT_MATCH_EXPORT_EXCEL,
    fileStem: "doi-soat-toa",
    dateFilter: true,
  },
  "label-log": {
    label: "Packing Label",
    endpoint: API_ENDPOINTS.REPORTS_LABEL_LOG,
    exportEndpoint: API_ENDPOINTS.REPORTS_LABEL_LOG_EXPORT_EXCEL,
    fileStem: "packing-label-log",
    dateFilter: true,
  },
  warranty: {
    label: "Bảo hành & linh kiện",
    endpoint: API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS,
    exportEndpoint: API_ENDPOINTS.REPORTS_WARRANTY_DEFECTS_EXPORT_EXCEL,
    fileStem: "bao-cao-bao-hanh",
    dateFilter: true,
  },
  "outbound-by-agency": {
    label: "Xuất theo nơi nhận",
    endpoint: API_ENDPOINTS.REPORTS_OUTBOUND_BY_AGENCY,
    exportEndpoint: API_ENDPOINTS.REPORTS_OUTBOUND_BY_AGENCY_EXPORT_EXCEL,
    fileStem: "xuat-theo-noi-nhan",
    dateFilter: true,
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

function columnsFor(report: ReportKey): TableColumnsType<Raw> {
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
          width: 120,
          render: (v) => (
            <Tag color={v === "MATCH" ? "success" : "error"}>{text(v)}</Tag>
          ),
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
        { title: "Tồn", dataIndex: "stock_status", width: 120 },
        { title: "Đầu kỳ", dataIndex: "opening", align: "right", render: fmt },
        { title: "Nhập", dataIndex: "receipt", align: "right", render: fmt },
        { title: "Xuất", dataIndex: "issue", align: "right", render: fmt },
        {
          title: "Xuất LK",
          dataIndex: "component_issue",
          align: "right",
          render: fmt,
        },
        {
          title: "Reversal",
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
        {
          title: "Thời gian",
          dataIndex: "occurred_at",
          width: 170,
          fixed: "left",
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
      return [
        {
          title: "Mã batch",
          dataIndex: "import_no",
          width: 150,
          fixed: "left",
        },
        {
          title: "File",
          dataIndex: "source_file_name",
          width: 220,
          ellipsis: true,
        },
        {
          title: "Trạng thái",
          dataIndex: "status",
          width: 120,
          render: statusTag,
        },
        {
          title: "Tổng dòng",
          dataIndex: "total_rows",
          align: "right",
          render: fmt,
        },
        {
          title: "Hợp lệ",
          dataIndex: "valid_rows",
          align: "right",
          render: fmt,
        },
        { title: "Lỗi", dataIndex: "error_rows", align: "right", render: fmt },
        {
          title: "Pass rate",
          dataIndex: "pass_rate",
          align: "right",
          render: (v) => `${n(v)}%`,
        },
        {
          title: "SL khớp",
          dataIndex: "matched_qty",
          align: "right",
          render: fmt,
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
        {
          title: "Lần in",
          dataIndex: "total_attempts",
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
        { title: "Ngày nhận", dataIndex: "received_at", width: 170 },
        { title: "Cập nhật", dataIndex: "updated_at", width: 170 },
      ];
    case "outbound-by-agency":
      return [
        { title: "Mã nơi nhận", dataIndex: "agency_code", width: 130 },
        { title: "Nơi nhận", dataIndex: "agency_name", width: 190 },
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
        ["Consumed", summary.consumed, "success"],
        ["Rejected", summary.rejected, "error"],
        ["Matched qty", summary.total_matched_qty, "blue"],
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
  const [printerId, setPrinterId] = useState<string>();
  const [defectId, setDefectId] = useState<string>();
  const [identification, setIdentification] = useState<string>();
  const [movementType, setMovementType] = useState<string>();
  const [docType, setDocType] = useState<"all" | "inbound" | "outbound">("all");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);
  const [exporting, setExporting] = useState<"xlsx" | "pdf" | null>(null);

  const warehouses = useWarehouseOptions();
  const printers = usePrinterOptions();
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
    if (report === "inventory-balance") {
      if (keyword.trim()) result.keyword = keyword.trim();
      if (status) result.stock_status = status;
      if (warehouseId) result.warehouse_id = warehouseId;
    }
    if (report === "xnt") {
      if (keyword.trim()) result.keyword = keyword.trim();
      if (warehouseId) result.warehouse_id = warehouseId;
    }
    if (report === "document-history") {
      result.doc_type = docType;
      if (keyword.trim()) result.keyword = keyword.trim();
      if (status) result.status = status;
    }
    if (report === "movement-trace") {
      if (keyword.trim()) result.code_value = keyword.trim();
      if (movementType) result.movement_type = movementType;
      if (warehouseId) result.warehouse_id = warehouseId;
    }
    if (report === "import-match") {
      if (keyword.trim()) result.keyword = keyword.trim();
      if (status) result.status = status;
    }
    if (report === "label-log") {
      if (keyword.trim()) result.keyword = keyword.trim();
      if (status) result.status = status;
      if (printerId) result.printer_id = printerId;
    }
    if (report === "warranty") {
      if (status) result.status = status;
      if (defectId) result.defect_id = defectId;
      if (identification) result.identification_status = identification;
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
    printerId,
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

  const exportReport = async (format: "xlsx" | "pdf") => {
    if (config.dateFilter && invalidPeriod) return;
    setExporting(format);
    try {
      const { page: _page, per_page: _perPage, ...filters } = params;
      const blob = await http.downloadBlob(config.exportEndpoint, {
        params: { ...filters, ...(format === "pdf" ? { format: "pdf" } : {}) },
      });
      const suffix = config.dateFilter ? `-${from}-${to}` : "";
      handleBlobDownload(blob, `${config.fileStem}${suffix}.${format}`);
      toast.success(
        `Đã xuất ${format.toUpperCase()} theo đúng bộ lọc hiện tại.`,
      );
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Xuất báo cáo thất bại."));
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
    <div className="reversal-page">
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
        ].includes(report) ? (
          <Input
            allowClear
            prefix={<SearchOutlined />}
            style={{ width: 230 }}
            placeholder={
              report === "movement-trace" ? "Mã vật lý / barcode" : "Từ khóa"
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

        {report === "outbound-by-agency" ? (
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
            (config.dateFilter && invalidPeriod)
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
            (config.dateFilter && invalidPeriod)
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
          title="PII không hiển thị trên màn hình; export chỉ có PII khi BE xác nhận warranty.pii.export và mọi lần export đều audit."
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

      <Table<Raw>
        rowKey="__rowKey"
        dataSource={rows}
        columns={columnsFor(report)}
        loading={query.isLoading || query.isFetching}
        scroll={{ x: "max-content" }}
        pagination={{
          current: n(pagination.current_page, page),
          pageSize: n(pagination.per_page, perPage),
          total,
          showSizeChanger: false,
          showTotal: (value) => `Tổng ${fmt(value)} bản ghi`,
          onChange: (next) => setPage(next),
        }}
        locale={{
          emptyText: query.isError
            ? "Không tải được dữ liệu"
            : "Không có dữ liệu theo bộ lọc",
        }}
      />

      {report === "warranty" && Array.isArray(query.data?.by_defect) ? (
        <Table<Raw>
          style={{ marginTop: 16 }}
          size="small"
          pagination={false}
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
