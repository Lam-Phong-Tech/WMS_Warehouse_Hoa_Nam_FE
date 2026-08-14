import { useMemo, useState } from "react";
import {
  Alert,
  DatePicker,
  Input,
  Select,
  Table,
  Tabs,
  Tag,
  Space,
} from "antd";
import { DownloadOutlined, SearchOutlined } from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { toast } from "sonner";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import { ActionButton } from "@/shared/components/permission/ActionButton";
import {
  downloadXntEnhancedExcel,
  downloadWarrantyReportExcel,
  downloadInventoryBalanceExcel,
  downloadDocumentHistoryExcel,
  downloadImportMatchExcel,
  downloadLabelLogExcel,
  downloadOutboundByAgencyExcel,
  downloadMovementTraceExcel,
  getExportErrorMessage,
  type XntEnhancedParams,
  type DocumentHistoryParams,
  type ImportMatchParams,
  type LabelLogParams,
  type OutboundByAgencyParams,
  type MovementTraceParams,
  type InventoryBalanceParams,
  type WarrantyReportParams,
} from "../services/reportsService";
import {
  useInventoryBalanceReport,
  useXntEnhancedReport,
  useDocumentHistoryReport,
  useImportMatchReport,
  useLabelLogReport,
  useOutboundByAgencyReport,
  useMovementTraceReport,
  useWarrantyReport,
} from "../hooks/use-reports";
import {
  WARRANTY_STATUS_COLORS,
  WARRANTY_STATUS_LABELS,
  formatWarrantyDateTime,
} from "@/modules/warranty/constants";

type ReportTab =
  | "inventory-balance"
  | "xnt"
  | "doc-history"
  | "movement-trace"
  | "import-match"
  | "label-log"
  | "warranty"
  | "by-agency";

const DOC_STATUS_COLORS: Record<string, string> = {
  DRAFT: "default",
  SCANNING: "processing",
  POSTED: "success",
  CANCELLED: "error",
};

const LABEL_STATUS_COLORS: Record<string, string> = {
  PENDING_PRINT: "processing",
  PRINTED: "success",
  PRINT_FAILED: "error",
};

const IMPORT_STATUS_COLORS: Record<string, string> = {
  UPLOADED: "default",
  VALIDATED: "processing",
  CONSUMED: "success",
  REJECTED: "error",
};

const fmtNum = (n: number) => new Intl.NumberFormat("vi-VN").format(n);

function useDateRange(defaultDays = 30) {
  const [period, setPeriod] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(defaultDays, "day"),
    dayjs(),
  ]);
  const invalidPeriod = period[0].isAfter(period[1], "day");
  const from = period[0].format("YYYY-MM-DD");
  const to = period[1].format("YYYY-MM-DD");
  return { period, setPeriod, invalidPeriod, from, to };
}

function handleBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
}

function PeriodWarning() {
  return (
    <Alert
      showIcon
      type="error"
      style={{ marginBottom: 16 }}
      message="Bộ lọc ngày chưa hợp lệ"
      description="Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc."
    />
  );
}

// ─── Tab: Tồn kho hiện tại ───

