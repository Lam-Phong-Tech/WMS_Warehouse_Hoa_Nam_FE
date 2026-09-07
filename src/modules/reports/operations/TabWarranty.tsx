import { useT, type TranslateFn } from "@/shared/i18n/useT";
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
import { EMPTY_TEXT } from "@/shared/constants/display";
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
  SLA_LABEL_KEYS,
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
import { rowIndexOf } from "@/shared/components/data-display/row-index";

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
  t: TranslateFn,
  value: string,
): Array<{ skuCode: string; qty: number }> {
  if (!value || value === t("reports.warranty.notIssued")) return [];
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
  const t = useT();
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
        components: parseComponents(t, componentsText),
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
  }, [warranty.data, rawCaseByCode, users, today, canViewPii, t]);

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
        name: t("reports.warranty.seriesReceived"),
        data: days.map((day) => received.get(day) ?? 0),
        color: CHART_COLORS.info,
      },
      {
        name: t("reports.warranty.seriesCompleted"),
        data: days.map((day) => completed.get(day) ?? 0),
        color: CHART_COLORS.success,
      },
      {
        name: t("reports.warranty.seriesOverdue"),
        data: days.map((day) => overdue.get(day) ?? 0),
        color: CHART_COLORS.danger,
      },
    ];
  }, [days, cases, t]);

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
  const slaOptions = (Object.keys(SLA_LABEL_KEYS) as SlaState[]).map(
    (value) => ({
      value,
      label: t(SLA_LABEL_KEYS[value]),
    }),
  );
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
        title={t("reports.warranty.title")}
        description={t("reports.warranty.description")}
      />

      <FilterBar
        label={t("reports.warranty.filterLabel")}
        hint={t("reports.warranty.filterHint", {
          label: period.label,
          count: fmt(cases.length),
        })}
      >
        <PeriodFilterControls state={period} />
      </FilterBar>

      {period.invalid ? (
        <Box sx={{ mb: 2 }}>
          <UiAlert tone="error">{t("reports.common.dateOrderError")}</UiAlert>
        </Box>
      ) : null}

      <Box sx={{ mb: 2 }}>
        <UiAlert tone="info">
          {canExportPii
            ? t("reports.warranty.piiCanExport", {
                min: PII_REASON_MIN_LENGTH,
              })
            : t("reports.warranty.piiCannotExport")}
        </UiAlert>
      </Box>

      {piiReasonInvalid ? (
        <Box sx={{ mb: 1.5 }}>
          <UiAlert tone="warning">
            {t("reports.warranty.piiReasonHint", {
              min: PII_REASON_MIN_LENGTH,
            })}
          </UiAlert>
        </Box>
      ) : null}

      {exceedsExportRowLimit ? (
        <div {...uiStateProps(UI_STATE.DISABLED, "report-export-row-limit")}>
          <Box sx={{ mb: 1.5 }}>
            <UiAlert tone="warning">
              {t("reports.warranty.rowLimitWarning", {
                rows: fmt(totalRows),
                limit: fmt(EXPORT_ROW_LIMIT),
              })}
            </UiAlert>
          </Box>
        </div>
      ) : null}

      {noAssignee ? (
        <DataGapNotice>
          {t("reports.warranty.assigneeNoteA")}{" "}
          <b>{t("reports.warranty.assigneeNoteB")}</b>{" "}
          {t("reports.warranty.assigneeNoteC")}
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
          label={t("reports.warranty.kpiDueSoon")}
          value={fmt(dueSoonCases.length)}
          tone="warning"
          icon={<WarningOutlined />}
          hint={t("reports.warranty.kpiDueSoonHint", { days: DUE_SOON_DAYS })}
          onClick={() =>
            setStatusDrill({
              label: t("reports.warranty.kpiDueSoon"),
              rows: dueSoonCases,
            })
          }
        />
        <ReportKpi
          label={t("reports.warranty.kpiOverdue")}
          value={fmt(overdueCases.length)}
          tone="error"
          icon={<WarningOutlined />}
          hint={t("reports.warranty.kpiOverdueHint")}
          onClick={() =>
            setStatusDrill({
              label: t("reports.warranty.kpiOverdue"),
              rows: overdueCases,
            })
          }
        />
      </ReportKpiRow>

      <ChartGrid>
        <ChartCard
          title={t("reports.warranty.statusTitle")}
          description={t("reports.warranty.statusDescription")}
          loading={loading}
          error={warranty.error}
          onRetry={() => void warranty.refetch()}
          empty={cases.length === 0}
          emptyText={t("reports.warranty.statusEmpty")}
          footer={
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: "wrap", rowGap: 1 }}
            >
              <UiStatusBadge
                size="small"
                tone="warning"
                label={t("reports.warranty.dueSoonBadge", {
                  count: fmt(dueSoonCases.length),
                })}
              />
              <UiStatusBadge
                size="small"
                tone="error"
                label={t("reports.warranty.overdueBadge", {
                  count: fmt(overdueCases.length),
                })}
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
            centerLabel={t("reports.warranty.centerLabel")}
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
          title={t("reports.warranty.trendTitle")}
          description={t("reports.warranty.trendDescription")}
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
                if (
                  payload.seriesName === t("reports.warranty.seriesReceived")
                ) {
                  return dayKey(item.receivedAt) === day;
                }
                if (
                  payload.seriesName === t("reports.warranty.seriesCompleted")
                ) {
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
        title={t("reports.warranty.defectTitle")}
        description={t("reports.warranty.defectDescription")}
        fullWidth
        loading={breakdown.isLoading || loading}
        error={breakdown.error}
        onRetry={() => void breakdown.refetch()}
        empty={defectItems.length === 0}
        emptyText={t("reports.warranty.defectEmpty")}
        toolbar={
          <Box sx={{ display: "flex", flexWrap: "wrap", gap: 1 }}>
            <UiSelect
              minWidth={240}
              aria-label={t("reports.warranty.skuAria")}
              placeholder={t("reports.warranty.skuAll")}
              value={defectSkuId}
              onChange={setDefectSkuId}
              options={catalog.options}
            />
            <MultiSelectFilter
              value={defectFilterIds}
              onChange={setDefectFilterIds}
              options={defects.options}
              placeholder={t("reports.warranty.defectPlaceholder")}
              ariaLabel={t("reports.warranty.defectAria")}
            />
            <AllOrPickFilter
              value={defectStatus}
              onChange={setDefectStatus}
              options={statusOptions}
              allLabel={t("reports.warranty.caseStatusAll")}
              ariaLabel={t("reports.warranty.caseStatusAria")}
            />
            <AllOrPickFilter
              value={defectDepartment}
              onChange={setDefectDepartment}
              options={users.departmentOptions}
              allLabel={t("reports.warranty.departmentAll")}
              ariaLabel={t("reports.warranty.departmentAria")}
            />
            <AllOrPickFilter
              value={defectAssignee}
              onChange={setDefectAssignee}
              options={assigneeOptions}
              allLabel={t("reports.warranty.assigneeAll")}
              ariaLabel={t("reports.warranty.assigneeAria")}
            />
          </Box>
        }
        footer={
          useLocalDefectCount ? (
            <FormulaNote>{t("reports.warranty.recountNote")}</FormulaNote>
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
        title={t("reports.warranty.topComponentsTitle")}
        description={t("reports.warranty.topComponentsDescription")}
        fullWidth
        loading={componentUsage.isLoading}
        error={componentUsage.error}
        onRetry={() => void componentUsage.refetch()}
        empty={componentItems.length === 0}
        emptyText={t("reports.warranty.topComponentsEmpty")}
        toolbar={
          <SegmentedToggle
            label={t("reports.warranty.topComponentsCount")}
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
        title={t("reports.warranty.componentTableTitle")}
        description={t("reports.warranty.componentTableDescription")}
      />

      <FilterBar
        label={t("reports.warranty.componentFilterLabel")}
        hint={t("reports.warranty.componentFilterHint", {
          count: fmt(filteredComponentRows.length),
        })}
      >
        <SearchInput
          width={300}
          placeholder={t("reports.warranty.componentSearchPlaceholder")}
          aria-label={t("reports.warranty.componentSearchAria")}
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
                rowIndexOf(componentPagination.pageRows, row),
              ),
          },
          {
            key: "caseNo",
            header: t("reports.warranty.colCase"),
            width: 150,
            sortAccessor: (row) => row.caseNo,
            render: (row) => (
              <Box sx={{ fontWeight: 700 }}>{row.caseNo || EMPTY_TEXT}</Box>
            ),
          },
          {
            key: "model",
            header: t("reports.warranty.colDeviceSku"),
            width: 150,
            render: (row) => row.model || EMPTY_TEXT,
          },
          {
            key: "physicalCode",
            header: t("reports.warranty.colPhysicalSerial"),
            width: 190,
            hideOnMobile: true,
            render: (row) => row.physicalCode || EMPTY_TEXT,
          },
          {
            key: "status",
            header: t("reports.warranty.colStatus"),
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
            header: t("reports.warranty.colComponent"),
            render: (row) => row.componentName,
          },
          {
            key: "componentSku",
            header: t("reports.warranty.colComponentSku"),
            width: 160,
            render: (row) => row.componentSku,
          },
          {
            key: "qty",
            header: t("reports.warranty.colQty"),
            align: "right",
            width: 110,
            sortAccessor: (row) => row.qty,
            render: (row) => fmt(row.qty),
          },
          {
            key: "issueNo",
            header: t("reports.warranty.colIssueNote"),
            width: 180,
            hideOnMobile: true,
            render: (row) => row.issueNo || EMPTY_TEXT,
          },
          {
            key: "issuedAt",
            header: t("reports.warranty.colIssueDate"),
            width: 140,
            hideOnMobile: true,
            render: (row) =>
              row.issuedAt ? fmtDate(row.issuedAt) : EMPTY_TEXT,
          },
          {
            key: "actor",
            header: t("reports.warranty.colActor"),
            hideOnMobile: true,
            render: (row) => row.actor || EMPTY_TEXT,
          },
        ]}
        rows={componentPagination.pageRows}
        rowKey={(row) => row.key}
        loading={loading || issueDocs.isLoading}
        onRowClick={(row) => setOpenCase(row.caseRow)}
        emptyText={t("reports.warranty.componentTableEmpty")}
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
        title={t("reports.warranty.caseTableTitle")}
        description={t("reports.warranty.caseTableDescription")}
      />

      <FilterBar
        label={t("reports.warranty.caseFilterLabel")}
        hint={t("reports.warranty.caseFilterHint", {
          count: fmt(filteredCases.length),
        })}
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
            placeholder={t("reports.warranty.piiReasonPlaceholder", {
              min: PII_REASON_MIN_LENGTH,
            })}
            slotProps={{
              htmlInput: {
                maxLength: 500,
                "data-testid": "report-pii-reason",
                "aria-label": t("reports.warranty.piiReasonAria"),
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
          allLabel={t("reports.warranty.caseStatusAllShort")}
          ariaLabel={t("reports.warranty.caseStatusFilterAria")}
        />
        <AllOrPickFilter
          value={listSku}
          onChange={setListSku}
          options={catalog.options}
          allLabel={t("reports.warranty.skuAllShort")}
          ariaLabel="SKU"
          minWidth={240}
        />
        <UiSelect
          minWidth={200}
          aria-label={t("reports.warranty.defectCountAria")}
          placeholder={t("reports.warranty.defectCountPlaceholder")}
          value={listMultiDefect}
          onChange={setListMultiDefect}
          options={[
            { value: "MULTI", label: t("reports.warranty.defectMulti") },
            { value: "SINGLE", label: t("reports.warranty.defectSingle") },
          ]}
        />
        <AllOrPickFilter
          value={listSla}
          onChange={setListSla}
          options={slaOptions}
          allLabel={t("reports.warranty.slaAll")}
          ariaLabel="SLA"
        />
        <AllOrPickFilter
          value={listDepartment}
          onChange={setListDepartment}
          options={users.departmentOptions}
          allLabel={t("reports.warranty.departmentAll")}
          ariaLabel={t("reports.warranty.caseDepartmentAria")}
        />
        <AllOrPickFilter
          value={listAssignee}
          onChange={setListAssignee}
          options={assigneeOptions}
          allLabel={t("reports.warranty.assigneeAll")}
          ariaLabel={t("reports.warranty.caseAssigneeAria")}
        />
        <SearchInput
          width={280}
          placeholder={t("reports.warranty.caseSearchPlaceholder")}
          aria-label={t("reports.warranty.caseSearchAria")}
          value={listKeyword}
          onChange={setListKeyword}
        />
      </FilterBar>

      {warranty.isError ? (
        <Box sx={{ mb: 1.5 }}>
          <ApiErrorAlert
            error={warranty.error}
            title={t("reports.warranty.caseLoadError")}
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
              title={t("reports.common.exportDenied")}
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
                rowIndexOf(casePagination.pageRows, row),
              ),
          },
          {
            key: "caseNo",
            header: t("reports.warranty.colCase"),
            width: 150,
            sortAccessor: (row) => row.caseNo,
            render: (row) => (
              <Box sx={{ fontWeight: 700 }}>{row.caseNo || EMPTY_TEXT}</Box>
            ),
          },
          {
            key: "model",
            header: "SKU / Model",
            width: 160,
            sortAccessor: (row) => row.model,
            render: (row) => (
              <Box>
                <Box>{row.model || EMPTY_TEXT}</Box>
                <Box sx={{ fontSize: 12, color: "text.secondary" }}>
                  {row.skuName}
                </Box>
              </Box>
            ),
          },
          {
            key: "physicalCode",
            header: t("reports.warranty.colPhysicalSerial"),
            width: 190,
            hideOnMobile: true,
            render: (row) => row.physicalCode || EMPTY_TEXT,
          },
          {
            key: "defect",
            header: t("reports.warranty.colDefect"),
            render: (row) => row.defect || EMPTY_TEXT,
          },
          {
            key: "status",
            header: t("reports.warranty.colStatus"),
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
            header: t("reports.warranty.colReceivedAt"),
            width: 150,
            sortAccessor: (row) => row.receivedAt,
            render: (row) =>
              row.receivedAt ? fmtDate(row.receivedAt) : EMPTY_TEXT,
          },
          {
            key: "dueDate",
            header: t("reports.warranty.colEstimated"),
            width: 170,
            sortAccessor: (row) => row.dueDate,
            render: (row) => (row.dueDate ? fmtDate(row.dueDate) : EMPTY_TEXT),
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
                    ? t(SLA_LABEL_KEYS[row.sla])
                    : t("reports.warranty.slaValue", {
                        label: t(SLA_LABEL_KEYS[row.sla]),
                        detail:
                          row.slaDays >= 0
                            ? t("reports.warranty.slaRemaining", {
                                days: row.slaDays,
                              })
                            : t("reports.warranty.slaLate", {
                                days: Math.abs(row.slaDays),
                              }),
                      })
                }
              />
            ),
          },
          {
            key: "department",
            header: t("reports.warranty.colDepartment"),
            hideOnMobile: true,
            render: (row) => row.department || EMPTY_TEXT,
          },
          {
            key: "assignee",
            header: t("reports.warranty.colAssignee"),
            hideOnMobile: true,
            render: (row) => row.assignee || EMPTY_TEXT,
          },
          {
            key: "componentCount",
            header: t("reports.warranty.colComponentCount"),
            align: "right",
            width: 175,
            sortAccessor: (row) =>
              row.components.reduce((acc, item) => acc + item.qty, 0),
            render: (row) =>
              fmt(row.components.reduce((acc, item) => acc + item.qty, 0)),
          },
          {
            key: "customerName",
            header: t("reports.warranty.colCustomer"),
            hideOnMobile: true,
            render: (row) => row.customerName || EMPTY_TEXT,
          },
          {
            key: "customerPhone",
            header: t("reports.warranty.colPhone"),
            hideOnMobile: true,
            render: (row) => row.customerPhone || EMPTY_TEXT,
          },
        ]}
        rows={casePagination.pageRows}
        rowKey={(row) => row.caseNo}
        loading={loading}
        onRowClick={(row) => setOpenCase(row)}
        emptyText={t("reports.warranty.caseTableEmpty")}
        renderRowActions={(row) => (
          <ActionButton
            kind="view"
            aria-label={t("reports.warranty.caseDetailAria")}
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
          title={t("reports.warranty.statusDrillTitle", {
            label: statusDrill.label,
          })}
          subtitle={t("reports.warranty.statusDrillSubtitle", {
            count: fmt(statusDrill.rows.length),
          })}
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
          title={t("reports.warranty.defectDrillTitle", {
            defect: defectDrill,
          })}
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
          title={t("reports.warranty.caseDialogTitle", {
            code: openCase.caseNo,
          })}
          subtitle={t("reports.warranty.caseDialogSubtitle", {
            model: openCase.model,
            sku: openCase.skuName,
          })}
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
              label={t(SLA_LABEL_KEYS[openCase.sla])}
            />
            <UiStatusBadge
              size="small"
              tone="neutral"
              label={t("reports.warranty.receivedBadge", {
                date: openCase.receivedAt
                  ? fmtDate(openCase.receivedAt)
                  : EMPTY_TEXT,
              })}
            />
            <UiStatusBadge
              size="small"
              tone="neutral"
              label={t("reports.warranty.assigneeBadge", {
                name: openCase.assignee || EMPTY_TEXT,
              })}
            />
          </Stack>

          <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
            {t("reports.warranty.sectionCustomer")}
          </Box>
          {/* Mỗi giá trị PII đứng trong phần tử riêng: kiểm thử và trình đọc
              màn hình phải đọc được đúng giá trị đã che, không dính vào nhãn. */}
          <Box sx={{ typography: "body2", mb: 2, display: "grid", gap: 0.25 }}>
            <div>
              {t("reports.warranty.customerLine")}{" "}
              <b>{openCase.customerName || EMPTY_TEXT}</b>
            </div>
            <div>
              {t("reports.warranty.phoneLine")}{" "}
              <b>{openCase.customerPhone || EMPTY_TEXT}</b>
            </div>
            <div>
              {t("reports.warranty.addressLine")}{" "}
              <b>{openCase.customerAddress || EMPTY_TEXT}</b>
            </div>
          </Box>

          <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
            {t("reports.warranty.sectionComponentsUsed")}
          </Box>
          <ResponsiveDataTable<{ skuCode: string; qty: number }>
            columns={[
              {
                key: "skuCode",
                header: t("reports.warranty.colComponentSku"),
                render: (row) => row.skuCode,
              },
              {
                key: "name",
                header: t("reports.warranty.colComponentName"),
                render: (row) =>
                  catalog.byCode.get(row.skuCode)?.sku_name ?? EMPTY_TEXT,
              },
              {
                key: "qty",
                header: t("reports.warranty.colQty"),
                align: "right",
                render: (row) => fmt(row.qty),
              },
            ]}
            rows={openCase.components}
            rowKey={(row) => row.skuCode}
            emptyText={t("reports.warranty.componentsUsedEmpty")}
          />

          <Box sx={{ typography: "subtitle2", fontWeight: 700, mt: 2, mb: 1 }}>
            {t("reports.warranty.sectionIssueDocs")}
          </Box>
          {(() => {
            const doc = issueDocByCase.get(openCase.caseId);
            if (!doc) {
              return (
                <UiAlert tone="info">
                  {t("reports.warranty.issueDocsEmpty")}
                </UiAlert>
              );
            }
            return (
              <Box sx={{ typography: "body2" }}>
                {t("reports.warranty.issueDocLineA")}{" "}
                <b>{text(doc.component_issue_no)}</b>{" "}
                {t("reports.warranty.issueDocLineB")}{" "}
                {reportStatusLabel(doc.status)}{" "}
                {t("reports.warranty.issueDocLineC")}{" "}
                {fmtDateTime(doc.posted_at ?? doc.document_date)}{" "}
                {t("reports.warranty.issueDocLineD")}{" "}
                {openCase.assignee || EMPTY_TEXT}
              </Box>
            );
          })()}

          <Box sx={{ typography: "subtitle2", fontWeight: 700, mt: 2, mb: 1 }}>
            {t("reports.warranty.sectionMovements")}
          </Box>
          <MovementTable
            rows={listOf(caseMovements.data?.rows).filter((row) =>
              openCase.components.some(
                (component) => text(row.product_code) === component.skuCode,
              ),
            )}
            loading={caseMovements.isLoading}
            emptyText={t("reports.warranty.movementsEmpty")}
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
  const t = useT();
  return (
    <ResponsiveDataTable<CaseRow>
      columns={[
        {
          key: "caseNo",
          header: t("reports.warranty.colCase"),
          render: (row) => (
            <Box sx={{ fontWeight: 700 }}>{row.caseNo || EMPTY_TEXT}</Box>
          ),
        },
        { key: "model", header: "SKU / Model", render: (row) => row.model },
        {
          key: "defect",
          header: t("reports.warranty.colDefect"),
          render: (row) => row.defect || EMPTY_TEXT,
        },
        {
          key: "status",
          header: t("reports.warranty.colStatus"),
          render: (row) => reportStatusLabel(row.status),
        },
        {
          key: "receivedAt",
          header: t("reports.warranty.colReceived"),
          render: (row) =>
            row.receivedAt ? fmtDate(row.receivedAt) : EMPTY_TEXT,
        },
        {
          key: "sla",
          header: "SLA",
          render: (row) => (
            <UiStatusBadge
              size="small"
              tone={SLA_TONE[row.sla]}
              label={t(SLA_LABEL_KEYS[row.sla])}
            />
          ),
        },
      ]}
      rows={rows}
      rowKey={(row) => row.caseNo}
      onRowClick={onOpen}
      emptyText={t("reports.warranty.drillEmpty")}
    />
  );
}
