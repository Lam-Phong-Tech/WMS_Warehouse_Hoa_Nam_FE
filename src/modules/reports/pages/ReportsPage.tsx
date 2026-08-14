/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Button,
  DatePicker,
  Input,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from "antd";
import {
  DownloadOutlined,
  ReloadOutlined,
  SearchOutlined,
} from "@ant-design/icons";
import dayjs from "dayjs";
import type { Dayjs } from "dayjs";
import { toast } from "sonner";
import {
  InlineApiError,
  ResponsiveToolbar,
  tableEmptyText,
} from "@/shared/components/feedback/BusinessState";
import { ActionButton } from "@/shared/components/permission/ActionButton";
import {
  downloadWarrantyReportExcel,
  downloadXntReportExcel,
  fetchReportsHub,
  fetchWarrantyDefectsReport,
  fetchXntReport,
  type WarrantyReportResult,
  type XntReportParams,
} from "../services/reportsService";
import type { ReportItem, XntReportRow } from "../types";
import {
  WARRANTY_STATUS_COLORS,
  WARRANTY_STATUS_LABELS,
  formatWarrantyDateTime,
} from "@/modules/warranty/constants";

type ReportTab = "hub" | "xnt" | "warranty";
type ReportScope = "warehouse" | "system";
type MovementType = "all" | "receipt" | "issue" | "adjustment" | "reversal";

const P0_REPORT_CODES = [
  "RPT-INV-01",
  "RPT-XNT-01",
  "RPT-MOV-01",
  "RPT-STK-01",
  "RPT-WAR-01",
  "RPT-IO-01",
] as const;