function InventoryBalanceTab() {
  const [keyword, setKeyword] = useState("");
  const [stockStatus, setStockStatus] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const params = useMemo<InventoryBalanceParams>(
    () => ({
      ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
      ...(stockStatus ? { stock_status: stockStatus } : {}),
    }),
    [keyword, stockStatus],
  );

  const { data, isLoading, error, refetch } = useInventoryBalanceReport(params);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await downloadInventoryBalanceExcel(params);
      handleBlobDownload(blob, "bao-cao-ton-kho-hien-tai.xlsx");
      toast.success("Đã xuất báo cáo tồn kho");
    } catch (err) {
      toast.error(getExportErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const mismatchCount = data?.summary.mismatchCount ?? 0;
  const rows = data?.rows ?? [];

  return (
    <>
      <div className="toolbar">
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder="Tìm SKU hoặc tên sản phẩm"
          style={{ maxWidth: 280, width: "100%" }}
          value={keyword}
          onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
        />
        <Select
          allowClear
          placeholder="Trạng thái tồn"
          style={{ width: 160 }}
          value={stockStatus}
          onChange={(v) => { setStockStatus(v); setPage(1); }}
          options={[
            { value: "AVAILABLE", label: "AVAILABLE" },
            { value: "NON_SELLABLE", label: "NON_SELLABLE" },
            { value: "DEFECTIVE", label: "DEFECTIVE" },
            { value: "QUARANTINE", label: "QUARANTINE" },
          ]}
        />
        <div className="spacer" />
        <ActionButton
          module="reports" action="export" permissionCode="REPORT_EXPORT" mode="disable"
          type="primary" icon={<DownloadOutlined />}
          onClick={handleExport} loading={exporting} disabled={isLoading || exporting}
          disabledTooltip="Bạn không có quyền xuất báo cáo"
        >
          Xuất XLSX
        </ActionButton>
      </div>

      {mismatchCount > 0 && (
        <Alert showIcon type="warning" style={{ marginBottom: 16 }}
          message={`Phát hiện ${mismatchCount} dòng tồn kho lệch ledger`}
          description="Kiểm tra chi tiết cột Đối soát để xử lý."
        />
      )}

      {data && (
        <Space wrap style={{ marginBottom: 12 }}>
          <Tag>Tổng {fmtNum(data.summary.totalRows)} dòng</Tag>
          <Tag color="blue">Tồn kho: {fmtNum(data.summary.totalOnHand)}</Tag>
          <Tag color="green">Khả dụng: {fmtNum(data.summary.totalAvailable)}</Tag>
          <Tag>Cập nhật: {data.dataAsOf}</Tag>
        </Space>
      )}

      {error && !isLoading && (
        <ApiErrorAlert error={error} title="Không thể tải báo cáo tồn kho"
          onRetry={() => refetch()} style={{ marginBottom: 16 }} />
      )}

      <MvpPageSizeSelector value={perPage} onChange={(v) => { setPerPage(v); setPage(1); }} />

      <Table
        dataSource={rows} rowKey="id" loading={isLoading}
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize: perPage,
          showSizeChanger: false,
          showTotal: (total) => `Tổng ${fmtNum(total)} bản ghi`,
          onChange: (p) => setPage(p),
        }}
        locale={{
          emptyText: error ? "Không tải được dữ liệu" : "Không có dữ liệu tồn kho",
        }}
        columns={[
          { title: "Kho", dataIndex: "warehouseCode", key: "warehouseCode", width: 100 },
          { title: "Mã SKU", dataIndex: "productCode", key: "productCode", width: 140, fixed: "left" },
          { title: "Tên sản phẩm", dataIndex: "productName", key: "productName", width: 220 },
          { title: "Trạng thái", dataIndex: "stockStatus", key: "stockStatus", width: 120 },
          { title: "Tồn kho", dataIndex: "onHandQty", key: "onHandQty", align: "right" },
          { title: "Khả dụng", dataIndex: "availableQty", key: "availableQty", align: "right" },
          { title: "Đã giữ", dataIndex: "reservedQty", key: "reservedQty", align: "right" },
          { title: "Ledger", dataIndex: "ledgerQty", key: "ledgerQty", align: "right" },
          {
            title: "Chênh lệch", dataIndex: "variance", key: "variance", align: "right", width: 110,
            render: (v: number) => v !== 0 ? <Tag color="error">{fmtNum(v)}</Tag> : <span>{fmtNum(v)}</span>,
          },
          {
            title: "Đối soát", dataIndex: "reconciliationStatus", key: "reconciliationStatus", width: 120,
            render: (v: string) => <Tag color={v === "MATCH" ? "success" : "error"}>{v}</Tag>,
          },
        ]}
      />
    </>
  );
}

// ─── Tab: Nhập-Xuất-Tồn (nâng cấp) ───

function XntEnhancedTab() {
  const { period, setPeriod, invalidPeriod, from, to } = useDateRange();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const params = useMemo<XntEnhancedParams>(
    () => ({ from_date: from, to_date: to }),
    [from, to],
  );

  const { data, isLoading, error, refetch } = useXntEnhancedReport(params, !invalidPeriod);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (invalidPeriod) return;
    setExporting(true);
    try {
      const blob = await downloadXntEnhancedExcel(params);
      handleBlobDownload(blob, `xnt-chitiet-${from}-${to}.xlsx`);
      toast.success("Đã xuất báo cáo XNT");
    } catch (err) {
      toast.error(getExportErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const lines = data?.lines ?? [];

  return (
    <>
      {data?.formula && (
        <Alert showIcon type="info" style={{ marginBottom: 16 }}
          message={`Công thức: ${data.formula}`}
        />
      )}

      <div className="toolbar">
        <DatePicker value={period[0]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([v, period[1]]); setPage(1); } }} />
        <DatePicker value={period[1]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([period[0], v]); setPage(1); } }} />
        <div className="spacer" />
        <ActionButton
          module="reports" action="export" permissionCode="REPORT_EXPORT" mode="disable"
          type="primary" icon={<DownloadOutlined />}
          onClick={handleExport} loading={exporting}
          disabled={invalidPeriod || isLoading || exporting}
          disabledTooltip="Bạn không có quyền xuất báo cáo hoặc bộ lọc chưa hợp lệ"
        >
          Xuất XLSX
        </ActionButton>
      </div>

      {invalidPeriod && <PeriodWarning />}

      {error && !isLoading && (
        <ApiErrorAlert error={error} title="Không thể tải báo cáo XNT"
          onRetry={() => refetch()} style={{ marginBottom: 16 }} />
      )}

      <MvpPageSizeSelector value={perPage} onChange={(v) => { setPerPage(v); setPage(1); }} />

      <Table
        dataSource={lines}
        rowKey={(r) => `${r.warehouseCode}-${r.productCode}-${r.stockStatus}`}
        loading={isLoading} scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize: perPage,
          showSizeChanger: false,
          showTotal: (total) => `Tổng ${fmtNum(total)} dòng`,
          onChange: (p) => setPage(p),
        }}
        locale={{
          emptyText: error ? "Không tải được dữ liệu" : "Không có dữ liệu XNT theo bộ lọc",
        }}
        columns={[
          { title: "Kho", dataIndex: "warehouseCode", key: "warehouseCode", width: 100 },
          { title: "Mã SKU", dataIndex: "productCode", key: "productCode", fixed: "left", width: 140 },
          { title: "Tên SKU", dataIndex: "productName", key: "productName", width: 200 },
          { title: "Trạng thái", dataIndex: "stockStatus", key: "stockStatus", width: 110 },
          { title: "Đầu kỳ", dataIndex: "opening", key: "opening", align: "right" },
          { title: "Nhập", dataIndex: "receipt", key: "receipt", align: "right" },
          { title: "Xuất", dataIndex: "issue", key: "issue", align: "right" },
          { title: "Xuất LK", dataIndex: "componentIssue", key: "componentIssue", align: "right" },
          { title: "Hoàn đảo", dataIndex: "reversalNet", key: "reversalNet", align: "right" },
          { title: "Cuối kỳ", dataIndex: "closing", key: "closing", align: "right" },
        ]}
      />
    </>
  );
}

