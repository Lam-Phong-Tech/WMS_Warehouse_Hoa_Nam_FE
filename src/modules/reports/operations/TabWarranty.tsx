import { useMemo, useState } from "react";
import dayjs from "dayjs";
import {
  Box,
  Stack,
  UiAlert,
  UiSelect,
  UiStatusBadge,
  UiTextField,
} from "@/shared/ui";
import {
  SafetyCertificateOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ActionButton } from "@/shared/components/actions";
import { useHasPermission } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG } from "@/shared/constants/wms-permissions";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { warrantyPiiText } from "@/modules/warranty/constants";
import { DonutChart } from "@/shared/components/charts/DonutChart";
import { LineChart } from "@/shared/components/charts/LineChart";
import { HorizontalBarChart } from "@/shared/components/charts/HorizontalBarChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
import {
  axisDayLabel,
  dateSpan,
  dayKey,
  fmt,
  fmtDate,
  fmtDateTime,
  listOf,
  n,
  objectOf,
  text,
  type Raw,
} from "./report-format";
import {
  useComponentIssueDocuments,
  useComponentUsage,
  useDefectOptions,
  useDefectSkuBreakdown,
  useMovementTrace,
  useSkuCatalog,
  useUserDirectory,
  useWarrantyCases,
  useWarrantyReport,
} from "./report-data";
import {
  ChartCard,
  ChartGrid,
  DataGapNotice,
  DrillDownDialog,
  FilterBar,
  FormulaNote,
  ReportKpi,
  ReportKpiRow,
  ReportSectionHeading,
  SegmentedToggle,
} from "./report-ui";
import {
  AllOrPickFilter,
  ExportButtons,
  PeriodFilterControls,
} from "./report-filters";
import { usePeriodFilter } from "./report-period";
import {
  reportStatusLabel,
  SLA_LABELS,
  SLA_TONE,
  type SlaState,
} from "./report-labels";
import { MultiSelectFilter, ReportPaginationBar } from "./report-table";
import { useClientPagination } from "./report-columns";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import { MovementTable, ReportStatusBadge } from "./report-drilldown";
import {
  EXPORT_ROW_LIMIT,
  PII_REASON_MIN_LENGTH,
  useReportExport,
} from "./report-export";

const WARRANTY_STATUSES = [
  "RECEIVED",
  "CHECKING",
  "REPAIRING",
  "COMPLETED",
  "RETURNED",
  "CANCELLED",
] as const;

const STATUS_COLORS: Record<string, string> = {
  RECEIVED: CHART_COLORS.info,
  CHECKING: CHART_COLORS.primary,
  REPAIRING: CHART_COLORS.warning,
  COMPLETED: CHART_COLORS.success,
  RETURNED: CHART_COLORS.successDeep,
  CANCELLED: CHART_COLORS.secondary,
};

/** Trạng thái coi là đã đóng — không tính SLA quá hạn nữa. */
const CLOSED_STATUSES = new Set(["RETURNED", "CANCELLED"]);

const DUE_SOON_DAYS = 2;

const TOP_COMPONENT_OPTIONS = [
  { value: "5", label: "Top 5" },
  { value: "10", label: "Top 10" },
] as const;

type CaseRow = {
  caseId: string;
  caseNo: string;
  model: string;
  skuId: string;
  skuName: string;
  physicalCode: string;
  defect: string;
  defectIds: string[];
  defectNames: string[];
  status: string;
  receivedAt: string;
  dueDate: string;
  returnedAt: string;
  sla: SlaState;
  slaDays: number | null;
  assignee: string;
  department: string;
  departmentId: string | null;
  componentsText: string;
  components: Array<{ skuCode: string; qty: number }>;
  customerName: string;
  customerPhone: string;
  customerAddress: string;
  raw: Raw;
};

/** "SKU-A × 2; SKU-B × 1" → [{skuCode, qty}] (định dạng do BE dựng). */
function parseComponents(
  value: string,
): Array<{ skuCode: string; qty: number }> {
  if (!value || value === "Chưa xuất") return [];
  return value
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [codePart, qtyPart] = part.split("×").map((piece) => piece.trim());
      return { skuCode: codePart ?? part, qty: Number(qtyPart ?? 0) || 0 };
    });
}

function slaOf(
  dueDate: string,
  status: string,
  today: dayjs.Dayjs,
): { state: SlaState; days: number | null } {
  if (!dueDate) return { state: "UNSET", days: null };
  const due = dayjs(dueDate);
  if (!due.isValid()) return { state: "UNSET", days: null };
  const days = due.startOf("day").diff(today.startOf("day"), "day");
  if (CLOSED_STATUSES.has(status)) return { state: "NORMAL", days };
  if (days < 0) return { state: "OVERDUE", days };
  if (days <= DUE_SOON_DAYS) return { state: "DUE_SOON", days };
  return { state: "NORMAL", days };
}

/**
 * Tab 6 — Bảo hành và linh kiện.
 *
 * `/reports/warranty-defects` là nguồn chính (hồ sơ + bệnh/lỗi N:N + PII đã
 * che), được bổ sung bằng `/warranty-cases` cho `created_by` (người phụ trách)
 * và `/warranty-component-issues` cho chứng từ xuất linh kiện — hai thứ báo cáo
 * bảo hành không trả nhưng mục 6.5/6.6 yêu cầu.
 */
