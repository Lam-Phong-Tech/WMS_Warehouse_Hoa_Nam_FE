import { useT, type TranslateFn } from "@/shared/i18n/useT";
import { useMemo, useState } from "react";
import { Box, UiAlert, UiSelect, UiStatusBadge } from "@/shared/ui";
import {
  ExportOutlined,
  ImportOutlined,
  StockOutlined,
  SwapOutlined,
} from "@/shared/components/icons";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ActionButton } from "@/shared/components/actions";
import {
  WaterfallChart,
  type WaterfallPoint,
} from "@/shared/components/charts/WaterfallChart";
import { MultiSeriesBarChart } from "@/shared/components/charts/MultiSeriesBarChart";
import { LineChart } from "@/shared/components/charts/LineChart";
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
  minuteOfDay,
  n,
  parseHourMinute,
  text,
  type ItemKind,
  type Raw,
} from "./report-format";
import {
  useDocumentHistory,
  useMovementTrace,
  useReversalDocuments,
  useSkuCatalog,
  useUserDirectory,
  useXntReport,
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
} from "./report-ui";
import {
  AllOrPickFilter,
  ExportButtons,
  ItemKindFilter,
  PeriodFilterControls,
  TimeWindowFilter,
} from "./report-filters";
import {
  EMPTY_TIME_WINDOW,
  usePeriodFilter,
  type TimeWindow,
} from "./report-period";
import {
  DIRECTION_LABEL_KEYS,
  DIRECTION_TONE,
  DOC_TYPE_LABEL_KEYS,
  reportStatusLabel,
  stockStatusLabel,
  type StockDirection,
} from "./report-labels";
import {
  MultiSelectFilter,
  ReportPaginationBar,
  ReportRowDetailModal,
} from "./report-table";
import {
  sttColumn,
  toResponsiveColumns,
  useClientPagination,
  useReportColumnSort,
  visibleReportColumns,
  type ReportColumn,
} from "./report-columns";
import {
  DocumentLinesTable,
  MovementTable,
  ReportStatusBadge,
} from "./report-drilldown";
import { useReportExport } from "./report-export";

/** Mỗi bậc waterfall ứng với đúng một movement_type để bấm vào là ra nguồn số. */
type WaterfallKey =
  | "OPENING"
  | "RECEIPT"
  | "ISSUE"
  | "COMPONENT_ISSUE"
  | "REVERSAL"
  | "CLOSING";

const waterfallSteps = (
  t: TranslateFn,
): Array<{ key: WaterfallKey; label: string }> => [
  { key: "OPENING", label: t("reports.inventoryFlow.opening") },
  { key: "RECEIPT", label: t("reports.inventoryFlow.receipt") },
  { key: "ISSUE", label: t("reports.inventoryFlow.issue") },
  {
    key: "COMPONENT_ISSUE",
    label: t("reports.inventoryFlow.componentIssue"),
  },
  { key: "REVERSAL", label: t("reports.inventoryFlow.reversal") },
  { key: "CLOSING", label: t("reports.inventoryFlow.closing") },
];

const docTypeFilterOptions = (t: TranslateFn) => [
  { value: "all", label: t("reports.inventoryFlow.docAll") },
  { value: "INBOUND", label: t("reports.inventoryFlow.docInbound") },
  { value: "OUTBOUND", label: t("reports.inventoryFlow.docOutbound") },
  { value: "REVERSAL", label: t("reports.inventoryFlow.docReversal") },
];

const DOC_STATUS_OPTIONS = ["DRAFT", "SCANNING", "POSTED", "CANCELLED"].map(
  (value) => ({ value, label: reportStatusLabel(value) }),
);

type DocumentRow = Raw & {
  __key: string;
  __docType: "INBOUND" | "OUTBOUND" | "REVERSAL";
  __direction: StockDirection;
  __qty: number;
  __skuCount: number;
  __actor: string;
  __department: string;
  __createdAt: string;
  __postedAt: string;
};

/**
 * Tab 1 — Nhập-Xuất-Tồn & Lịch sử chứng từ.
 *
 * Ba biểu đồ 1.1–1.3 dùng CHUNG một bộ lọc (kỳ + loại hàng); bảng 1.4 có bộ lọc
 * riêng theo đúng yêu cầu nghiệp vụ, nên hai khối được tách rõ bằng hai
 * `FilterBar` có nhãn phạm vi — nếu dùng chung một thanh lọc thì người đọc
 * không thể biết con số trên chart và dòng trong bảng có cùng điều kiện hay
 * không.
 */