function isReconcileProblem(value: string): boolean {
  return ["FAIL", "WARN", "WARNING"].includes(value.toUpperCase());
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("hub");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [hubSearch, setHubSearch] = useState("");
  const [xntRows, setXntRows] = useState<XntReportRow[]>([]);
  const [warrantyReport, setWarrantyReport] =
    useState<WarrantyReportResult | null>(null);
  const [warrantyExporting, setWarrantyExporting] = useState(false);
  const [period, setPeriod] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(30, "day"),
    dayjs(),
  ]);
  const [scope, setScope] = useState<ReportScope>("system");
  const [sku, setSku] = useState("");
  const [category, setCategory] = useState("");
  const [movementType, setMovementType] = useState<MovementType>("all");
  const [hubLoading, setHubLoading] = useState(false);
  const [xntLoading, setXntLoading] = useState(false);
  const [warrantyLoading, setWarrantyLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [hubError, setHubError] = useState<unknown>(null);
  const [xntError, setXntError] = useState<unknown>(null);
  const [warrantyError, setWarrantyError] = useState<unknown>(null);
  const [exportError, setExportError] = useState<unknown>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const invalidPeriod = period[0].isAfter(period[1], "day");
  const xntParams = useMemo<XntReportParams>(
    () => ({
      from: period[0].format("YYYY-MM-DD"),
      to: period[1].format("YYYY-MM-DD"),
      scope,
      ...(sku.trim() ? { sku: sku.trim() } : {}),
      ...(category.trim() ? { category: category.trim() } : {}),
      ...(movementType !== "all" ? { movement_type: movementType } : {}),
    }),
    [category, movementType, period, scope, sku],
  );

  const filteredReports = useMemo(() => {
    const keyword = hubSearch.trim().toLowerCase();
    if (!keyword) return reports;
    return reports.filter((report) =>
      [report.code, report.title, report.description]
        .join(" ")
        .toLowerCase()
        .includes(keyword),
    );
  }, [hubSearch, reports]);

  const missingP0Codes = useMemo(() => {
    const availableCodes = new Set(reports.map((report) => report.code));
    return P0_REPORT_CODES.filter((code) => !availableCodes.has(code));
  }, [reports]);

  const reconcileProblems = useMemo(
    () => xntRows.filter((row) => isReconcileProblem(row.reconcile)),
    [xntRows],
  );

  useEffect(() => {
    let cancelled = false;
    setHubLoading(true);
    setHubError(null);
    fetchReportsHub()
      .then((rows) => {
        if (!cancelled) setReports(rows);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setReports([]);
          setHubError(fetchError);
        }
      })
      .finally(() => {
        if (!cancelled) setHubLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [reloadKey]);

  useEffect(() => {
    if (activeTab !== "xnt" || invalidPeriod) return;
    let cancelled = false;
    setXntLoading(true);
    setXntError(null);
    fetchXntReport(xntParams)
      .then((data) => {
        if (!cancelled) setXntRows(data);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setXntRows([]);
          setXntError(fetchError);
        }
      })
      .finally(() => {
        if (!cancelled) setXntLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, invalidPeriod, reloadKey, xntParams]);

  useEffect(() => {
    if (activeTab !== "warranty" || invalidPeriod) return;
    let cancelled = false;
    setWarrantyLoading(true);
    setWarrantyError(null);
    fetchWarrantyDefectsReport({
      from: period[0].format("YYYY-MM-DD"),
      to: period[1].format("YYYY-MM-DD"),
    })
      .then((report) => {
        if (!cancelled) setWarrantyReport(report);
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setWarrantyReport(null);
          setWarrantyError(fetchError);
        }
      })
      .finally(() => {
        if (!cancelled) setWarrantyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, invalidPeriod, period, reloadKey]);

  const handleExportWarranty = async () => {
    if (invalidPeriod) return;
    setWarrantyExporting(true);
    setWarrantyError(null);
    try {
      const blob = await downloadWarrantyReportExcel({
        from: period[0].format("YYYY-MM-DD"),
        to: period[1].format("YYYY-MM-DD"),
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bao-cao-bao-hanh-${period[0].format("YYYYMMDD")}-${period[1].format("YYYYMMDD")}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success(
        "Đã xuất báo cáo bảo hành (PII chỉ có khi tài khoản được cấp warranty.pii.export)",
      );
    } catch (downloadError: unknown) {
      toast.error("Không thể xuất báo cáo bảo hành.");
      setWarrantyError(downloadError);
    } finally {
      setWarrantyExporting(false);
    }
  };

  const reload = () => setReloadKey((value) => value + 1);

  const handleExportXnt = async () => {
    if (invalidPeriod) return;
    setExporting(true);
    setExportError(null);
    try {
      const blob = await downloadXntReportExcel(xntParams);
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `xnt-report-${period[0].format("YYYYMMDD")}-${period[1].format("YYYYMMDD")}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
      toast.success("Đã xuất báo cáo XNT");
    } catch (downloadError: unknown) {
      toast.error("Không thể xuất báo cáo XNT.");
      setExportError(downloadError);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as ReportTab)}
        items={[
          {
            key: "hub",
            label: "Trung tâm báo cáo",
            children: (
              <>
                <ResponsiveToolbar>
                  <Input
                    allowClear
                    prefix={<SearchOutlined />}
                    placeholder="Tìm mã, tên hoặc mô tả báo cáo"
                    style={{ maxWidth: 360, width: "100%" }}
                    value={hubSearch}
                    onChange={(event) => setHubSearch(event.target.value)}
                  />
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={reload}
                    loading={hubLoading}
                  >
                    Tải lại
                  </Button>
                </ResponsiveToolbar>
                {missingP0Codes.length > 0 && !hubError && !hubLoading && (
                  <Alert
                    showIcon
                    type="warning"
                    style={{ marginBottom: 16 }}
                    message="Danh sách report P0 chưa đủ theo baseline"
                    description={`Thiếu: ${missingP0Codes.join(", ")}. Cần BE/BA xác nhận contract /reports/hub trước khi sign-off production.`}
                  />
                )}
                <InlineApiError
                  error={hubError}
                  title="Không thể tải trung tâm báo cáo"
                  onRetry={reload}
                />
                <Table
                  dataSource={filteredReports}
                  rowKey="id"
                  loading={hubLoading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: "max-content" }}
                  locale={{
                    emptyText: tableEmptyText(
                      hubError,
                      "Chưa có báo cáo phù hợp",
                    ),
                  }}
                  columns={[
                    { title: "Mã", dataIndex: "code", key: "code", width: 140 },
                    {
                      title: "Tên báo cáo",
                      dataIndex: "title",
                      key: "title",
                      width: 220,
                    },
                    {
                      title: "Mô tả",
                      dataIndex: "description",
                      key: "description",
                    },
                    {
                      title: "Trạng thái",
                      key: "status",
                      width: 140,
                      render: (_, row) => {
                        const blocked = row.available === false;
                        return (
                          <Tag color={blocked ? "default" : "success"}>
                            {blocked
                              ? "Chưa khả dụng"
                              : row.status || "Khả dụng"}
                          </Tag>
                        );
                      },
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: "xnt",
            label: "Báo cáo XNT",
            children: (
              <>
                <ResponsiveToolbar>
                  <DatePicker
                    value={period[0]}
                    status={invalidPeriod ? "error" : undefined}
                    onChange={(value) => value && setPeriod([value, period[1]])}
                  />
                  <DatePicker
                    value={period[1]}
                    status={invalidPeriod ? "error" : undefined}
                    onChange={(value) => value && setPeriod([period[0], value])}
                  />
                  <Input
                    allowClear
                    placeholder="SKU"
                    style={{ width: 180 }}
                    value={sku}
                    onChange={(event) => setSku(event.target.value)}
                  />
                  <Input
                    allowClear
                    placeholder="Nhóm hàng"
                    style={{ width: 180 }}
                    value={category}
                    onChange={(event) => setCategory(event.target.value)}
                  />
                  <Select
                    placeholder="Loại phát sinh"
                    style={{ width: 180 }}
                    value={movementType}
                    onChange={setMovementType}
                    options={[
                      { value: "all", label: "Tất cả phát sinh" },
                      { value: "receipt", label: "Nhập" },
                      { value: "issue", label: "Xuất" },
                      { value: "adjustment", label: "Điều chỉnh" },
                      { value: "reversal", label: "Hoàn đảo" },
                    ]}
                  />
                  <Select
                    placeholder="Phạm vi"
                    style={{ width: 160 }}
                    value={scope}
                    onChange={setScope}
                    options={[
                      { value: "system", label: "Toàn hệ thống" },
                      { value: "warehouse", label: "Theo kho" },
                    ]}
                  />
                  <Space.Compact>
                    <Button
                      icon={<ReloadOutlined />}
                      onClick={reload}
                      loading={xntLoading}
                    >
                      Tải lại
                    </Button>
                    <ActionButton
                      module="reports"
                      action="export"
                      permissionCode="REPORT_EXPORT"
                      mode="disable"
                      type="primary"
                      icon={<DownloadOutlined />}
                      onClick={handleExportXnt}
                      loading={exporting}
                      disabled={invalidPeriod || xntLoading || exporting}
                      disabledTooltip="Bạn không có quyền xuất báo cáo hoặc bộ lọc chưa hợp lệ"
                    >
                      Xuất XLSX
                    </ActionButton>
                  </Space.Compact>
                </ResponsiveToolbar>
                {invalidPeriod && (
                  <Alert
                    showIcon
                    type="error"
                    style={{ marginBottom: 16 }}
                    message="Bộ lọc ngày chưa hợp lệ"
                    description="Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc. Filter hiện tại được giữ nguyên để bạn chỉnh và thử lại."
                  />
                )}
                {reconcileProblems.length > 0 && (
                  <Alert
                    showIcon
                    type="warning"
                    style={{ marginBottom: 16 }}
                    message="Có dòng XNT cần đối soát trước khi sign-off"
                    description={`Phát hiện ${reconcileProblems.length} SKU WARN/FAIL. Export dữ liệu xem nhanh vẫn dùng đúng filter hiện tại; export final cần disposition BA/BE theo baseline Ledger/Balance/Subledger.`}
                  />
                )}
                <InlineApiError
                  error={xntError}
                  title="Không thể tải báo cáo XNT"
                  onRetry={reload}
                />
                <InlineApiError
                  error={exportError}
                  title="Không thể xuất báo cáo XNT"
                  onRetry={handleExportXnt}
                />
                <Table
                  dataSource={xntRows}
                  rowKey={(row) => row.sku}
                  loading={xntLoading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: "max-content" }}
                  locale={{
                    emptyText: tableEmptyText(
                      xntError,
                      "Không có dữ liệu XNT theo bộ lọc",
                    ),
                  }}
                  columns={[
                    {
                      title: "SKU",
                      dataIndex: "sku",
                      key: "sku",
                      fixed: "left",
                      width: 160,
                    },
                    {
                      title: "Nhóm hàng",
                      dataIndex: "category",
                      key: "category",
                      width: 160,
                    },
                    {
                      title: "Đầu kỳ",
                      dataIndex: "opening",
                      key: "opening",
                      align: "right",
                    },
                    {
                      title: "Nhập",
                      dataIndex: "receipt",
                      key: "receipt",
                      align: "right",
                    },
                    {
                      title: "Xuất",
                      dataIndex: "issue",
                      key: "issue",
                      align: "right",
                    },
                    {
                      title: "Điều chỉnh tăng",
                      dataIndex: "adjustIn",
                      key: "adjustIn",
                      align: "right",
                    },
                    {
                      title: "Điều chỉnh giảm",
                      dataIndex: "adjustOut",
                      key: "adjustOut",
                      align: "right",
                    },
                    {
                      title: "Hoàn đảo ròng",
                      dataIndex: "reversalNet",
                      key: "reversalNet",
                      align: "right",
                    },
                    {
                      title: "Cuối kỳ",
                      dataIndex: "closing",
                      key: "closing",
                      align: "right",
                    },
                    {
                      title: "Còn lại từng phần",
                      dataIndex: "partialRemaining",
                      key: "partialRemaining",
                      align: "right",
                    },
                    {
                      title: "Đối soát",
                      dataIndex: "reconcile",
                      key: "reconcile",
                      width: 130,
                      render: (value: string) => (
                        <Tag
                          color={
                            isReconcileProblem(value) ? "warning" : "success"
                          }
                        >
                          {value || "PASS"}
                        </Tag>
                      ),
                    },
                  ]}
                />
              </>
            ),
          },
          {
            key: "warranty",
            label: "Bảo hành & linh kiện",
            children: (
              <>
                <Alert
                  showIcon
                  type="info"
                  style={{ marginBottom: 16 }}
                  message="Báo cáo bảo hành mặc định không hiển thị PII"
                  description="Nguồn dữ liệu là /reports/warranty-defects. Tên/SĐT/địa chỉ khách chỉ xuất hiện trong file export khi tài khoản được cấp warranty.pii.export; mọi lần export đều được audit."
                />
                <ResponsiveToolbar>
                  <DatePicker
                    value={period[0]}
                    status={invalidPeriod ? "error" : undefined}
                    onChange={(value) => value && setPeriod([value, period[1]])}
                  />
                  <DatePicker
                    value={period[1]}
                    status={invalidPeriod ? "error" : undefined}
                    onChange={(value) => value && setPeriod([period[0], value])}
                  />
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={reload}
                    loading={warrantyLoading}
                  >
                    Tải lại
                  </Button>
                  <ActionButton
                    module="reports"
                    action="export"
                    permissionCode="REPORT_EXPORT"
                    mode="disable"
                    type="primary"
                    icon={<DownloadOutlined />}
                    onClick={handleExportWarranty}
                    loading={warrantyExporting}
                    disabled={
                      invalidPeriod || warrantyLoading || warrantyExporting
                    }
                    disabledTooltip="Bạn không có quyền xuất báo cáo hoặc bộ lọc chưa hợp lệ"
                  >
                    Xuất Excel
                  </ActionButton>
                </ResponsiveToolbar>
                {warrantyReport ? (
                  <Space wrap style={{ marginBottom: 12 }}>
                    <Tag>Tổng {warrantyReport.summary.total} case</Tag>
                    <Tag color="processing">
                      Đang xử lý {warrantyReport.summary.processing}
                    </Tag>
                    <Tag color="success">
                      Đã trả {warrantyReport.summary.returned}
                    </Tag>
                    <Tag color="error">
                      Đã hủy {warrantyReport.summary.cancelled}
                    </Tag>
                    <Tag color="warning">
                      TEMP_ONLY {warrantyReport.summary.tempOnly}
                    </Tag>
                  </Space>
                ) : null}
                <InlineApiError
                  error={warrantyError}
                  title="Không thể tải báo cáo bảo hành & linh kiện"
                  onRetry={reload}
                />
                <Table
                  dataSource={warrantyReport?.rows ?? []}
                  rowKey="id"
                  loading={warrantyLoading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: "max-content" }}
                  locale={{
                    emptyText: tableEmptyText(
                      warrantyError,
                      "Không có case bảo hành trong khoảng thời gian đã chọn",
                    ),
                  }}
                  columns={[
                    {
                      title: "Case",
                      dataIndex: "caseNo",
                      key: "caseNo",
                      render: (value: string, row) => (
                        <Space size={4}>
                          <strong>{value}</strong>
                          {row.identification === "TEMP_ONLY" ? (
                            <Tag color="warning">TEMP</Tag>
                          ) : null}
                        </Space>
                      ),
                    },
                    { title: "SKU/Model", dataIndex: "model", key: "model" },
                    { title: "Bệnh / lỗi", dataIndex: "defect", key: "defect" },
                    {
                      title: "Linh kiện đã xuất",
                      dataIndex: "componentsIssued",
                      key: "componentsIssued",
                    },
                    {
                      title: "Trạng thái",
                      dataIndex: "status",
                      key: "status",
                      render: (value: string) => (
                        <Tag color={WARRANTY_STATUS_COLORS[value]}>
                          {WARRANTY_STATUS_LABELS[value] ?? value}
                        </Tag>
                      ),
                    },
                    {
                      title: "Ngày cập nhật",
                      dataIndex: "updatedAt",
                      key: "updatedAt",
                      render: (value: string) => formatWarrantyDateTime(value),
                    },
                  ]}
                />
                <Table
                  style={{ marginTop: 16 }}
                  dataSource={warrantyReport?.byDefect ?? []}
                  rowKey="defect"
                  size="small"
                  loading={warrantyLoading}
                  pagination={false}
                  scroll={{ x: "max-content" }}
                  locale={{
                    emptyText: tableEmptyText(
                      warrantyError,
                      "Chưa có tổng hợp theo bệnh/lỗi",
                    ),
                  }}
                  columns={[
                    {
                      title: "Tổng hợp theo bệnh / lỗi",
                      dataIndex: "defect",
                      key: "defect",
                    },
                    {
                      title: "Số case",
                      dataIndex: "total",
                      key: "total",
                      align: "right",
                    },
                    {
                      title: "Đang xử lý",
                      dataIndex: "processing",
                      key: "processing",
                      align: "right",
                    },
                    {
                      title: "Đã trả",
                      dataIndex: "returned",
                      key: "returned",
                      align: "right",
                    },
                    {
                      title: "Đã hủy",
                      dataIndex: "cancelled",
                      key: "cancelled",
                      align: "right",
                    },
                    {
                      title: "TEMP_ONLY",
                      dataIndex: "tempOnly",
                      key: "tempOnly",
                      align: "right",
                    },
                  ]}
                />
              </>
            ),
          },
        ]}
      />
    </div>
  );
}