export default function TabWarranty() {
  const period = usePeriodFilter("this-month");
  const catalog = useSkuCatalog();
  const users = useUserDirectory();
  const defects = useDefectOptions();
  const exporter = useReportExport();
  const hasPermission = useHasPermission();
  const today = useMemo(() => dayjs(), []);

  // §13.8 WWHN-258: PII khách hàng luôn hiển thị ở dạng ĐÃ CHE trừ khi actor có
  // `warranty.pii.view`; tệp xuất chỉ mang PII thô khi actor có
  // `warranty.pii.export` VÀ nhập lý do đủ dài. Quyết định fail-closed nằm ở FE
  // chứ không phụ thuộc việc BE có mask hay không.
  const canViewPii = hasPermission(WMS_PERMISSION_CATALOG.WARRANTY_PII_VIEW);
  const canExportPii = hasPermission(
    WMS_PERMISSION_CATALOG.WARRANTY_PII_EXPORT,
  );
  const [piiReason, setPiiReason] = useState("");

  // Bộ lọc SKU của mục 6.6 đi THẲNG lên máy chủ qua tham số `model` (BE khớp
  // sku_code/sku_name/mô tả thủ công) thay vì lọc lại ở client: có vậy biểu đồ
  // 6.1/6.2 và bảng 6.6 mới cùng mô tả một tập hồ sơ, và tệp xuất mới trùng
  // đúng bộ lọc đang xem.
  const [listSku, setListSku] = useState("");
  const listSkuCode = listSku
    ? (catalog.byId.get(listSku)?.sku_code ?? "")
    : "";

  const warranty = useWarrantyReport({
    from: period.from,
    to: period.to,
    model: listSkuCode || undefined,
    enabled: !period.invalid,
  });
  const rawCases = useWarrantyCases({ enabled: !period.invalid });
  const issueDocs = useComponentIssueDocuments({ enabled: !period.invalid });

  /** case_id → phiếu xuất linh kiện gần nhất (mục 6.5). */
  const issueDocByCase = useMemo(() => {
    const map = new Map<string, Raw>();
    for (const doc of issueDocs.data ?? []) {
      const caseId = text(doc.warranty_case_id, "");
      if (!caseId) continue;
      const current = map.get(caseId);
      const at = text(doc.posted_at ?? doc.document_date, "");
      if (
        !current ||
        at > text(current.posted_at ?? current.document_date, "")
      ) {
        map.set(caseId, doc);
      }
    }
    return map;
  }, [issueDocs.data]);

  /** case_code → bản ghi thô, để lấy created_by và item/serial. */
  const rawCaseByCode = useMemo(() => {
    const map = new Map<string, Raw>();
    for (const row of rawCases.data ?? []) {
      map.set(text(row.warranty_case_code ?? row.case_code, ""), row);
    }
    return map;
  }, [rawCases.data]);

  const cases = useMemo<CaseRow[]>(() => {
    return listOf(warranty.data?.rows).map((row) => {
      const caseNo = text(row.case_no, "");
      const raw = rawCaseByCode.get(caseNo) ?? {};
      const assigneeId = text(raw.created_by, "");
      const assignee =
        users.entries.find((entry) => entry.user_id === assigneeId)?.name ?? "";
      const status = text(row.status, "");
      const dueDate = text(
        row.estimated_completion_date ?? raw.estimated_completion_date,
        "",
      );
      const sla = slaOf(dueDate, status, today);
      const componentsText = text(row.components_issued, "");
      const defectList = listOf(row.defects);

      return {
        caseId: text(row.warranty_case_id, ""),
        caseNo,
        model: text(row.model, ""),
        skuId: text(row.sku_id, ""),
        skuName: text(row.sku_name, ""),
        physicalCode: text(
          raw.serial_number ?? raw.physical_code ?? row.temporary_item_code,
          "",
        ),
        defect: text(row.defect, ""),
        defectIds: defectList.map((item) => text(item.defect_id, "")),
        defectNames: defectList.map((item) => text(item.defect_name, "")),
        status,
        receivedAt: text(row.received_at, ""),
        dueDate,
        returnedAt: text(row.returned_at, ""),
        sla: sla.state,
        slaDays: sla.days,
        assignee,
        department: users.departmentNameOfActor(assignee),
        departmentId: users.departmentOfName(assignee),
        componentsText,
        components: parseComponents(componentsText),
        customerName: warrantyPiiText(
          text(row.customer_name, ""),
          canViewPii,
          "name",
        ),
        customerPhone: warrantyPiiText(
          text(row.customer_phone, ""),
          canViewPii,
          "phone",
        ),
        customerAddress: warrantyPiiText(
          text(row.customer_address, ""),
          canViewPii,
          "address",
        ),
        raw: row,
      };
    });
  }, [warranty.data, rawCaseByCode, users, today, canViewPii]);

  // ── 6.1 Tình trạng bảo hành ────────────────────────────────────────────
  const statusCounts = useMemo(() => {
    const counter = new Map<string, number>(
      WARRANTY_STATUSES.map((status) => [status, 0]),
    );
    for (const item of cases) {
      counter.set(item.status, (counter.get(item.status) ?? 0) + 1);
    }
    return counter;
  }, [cases]);

  const overdueCases = cases.filter((item) => item.sla === "OVERDUE");
  const dueSoonCases = cases.filter((item) => item.sla === "DUE_SOON");

  const [statusDrill, setStatusDrill] = useState<{
    label: string;
    rows: CaseRow[];
  } | null>(null);

  // ── 6.2 Xu hướng bảo hành ──────────────────────────────────────────────
  const days = useMemo(
    () => dateSpan(period.from, period.to),
    [period.from, period.to],
  );

  const trend = useMemo(() => {
    const blank = () => new Map<string, number>(days.map((day) => [day, 0]));
    const received = blank();
    const completed = blank();
    const overdue = blank();
    for (const item of cases) {
      const receivedDay = dayKey(item.receivedAt);
      if (received.has(receivedDay)) {
        received.set(receivedDay, (received.get(receivedDay) ?? 0) + 1);
      }
      const closedDay = dayKey(item.returnedAt);
      if (completed.has(closedDay)) {
        completed.set(closedDay, (completed.get(closedDay) ?? 0) + 1);
      }
      if (item.sla === "OVERDUE") {
        // Ca quá hạn được ghi nhận vào NGÀY ĐẾN HẠN của nó, tức ngày mà nó bắt
        // đầu trễ — ghi vào ngày tiếp nhận sẽ trộn lẫn với chuỗi "tiếp nhận mới".
        const dueDay = dayKey(item.dueDate);
        if (overdue.has(dueDay)) {
          overdue.set(dueDay, (overdue.get(dueDay) ?? 0) + 1);
        }
      }
    }
    return [
      {
        name: "Tiếp nhận mới",
        data: days.map((day) => received.get(day) ?? 0),
        color: CHART_COLORS.info,
      },
      {
        name: "Hoàn thành",
        data: days.map((day) => completed.get(day) ?? 0),
        color: CHART_COLORS.success,
      },
      {
        name: "Quá hạn",
        data: days.map((day) => overdue.get(day) ?? 0),
        color: CHART_COLORS.danger,
      },
    ];
  }, [days, cases]);

  // ── 6.3 Bệnh/lỗi theo SKU ──────────────────────────────────────────────
  const [defectSkuId, setDefectSkuId] = useState("");
  const [defectFilterIds, setDefectFilterIds] = useState<string[]>([]);
  const [defectStatus, setDefectStatus] = useState("");
  const [defectDepartment, setDefectDepartment] = useState("");
  const [defectAssignee, setDefectAssignee] = useState("");

  const breakdown = useDefectSkuBreakdown({
    from: period.from,
    to: period.to,
    skuIds: defectSkuId ? [defectSkuId] : undefined,
    defectIds: defectFilterIds.length > 0 ? defectFilterIds : undefined,
    enabled: !period.invalid,
  });

  /**
   * BE gộp bệnh/lỗi × SKU nhưng KHÔNG nhận được bộ lọc trạng thái/phòng
   * ban/người phụ trách (những chiều đó chỉ tồn tại ở tầng hồ sơ). Khi người
   * dùng bật một trong ba bộ lọc đó thì phải đếm lại từ chính danh sách hồ sơ
   * đã lọc, nếu không biểu đồ sẽ mâu thuẫn với bộ lọc đang bật.
   */
  const useLocalDefectCount =
    Boolean(defectStatus) ||
    Boolean(defectDepartment) ||
    Boolean(defectAssignee);

  const defectItems = useMemo(() => {
    if (!useLocalDefectCount) {
      return listOf(breakdown.data?.rows)
        .filter((row) => !defectSkuId || text(row.sku_id) === defectSkuId)
        .map((row) => ({
          label: `${text(row.defect_code, "")} · ${text(row.defect_name, "")}`,
          value: n(row.case_count),
        }))
        .sort((a, b) => b.value - a.value);
    }
    const counter = new Map<string, number>();
    for (const item of cases) {
      if (defectStatus && item.status !== defectStatus) continue;
      if (defectDepartment && item.departmentId !== defectDepartment) continue;
      if (defectAssignee && item.assignee !== defectAssignee) continue;
      if (defectSkuId && item.skuId !== defectSkuId) continue;
      if (
        defectFilterIds.length > 0 &&
        !item.defectIds.some((id) => defectFilterIds.includes(id))
      ) {
        continue;
      }
      // Một ca nhiều lỗi được tính MỘT lần ở TỪNG lỗi tương ứng.
      for (const name of item.defectNames) {
        counter.set(name, (counter.get(name) ?? 0) + 1);
      }
    }
    return [...counter.entries()]
      .map(([label, value]) => ({ label, value }))
      .sort((a, b) => b.value - a.value);
  }, [
    useLocalDefectCount,
    breakdown.data,
    cases,
    defectStatus,
    defectDepartment,
    defectAssignee,
    defectSkuId,
    defectFilterIds,
  ]);

  const [defectDrill, setDefectDrill] = useState<string | null>(null);

  // ── 6.4 Top linh kiện sử dụng ──────────────────────────────────────────
  const [topComponents, setTopComponents] = useState<"5" | "10">("5");
  const componentUsage = useComponentUsage({
    from: period.from,
    to: period.to,
    enabled: !period.invalid,
  });
  const componentItems = useMemo(
    () =>
      listOf(componentUsage.data?.rows)
        .map((row) => ({
          label: `${text(row.sku_code, "")} · ${text(row.sku_name, "")}`,
          value: n(row.total_issued_qty),
        }))
        .sort((a, b) => b.value - a.value),
    [componentUsage.data],
  );

  // ── 6.5 Chi tiết linh kiện theo phiếu bảo hành ─────────────────────────
  const componentRows = useMemo(() => {
    return cases.flatMap((item) => {
      const doc = issueDocByCase.get(item.caseId);
      if (item.components.length === 0) return [];
      return item.components.map((component) => ({
        key: `${item.caseNo}-${component.skuCode}`,
        caseNo: item.caseNo,
        model: item.model,
        physicalCode: item.physicalCode,
        status: item.status,
        componentName:
          catalog.byCode.get(component.skuCode)?.sku_name ?? component.skuCode,
        componentSku: component.skuCode,
        qty: component.qty,
        issueNo: text(doc?.component_issue_no, ""),
        issuedAt: text(doc?.posted_at ?? doc?.document_date, ""),
        actor: item.assignee,
        caseRow: item,
      }));
    });
  }, [cases, issueDocByCase, catalog]);

  const [componentKeyword, setComponentKeyword] = useState("");
  const filteredComponentRows = useMemo(() => {
    const needle = componentKeyword.trim().toLowerCase();
    if (!needle) return componentRows;
    return componentRows.filter((row) =>
      `${row.caseNo} ${row.model} ${row.componentSku} ${row.physicalCode}`
        .toLowerCase()
        .includes(needle),
    );
  }, [componentRows, componentKeyword]);

  const componentPagination = useClientPagination(filteredComponentRows, 10);
  const [openCase, setOpenCase] = useState<CaseRow | null>(null);

  const caseMovements = useMovementTrace({
    from: period.from,
    to: period.to,
    movementType: "COMPONENT_ISSUE",
    enabled: openCase !== null,
  });

  // ── 6.6 Danh sách chi tiết hồ sơ bảo hành ──────────────────────────────
  const [listStatus, setListStatus] = useState("");
  const [listSla, setListSla] = useState("");
  const [listDepartment, setListDepartment] = useState("");
  const [listAssignee, setListAssignee] = useState("");
  const [listMultiDefect, setListMultiDefect] = useState("");
  const [listKeyword, setListKeyword] = useState("");

  const filteredCases = useMemo(() => {
    const needle = listKeyword.trim().toLowerCase();
    return cases.filter((item) => {
      if (listStatus && item.status !== listStatus) return false;
      if (listSku && item.skuId !== listSku) return false;
      if (listSla && item.sla !== listSla) return false;
      if (listDepartment && item.departmentId !== listDepartment) return false;
      if (listAssignee && item.assignee !== listAssignee) return false;
      if (listMultiDefect === "MULTI" && item.defectIds.length < 2)
        return false;
      if (listMultiDefect === "SINGLE" && item.defectIds.length > 1)
        return false;
      if (needle) {
        const haystack =
          `${item.caseNo} ${item.model} ${item.physicalCode}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [
    cases,
    listStatus,
    listSku,
    listSla,
    listDepartment,
    listAssignee,
    listMultiDefect,
    listKeyword,
  ]);

  const casePagination = useClientPagination(filteredCases, 15);

  const statusOptions = WARRANTY_STATUSES.map((value) => ({
    value,
    label: reportStatusLabel(value),
  }));
  const slaOptions = (Object.keys(SLA_LABELS) as SlaState[]).map((value) => ({
    value,
    label: SLA_LABELS[value],
  }));
  const assigneeOptions = useMemo(() => {
    const values = new Set(
      cases.map((item) => item.assignee).filter((value) => value !== ""),
    );
    return [...values]
      .sort((a, b) => a.localeCompare(b, "vi"))
      .map((value) => ({ value, label: value }));
  }, [cases]);

  const loading = warranty.isLoading || rawCases.isLoading;
  const noAssignee = cases.length > 0 && cases.every((item) => !item.assignee);

  const piiReasonTrimmed = piiReason.trim();
  // Lý do BỎ TRỐNG là hợp lệ (xuất bản đã che). Chỉ khi người dùng đã gõ mà
  // chưa đủ dài thì mới chặn — gửi đi sẽ ăn 422 PII_EXPORT_REASON_INVALID.
  const piiReasonInvalid =
    canExportPii &&
    piiReasonTrimmed.length > 0 &&
    piiReasonTrimmed.length < PII_REASON_MIN_LENGTH;
  // Tổng dòng lấy từ pagination của máy chủ, không phải số dòng đang hiển thị:
  // trần export áp trên TOÀN BỘ tập lọc chứ không phải trang hiện tại.
  const totalRows = n(objectOf(warranty.data?.pagination).total, cases.length);
  const exceedsExportRowLimit = totalRows > EXPORT_ROW_LIMIT;
  const exportBlocked =
    period.invalid || loading || piiReasonInvalid || exceedsExportRowLimit;

  return (
    <Box data-testid="rpt-tab-warranty">
      <ReportSectionHeading
        id="rpt-tab6-heading"
        title="Báo cáo bảo hành và linh kiện"
        description="Tình trạng hồ sơ, xu hướng theo thời gian, bệnh/lỗi theo SKU và linh kiện đã dùng."
      />

      <FilterBar
        label="Bộ lọc kỳ báo cáo (áp cho toàn bộ tab)"
        hint={`Kỳ đang xem: ${period.label} · ${fmt(cases.length)} hồ sơ`}
      >
        <PeriodFilterControls state={period} />
      </FilterBar>

      {period.invalid ? (
        <Box sx={{ mb: 2 }}>
          <UiAlert tone="error">
            Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.
          </UiAlert>
        </Box>
      ) : null}

      <Box sx={{ mb: 2 }}>
        <UiAlert tone="info">
          {canExportPii
            ? `Khách hàng/SĐT/địa chỉ hiển thị ở dạng đã che. Tệp xuất chỉ chứa PII thô khi bạn nhập lý do (≥ ${PII_REASON_MIN_LENGTH} ký tự); mọi lần xuất đều được ghi nhật ký.`
            : "Khách hàng/SĐT/địa chỉ hiển thị ở dạng đã che. Tài khoản của bạn không có quyền xuất PII nên tệp xuất luôn che thông tin; cần PII thô hãy liên hệ quản trị để được cấp quyền."}
        </UiAlert>
      </Box>

      {piiReasonInvalid ? (
        <Box sx={{ mb: 1.5 }}>
          <UiAlert tone="warning">
            {`Lý do xuất PII phải có ít nhất ${PII_REASON_MIN_LENGTH} ký tự. Bỏ trống nếu chỉ cần tệp đã che thông tin.`}
          </UiAlert>
        </Box>
      ) : null}

      {exceedsExportRowLimit ? (
        <div {...uiStateProps(UI_STATE.DISABLED, "report-export-row-limit")}>
          <Box sx={{ mb: 1.5 }}>
            <UiAlert tone="warning">
              {`Bộ lọc hiện tại có ${fmt(totalRows)} dòng — vượt giới hạn ${fmt(EXPORT_ROW_LIMIT)} dòng mỗi tệp. Thu hẹp khoảng ngày hoặc bộ lọc trước khi xuất.`}
            </UiAlert>
          </Box>
        </div>
      ) : null}

      {noAssignee ? (
        <DataGapNotice>
          Hồ sơ bảo hành hiện chưa gắn người phụ trách/phòng ban riêng; hai cột
          này lấy theo <b>người tạo hồ sơ</b> và phòng ban của người đó. Khi mô
          hình dữ liệu bổ sung trường phụ trách, các bộ lọc theo người phụ trách
          sẽ dùng ngay trường mới.
        </DataGapNotice>
      ) : null}

      <ReportKpiRow>
        {WARRANTY_STATUSES.slice(0, 5).map((status) => (
          <ReportKpi
            key={status}
            label={reportStatusLabel(status)}
            value={fmt(statusCounts.get(status) ?? 0)}
            tone={
              status === "RETURNED" || status === "COMPLETED"
                ? "success"
                : status === "REPAIRING"
                  ? "warning"
                  : "info"
            }
            icon={<SafetyCertificateOutlined />}
            onClick={() =>
              setStatusDrill({
                label: reportStatusLabel(status),
                rows: cases.filter((item) => item.status === status),
              })
            }
          />
        ))}
        <ReportKpi
          label="Sắp đến hạn"
          value={fmt(dueSoonCases.length)}
          tone="warning"
          icon={<WarningOutlined />}
          hint={`Còn ≤ ${DUE_SOON_DAYS} ngày tới hạn`}
          onClick={() =>
            setStatusDrill({ label: "Sắp đến hạn", rows: dueSoonCases })
          }
        />
        <ReportKpi
          label="Quá hạn"
          value={fmt(overdueCases.length)}
          tone="error"
          icon={<WarningOutlined />}
          hint="Đã qua ngày dự kiến hoàn thành"
          onClick={() =>
            setStatusDrill({ label: "Quá hạn", rows: overdueCases })
          }
        />
      </ReportKpiRow>

      <ChartGrid>
        <ChartCard
          title="Tình trạng bảo hành"
          description="Số hồ sơ theo trạng thái tính đến hiện tại. Bấm một lát để mở danh sách hồ sơ tương ứng."
          loading={loading}
          error={warranty.error}
          onRetry={() => void warranty.refetch()}
          empty={cases.length === 0}
          emptyText="Kỳ này chưa có hồ sơ bảo hành nào."
          footer={
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", rowGap: 1 }}
            >
              <UiStatusBadge
                size="small"
                tone="warning"
                label={`Sắp đến hạn: ${fmt(dueSoonCases.length)}`}
              />
              <UiStatusBadge
                size="small"
                tone="error"
                label={`Quá hạn: ${fmt(overdueCases.length)}`}
              />
            </Stack>
          }
        >
          <DonutChart
            items={WARRANTY_STATUSES.map((status) => ({
              label: reportStatusLabel(status),
              value: statusCounts.get(status) ?? 0,
              color: STATUS_COLORS[status],
            }))}
            centerLabel="Tổng hồ sơ"
            valueFormatter={fmt}
            onSelect={(item, index) => {
              const status = WARRANTY_STATUSES[index];
              setStatusDrill({
                label: item.label,
                rows: cases.filter((row) => row.status === status),
              });
            }}
          />
        </ChartCard>

        <ChartCard
          title="Xu hướng bảo hành"
          description="Tiếp nhận mới / Hoàn thành / Quá hạn theo ngày. Bấm một điểm để mở danh sách hồ sơ."
          loading={loading}
          error={warranty.error}
          onRetry={() => void warranty.refetch()}
          empty={days.length === 0 || cases.length === 0}
        >
          <LineChart
            categories={days.map(axisDayLabel)}
            series={trend}
            height={320}
            valueFormatter={fmt}
            onSelect={(payload) => {
              const day = days[payload.categoryIndex] ?? "";
              const rows = cases.filter((item) => {
                if (payload.seriesName === "Tiếp nhận mới") {
                  return dayKey(item.receivedAt) === day;
                }
                if (payload.seriesName === "Hoàn thành") {
                  return dayKey(item.returnedAt) === day;
                }
                return item.sla === "OVERDUE" && dayKey(item.dueDate) === day;
              });
              setStatusDrill({
                label: `${payload.seriesName} — ${fmtDate(day)}`,
                rows,
              });
            }}
          />
        </ChartCard>
      </ChartGrid>

      <ChartCard
        title="Bệnh/lỗi theo SKU"
        description="Chọn một SKU để xem từng bệnh/lỗi xuất hiện bao nhiêu lần. Một ca nhiều lỗi được tính một lần ở mỗi lỗi."
        fullWidth
        loading={breakdown.isLoading || loading}
        error={breakdown.error}
        onRetry={() => void breakdown.refetch()}
        empty={defectItems.length === 0}
        emptyText="Chưa có bệnh/lỗi nào theo bộ lọc hiện tại."
        toolbar={
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <UiSelect
              minWidth={240}
              aria-label="SKU máy"
              placeholder="Tất cả SKU"
              value={defectSkuId}
              onChange={setDefectSkuId}
              options={catalog.options}
            />
            <MultiSelectFilter
              value={defectFilterIds}
              onChange={setDefectFilterIds}
              options={defects.options}
              placeholder="Bệnh / lỗi"
              ariaLabel="Bệnh / lỗi"
            />
            <AllOrPickFilter
              value={defectStatus}
              onChange={setDefectStatus}
              options={statusOptions}
              allLabel="Tất cả trạng thái case"
              ariaLabel="Trạng thái case"
            />
            <AllOrPickFilter
              value={defectDepartment}
              onChange={setDefectDepartment}
              options={users.departmentOptions}
              allLabel="Tất cả phòng ban"
              ariaLabel="Phòng ban"
            />
            <AllOrPickFilter
              value={defectAssignee}
              onChange={setDefectAssignee}
              options={assigneeOptions}
              allLabel="Tất cả người phụ trách"
              ariaLabel="Người phụ trách"
            />
          </Box>
        }
        footer={
          useLocalDefectCount ? (
            <FormulaNote>
              Đang đếm lại từ danh sách hồ sơ vì bộ lọc trạng thái/phòng
              ban/người phụ trách chỉ tồn tại ở tầng hồ sơ.
            </FormulaNote>
          ) : null
        }
      >
        <HorizontalBarChart
          items={defectItems}
          limit={15}
          color={CHART_COLORS.warning}
          valueFormatter={fmt}
          onSelect={(item) => setDefectDrill(item.label)}
        />
      </ChartCard>

      <Box sx={{ height: 16 }} />

      <ChartCard
        title="Top linh kiện sử dụng"
        description="Linh kiện được dùng nhiều nhất cho các hồ sơ bảo hành trong kỳ."
        fullWidth
        loading={componentUsage.isLoading}
        error={componentUsage.error}
        onRetry={() => void componentUsage.refetch()}
        empty={componentItems.length === 0}
        emptyText="Kỳ này chưa xuất linh kiện nào cho bảo hành."
        toolbar={
          <SegmentedToggle
            label="Số linh kiện hiển thị"
            value={topComponents}
            onChange={setTopComponents}
            options={TOP_COMPONENT_OPTIONS}
          />
        }
      >
        <HorizontalBarChart
          items={componentItems}
          limit={Number(topComponents)}
          color={CHART_COLORS.violet}
          valueFormatter={fmt}
        />
      </ChartCard>

      <Box sx={{ height: 16 }} />

      <ReportSectionHeading
        id="rpt-tab6-components"
        title="Chi tiết linh kiện theo phiếu bảo hành"
        description="Bấm một dòng để xem toàn bộ linh kiện đã dùng, phiếu xuất và movement liên quan."
      />

      <FilterBar
        label="Bộ lọc bảng linh kiện"
        hint={`${fmt(filteredComponentRows.length)} dòng linh kiện`}
      >
        <SearchInput
          width={300}
          placeholder="Mã case / SKU máy / SKU linh kiện / Serial"
          aria-label="Tìm mã case, SKU hoặc serial"
          value={componentKeyword}
          onChange={setComponentKeyword}
        />
      </FilterBar>

      <ResponsiveDataTable<(typeof componentRows)[number]>
        columns={[
          {
            key: "stt",
            header: "STT",
            align: "center",
            width: 56,
            hideOnMobile: true,
            render: (row) =>
              mvpRowNumber(
                componentPagination.page,
                componentPagination.perPage,
                componentPagination.pageRows.indexOf(row),
              ),
          },
          {
            key: "caseNo",
            header: "Mã case",
            width: 150,
            sortAccessor: (row) => row.caseNo,
            render: (row) => (
              <Box sx={{ fontWeight: 700 }}>{row.caseNo || "—"}</Box>
            ),
          },
          {
            key: "model",
            header: "SKU máy",
            width: 150,
            render: (row) => row.model || "—",
          },
          {
            key: "physicalCode",
            header: "Physical Code / Serial",
            width: 190,
            hideOnMobile: true,
            render: (row) => row.physicalCode || "—",
          },
          {
            key: "status",
            header: "Trạng thái",
            width: 150,
            render: (row) => (
              <ReportStatusBadge
                value={row.status}
                label={reportStatusLabel(row.status)}
              />
            ),
          },
          {
            key: "componentName",
            header: "Linh kiện",
            render: (row) => row.componentName,
          },
          {
            key: "componentSku",
            header: "SKU linh kiện",
            width: 160,
            render: (row) => row.componentSku,
          },
          {
            key: "qty",
            header: "Số lượng",
            align: "right",
            width: 110,
            sortAccessor: (row) => row.qty,
            render: (row) => fmt(row.qty),
          },
          {
            key: "issueNo",
            header: "Phiếu xuất linh kiện",
            width: 180,
            hideOnMobile: true,
            render: (row) => row.issueNo || "—",
          },
          {
            key: "issuedAt",
            header: "Ngày xuất",
            width: 140,
            hideOnMobile: true,
            render: (row) => (row.issuedAt ? fmtDate(row.issuedAt) : "—"),
          },
          {
            key: "actor",
            header: "Người thực hiện",
            hideOnMobile: true,
            render: (row) => row.actor || "—",
          },
        ]}
        rows={componentPagination.pageRows}
        rowKey={(row) => row.key}
        loading={loading || issueDocs.isLoading}
        onRowClick={(row) => setOpenCase(row.caseRow)}
        emptyText="Chưa có hồ sơ nào đã xuất linh kiện trong kỳ."
      />
      <ReportPaginationBar
        page={componentPagination.page}
        perPage={componentPagination.perPage}
        total={componentPagination.total}
        onPageChange={componentPagination.setPage}
        onPageSizeChange={componentPagination.setPerPage}
      />

      <Box sx={{ height: 16 }} />

      <ReportSectionHeading
        id="rpt-tab6-cases"
        title="Danh sách chi tiết hồ sơ bảo hành"
        description="Toàn bộ hồ sơ trong kỳ kèm SLA, bệnh/lỗi, người phụ trách và số linh kiện đã dùng."
      />

      <FilterBar
        label="Bộ lọc bảng hồ sơ bảo hành"
        hint={`${fmt(filteredCases.length)} hồ sơ`}
        actions={
          <ExportButtons
            exporting={exporter.exporting}
            disabled={exportBlocked}
            onExport={(format) =>
              void exporter.exportReport(format, {
                reportCode: "warranty-defects",
                fileStem: "bao-cao-bao-hanh",
                fileSuffix: `-${period.from}-${period.to}`,
                filters: {
                  from_date: period.from,
                  to_date: period.to,
                  ...(listStatus ? { status: listStatus } : {}),
                  ...(listSkuCode ? { model: listSkuCode } : {}),
                  // `reason` CHỈ được đính khi actor có quyền xuất PII và lý do
                  // đủ dài — gửi khi thiếu quyền sẽ bị BE trả 403.
                  ...(canExportPii &&
                  piiReasonTrimmed.length >= PII_REASON_MIN_LENGTH
                    ? { reason: piiReasonTrimmed }
                    : {}),
                },
              })
            }
          />
        }
      >
        {canExportPii ? (
          <UiTextField
            sx={{ width: 300 }}
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
        <AllOrPickFilter
          value={listStatus}
          onChange={setListStatus}
          options={statusOptions}
          allLabel="Tất cả trạng thái"
          ariaLabel="Trạng thái hồ sơ"
        />
        <AllOrPickFilter
          value={listSku}
          onChange={setListSku}
          options={catalog.options}
          allLabel="Tất cả SKU"
          ariaLabel="SKU"
          minWidth={240}
        />
        <UiSelect
          minWidth={200}
          aria-label="Số bệnh/lỗi"
          placeholder="Mọi số bệnh/lỗi"
          value={listMultiDefect}
          onChange={setListMultiDefect}
          options={[
            { value: "MULTI", label: "Nhiều bệnh/lỗi (≥ 2)" },
            { value: "SINGLE", label: "Một bệnh/lỗi" },
          ]}
        />
        <AllOrPickFilter
          value={listSla}
          onChange={setListSla}
          options={slaOptions}
          allLabel="Tất cả SLA"
          ariaLabel="SLA"
        />
        <AllOrPickFilter
          value={listDepartment}
          onChange={setListDepartment}
          options={users.departmentOptions}
          allLabel="Tất cả phòng ban"
          ariaLabel="Phòng ban của hồ sơ"
        />
        <AllOrPickFilter
          value={listAssignee}
          onChange={setListAssignee}
          options={assigneeOptions}
          allLabel="Tất cả người phụ trách"
          ariaLabel="Người phụ trách hồ sơ"
        />
        <SearchInput
          width={280}
          placeholder="Mã case / SKU / Physical Code / Serial"
          aria-label="Tìm mã case, SKU, physical code hoặc serial"
          value={listKeyword}
          onChange={setListKeyword}
        />
      </FilterBar>

      {warranty.isError ? (
        <Box sx={{ mb: 1.5 }}>
          <ApiErrorAlert
            error={warranty.error}
            title="Không tải được báo cáo bảo hành"
            onRetry={() => void warranty.refetch()}
          />
        </Box>
      ) : null}

      {exporter.exportDenied ? (
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
              onClose={exporter.clearExportDenied}
            >
              {exporter.exportDenied}
            </UiAlert>
          </Box>
        </div>
      ) : null}

      <ResponsiveDataTable<CaseRow>
        columns={[
          {
            key: "stt",
            header: "STT",
            align: "center",
            width: 56,
            hideOnMobile: true,
            render: (row) =>
              mvpRowNumber(
                casePagination.page,
                casePagination.perPage,
                casePagination.pageRows.indexOf(row),
              ),
          },
          {
            key: "caseNo",
            header: "Mã case",
            width: 150,
            sortAccessor: (row) => row.caseNo,
            render: (row) => (
              <Box sx={{ fontWeight: 700 }}>{row.caseNo || "—"}</Box>
            ),
          },
          {
            key: "model",
            header: "SKU / Model",
            width: 160,
            sortAccessor: (row) => row.model,
            render: (row) => (
              <Box>
                <Box>{row.model || "—"}</Box>
                <Box sx={{ fontSize: 12, color: "text.secondary" }}>
                  {row.skuName}
                </Box>
              </Box>
            ),
          },
          {
            key: "physicalCode",
            header: "Physical Code / Serial",
            width: 190,
            hideOnMobile: true,
            render: (row) => row.physicalCode || "—",
          },
          {
            key: "defect",
            header: "Bệnh / lỗi",
            render: (row) => row.defect || "—",
          },
          {
            key: "status",
            header: "Trạng thái",
            width: 150,
            render: (row) => (
              <ReportStatusBadge
                value={row.status}
                label={reportStatusLabel(row.status)}
              />
            ),
          },
          {
            key: "receivedAt",
            header: "Ngày tiếp nhận",
            width: 150,
            sortAccessor: (row) => row.receivedAt,
            render: (row) => (row.receivedAt ? fmtDate(row.receivedAt) : "—"),
          },
          {
            key: "dueDate",
            header: "Dự kiến hoàn thành",
            width: 170,
            sortAccessor: (row) => row.dueDate,
            render: (row) => (row.dueDate ? fmtDate(row.dueDate) : "—"),
          },
          {
            key: "sla",
            header: "SLA",
            width: 150,
            render: (row) => (
              <UiStatusBadge
                size="small"
                tone={SLA_TONE[row.sla]}
                label={
                  row.slaDays === null
                    ? SLA_LABELS[row.sla]
                    : `${SLA_LABELS[row.sla]} (${row.slaDays >= 0 ? `còn ${row.slaDays}` : `trễ ${Math.abs(row.slaDays)}`} ngày)`
                }
              />
            ),
          },
          {
            key: "department",
            header: "Phòng ban",
            hideOnMobile: true,
            render: (row) => row.department || "—",
          },
          {
            key: "assignee",
            header: "Người phụ trách",
            hideOnMobile: true,
            render: (row) => row.assignee || "—",
          },
          {
            key: "componentCount",
            header: "Số linh kiện đã dùng",
            align: "right",
            width: 175,
            sortAccessor: (row) =>
              row.components.reduce((acc, item) => acc + item.qty, 0),
            render: (row) =>
              fmt(row.components.reduce((acc, item) => acc + item.qty, 0)),
          },
          {
            key: "customerName",
            header: "Khách hàng",
            hideOnMobile: true,
            render: (row) => row.customerName || "—",
          },
          {
            key: "customerPhone",
            header: "SĐT",
            hideOnMobile: true,
            render: (row) => row.customerPhone || "—",
          },
        ]}
        rows={casePagination.pageRows}
        rowKey={(row) => row.caseNo}
        loading={loading}
        onRowClick={(row) => setOpenCase(row)}
        emptyText="Không có hồ sơ nào theo bộ lọc."
        renderRowActions={(row) => (
          <ActionButton
            kind="view"
            aria-label="Xem chi tiết dòng báo cáo"
            sx={{ whiteSpace: "nowrap" }}
            onClick={() => setOpenCase(row)}
          />
        )}
      />
      <ReportPaginationBar
        page={casePagination.page}
        perPage={casePagination.perPage}
        total={casePagination.total}
        onPageChange={casePagination.setPage}
        onPageSizeChange={casePagination.setPerPage}
      />

      {statusDrill ? (
        <DrillDownDialog
          title={`Hồ sơ bảo hành — ${statusDrill.label}`}
          subtitle={`${fmt(statusDrill.rows.length)} hồ sơ`}
          onClose={() => setStatusDrill(null)}
        >
          <CaseMiniTable
            rows={statusDrill.rows}
            onOpen={(row) => {
              setStatusDrill(null);
              setOpenCase(row);
            }}
          />
        </DrillDownDialog>
      ) : null}

      {defectDrill ? (
        <DrillDownDialog
          title={`Hồ sơ có bệnh/lỗi: ${defectDrill}`}
          onClose={() => setDefectDrill(null)}
        >
          <CaseMiniTable
            rows={cases.filter((item) =>
              item.defectNames.some((name) => defectDrill.includes(name)),
            )}
            onOpen={(row) => {
              setDefectDrill(null);
              setOpenCase(row);
            }}
          />
        </DrillDownDialog>
      ) : null}

      {openCase ? (
        <DrillDownDialog
          title={`Hồ sơ bảo hành ${openCase.caseNo}`}
          subtitle={`${openCase.model} · ${openCase.skuName}`}
          onClose={() => setOpenCase(null)}
        >
          <Stack direction="row" spacing={1} sx={{ flexWrap: "wrap", mb: 1.5 }}>
            <ReportStatusBadge
              value={openCase.status}
              label={reportStatusLabel(openCase.status)}
            />
            <UiStatusBadge
              size="small"
              tone={SLA_TONE[openCase.sla]}
              label={SLA_LABELS[openCase.sla]}
            />
            <UiStatusBadge
              size="small"
              tone="neutral"
              label={`Tiếp nhận: ${openCase.receivedAt ? fmtDate(openCase.receivedAt) : "—"}`}
            />
            <UiStatusBadge
              size="small"
              tone="neutral"
              label={`Người phụ trách: ${openCase.assignee || "—"}`}
            />
          </Stack>

          <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
            Khách hàng
          </Box>
          {/* Mỗi giá trị PII đứng trong phần tử riêng: kiểm thử và trình đọc
              màn hình phải đọc được đúng giá trị đã che, không dính vào nhãn. */}
          <Box sx={{ typography: "body2", mb: 2, display: "grid", gap: 0.25 }}>
            <div>
              Khách hàng: <b>{openCase.customerName || "—"}</b>
            </div>
            <div>
              SĐT: <b>{openCase.customerPhone || "—"}</b>
            </div>
            <div>
              Địa chỉ: <b>{openCase.customerAddress || "—"}</b>
            </div>
          </Box>

          <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
            Linh kiện đã sử dụng
          </Box>
          <ResponsiveDataTable<{ skuCode: string; qty: number }>
            columns={[
              {
                key: "skuCode",
                header: "SKU linh kiện",
                render: (row) => row.skuCode,
              },
              {
                key: "name",
                header: "Tên linh kiện",
                render: (row) =>
                  catalog.byCode.get(row.skuCode)?.sku_name ?? "—",
              },
              {
                key: "qty",
                header: "Số lượng",
                align: "right",
                render: (row) => fmt(row.qty),
              },
            ]}
            rows={openCase.components}
            rowKey={(row) => row.skuCode}
            emptyText="Hồ sơ này chưa xuất linh kiện nào."
          />

          <Box sx={{ typography: "subtitle2", fontWeight: 700, mt: 2, mb: 1 }}>
            Phiếu xuất linh kiện liên quan
          </Box>
          {(() => {
            const doc = issueDocByCase.get(openCase.caseId);
            if (!doc) {
              return (
                <UiAlert tone="info">
                  Chưa có phiếu xuất linh kiện gắn với hồ sơ này.
                </UiAlert>
              );
            }
            return (
              <Box sx={{ typography: "body2" }}>
                Phiếu <b>{text(doc.component_issue_no)}</b> · trạng thái{" "}
                {reportStatusLabel(doc.status)} · thời gian{" "}
                {fmtDateTime(doc.posted_at ?? doc.document_date)} · người thực
                hiện {openCase.assignee || "—"}
              </Box>
            );
          })()}

          <Box sx={{ typography: "subtitle2", fontWeight: 700, mt: 2, mb: 1 }}>
            Movement liên quan (xuất linh kiện trong kỳ)
          </Box>
          <MovementTable
            rows={listOf(caseMovements.data?.rows).filter((row) =>
              openCase.components.some(
                (component) => text(row.product_code) === component.skuCode,
              ),
            )}
            loading={caseMovements.isLoading}
            emptyText="Không tìm thấy movement xuất linh kiện khớp hồ sơ này trong kỳ."
          />
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}

/** Bảng hồ sơ rút gọn dùng trong mọi drill-down của tab bảo hành. */
function CaseMiniTable({
  rows,
  onOpen,
}: {
  rows: CaseRow[];
  onOpen: (row: CaseRow) => void;
}) {
  return (
    <ResponsiveDataTable<CaseRow>
      columns={[
        {
          key: "caseNo",
          header: "Mã case",
          render: (row) => (
            <Box sx={{ fontWeight: 700 }}>{row.caseNo || "—"}</Box>
          ),
        },
        { key: "model", header: "SKU / Model", render: (row) => row.model },
        {
          key: "defect",
          header: "Bệnh / lỗi",
          render: (row) => row.defect || "—",
        },
        {
          key: "status",
          header: "Trạng thái",
          render: (row) => reportStatusLabel(row.status),
        },
        {
          key: "receivedAt",
          header: "Tiếp nhận",
          render: (row) => (row.receivedAt ? fmtDate(row.receivedAt) : "—"),
        },
        {
          key: "sla",
          header: "SLA",
          render: (row) => (
            <UiStatusBadge
              size="small"
              tone={SLA_TONE[row.sla]}
              label={SLA_LABELS[row.sla]}
            />
          ),
        },
      ]}
      rows={rows}
      rowKey={(row) => row.caseNo}
      onRowClick={onOpen}
      emptyText="Không có hồ sơ nào."
    />
  );
}