// ─── Tab: Lịch sử phiếu nhập/xuất ───

function DocumentHistoryTab() {
  const { period, setPeriod, invalidPeriod, from, to } = useDateRange();
  const [docType, setDocType] = useState<"inbound" | "outbound" | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const params = useMemo<DocumentHistoryParams>(
    () => ({
      from_date: from,
      to_date: to,
      doc_type: docType,
      ...(statusFilter ? { status: statusFilter } : {}),
      ...(keyword.trim() ? { keyword: keyword.trim() } : {}),
    }),
    [from, to, docType, statusFilter, keyword],
  );

  const { data, isLoading, error, refetch } = useDocumentHistoryReport(params, !invalidPeriod);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (invalidPeriod) return;
    setExporting(true);
    try {
      const blob = await downloadDocumentHistoryExcel(params);
      handleBlobDownload(blob, `lich-su-phieu-${from}-${to}.xlsx`);
      toast.success("Đã xuất lịch sử phiếu");
    } catch (err) {
      toast.error(getExportErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.rows ?? [];

  return (
    <>
      <div className="toolbar">
        <DatePicker value={period[0]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([v, period[1]]); setPage(1); } }} />
        <DatePicker value={period[1]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([period[0], v]); setPage(1); } }} />
        <Select style={{ width: 150 }} value={docType}
          onChange={(v) => { setDocType(v); setPage(1); }}
          options={[
            { value: "all", label: "Tất cả" },
            { value: "inbound", label: "Phiếu nhập" },
            { value: "outbound", label: "Phiếu xuất" },
          ]}
        />
        <Select allowClear placeholder="Trạng thái" style={{ width: 140 }}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          options={[
            { value: "DRAFT", label: "DRAFT" },
            { value: "SCANNING", label: "SCANNING" },
            { value: "POSTED", label: "POSTED" },
            { value: "CANCELLED", label: "CANCELLED" },
          ]}
        />
        <Input allowClear prefix={<SearchOutlined />} placeholder="Số phiếu, đối tác"
          style={{ maxWidth: 220, width: "100%" }}
          value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
        />
        <div className="spacer" />
        <ActionButton
          module="reports" action="export" permissionCode="REPORT_EXPORT" mode="disable"
          type="primary" icon={<DownloadOutlined />}
          onClick={handleExport} loading={exporting}
          disabled={invalidPeriod || isLoading || exporting}
          disabledTooltip="Bạn không có quyền xuất báo cáo hoặc bộ lọc chưa hợp lệ"
        >
          Xuất XLSX
        </ActionButton>
      </div>

      {invalidPeriod && <PeriodWarning />}

      {data && (
        <Space wrap style={{ marginBottom: 12 }}>
          <Tag>Tổng {fmtNum(data.summary.total)}</Tag>
          <Tag color="default">Nháp {fmtNum(data.summary.draft)}</Tag>
          <Tag color="processing">Scanning {fmtNum(data.summary.scanning)}</Tag>
          <Tag color="success">Đã post {fmtNum(data.summary.posted)}</Tag>
          <Tag color="error">Đã hủy {fmtNum(data.summary.cancelled)}</Tag>
        </Space>
      )}

      {error && !isLoading && (
        <ApiErrorAlert error={error} title="Không thể tải lịch sử phiếu"
          onRetry={() => refetch()} style={{ marginBottom: 16 }} />
      )}

      <MvpPageSizeSelector value={perPage} onChange={(v) => { setPerPage(v); setPage(1); }} />

      <Table
        dataSource={rows} rowKey="id" loading={isLoading}
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize: perPage,
          showSizeChanger: false,
          showTotal: (total) => `Tổng ${fmtNum(total)} phiếu`,
          onChange: (p) => setPage(p),
        }}
        locale={{
          emptyText: error ? "Không tải được dữ liệu" : "Không có phiếu trong khoảng thời gian đã chọn",
        }}
        columns={[
          { title: "Số phiếu", dataIndex: "documentNo", key: "documentNo", width: 160, fixed: "left" },
          {
            title: "Loại", dataIndex: "docType", key: "docType", width: 100,
            render: (v: string) => <Tag color={v === "INBOUND" ? "blue" : "orange"}>{v === "INBOUND" ? "Nhập" : "Xuất"}</Tag>,
          },
          { title: "Kho", dataIndex: "warehouseCode", key: "warehouseCode", width: 100 },
          { title: "Đối tác / Nơi nhận", dataIndex: "counterpart", key: "counterpart", width: 200 },
          { title: "Ngày chứng từ", dataIndex: "documentDate", key: "documentDate", width: 120 },
          {
            title: "Trạng thái", dataIndex: "status", key: "status", width: 120,
            render: (v: string) => <Tag color={DOC_STATUS_COLORS[v]}>{v}</Tag>,
          },
          { title: "Ngày post", dataIndex: "postedAt", key: "postedAt", width: 160 },
          { title: "Người tạo", dataIndex: "createdByName", key: "createdByName", width: 140 },
          { title: "Ghi chú", dataIndex: "note", key: "note", ellipsis: true },
        ]}
      />
    </>
  );
}