export default function TabInventoryFlow() {
  const t = useT();
  const catalog = useSkuCatalog();
  const users = useUserDirectory();

  // ── Bộ lọc chung cho 1.1 – 1.3 ─────────────────────────────────────────
  const chartPeriod = usePeriodFilter("this-month");
  const [chartKind, setChartKind] = useState<ItemKind>("all");

  const xnt = useXntReport({
    from: chartPeriod.from,
    to: chartPeriod.to,
    enabled: !chartPeriod.invalid,
  });
  const ledger = useMovementTrace({
    from: chartPeriod.from,
    to: chartPeriod.to,
    enabled: !chartPeriod.invalid,
  });

  const xntLines = useMemo(
    () =>
      listOf(xnt.data?.lines).filter(
        (line) =>
          chartKind === "all" ||
          catalog.kindOfCode(line.product_code) === chartKind,
      ),
    [xnt.data, chartKind, catalog],
  );

  const ledgerRows = useMemo(
    () =>
      listOf(ledger.data?.rows).filter(
        (row) =>
          chartKind === "all" ||
          catalog.kindOfCode(row.product_code) === chartKind,
      ),
    [ledger.data, chartKind, catalog],
  );

  // ── 1.1 Waterfall ──────────────────────────────────────────────────────
  const totals = useMemo(() => {
    const sum = (field: string) =>
      xntLines.reduce((acc, line) => acc + n(line[field]), 0);
    return {
      opening: sum("opening"),
      receiptNet: sum("receipt_net"),
      issueNet: sum("issue_net"),
      componentNet: sum("component_issue_net"),
      reversalUnlinked: sum("reversal_unlinked_net"),
      reversalNet: sum("reversal_net"),
      closing: sum("closing"),
    };
  }, [xntLines]);

  const waterfallPoints: WaterfallPoint[] = [
    {
      label: t("reports.inventoryFlow.opening"),
      value: totals.opening,
      kind: "total",
      hint: t("reports.inventoryFlow.hintOpening"),
    },
    {
      label: t("reports.inventoryFlow.receipt"),
      value: totals.receiptNet,
      kind: "delta",
      hint: t("reports.inventoryFlow.hintReceipt"),
    },
    {
      label: t("reports.inventoryFlow.issue"),
      value: -totals.issueNet,
      kind: "delta",
      hint: t("reports.inventoryFlow.hintIssue"),
    },
    {
      label: t("reports.inventoryFlow.componentIssue"),
      value: -totals.componentNet,
      kind: "delta",
      hint: t("reports.inventoryFlow.hintComponentIssue"),
    },
    {
      label: t("reports.inventoryFlow.reversal"),
      value: totals.reversalUnlinked,
      kind: "delta",
      hint: t("reports.inventoryFlow.hintReversal"),
    },
    {
      label: t("reports.inventoryFlow.closing"),
      value: totals.closing,
      kind: "total",
      hint: t("reports.inventoryFlow.hintClosing"),
    },
  ];

  const [waterfallDrill, setWaterfallDrill] = useState<{
    key: WaterfallKey;
    label: string;
  } | null>(null);

  const drillRows = useMemo(() => {
    if (!waterfallDrill) return [];
    if (waterfallDrill.key === "CLOSING") return ledgerRows;
    return ledgerRows.filter(
      (row) => text(row.movement_type) === waterfallDrill.key,
    );
  }, [waterfallDrill, ledgerRows]);

  // ── 1.1b Chi tiết cân đối theo SKU (gross · đã đảo · thuần) ────────────
  // BR-RPT-01..07 + BR-REV-11: waterfall chỉ nói được số THUẦN của cả kỳ; muốn
  // đối soát thì phải đọc được từng chiều Nhập/Xuất/Xuất LK tách gross · đã đảo
  // · thuần cho từng SKU, nên bảng này đi kèm ngay dưới biểu đồ 1.1.
  const xntPagination = useClientPagination(xntLines, 10);

  const xntColumns = useMemo<ReportColumn[]>(
    () => [
      sttColumn(xntPagination.page, xntPagination.perPage),
      {
        title: "Kho",
        dataIndex: "warehouse_code",
        width: 140,
        sorter: (a, b) =>
          text(a.warehouse_code, "").localeCompare(
            text(b.warehouse_code, ""),
            "vi",
          ),
        render: (value) => text(value),
      },
      {
        title: t("reports.inventoryFlow.colSkuCode"),
        dataIndex: "product_code",
        width: 150,
        sorter: (a, b) =>
          text(a.product_code, "").localeCompare(
            text(b.product_code, ""),
            "vi",
          ),
        render: (value) => text(value),
      },
      {
        title: t("reports.inventoryFlow.colSkuName"),
        dataIndex: "product_name",
        sorter: (a, b) =>
          text(a.product_name, "").localeCompare(
            text(b.product_name, ""),
            "vi",
          ),
        render: (value) => text(value),
      },
      {
        title: t("reports.inventoryFlow.colStockStatus"),
        dataIndex: "stock_status",
        width: 140,
        render: (value) => stockStatusLabel(value),
      },
      {
        title: t("reports.inventoryFlow.colOpening"),
        dataIndex: "opening",
        align: "right",
        width: 110,
        sortType: "value",
        sorter: (a, b) => n(a.opening) - n(b.opening),
        render: fmt,
      },
      {
        title: t("reports.inventoryFlow.receipt"),
        key: "receipt-group",
        children: [
          {
            title: t("reports.inventoryFlow.colGross"),
            dataIndex: "receipt_gross",
            align: "right",
            width: 120,
            sortType: "value",
            sorter: (a, b) => n(a.receipt_gross) - n(b.receipt_gross),
            render: fmt,
          },
          {
            title: t("reports.inventoryFlow.colReversed"),
            dataIndex: "receipt_reversal",
            align: "right",
            width: 110,
            sortType: "value",
            sorter: (a, b) => n(a.receipt_reversal) - n(b.receipt_reversal),
            render: fmt,
          },
          {
            title: t("reports.inventoryFlow.colNet"),
            dataIndex: "receipt_net",
            align: "right",
            width: 110,
            sortType: "value",
            sorter: (a, b) => n(a.receipt_net) - n(b.receipt_net),
            render: fmt,
          },
        ],
      },
      {
        title: t("reports.inventoryFlow.docOutbound"),
        key: "issue-group",
        children: [
          {
            title: t("reports.inventoryFlow.colGross"),
            dataIndex: "issue_gross",
            align: "right",
            width: 120,
            sortType: "value",
            sorter: (a, b) => n(a.issue_gross) - n(b.issue_gross),
            render: fmt,
          },
          {
            title: t("reports.inventoryFlow.colReversed"),
            dataIndex: "issue_reversal",
            align: "right",
            width: 110,
            sortType: "value",
            sorter: (a, b) => n(a.issue_reversal) - n(b.issue_reversal),
            render: fmt,
          },
          {
            title: t("reports.inventoryFlow.colNet"),
            dataIndex: "issue_net",
            align: "right",
            width: 110,
            sortType: "value",
            sorter: (a, b) => n(a.issue_net) - n(b.issue_net),
            render: fmt,
          },
        ],
      },
      {
        title: t("reports.inventoryFlow.colComponentIssue"),
        key: "component-issue-group",
        children: [
          {
            title: t("reports.inventoryFlow.colGross"),
            dataIndex: "component_issue_gross",
            align: "right",
            width: 120,
            sortType: "value",
            sorter: (a, b) =>
              n(a.component_issue_gross) - n(b.component_issue_gross),
            render: fmt,
          },
          {
            title: t("reports.inventoryFlow.colReversed"),
            dataIndex: "component_issue_reversal",
            align: "right",
            width: 110,
            sortType: "value",
            sorter: (a, b) =>
              n(a.component_issue_reversal) - n(b.component_issue_reversal),
            render: fmt,
          },
          {
            title: t("reports.inventoryFlow.colNet"),
            dataIndex: "component_issue_net",
            align: "right",
            width: 110,
            sortType: "value",
            sorter: (a, b) =>
              n(a.component_issue_net) - n(b.component_issue_net),
            render: fmt,
          },
        ],
      },
      {
        title: t("reports.inventoryFlow.colNetReversal"),
        dataIndex: "reversal_net",
        align: "right",
        width: 150,
        sortType: "value",
        sorter: (a, b) => n(a.reversal_net) - n(b.reversal_net),
        render: fmt,
      },
      {
        title: t("reports.inventoryFlow.colClosing"),
        dataIndex: "closing",
        align: "right",
        width: 120,
        sortType: "value",
        sorter: (a, b) => n(a.closing) - n(b.closing),
        render: fmt,
      },
    ],
    [xntPagination.page, xntPagination.perPage, t],
  );

  const {
    sortedRows: xntSortedRows,
    sortState: xntSortState,
    onSortChange: onXntSortChange,
  } = useReportColumnSort(xntColumns, xntPagination.pageRows);
  const xntResponsiveColumns = toResponsiveColumns(xntColumns, xntSortedRows);
  const [xntDetailRow, setXntDetailRow] = useState<{
    row: Raw;
    index: number;
  } | null>(null);

  // ── 1.2 / 1.3 chuỗi theo ngày ──────────────────────────────────────────
  const days = useMemo(
    () => dateSpan(chartPeriod.from, chartPeriod.to),
    [chartPeriod.from, chartPeriod.to],
  );

  const daily = useMemo(() => {
    const empty = () => new Map<string, number>(days.map((day) => [day, 0]));
    const receipt = empty();
    const issue = empty();
    const component = empty();
    const reversal = empty();
    const netChange = empty();
    let openingMovementsInPeriod = 0;

    for (const row of ledgerRows) {
      const day = dayKey(row.occurred_at);
      if (!receipt.has(day)) continue;
      const delta = n(row.qty_delta);
      const type = text(row.movement_type, "");
      netChange.set(day, (netChange.get(day) ?? 0) + delta);
      if (type === "RECEIPT") receipt.set(day, (receipt.get(day) ?? 0) + delta);
      else if (type === "ISSUE") issue.set(day, (issue.get(day) ?? 0) - delta);
      else if (type === "COMPONENT_ISSUE")
        component.set(day, (component.get(day) ?? 0) - delta);
      else if (type === "REVERSAL")
        reversal.set(day, (reversal.get(day) ?? 0) + delta);
      else if (type === "OPENING") openingMovementsInPeriod += delta;
    }

    // `opening` của báo cáo XNT gồm cả movement OPENING phát sinh TRONG kỳ; số
    // dư đầu chuỗi phải là số dư TRƯỚC kỳ, nếu không mỗi OPENING trong kỳ bị
    // cộng hai lần (một lần ở mốc đầu, một lần khi cộng dồn qty_delta).
    const closing: number[] = [];
    let running = totals.opening - openingMovementsInPeriod;
    for (const day of days) {
      running += netChange.get(day) ?? 0;
      closing.push(running);
    }

    return {
      receipt: days.map((day) => receipt.get(day) ?? 0),
      issue: days.map((day) => issue.get(day) ?? 0),
      component: days.map((day) => component.get(day) ?? 0),
      reversal: days.map((day) => reversal.get(day) ?? 0),
      closing,
    };
  }, [days, ledgerRows, totals.opening]);

  // Yêu cầu 1.2: từ mốc 30 ngày trở lên thì cột chồng lên nhau tới mức không
  // đọc được nữa — đổi sang Line Chart.
  const useLineForFlow = days.length >= 30;

  const flowSeries = [
    {
      name: t("reports.inventoryFlow.receipt"),
      data: daily.receipt,
      color: CHART_COLORS.success,
    },
    {
      name: t("reports.inventoryFlow.seriesIssueProduct"),
      data: daily.issue,
      color: CHART_COLORS.warning,
    },
    {
      name: t("reports.inventoryFlow.seriesComponentIssue"),
      data: daily.component,
      color: CHART_COLORS.violet,
    },
    {
      name: t("reports.inventoryFlow.reversal"),
      data: daily.reversal,
      color: CHART_COLORS.danger,
    },
  ];

  const dayLabels = days.map(axisDayLabel);
  const [dayDrill, setDayDrill] = useState<{
    day: string;
    seriesName: string;
  } | null>(null);

  const dayDrillRows = useMemo(() => {
    if (!dayDrill) return [];
    // Khoá là NHÃN chuỗi đang hiển thị trên chart, nên phải dựng qua `t` —
    // chart đổi ngôn ngữ thì bảng tra này phải đổi theo, nếu không bấm vào một
    // series ở chế độ EN sẽ không lọc ra dòng nào.
    const typeOfSeries: Record<string, string | null> = {
      [t("reports.inventoryFlow.receipt")]: "RECEIPT",
      [t("reports.inventoryFlow.seriesIssueProduct")]: "ISSUE",
      [t("reports.inventoryFlow.seriesComponentIssue")]: "COMPONENT_ISSUE",
      Reversal: "REVERSAL",
    };
    const wanted = typeOfSeries[dayDrill.seriesName] ?? null;
    return ledgerRows.filter((row) => {
      if (dayKey(row.occurred_at) !== dayDrill.day) return false;
      return wanted === null || text(row.movement_type) === wanted;
    });
  }, [dayDrill, ledgerRows, t]);

  const chartsLoading = xnt.isLoading || ledger.isLoading || catalog.loading;
  const chartsError = xnt.error ?? ledger.error;

  // ── 1.4 Lịch sử chứng từ ───────────────────────────────────────────────
  const docPeriod = usePeriodFilter("this-month");
  const [docType, setDocType] = useState<string>("all");
  const [docStatus, setDocStatus] = useState<string>("");
  const [docKind, setDocKind] = useState<ItemKind>("all");
  const [timeWindow, setTimeWindow] = useState<TimeWindow>(EMPTY_TIME_WINDOW);
  const [actorNames, setActorNames] = useState<string[]>([]);
  const [departmentId, setDepartmentId] = useState<string>("");
  const [docKeyword, setDocKeyword] = useState("");
  const [detailRow, setDetailRow] = useState<{
    row: Raw;
    index: number;
  } | null>(null);

  const documents = useDocumentHistory({
    from: docPeriod.from,
    to: docPeriod.to,
    docType: "all",
    enabled: !docPeriod.invalid,
  });
  const reversals = useReversalDocuments({
    from: docPeriod.from,
    to: docPeriod.to,
    enabled: !docPeriod.invalid,
  });

  const documentRows = useMemo<DocumentRow[]>(() => {
    const fromStock = listOf(documents.data?.rows).map((row, index) => {
      const lines = listOf(row.lines);
      const qty = lines.reduce(
        (acc, line) => acc + n(line.posted_qty ?? line.scanned_qty),
        0,
      );
      const skuCodes = new Set(
        lines.map((line) => text(line.product_code, "")).filter(Boolean),
      );
      const kind = text(row.doc_type) === "INBOUND" ? "INBOUND" : "OUTBOUND";
      const actor = text(row.created_by_name ?? row.posted_by_name, "");
      return {
        ...row,
        __key: text(row.id, `doc-${index}`),
        __docType: kind as "INBOUND" | "OUTBOUND",
        __direction: (kind === "INBOUND"
          ? "INCREASE"
          : "DECREASE") as StockDirection,
        __qty: qty,
        __skuCount: skuCodes.size,
        __actor: actor,
        __department: users.departmentNameOfActor(actor),
        __createdAt: text(row.document_date, ""),
        __postedAt: text(row.posted_at, ""),
        __skuCodes: [...skuCodes],
      } as DocumentRow;
    });

    const fromReversal = listOf(reversals.data?.data).map((row, index) => {
      // posted_by / created_by là UUID: tra danh bạ ra tên, không in UUID.
      const actor = users.nameOfUserId(row.posted_by ?? row.created_by);
      return {
        ...row,
        id: text(row.id, `rev-${index}`),
        document_no: text(row.reversal_code ?? row.reversal_no, ""),
        doc_type: "REVERSAL",
        counterpart: text(row.reference_document_code, ""),
        warehouse_code: text(row.warehouse_name, ""),
        document_date: text(row.created_at, "").slice(0, 10),
        posted_at: text(row.reversed_at ?? row.posted_at, ""),
        status: text(row.status, ""),
        created_by_name: actor,
        lines: [],
        __key: text(row.id, `rev-${index}`),
        __docType: "REVERSAL" as const,
        // Reversal đảo chiều giao dịch gốc: đảo một phiếu nhập làm GIẢM tồn,
        // đảo một phiếu xuất làm TĂNG tồn. Suy từ loại chứng từ gốc.
        __direction: (text(row.reference_document_type, "") === "INBOUND"
          ? "DECREASE"
          : text(row.reference_document_type, "") === "OUTBOUND"
            ? "INCREASE"
            : "MIXED") as StockDirection,
        __qty: n(row.total_qty),
        __skuCount: n(row.total_lines),
        __actor: actor,
        __department: users.departmentNameOfActor(actor),
        __createdAt: text(row.created_at, ""),
        __postedAt: text(row.reversed_at ?? row.posted_at, ""),
        __skuCodes: [] as string[],
      } as DocumentRow;
    });

    return [...fromStock, ...fromReversal];
  }, [documents.data, reversals.data, users]);

  const filteredDocuments = useMemo(() => {
    const fromMinute = parseHourMinute(timeWindow.from);
    const toMinute = parseHourMinute(timeWindow.to);
    const keyword = docKeyword.trim().toLowerCase();

    return documentRows.filter((row) => {
      if (docType !== "all" && row.__docType !== docType) return false;
      if (docStatus && text(row.status) !== docStatus) return false;
      if (actorNames.length > 0 && !actorNames.includes(row.__actor)) {
        return false;
      }
      if (departmentId) {
        if (users.departmentOfName(row.__actor) !== departmentId) return false;
      }
      if (docKind !== "all") {
        const codes = (row.__skuCodes as string[] | undefined) ?? [];
        // Phiếu Reversal không trả tầng dòng SKU nên không xác định được loại
        // hàng — giữ lại khi đang lọc để người dùng không mất dấu chứng từ đảo.
        if (codes.length > 0) {
          const matched = codes.some(
            (code) => catalog.kindOfCode(code) === docKind,
          );
          if (!matched) return false;
        } else if (row.__docType !== "REVERSAL") {
          return false;
        }
      }
      if (fromMinute !== null || toMinute !== null) {
        const stamp = row.__postedAt || row.__createdAt;
        const minute = minuteOfDay(stamp);
        // Chỉ có ngày (không có giờ) thì không thể khẳng định nằm trong khung
        // giờ — loại ra thay vì đoán, để con số trên bảng luôn kiểm chứng được.
        if (minute === null) return false;
        if (fromMinute !== null && minute < fromMinute) return false;
        if (toMinute !== null && minute > toMinute) return false;
      }
      if (keyword) {
        const haystack = [
          text(row.document_no, ""),
          text(row.counterpart, ""),
          ...(((row.__skuCodes as string[] | undefined) ?? []) as string[]),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(keyword)) return false;
      }
      return true;
    });
  }, [
    documentRows,
    docType,
    docStatus,
    docKind,
    actorNames,
    departmentId,
    timeWindow,
    docKeyword,
    catalog,
    users,
  ]);

  const docPagination = useClientPagination(filteredDocuments, 15);

  const documentColumns = useMemo<ReportColumn[]>(
    () => [
      sttColumn(docPagination.page, docPagination.perPage),
      {
        title: t("reports.inventoryFlow.colDocumentNo"),
        dataIndex: "document_no",
        width: 170,
        fixed: "left",
        sorter: (a, b) =>
          text(a.document_no, "").localeCompare(text(b.document_no, ""), "vi"),
        render: (value) => <Box sx={{ fontWeight: 700 }}>{text(value)}</Box>,
      },
      {
        title: t("reports.inventoryFlow.colDocumentType"),
        dataIndex: "doc_type",
        width: 150,
        sorter: (a, b) =>
          text(a.doc_type, "").localeCompare(text(b.doc_type, ""), "vi"),
        render: (value) => {
          const key = DOC_TYPE_LABEL_KEYS[text(value, "")];
          return key ? t(key) : text(value, "");
        },
      },
      {
        title: t("reports.inventoryFlow.colDelta"),
        key: "__direction",
        width: 120,
        render: (_value, row) => {
          const direction = (row as DocumentRow).__direction;
          return (
            <Box
              component="span"
              data-testid="rpt-doc-direction"
              data-direction={direction}
            >
              <UiStatusBadge
                size="small"
                tone={DIRECTION_TONE[direction]}
                label={t(DIRECTION_LABEL_KEYS[direction])}
              />
            </Box>
          );
        },
      },
      {
        title: t("reports.inventoryFlow.colStatus"),
        dataIndex: "status",
        width: 140,
        sorter: (a, b) =>
          text(a.status, "").localeCompare(text(b.status, ""), "vi"),
        render: (value) => (
          <ReportStatusBadge value={value} label={reportStatusLabel(value)} />
        ),
      },
      {
        // Mục 6: đánh dấu rõ dòng nào làm đổi tồn thực tế.
        // Chỉ phiếu POSTED mới ghi vào Inventory Movement; phiếu nháp/hủy không tính.
        title: t("reports.inventoryFlow.colStockImpact"),
        key: "__stock_effect",
        width: 150,
        render: (_value, row) => {
          const posted =
            text((row as DocumentRow).status, "").toUpperCase() === "POSTED";
          return (
            <Box
              component="span"
              data-testid="rpt-doc-stock-effect"
              data-posted={posted}
            >
              <UiStatusBadge
                size="small"
                tone={posted ? "success" : "neutral"}
                label={
                  posted
                    ? t("reports.inventoryFlow.posted")
                    : t("reports.inventoryFlow.notPosted")
                }
              />
            </Box>
          );
        },
      },
      {
        title: t("reports.inventoryFlow.colCreatedAt"),
        dataIndex: "document_date",
        width: 130,
        sortType: "text",
        sorter: (a, b) =>
          text(a.document_date, "").localeCompare(text(b.document_date, "")),
        render: (value) => fmtDate(value),
      },
      {
        title: t("reports.inventoryFlow.colPostedAt"),
        dataIndex: "posted_at",
        width: 165,
        sortType: "text",
        sorter: (a, b) =>
          text(a.posted_at, "").localeCompare(text(b.posted_at, "")),
        render: (value) => (value ? fmtDateTime(value) : EMPTY_TEXT),
      },
      {
        title: t("reports.inventoryFlow.colQtySku"),
        key: "__qty",
        width: 150,
        align: "right",
        sortType: "value",
        sorter: (a, b) => (a as DocumentRow).__qty - (b as DocumentRow).__qty,
        render: (_value, row) => {
          const item = row as DocumentRow;
          return `${fmt(item.__qty)} / ${fmt(item.__skuCount)} SKU`;
        },
      },
      {
        title: t("reports.inventoryFlow.colSourceRecipient"),
        dataIndex: "counterpart",
        sorter: (a, b) =>
          text(a.counterpart, "").localeCompare(text(b.counterpart, ""), "vi"),
        render: (value) => text(value),
      },
      {
        title: t("reports.inventoryFlow.colActor"),
        key: "__actor",
        width: 170,
        hideOnMobile: true,
        sorter: (a, b) =>
          (a as DocumentRow).__actor.localeCompare(
            (b as DocumentRow).__actor,
            "vi",
          ),
        render: (_value, row) => text((row as DocumentRow).__actor),
      },
      {
        title: t("reports.inventoryFlow.colDepartment"),
        key: "__department",
        width: 170,
        hideOnMobile: true,
        render: (_value, row) => text((row as DocumentRow).__department),
      },
      {
        title: "Kho",
        dataIndex: "warehouse_code",
        width: 120,
        detailOnly: true,
        render: (value) => text(value),
      },
      {
        title: t("reports.inventoryFlow.colRecordedBy"),
        dataIndex: "posted_by_name",
        detailOnly: true,
        render: (value) => text(value),
      },
      {
        title: t("reports.inventoryFlow.colNote"),
        dataIndex: "note",
        detailOnly: true,
        render: (value) => text(value),
      },
    ],
    [docPagination.page, docPagination.perPage, t],
  );

  const tableColumns = useMemo(
    () => visibleReportColumns(documentColumns),
    [documentColumns],
  );
  const { sortedRows, sortState, onSortChange } = useReportColumnSort(
    tableColumns,
    docPagination.pageRows,
  );
  const responsiveColumns = toResponsiveColumns(tableColumns, sortedRows);

  const exporter = useReportExport();

  return (
    <Box data-testid="rpt-tab-inventory-flow">
      <ReportSectionHeading
        id="rpt-tab1-heading"
        title={t("reports.inventoryFlow.title")}
        description={t("reports.inventoryFlow.description")}
      />

      <FilterBar
        label={t("reports.inventoryFlow.chartFilterLabel")}
        hint={t("reports.period.viewing", { label: chartPeriod.label })}
      >
        <PeriodFilterControls state={chartPeriod} />
        <ItemKindFilter value={chartKind} onChange={setChartKind} />
      </FilterBar>

      {chartPeriod.invalid ? (
        <Box sx={{ mb: 2 }}>
          <UiAlert tone="error">{t("reports.common.dateOrderError")}</UiAlert>
        </Box>
      ) : null}

      <ReportKpiRow>
        <ReportKpi
          label={t("reports.inventoryFlow.kpiOpening")}
          value={fmt(totals.opening)}
          tone="neutral"
          icon={<StockOutlined />}
          hint={t("reports.inventoryFlow.hintOpening")}
        />
        <ReportKpi
          label={t("reports.inventoryFlow.kpiReceiptNet")}
          value={fmt(totals.receiptNet)}
          tone="success"
          icon={<ImportOutlined />}
          hint={t("reports.inventoryFlow.kpiReceiptNetHint")}
        />
        <ReportKpi
          label={t("reports.inventoryFlow.kpiIssueNet")}
          value={fmt(totals.issueNet)}
          tone="warning"
          icon={<ExportOutlined />}
          hint={t("reports.inventoryFlow.kpiIssueNetHint")}
        />
        <ReportKpi
          label={t("reports.inventoryFlow.kpiComponentNet")}
          value={fmt(totals.componentNet)}
          tone="warning"
          icon={<ExportOutlined />}
          hint={t("reports.inventoryFlow.kpiComponentNetHint")}
        />
        <ReportKpi
          label={t("reports.inventoryFlow.kpiOrphanReversal")}
          value={fmt(totals.reversalUnlinked)}
          tone="error"
          icon={<SwapOutlined />}
          hint={t("reports.inventoryFlow.kpiOrphanReversalHint")}
        />
        <ReportKpi
          label={t("reports.inventoryFlow.kpiClosing")}
          value={fmt(totals.closing)}
          tone="primary"
          icon={<StockOutlined />}
          hint={t("reports.inventoryFlow.kpiClosingHint")}
        />
      </ReportKpiRow>

      <ChartCard
        title={t("reports.inventoryFlow.waterfallTitle")}
        description={t("reports.inventoryFlow.waterfallDescription")}
        fullWidth
        loading={chartsLoading}
        error={chartsError}
        onRetry={() => {
          void xnt.refetch();
          void ledger.refetch();
        }}
        empty={xntLines.length === 0}
        emptyText={t("reports.inventoryFlow.waterfallEmpty")}
        footer={
          <FormulaNote>{t("reports.inventoryFlow.waterfallNote")}</FormulaNote>
        }
      >
        <WaterfallChart
          points={waterfallPoints}
          valueFormatter={fmt}
          onSelect={(_point, index) => {
            const step = waterfallSteps(t)[index];
            if (step) setWaterfallDrill({ key: step.key, label: step.label });
          }}
        />
      </ChartCard>

      <Box sx={{ height: 16 }} />

      <ReportSectionHeading
        id="rpt-tab1-xnt-detail"
        title={t("reports.inventoryFlow.skuTableTitle")}
        description={t("reports.inventoryFlow.skuTableDescription")}
      />

      <ResponsiveDataTable<Raw>
        columns={xntResponsiveColumns}
        rows={xntSortedRows}
        rowKey={(row) =>
          `${text(row.warehouse_code, "")}|${text(row.product_code, "")}|${text(row.stock_status, "")}`
        }
        loading={xnt.isLoading}
        sortState={xntSortState}
        onSortChange={onXntSortChange}
        emptyText={t("reports.inventoryFlow.skuTableEmpty")}
        renderRowActions={(row) => (
          <ActionButton
            kind="view"
            aria-label={t("reports.inventoryFlow.rowDetailAria")}
            sx={{ whiteSpace: "nowrap" }}
            onClick={() =>
              setXntDetailRow({ row, index: xntSortedRows.indexOf(row) })
            }
          />
        )}
      />
      <ReportPaginationBar
        page={xntPagination.page}
        perPage={xntPagination.perPage}
        total={xntPagination.total}
        onPageChange={xntPagination.setPage}
        onPageSizeChange={xntPagination.setPerPage}
      />

      <Box sx={{ height: 16 }} />

      <ChartGrid>
        <ChartCard
          fullWidth
          title={t("reports.inventoryFlow.dailyTitle")}
          description={
            useLineForFlow
              ? t("reports.inventoryFlow.dailyDescriptionLong")
              : t("reports.inventoryFlow.dailyDescriptionShort")
          }
          loading={chartsLoading}
          error={ledger.error}
          onRetry={() => void ledger.refetch()}
          empty={days.length === 0}
        >
          {useLineForFlow ? (
            <LineChart
              categories={dayLabels}
              series={flowSeries}
              height={320}
              valueFormatter={fmt}
              onSelect={(payload) =>
                setDayDrill({
                  day: days[payload.categoryIndex] ?? "",
                  seriesName: payload.seriesName,
                })
              }
            />
          ) : (
            <MultiSeriesBarChart
              categories={dayLabels}
              series={flowSeries}
              height={320}
              valueFormatter={fmt}
              onSelect={(payload) =>
                setDayDrill({
                  day: days[payload.categoryIndex] ?? "",
                  seriesName: payload.seriesName,
                })
              }
            />
          )}
        </ChartCard>

        <ChartCard
          fullWidth
          title={t("reports.inventoryFlow.trendTitle")}
          description={t("reports.inventoryFlow.trendDescription")}
          loading={chartsLoading}
          error={ledger.error}
          onRetry={() => void ledger.refetch()}
          empty={days.length === 0}
          footer={
            <FormulaNote>{t("reports.inventoryFlow.trendNote")}</FormulaNote>
          }
        >
          <LineChart
            categories={dayLabels}
            series={[
              {
                name: t("reports.inventoryFlow.trendSeries"),
                data: daily.closing,
                color: CHART_COLORS.primary,
              },
            ]}
            height={320}
            valueFormatter={fmt}
          />
        </ChartCard>
      </ChartGrid>

      <Box sx={{ ...{ mt: 1 } }}>
        <ReportSectionHeading
          id="rpt-tab1-doc-history"
          title={t("reports.inventoryFlow.docTitle")}
          description={t("reports.inventoryFlow.docDescription")}
        />
      </Box>

      <FilterBar
        label={t("reports.inventoryFlow.docFilterLabel")}
        hint={t("reports.inventoryFlow.docFilterHint", {
          label: docPeriod.label,
          count: fmt(filteredDocuments.length),
        })}
        actions={
          <ExportButtons
            exporting={exporter.exporting}
            disabled={docPeriod.invalid || documents.isLoading}
            onExport={(format) =>
              void exporter.exportReport(format, {
                reportCode: "document-history",
                fileStem: "lich-su-chung-tu",
                fileSuffix: `-${docPeriod.from}-${docPeriod.to}`,
                filters: {
                  from_date: docPeriod.from,
                  to_date: docPeriod.to,
                  doc_type:
                    docType === "INBOUND"
                      ? "inbound"
                      : docType === "OUTBOUND"
                        ? "outbound"
                        : "all",
                  ...(docStatus ? { status: docStatus } : {}),
                  ...(docKeyword.trim() ? { keyword: docKeyword.trim() } : {}),
                },
              })
            }
          />
        }
      >
        <PeriodFilterControls state={docPeriod} />
        <UiSelect
          minWidth={180}
          aria-label={t("reports.inventoryFlow.docTypeAria")}
          value={docType}
          onChange={setDocType}
          options={docTypeFilterOptions(t)}
        />
        <AllOrPickFilter
          value={docStatus}
          onChange={setDocStatus}
          options={DOC_STATUS_OPTIONS}
          allLabel={t("reports.inventoryFlow.statusAll")}
          ariaLabel={t("reports.inventoryFlow.statusAria")}
        />
        <ItemKindFilter value={docKind} onChange={setDocKind} />
        <TimeWindowFilter value={timeWindow} onChange={setTimeWindow} />
        <MultiSelectFilter
          value={actorNames}
          onChange={setActorNames}
          options={users.actorNameOptions}
          placeholder={t("reports.inventoryFlow.actorPlaceholder")}
          ariaLabel={t("reports.inventoryFlow.actorAria")}
        />
        <AllOrPickFilter
          value={departmentId}
          onChange={setDepartmentId}
          options={users.departmentOptions}
          allLabel={t("reports.inventoryFlow.departmentAll")}
          ariaLabel={t("reports.inventoryFlow.departmentAria")}
        />
        <SearchInput
          width={260}
          placeholder={t("reports.inventoryFlow.searchPlaceholder")}
          aria-label={t("reports.inventoryFlow.searchAria")}
          value={docKeyword}
          onChange={setDocKeyword}
        />
      </FilterBar>

      {reversals.isError ? (
        <DataGapNotice>
          {t("reports.inventoryFlow.reversalReadError", {
            error: String(reversals.error ?? ""),
          })}
        </DataGapNotice>
      ) : null}

      {documents.isError ? (
        <Box sx={{ mb: 1.5 }}>
          <ApiErrorAlert
            error={documents.error}
            title={t("reports.inventoryFlow.docLoadError")}
            onRetry={() => void documents.refetch()}
          />
        </Box>
      ) : null}

      {exporter.exportDenied ? (
        <Box sx={{ mb: 1.5 }} role="alert">
          <UiAlert
            tone="error"
            title={t("reports.common.exportDenied")}
            onClose={exporter.clearExportDenied}
          >
            {exporter.exportDenied}
          </UiAlert>
        </Box>
      ) : null}

      <ResponsiveDataTable<Raw>
        columns={responsiveColumns}
        rows={sortedRows}
        rowKey={(row) => (row as DocumentRow).__key}
        loading={documents.isLoading}
        // Yêu cầu 1.4: "nhấn vào một dòng chứng từ" mở chi tiết — giữ song song
        // với nút Xem để cả chuột lẫn bàn phím đều có đường vào.
        onRowClick={(row) =>
          setDetailRow({ row, index: sortedRows.indexOf(row) })
        }
        sortState={sortState}
        onSortChange={onSortChange}
        emptyText={t("reports.inventoryFlow.docEmpty")}
        renderRowActions={(row) => (
          <ActionButton
            kind="view"
            aria-label={t("reports.inventoryFlow.docDetailAria")}
            sx={{ whiteSpace: "nowrap" }}
            onClick={() =>
              setDetailRow({ row, index: sortedRows.indexOf(row) })
            }
          />
        )}
      />
      <ReportPaginationBar
        page={docPagination.page}
        perPage={docPagination.perPage}
        total={docPagination.total}
        onPageChange={docPagination.setPage}
        onPageSizeChange={docPagination.setPerPage}
      />

      {waterfallDrill ? (
        <DrillDownDialog
          title={t("reports.inventoryFlow.waterfallDrillTitle", {
            label: waterfallDrill.label,
          })}
          subtitle={t("reports.inventoryFlow.waterfallDrillSubtitle", {
            label: chartPeriod.label,
            count: fmt(drillRows.length),
          })}
          onClose={() => setWaterfallDrill(null)}
        >
          {waterfallDrill.key === "OPENING" ? (
            <Box sx={{ mb: 1.5 }}>
              <UiAlert tone="info">
                {t("reports.inventoryFlow.openingDrillNote")}
              </UiAlert>
            </Box>
          ) : null}
          <MovementTable rows={drillRows} loading={ledger.isLoading} />
        </DrillDownDialog>
      ) : null}

      {dayDrill ? (
        <DrillDownDialog
          title={t("reports.inventoryFlow.dayDrillTitle", {
            series: dayDrill.seriesName,
            date: fmtDate(dayDrill.day),
          })}
          subtitle={t("reports.inventoryFlow.dayDrillSubtitle", {
            count: fmt(dayDrillRows.length),
          })}
          onClose={() => setDayDrill(null)}
        >
          <MovementTable rows={dayDrillRows} loading={ledger.isLoading} />
        </DrillDownDialog>
      ) : null}

      {xntDetailRow ? (
        <ReportRowDetailModal
          title={t("reports.inventoryFlow.skuDetailTitle", {
            code: text(xntDetailRow.row.product_code),
          })}
          columns={xntColumns}
          row={xntDetailRow.row}
          rowIndex={xntDetailRow.index}
          onClose={() => setXntDetailRow(null)}
        />
      ) : null}

      {detailRow ? (
        <ReportRowDetailModal
          title={t("reports.inventoryFlow.docDetailTitle", {
            code: text(detailRow.row.document_no),
          })}
          columns={documentColumns}
          row={detailRow.row}
          rowIndex={detailRow.index}
          onClose={() => setDetailRow(null)}
          extra={
            <>
              <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
                {t("reports.inventoryFlow.docDetailLines")}
              </Box>
              <DocumentLinesTable lines={listOf(detailRow.row.lines)} />
              <Box
                sx={{ typography: "subtitle2", fontWeight: 700, mt: 2, mb: 1 }}
              >
                {t("reports.inventoryFlow.docDetailMovements")}
              </Box>
              <MovementTable
                rows={ledgerRows.filter(
                  (row) =>
                    text(row.source_id, "") === text(detailRow.row.id, ""),
                )}
                emptyText={t("reports.inventoryFlow.docDetailMovementsEmpty")}
              />
            </>
          }
        />
      ) : null}
    </Box>
  );
}
