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
import { fetchWarrantyDefectsReport } from "../services/reportsService";
import {
  downloadXntReportExcel,
  fetchReportsHub,
  fetchXntReport,
  type XntReportParams,
} from "../services/reportsService";
import type { ReportItem, XntReportRow } from "../types";

type ReportTab = "hub" | "xnt" | "warranty";
type ReportScope = "warehouse" | "system";
type MovementType = "all" | "receipt" | "issue" | "adjustment" | "reversal";

type WarrantyReportRow = {
  id: string;
  model: string;
  defect: string;
  total: number;
  processing: number;
  returned: number;
  tempOnly: number;
};

const P0_REPORT_CODES = [
  "RPT-INV-01",
  "RPT-XNT-01",
  "RPT-MOV-01",
  "RPT-STK-01",
  "RPT-WAR-01",
  "RPT-IO-01",
] as const;

function rawText(
  row: Record<string, unknown>,
  keys: string[],
  fallback = "",
): string {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value);
    }
  }
  return fallback;
}

function rawNumber(row: Record<string, unknown>, keys: string[]): number {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "")
      return Number(value);
  }
  return 0;
}

function normalizeWarrantyReportRow(
  row: Record<string, unknown>,
  index: number,
): WarrantyReportRow {
  return {
    id: rawText(row, ["id", "defect_code", "defect"], String(index)),
    model: rawText(row, ["model", "sku", "sku_code"], "Chưa phân loại"),
    defect: rawText(
      row,
      ["defect", "defect_code", "defect_name"],
      "Chưa phân loại",
    ),
    total: rawNumber(row, ["total", "total_case", "case_count"]),
    processing: rawNumber(row, [
      "processing",
      "processing_count",
      "open_count",
    ]),
    returned: rawNumber(row, ["returned", "returned_count", "closed_count"]),
    tempOnly: rawNumber(row, ["temp_only", "tempOnly", "temp_only_count"]),
  };
}

function isReconcileProblem(value: string): boolean {
  return ["FAIL", "WARN", "WARNING"].includes(value.toUpperCase());
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<ReportTab>("hub");
  const [reports, setReports] = useState<ReportItem[]>([]);
  const [hubSearch, setHubSearch] = useState("");
  const [xntRows, setXntRows] = useState<XntReportRow[]>([]);
  const [warrantyRows, setWarrantyRows] = useState<WarrantyReportRow[]>([]);
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
    if (activeTab !== "warranty") return;
    let cancelled = false;
    setWarrantyLoading(true);
    setWarrantyError(null);
    fetchWarrantyDefectsReport({
      from: period[0].format("YYYY-MM-DD"),
      to: period[1].format("YYYY-MM-DD"),
    })
      .then((rows) => {
        if (!cancelled) setWarrantyRows(rows.map(normalizeWarrantyReportRow));
      })
      .catch((fetchError: unknown) => {
        if (!cancelled) {
          setWarrantyRows([]);
          setWarrantyError(fetchError);
        }
      })
      .finally(() => {
        if (!cancelled) setWarrantyLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activeTab, period, reloadKey]);

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
            label: "Bảo hành theo lỗi",
            children: (
              <>
                <Alert
                  showIcon
                  type="info"
                  style={{ marginBottom: 16 }}
                  message="Báo cáo bảo hành mặc định không hiển thị PII"
                  description="Nguồn dữ liệu ưu tiên là endpoint report warranty-defects. Tên khách hàng và số điện thoại không được đưa vào bảng/export mặc định."
                />
                <InlineApiError
                  error={warrantyError}
                  title="Không thể tải báo cáo bảo hành theo lỗi"
                  onRetry={reload}
                />
                <Table
                  dataSource={warrantyRows}
                  rowKey="id"
                  loading={warrantyLoading}
                  pagination={{ pageSize: 10 }}
                  scroll={{ x: "max-content" }}
                  locale={{
                    emptyText: tableEmptyText(
                      warrantyError,
                      "Không có dữ liệu bảo hành theo lỗi",
                    ),
                  }}
                  columns={[
                    { title: "Model/SKU", dataIndex: "model", key: "model" },
                    { title: "Lỗi/bệnh", dataIndex: "defect", key: "defect" },
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