// ─── Tab: Đối soát toa (Excel Import/Match) ───

function ImportMatchTab() {
  const { period, setPeriod, invalidPeriod, from, to } = useDateRange();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const params = useMemo<ImportMatchParams>(
    () => ({
      from_date: from,
      to_date: to,
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    [from, to, statusFilter],
  );

  const { data, isLoading, error, refetch } = useImportMatchReport(params, !invalidPeriod);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (invalidPeriod) return;
    setExporting(true);
    try {
      const blob = await downloadImportMatchExcel(params);
      handleBlobDownload(blob, `doi-soat-toa-${from}-${to}.xlsx`);
      toast.success("Đã xuất báo cáo đối soát toa");
    } catch (err) {
      toast.error(getExportErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.rows ?? [];

  return (
    <>
      <div className="toolbar">
        <DatePicker value={period[0]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([v, period[1]]); setPage(1); } }} />
        <DatePicker value={period[1]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([period[0], v]); setPage(1); } }} />
        <Select allowClear placeholder="Trạng thái" style={{ width: 160 }}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          options={[
            { value: "UPLOADED", label: "Đã upload" },
            { value: "VALIDATED", label: "Đã validate" },
            { value: "CONSUMED", label: "Đã consume" },
            { value: "REJECTED", label: "Bị reject" },
          ]}
        />
        <div className="spacer" />
        <ActionButton
          module="reports" action="export" permissionCode="REPORT_EXPORT" mode="disable"
          type="primary" icon={<DownloadOutlined />}
          onClick={handleExport} loading={exporting}
          disabled={invalidPeriod || isLoading || exporting}
          disabledTooltip="Bạn không có quyền xuất báo cáo hoặc bộ lọc chưa hợp lệ"
        >
          Xuất XLSX
        </ActionButton>
      </div>

      {invalidPeriod && <PeriodWarning />}

      {data && (
        <Space wrap style={{ marginBottom: 12 }}>
          <Tag>Tổng {fmtNum(data.summary.totalBatches)} batch</Tag>
          <Tag color="success">Consumed {fmtNum(data.summary.consumed)}</Tag>
          <Tag color="error">Rejected {fmtNum(data.summary.rejected)}</Tag>
          <Tag color="blue">TB tỷ lệ {data.summary.avgPassRate}%</Tag>
          <Tag>SL khớp: {fmtNum(data.summary.totalMatchedQty)}</Tag>
        </Space>
      )}

      {error && !isLoading && (
        <ApiErrorAlert error={error} title="Không thể tải báo cáo đối soát toa"
          onRetry={() => refetch()} style={{ marginBottom: 16 }} />
      )}

      <MvpPageSizeSelector value={perPage} onChange={(v) => { setPerPage(v); setPage(1); }} />

      <Table
        dataSource={rows} rowKey="id" loading={isLoading}
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize: perPage,
          showSizeChanger: false,
          showTotal: (total) => `Tổng ${fmtNum(total)} batch`,
          onChange: (p) => setPage(p),
        }}
        locale={{
          emptyText: error ? "Không tải được dữ liệu" : "Không có batch import trong khoảng thời gian đã chọn",
        }}
        columns={[
          { title: "Mã batch", dataIndex: "importNo", key: "importNo", width: 140, fixed: "left" },
          { title: "File", dataIndex: "sourceFileName", key: "sourceFileName", width: 200, ellipsis: true },
          {
            title: "Trạng thái", dataIndex: "status", key: "status", width: 120,
            render: (v: string) => <Tag color={IMPORT_STATUS_COLORS[v]}>{v}</Tag>,
          },
          { title: "Tổng dòng", dataIndex: "totalRows", key: "totalRows", align: "right" },
          { title: "Hợp lệ", dataIndex: "validRows", key: "validRows", align: "right" },
          { title: "Lỗi", dataIndex: "errorRows", key: "errorRows", align: "right" },
          {
            title: "Tỷ lệ (%)", dataIndex: "passRate", key: "passRate", align: "right", width: 100,
            render: (v: number) => <Tag color={v >= 99.5 ? "success" : v >= 90 ? "warning" : "error"}>{v}%</Tag>,
          },
          { title: "SL khớp", dataIndex: "matchedQty", key: "matchedQty", align: "right" },
          { title: "Ngày upload", dataIndex: "uploadedAt", key: "uploadedAt", width: 160 },
          { title: "Người upload", dataIndex: "uploadedByName", key: "uploadedByName", width: 140 },
        ]}
      />
    </>
  );
}

// ─── Tab: Nhật ký nhãn ───

function LabelLogTab() {
  const { period, setPeriod, invalidPeriod, from, to } = useDateRange();
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const params = useMemo<LabelLogParams>(
    () => ({
      from_date: from,
      to_date: to,
      ...(statusFilter ? { status: statusFilter } : {}),
    }),
    [from, to, statusFilter],
  );

  const { data, isLoading, error, refetch } = useLabelLogReport(params, !invalidPeriod);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (invalidPeriod) return;
    setExporting(true);
    try {
      const blob = await downloadLabelLogExcel(params);
      handleBlobDownload(blob, `nhat-ky-nhan-${from}-${to}.xlsx`);
      toast.success("Đã xuất nhật ký nhãn");
    } catch (err) {
      toast.error(getExportErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.rows ?? [];

  return (
    <>
      <div className="toolbar">
        <DatePicker value={period[0]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([v, period[1]]); setPage(1); } }} />
        <DatePicker value={period[1]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([period[0], v]); setPage(1); } }} />
        <Select allowClear placeholder="Trạng thái" style={{ width: 170 }}
          value={statusFilter}
          onChange={(v) => { setStatusFilter(v); setPage(1); }}
          options={[
            { value: "PENDING_PRINT", label: "Chờ in" },
            { value: "PRINTED", label: "Đã in" },
            { value: "PRINT_FAILED", label: "Lỗi in" },
          ]}
        />
        <div className="spacer" />
        <ActionButton
          module="reports" action="export" permissionCode="REPORT_EXPORT" mode="disable"
          type="primary" icon={<DownloadOutlined />}
          onClick={handleExport} loading={exporting}
          disabled={invalidPeriod || isLoading || exporting}
          disabledTooltip="Bạn không có quyền xuất báo cáo hoặc bộ lọc chưa hợp lệ"
        >
          Xuất XLSX
        </ActionButton>
      </div>

      {invalidPeriod && <PeriodWarning />}

      {data && (
        <Space wrap style={{ marginBottom: 12 }}>
          <Tag>Tổng {fmtNum(data.summary.totalSnapshots)} nhãn</Tag>
          <Tag color="success">Đã in {fmtNum(data.summary.printed)}</Tag>
          <Tag color="processing">Chờ in {fmtNum(data.summary.pending)}</Tag>
          <Tag color="error">Lỗi {fmtNum(data.summary.failed)} ({data.summary.failureRate}%)</Tag>
          <Tag color="warning">In lại {fmtNum(data.summary.reprinted)} ({data.summary.reprintRate}%)</Tag>
        </Space>
      )}

      {error && !isLoading && (
        <ApiErrorAlert error={error} title="Không thể tải nhật ký nhãn"
          onRetry={() => refetch()} style={{ marginBottom: 16 }} />
      )}

      <MvpPageSizeSelector value={perPage} onChange={(v) => { setPerPage(v); setPage(1); }} />

      <Table
        dataSource={rows} rowKey="id" loading={isLoading}
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize: perPage,
          showSizeChanger: false,
          showTotal: (total) => `Tổng ${fmtNum(total)} nhãn`,
          onChange: (p) => setPage(p),
        }}
        locale={{
          emptyText: error ? "Không tải được dữ liệu" : "Không có nhãn trong khoảng thời gian đã chọn",
        }}
        columns={[
          { title: "Mã nhãn", dataIndex: "labelCode", key: "labelCode", width: 140, fixed: "left" },
          { title: "Phiếu xuất", dataIndex: "outboundNo", key: "outboundNo", width: 140 },
          { title: "SKU", dataIndex: "skuCode", key: "skuCode", width: 120 },
          { title: "Sản phẩm", dataIndex: "productName", key: "productName", width: 200, ellipsis: true },
          { title: "Mã vật lý", dataIndex: "itemCodeValue", key: "itemCodeValue", width: 160 },
          {
            title: "Trạng thái", dataIndex: "status", key: "status", width: 120,
            render: (v: string) => <Tag color={LABEL_STATUS_COLORS[v]}>{v}</Tag>,
          },
          { title: "In lại", dataIndex: "reprintCount", key: "reprintCount", align: "right", width: 80 },
          { title: "Attempts", dataIndex: "totalAttempts", key: "totalAttempts", align: "right", width: 90 },
          { title: "Lỗi", dataIndex: "failedCount", key: "failedCount", align: "right", width: 60 },
          { title: "Ngày tạo", dataIndex: "createdAt", key: "createdAt", width: 160 },
          { title: "Người tạo", dataIndex: "createdByName", key: "createdByName", width: 140 },
        ]}
      />
    </>
  );
}

// ─── Tab: Bảo hành & linh kiện ───

function WarrantyTab() {
  const { period, setPeriod, invalidPeriod, from, to } = useDateRange();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const params = useMemo<WarrantyReportParams>(
    () => ({ from, to }),
    [from, to],
  );

  const { data, isLoading, error, refetch } = useWarrantyReport(params, !invalidPeriod);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (invalidPeriod) return;
    setExporting(true);
    try {
      const blob = await downloadWarrantyReportExcel(params);
      handleBlobDownload(blob, `bao-cao-bao-hanh-${from}-${to}.xlsx`);
      toast.success("Đã xuất báo cáo bảo hành (PII chỉ có khi tài khoản được cấp warranty.pii.export)");
    } catch (err) {
      toast.error(getExportErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.rows ?? [];

  return (
    <>
      <Alert showIcon type="info" style={{ marginBottom: 16 }}
        message="Báo cáo bảo hành mặc định không hiển thị PII"
        description="Tên/SĐT/địa chỉ khách chỉ xuất hiện trong file export khi tài khoản được cấp warranty.pii.export; mọi lần export đều được audit."
      />

      <div className="toolbar">
        <DatePicker value={period[0]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([v, period[1]]); setPage(1); } }} />
        <DatePicker value={period[1]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([period[0], v]); setPage(1); } }} />
        <div className="spacer" />
        <ActionButton
          module="reports" action="export" permissionCode="REPORT_EXPORT" mode="disable"
          type="primary" icon={<DownloadOutlined />}
          onClick={handleExport} loading={exporting}
          disabled={invalidPeriod || isLoading || exporting}
          disabledTooltip="Bạn không có quyền xuất báo cáo hoặc bộ lọc chưa hợp lệ"
        >
          Xuất Excel
        </ActionButton>
      </div>

      {invalidPeriod && <PeriodWarning />}

      {data && (
        <Space wrap style={{ marginBottom: 12 }}>
          <Tag>Tổng {fmtNum(data.summary.total)} case</Tag>
          <Tag color="processing">Đang xử lý {fmtNum(data.summary.processing)}</Tag>
          <Tag color="success">Đã trả {fmtNum(data.summary.returned)}</Tag>
          <Tag color="error">Đã hủy {fmtNum(data.summary.cancelled)}</Tag>
          <Tag color="warning">TEMP_ONLY {fmtNum(data.summary.tempOnly)}</Tag>
        </Space>
      )}

      {error && !isLoading && (
        <ApiErrorAlert error={error} title="Không thể tải báo cáo bảo hành & linh kiện"
          onRetry={() => refetch()} style={{ marginBottom: 16 }} />
      )}

      <MvpPageSizeSelector value={perPage} onChange={(v) => { setPerPage(v); setPage(1); }} />

      <Table
        dataSource={rows} rowKey="id" loading={isLoading}
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize: perPage,
          showSizeChanger: false,
          showTotal: (total) => `Tổng ${fmtNum(total)} case bảo hành`,
          onChange: (p) => setPage(p),
        }}
        locale={{
          emptyText: error ? "Không tải được dữ liệu" : "Không có case bảo hành trong khoảng thời gian đã chọn",
        }}
        columns={[
          {
            title: "Case", dataIndex: "caseNo", key: "caseNo",
            render: (v: string, row) => (
              <Space size={4}>
                <strong>{v}</strong>
                {row.identification === "TEMP_ONLY" && <Tag color="warning">TEMP</Tag>}
              </Space>
            ),
          },
          { title: "SKU/Model", dataIndex: "model", key: "model" },
          { title: "Bệnh / lỗi", dataIndex: "defect", key: "defect" },
          { title: "Linh kiện đã xuất", dataIndex: "componentsIssued", key: "componentsIssued" },
          {
            title: "Trạng thái", dataIndex: "status", key: "status",
            render: (v: string) => <Tag color={WARRANTY_STATUS_COLORS[v]}>{WARRANTY_STATUS_LABELS[v] ?? v}</Tag>,
          },
          {
            title: "Ngày cập nhật", dataIndex: "updatedAt", key: "updatedAt",
            render: (v: string) => formatWarrantyDateTime(v),
          },
        ]}
      />

      <Table
        style={{ marginTop: 16 }}
        dataSource={data?.byDefect ?? []} rowKey="defect" size="small"
        loading={isLoading} pagination={false} scroll={{ x: "max-content" }}
        locale={{
          emptyText: error ? "Không tải được dữ liệu" : "Chưa có tổng hợp theo bệnh/lỗi",
        }}
        columns={[
          { title: "Tổng hợp theo bệnh / lỗi", dataIndex: "defect", key: "defect" },
          { title: "Số case", dataIndex: "total", key: "total", align: "right" },
          { title: "Đang xử lý", dataIndex: "processing", key: "processing", align: "right" },
          { title: "Đã trả", dataIndex: "returned", key: "returned", align: "right" },
          { title: "Đã hủy", dataIndex: "cancelled", key: "cancelled", align: "right" },
          { title: "TEMP_ONLY", dataIndex: "tempOnly", key: "tempOnly", align: "right" },
        ]}
      />
    </>
  );
}

// ─── Tab: Movement / Trace ───

const MOVEMENT_TYPE_COLORS: Record<string, string> = {
  OPENING: "default",
  RECEIPT: "blue",
  ISSUE: "orange",
  COMPONENT_ISSUE: "purple",
  REVERSAL: "red",
};

const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  OPENING: "Đầu kỳ",
  RECEIPT: "Nhập",
  ISSUE: "Xuất",
  COMPONENT_ISSUE: "Xuất LK",
  REVERSAL: "Hoàn đảo",
};

function MovementTraceTab() {
  const { period, setPeriod, invalidPeriod, from, to } = useDateRange();
  const [movementType, setMovementType] = useState<string | undefined>();
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const params = useMemo<MovementTraceParams>(
    () => ({
      from_date: from,
      to_date: to,
      ...(movementType ? { movement_type: movementType } : {}),
      ...(keyword.trim() ? { code_value: keyword.trim() } : {}),
    }),
    [from, to, movementType, keyword],
  );

  const { data, isLoading, error, refetch } = useMovementTraceReport(params, !invalidPeriod);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (invalidPeriod) return;
    setExporting(true);
    try {
      const blob = await downloadMovementTraceExcel(params);
      handleBlobDownload(blob, `movement-trace-${from}-${to}.xlsx`);
      toast.success("Đã xuất báo cáo Movement/Trace");
    } catch (err) {
      toast.error(getExportErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.rows ?? [];

  return (
    <>
      {data?.formula && (
        <Alert showIcon type="info" style={{ marginBottom: 16 }}
          message={`Công thức: ${data.formula}`}
        />
      )}

      <div className="toolbar">
        <DatePicker value={period[0]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([v, period[1]]); setPage(1); } }} />
        <DatePicker value={period[1]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([period[0], v]); setPage(1); } }} />
        <Select allowClear placeholder="Loại movement" style={{ width: 160 }}
          value={movementType}
          onChange={(v) => { setMovementType(v); setPage(1); }}
          options={[
            { value: "RECEIPT", label: "Nhập kho" },
            { value: "ISSUE", label: "Xuất kho" },
            { value: "COMPONENT_ISSUE", label: "Xuất linh kiện BH" },
            { value: "REVERSAL", label: "Hoàn đảo" },
            { value: "OPENING", label: "Đầu kỳ" },
          ]}
        />
        <Input allowClear prefix={<SearchOutlined />} placeholder="Mã vật lý / barcode"
          style={{ maxWidth: 220, width: "100%" }}
          value={keyword} onChange={(e) => { setKeyword(e.target.value); setPage(1); }}
        />
        <div className="spacer" />
        <ActionButton
          module="reports" action="export" permissionCode="REPORT_EXPORT" mode="disable"
          type="primary" icon={<DownloadOutlined />}
          onClick={handleExport} loading={exporting}
          disabled={invalidPeriod || isLoading || exporting}
          disabledTooltip="Bạn không có quyền xuất báo cáo hoặc bộ lọc chưa hợp lệ"
        >
          Xuất XLSX
        </ActionButton>
      </div>

      {invalidPeriod && <PeriodWarning />}

      {data && (
        <Space wrap style={{ marginBottom: 12 }}>
          <Tag>Tổng {fmtNum(data.summary.totalMovements)} movement</Tag>
          <Tag color="blue">Net effect: {fmtNum(data.summary.netEffect)}</Tag>
          <Tag color="red">Hoàn đảo: {fmtNum(data.summary.reversalCount)}</Tag>
        </Space>
      )}

      {error && !isLoading && (
        <ApiErrorAlert error={error} title="Không thể tải báo cáo Movement/Trace"
          onRetry={() => refetch()} style={{ marginBottom: 16 }} />
      )}

      <MvpPageSizeSelector value={perPage} onChange={(v) => { setPerPage(v); setPage(1); }} />

      <Table
        dataSource={rows} rowKey="id" loading={isLoading}
        scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize: perPage,
          showSizeChanger: false,
          showTotal: (total) => `Tổng ${fmtNum(total)} dòng`,
          onChange: (p) => setPage(p),
        }}
        locale={{
          emptyText: error ? "Không tải được dữ liệu" : "Không có movement trong khoảng thời gian đã chọn",
        }}
        columns={[
          { title: "Thời gian", dataIndex: "occurredAt", key: "occurredAt", width: 170, fixed: "left" },
          {
            title: "Loại", dataIndex: "movementType", key: "movementType", width: 120,
            render: (v: string) => <Tag color={MOVEMENT_TYPE_COLORS[v]}>{MOVEMENT_TYPE_LABELS[v] ?? v}</Tag>,
          },
          { title: "Kho", dataIndex: "warehouseCode", key: "warehouseCode", width: 100 },
          { title: "Mã SKU", dataIndex: "productCode", key: "productCode", width: 140 },
          { title: "Tên SKU", dataIndex: "productName", key: "productName", width: 200, ellipsis: true },
          { title: "Trạng thái", dataIndex: "stockStatus", key: "stockStatus", width: 120 },
          {
            title: "SL thay đổi", dataIndex: "qtyDelta", key: "qtyDelta", align: "right", width: 110,
            render: (v: number) => <span style={{ color: v < 0 ? "#cf1322" : v > 0 ? "#389e0d" : undefined }}>{fmtNum(v)}</span>,
          },
          { title: "Mã vật lý", dataIndex: "physicalCode", key: "physicalCode", width: 160 },
          { title: "Nguồn", dataIndex: "sourceType", key: "sourceType", width: 120 },
          {
            title: "Gốc (reversal)", dataIndex: "originalMovementId", key: "originalMovementId", width: 140, ellipsis: true,
            render: (v: string | null) => v ? <Tag color="volcano">{v.substring(0, 8)}...</Tag> : "—",
          },
          {
            title: "Chuỗi sửa", dataIndex: "correctionChainId", key: "correctionChainId", width: 140, ellipsis: true,
            render: (v: string | null) => v ? <Tag color="geekblue">{v.substring(0, 8)}...</Tag> : "—",
          },
        ]}
      />
    </>
  );
}

// ─── Tab: Xuất theo nơi nhận ───

function OutboundByAgencyTab() {
  const { period, setPeriod, invalidPeriod, from, to } = useDateRange();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(15);

  const params = useMemo<OutboundByAgencyParams>(
    () => ({ from_date: from, to_date: to }),
    [from, to],
  );

  const { data, isLoading, error, refetch } = useOutboundByAgencyReport(params, !invalidPeriod);
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (invalidPeriod) return;
    setExporting(true);
    try {
      const blob = await downloadOutboundByAgencyExcel(params);
      handleBlobDownload(blob, `xuat-theo-noi-nhan-${from}-${to}.xlsx`);
      toast.success("Đã xuất báo cáo theo nơi nhận");
    } catch (err) {
      toast.error(getExportErrorMessage(err));
    } finally {
      setExporting(false);
    }
  };

  const detailRows = data?.rows ?? [];

  return (
    <>
      <Alert showIcon type="info" style={{ marginBottom: 16 }}
        message="Agency là chiều báo cáo, không phải stock"
        description="Báo cáo thống kê xuất cho nơi nhận (đại lý). Chỉ tính phiếu POSTED."
      />

      <div className="toolbar">
        <DatePicker value={period[0]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([v, period[1]]); setPage(1); } }} />
        <DatePicker value={period[1]} status={invalidPeriod ? "error" : undefined}
          onChange={(v) => { if (v) { setPeriod([period[0], v]); setPage(1); } }} />
        <div className="spacer" />
        <ActionButton
          module="reports" action="export" permissionCode="REPORT_EXPORT" mode="disable"
          type="primary" icon={<DownloadOutlined />}
          onClick={handleExport} loading={exporting}
          disabled={invalidPeriod || isLoading || exporting}
          disabledTooltip="Bạn không có quyền xuất báo cáo hoặc bộ lọc chưa hợp lệ"
        >
          Xuất XLSX
        </ActionButton>
      </div>

      {invalidPeriod && <PeriodWarning />}

      {data && (
        <Space wrap style={{ marginBottom: 12 }}>
          <Tag>{fmtNum(data.summary.totalAgencies)} nơi nhận</Tag>
          <Tag color="blue">{fmtNum(data.summary.totalDocuments)} phiếu</Tag>
          <Tag color="green">Tổng xuất: {fmtNum(data.summary.totalIssuedQty)}</Tag>
        </Space>
      )}

      {error && !isLoading && (
        <ApiErrorAlert error={error} title="Không thể tải báo cáo theo nơi nhận"
          onRetry={() => refetch()} style={{ marginBottom: 16 }} />
      )}

      <Table
        style={{ marginBottom: 16 }}
        dataSource={data?.byAgency ?? []} rowKey="agencyCode" size="small"
        loading={isLoading} pagination={false} scroll={{ x: "max-content" }}
        locale={{
          emptyText: error ? "Không tải được dữ liệu" : "Không có dữ liệu",
        }}
        columns={[
          { title: "Mã đại lý", dataIndex: "agencyCode", key: "agencyCode", width: 120 },
          { title: "Tên nơi nhận", dataIndex: "agencyName", key: "agencyName", width: 200 },
          { title: "Số phiếu", dataIndex: "documentCount", key: "documentCount", align: "right" },
          { title: "Tổng SL xuất", dataIndex: "totalIssuedQty", key: "totalIssuedQty", align: "right" },
          { title: "Số SKU", dataIndex: "skuCount", key: "skuCount", align: "right" },
        ]}
      />

      <MvpPageSizeSelector value={perPage} onChange={(v) => { setPerPage(v); setPage(1); }} />

      <Table
        dataSource={detailRows}
        rowKey={(r) => `${r.agencyCode}-${r.outboundNo}-${r.productCode}`}
        loading={isLoading} scroll={{ x: "max-content" }}
        pagination={{
          current: page,
          pageSize: perPage,
          showSizeChanger: false,
          showTotal: (total) => `Tổng ${fmtNum(total)} dòng chi tiết`,
          onChange: (p) => setPage(p),
        }}
        locale={{
          emptyText: error ? "Không tải được dữ liệu" : "Không có chi tiết xuất theo nơi nhận",
        }}
        columns={[
          { title: "Mã đại lý", dataIndex: "agencyCode", key: "agencyCode", width: 120 },
          { title: "Nơi nhận", dataIndex: "agencyName", key: "agencyName", width: 180 },
          { title: "Mã SKU", dataIndex: "productCode", key: "productCode", width: 120 },
          { title: "Tên SP", dataIndex: "productName", key: "productName", width: 200, ellipsis: true },
          { title: "Số phiếu", dataIndex: "outboundNo", key: "outboundNo", width: 140 },
          { title: "Ngày", dataIndex: "documentDate", key: "documentDate", width: 110 },
          { title: "Ngày post", dataIndex: "postedAt", key: "postedAt", width: 160 },
          { title: "SL yêu cầu", dataIndex: "requiredQty", key: "requiredQty", align: "right" },
          { title: "SL xuất", dataIndex: "scannedQty", key: "scannedQty", align: "right" },
        ]}
      />
    </>
  );
}

// ─── Main Page ───

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("inventory-balance");

  return (
    <div className="reversal-page">
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as ReportTab)}
        items={[
          { key: "inventory-balance", label: "Tồn kho", children: <InventoryBalanceTab /> },
          { key: "xnt", label: "Nhập-Xuất-Tồn", children: <XntEnhancedTab /> },
          { key: "doc-history", label: "Lịch sử nhập/xuất", children: <DocumentHistoryTab /> },
          { key: "movement-trace", label: "Movement / Trace", children: <MovementTraceTab /> },
          { key: "import-match", label: "Đối soát toa", children: <ImportMatchTab /> },
          { key: "label-log", label: "Nhật ký nhãn", children: <LabelLogTab /> },
          { key: "warranty", label: "Bảo hành & linh kiện", children: <WarrantyTab /> },
          { key: "by-agency", label: "Xuất theo nơi nhận", children: <OutboundByAgencyTab /> },
        ]}
      />
    </div>
  );
}
