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
import { businessLabel } from "@/shared/constants/business-labels";
import {
  WaterfallChart,
  type WaterfallPoint,
} from "@/shared/components/charts/WaterfallChart";
import { MultiSeriesBarChart } from "@/shared/components/charts/MultiSeriesBarChart";
import { LineChart } from "@/shared/components/charts/LineChart";
import { CHART_COLORS } from "@/shared/components/charts/chart-theme";
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
  DIRECTION_LABELS,
  DIRECTION_TONE,
  DOC_TYPE_LABELS,
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
const WATERFALL_STEPS = [
  { key: "OPENING", label: "Tồn đầu" },
  { key: "RECEIPT", label: "Nhập" },
  { key: "ISSUE", label: "Xuất SP" },
  { key: "COMPONENT_ISSUE", label: "Xuất LK bảo hành" },
  { key: "REVERSAL", label: "Reversal" },
  { key: "CLOSING", label: "Tồn cuối" },
] as const;

type WaterfallKey = (typeof WATERFALL_STEPS)[number]["key"];

const DOC_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "Tất cả chứng từ" },
  { value: "INBOUND", label: "Nhập" },
  { value: "OUTBOUND", label: "Xuất" },
  { value: "REVERSAL", label: "Reversal" },
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
      label: "Tồn đầu",
      value: totals.opening,
      kind: "total",
      hint: "Số dư trước ngày bắt đầu kỳ",
    },
    {
      label: "Nhập",
      value: totals.receiptNet,
      kind: "delta",
      hint: "Nhập thuần = nhập phát sinh − phần đã đảo",
    },
    {
      label: "Xuất SP",
      value: -totals.issueNet,
      kind: "delta",
      hint: "Xuất sản phẩm thuần",
    },
    {
      label: "Xuất LK bảo hành",
      value: -totals.componentNet,
      kind: "delta",
      hint: "Xuất linh kiện cho hồ sơ bảo hành, thuần",
    },
    {
      label: "Reversal",
      value: totals.reversalUnlinked,
      kind: "delta",
      hint: "Điều chỉnh chưa gắn giao dịch gốc (phần đã gắn đã trừ vào từng cột trên)",
    },
    {
      label: "Tồn cuối",
      value: totals.closing,
      kind: "total",
      hint: "Tồn đầu + Nhập − Xuất SP − Xuất LK + Reversal",
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
        title: "Mã SKU",
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
        title: "Tên SKU",
        dataIndex: "product_name",
        sorter: (a, b) =>
          text(a.product_name, "").localeCompare(
            text(b.product_name, ""),
            "vi",
          ),
        render: (value) => text(value),
      },
      {
        title: "Trạng thái tồn",
        dataIndex: "stock_status",
        width: 140,
        render: (value) => stockStatusLabel(value),
      },
      {
        title: "Đầu kỳ",
        dataIndex: "opening",
        align: "right",
        width: 110,
        sortType: "value",
        sorter: (a, b) => n(a.opening) - n(b.opening),
        render: fmt,
      },
      {
        title: "Nhập",
        key: "receipt-group",
        children: [
          {
            title: "Tổng phát sinh",
            dataIndex: "receipt_gross",
            align: "right",
            width: 120,
            sortType: "value",
            sorter: (a, b) => n(a.receipt_gross) - n(b.receipt_gross),
            render: fmt,
          },
          {
            title: "Đã đảo",
            dataIndex: "receipt_reversal",
            align: "right",
            width: 110,
            sortType: "value",
            sorter: (a, b) => n(a.receipt_reversal) - n(b.receipt_reversal),
            render: fmt,
          },
          {
            title: "Thuần",
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
        title: "Xuất",
        key: "issue-group",
        children: [
          {
            title: "Tổng phát sinh",
            dataIndex: "issue_gross",
            align: "right",
            width: 120,
            sortType: "value",
            sorter: (a, b) => n(a.issue_gross) - n(b.issue_gross),
            render: fmt,
          },
          {
            title: "Đã đảo",
            dataIndex: "issue_reversal",
            align: "right",
            width: 110,
            sortType: "value",
            sorter: (a, b) => n(a.issue_reversal) - n(b.issue_reversal),
            render: fmt,
          },
          {
            title: "Thuần",
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
        title: "Xuất linh kiện",
        key: "component-issue-group",
        children: [
          {
            title: "Tổng phát sinh",
            dataIndex: "component_issue_gross",
            align: "right",
            width: 120,
            sortType: "value",
            sorter: (a, b) =>
              n(a.component_issue_gross) - n(b.component_issue_gross),
            render: fmt,
          },
          {
            title: "Đã đảo",
            dataIndex: "component_issue_reversal",
            align: "right",
            width: 110,
            sortType: "value",
            sorter: (a, b) =>
              n(a.component_issue_reversal) - n(b.component_issue_reversal),
            render: fmt,
          },
          {
            title: "Thuần",
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
        title: "Điều chỉnh thuần",
        dataIndex: "reversal_net",
        align: "right",
        width: 150,
        sortType: "value",
        sorter: (a, b) => n(a.reversal_net) - n(b.reversal_net),
        render: fmt,
      },
      {
        title: "Cuối kỳ",
        dataIndex: "closing",
        align: "right",
        width: 120,
        sortType: "value",
        sorter: (a, b) => n(a.closing) - n(b.closing),
        render: fmt,
      },
    ],
    [xntPagination.page, xntPagination.perPage],
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
      name: "Nhập",
      data: daily.receipt,
      color: CHART_COLORS.success,
    },
    {
      name: "Xuất sản phẩm",
      data: daily.issue,
      color: CHART_COLORS.warning,
    },
    {
      name: "Xuất linh kiện bảo hành",
      data: daily.component,
      color: CHART_COLORS.violet,
    },
    {
      name: "Reversal",
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
    const typeOfSeries: Record<string, string | null> = {
      Nhập: "RECEIPT",
      "Xuất sản phẩm": "ISSUE",
      "Xuất linh kiện bảo hành": "COMPONENT_ISSUE",
      Reversal: "REVERSAL",
    };
    const wanted = typeOfSeries[dayDrill.seriesName] ?? null;
    return ledgerRows.filter((row) => {
      if (dayKey(row.occurred_at) !== dayDrill.day) return false;
      return wanted === null || text(row.movement_type) === wanted;
    });
  }, [dayDrill, ledgerRows]);

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
      const actor = text(row.posted_by ?? row.created_by, "");
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
        title: "Mã phiếu",
        dataIndex: "document_no",
        width: 170,
        fixed: "left",
        sorter: (a, b) =>
          text(a.document_no, "").localeCompare(text(b.document_no, ""), "vi"),
        render: (value) => <Box sx={{ fontWeight: 700 }}>{text(value)}</Box>,
      },
      {
        title: "Loại chứng từ",
        dataIndex: "doc_type",
        width: 150,
        sorter: (a, b) =>
          text(a.doc_type, "").localeCompare(text(b.doc_type, ""), "vi"),
        render: (value) => businessLabel(DOC_TYPE_LABELS, text(value, "")),
      },
      {
        title: "Tăng/Giảm",
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
                label={DIRECTION_LABELS[direction]}
              />
            </Box>
          );
        },
      },
      {
        title: "Trạng thái",
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
        title: "Tác động tồn",
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
                label={posted ? "Đã ghi nhận tồn" : "Chưa đổi tồn"}
              />
            </Box>
          );
        },
      },
      {
        title: "Ngày tạo",
        dataIndex: "document_date",
        width: 130,
        sortType: "text",
        sorter: (a, b) =>
          text(a.document_date, "").localeCompare(text(b.document_date, "")),
        render: (value) => fmtDate(value),
      },
      {
        title: "Ngày POSTED",
        dataIndex: "posted_at",
        width: 165,
        sortType: "text",
        sorter: (a, b) =>
          text(a.posted_at, "").localeCompare(text(b.posted_at, "")),
        render: (value) => (value ? fmtDateTime(value) : "—"),
      },
      {
        title: "Số lượng / SKU",
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
        title: "Nguồn hàng / Người nhận",
        dataIndex: "counterpart",
        sorter: (a, b) =>
          text(a.counterpart, "").localeCompare(text(b.counterpart, ""), "vi"),
        render: (value) => text(value),
      },
      {
        title: "Người thực hiện",
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
        title: "Phòng ban",
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
        title: "Người ghi nhận",
        dataIndex: "posted_by_name",
        detailOnly: true,
        render: (value) => text(value),
      },
      {
        title: "Ghi chú",
        dataIndex: "note",
        detailOnly: true,
        render: (value) => text(value),
      },
    ],
    [docPagination.page, docPagination.perPage],
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
        title="Báo cáo Nhập – Xuất – Tồn & Lịch sử chứng từ"
        description="Cân đối tồn theo kỳ, biến động theo ngày và toàn bộ chứng từ phát sinh."
      />

      <FilterBar
        label="Bộ lọc chung cho các biểu đồ bên dưới"
        hint={`Kỳ đang xem: ${chartPeriod.label}`}
      >
        <PeriodFilterControls state={chartPeriod} />
        <ItemKindFilter value={chartKind} onChange={setChartKind} />
      </FilterBar>

      {chartPeriod.invalid ? (
        <Box sx={{ mb: 2 }}>
          <UiAlert tone="error">
            Ngày bắt đầu phải nhỏ hơn hoặc bằng ngày kết thúc.
          </UiAlert>
        </Box>
      ) : null}

      <ReportKpiRow>
        <ReportKpi
          label="Tồn đầu kỳ"
          value={fmt(totals.opening)}
          tone="neutral"
          icon={<StockOutlined />}
          hint="Số dư trước ngày bắt đầu kỳ"
        />
        <ReportKpi
          label="Nhập thuần"
          value={fmt(totals.receiptNet)}
          tone="success"
          icon={<ImportOutlined />}
          hint="Đã trừ phần nhập bị đảo"
        />
        <ReportKpi
          label="Xuất sản phẩm thuần"
          value={fmt(totals.issueNet)}
          tone="warning"
          icon={<ExportOutlined />}
          hint="Xuất bán/giao sản phẩm, đã trừ phần bị đảo (KHÔNG gồm linh kiện bảo hành)"
        />
        <ReportKpi
          label="Xuất linh kiện bảo hành thuần"
          value={fmt(totals.componentNet)}
          tone="warning"
          icon={<ExportOutlined />}
          hint="Xuất linh kiện phục vụ sửa chữa bảo hành, tách riêng khỏi xuất sản phẩm"
        />
        <ReportKpi
          label="Reversal chưa gắn gốc"
          value={fmt(totals.reversalUnlinked)}
          tone="error"
          icon={<SwapOutlined />}
          hint="Điều chỉnh không truy được giao dịch gốc"
        />
        <ReportKpi
          label="Tồn cuối kỳ"
          value={fmt(totals.closing)}
          tone="primary"
          icon={<StockOutlined />}
          hint="Kết quả của phương trình cân đối"
        />
      </ReportKpiRow>

      <ChartCard
        title="Tổng quan cân đối tồn kho"
        description="Tồn đầu + Nhập − Xuất SP − Xuất LK bảo hành + Reversal = Tồn cuối. Bấm vào một bậc để xem Movement/phiếu tạo ra số đó."
        fullWidth
        loading={chartsLoading}
        error={chartsError}
        onRetry={() => {
          void xnt.refetch();
          void ledger.refetch();
        }}
        empty={xntLines.length === 0}
        emptyText="Kỳ này chưa có biến động tồn kho nào theo bộ lọc đang chọn."
        footer={
          <FormulaNote>
            Nhập/Xuất là số THUẦN (đã trừ phần bị đảo). Phần Reversal còn lại
            trên biểu đồ là điều chỉnh chưa gắn được giao dịch gốc.
          </FormulaNote>
        }
      >
        <WaterfallChart
          points={waterfallPoints}
          valueFormatter={fmt}
          onSelect={(_point, index) => {
            const step = WATERFALL_STEPS[index];
            if (step) setWaterfallDrill({ key: step.key, label: step.label });
          }}
        />
      </ChartCard>

      <Box sx={{ height: 16 }} />

      <ReportSectionHeading
        id="rpt-tab1-xnt-detail"
        title="Chi tiết cân đối theo SKU"
        description="Từng chiều Nhập / Xuất / Xuất linh kiện tách tổng phát sinh · đã đảo · thuần — đây là bảng đối soát đứng sau con số trên biểu đồ waterfall."
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
        emptyText="Không có dòng cân đối nào theo bộ lọc."
        renderRowActions={(row) => (
          <ActionButton
            kind="view"
            aria-label="Xem chi tiết dòng báo cáo"
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
          title="Biến động nhập/xuất theo ngày"
          description={
            useLineForFlow
              ? "Kỳ từ 30 ngày trở lên — hiển thị dạng Line Chart cho dễ đọc xu hướng."
              : "Nhập, xuất sản phẩm, xuất linh kiện bảo hành và reversal trong kỳ."
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
          title="Xu hướng tồn kho"
          description="Tồn khả dụng cuối mỗi ngày — cho thấy tồn đang tăng hay giảm."
          loading={chartsLoading}
          error={ledger.error}
          onRetry={() => void ledger.refetch()}
          empty={days.length === 0}
          footer={
            <FormulaNote>
              Tồn cuối ngày D = tồn trước kỳ + cộng dồn toàn bộ biến động tính
              đến hết ngày D.
            </FormulaNote>
          }
        >
          <LineChart
            categories={dayLabels}
            series={[
              {
                name: "Tồn cuối ngày",
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
          title="Lịch sử chứng từ"
          description="Toàn bộ phiếu Nhập / Xuất / Reversal phát sinh trong khoảng thời gian được chọn."
        />
      </Box>

      <FilterBar
        label="Bộ lọc riêng cho bảng Lịch sử chứng từ"
        hint={`Kỳ đang xem: ${docPeriod.label} · ${fmt(filteredDocuments.length)} chứng từ`}
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
          aria-label="Loại chứng từ"
          value={docType}
          onChange={setDocType}
          options={DOC_TYPE_FILTER_OPTIONS}
        />
        <AllOrPickFilter
          value={docStatus}
          onChange={setDocStatus}
          options={DOC_STATUS_OPTIONS}
          allLabel="Tất cả trạng thái"
          ariaLabel="Trạng thái chứng từ"
        />
        <ItemKindFilter value={docKind} onChange={setDocKind} />
        <TimeWindowFilter value={timeWindow} onChange={setTimeWindow} />
        <MultiSelectFilter
          value={actorNames}
          onChange={setActorNames}
          options={users.actorNameOptions}
          placeholder="Người thực hiện"
          ariaLabel="Người thực hiện"
        />
        <AllOrPickFilter
          value={departmentId}
          onChange={setDepartmentId}
          options={users.departmentOptions}
          allLabel="Tất cả phòng ban"
          ariaLabel="Phòng ban"
        />
        <SearchInput
          width={260}
          placeholder="Mã phiếu / SKU / người nhận"
          aria-label="Tìm mã phiếu, SKU hoặc người nhận"
          value={docKeyword}
          onChange={setDocKeyword}
        />
      </FilterBar>

      {reversals.isError ? (
        <DataGapNotice>
          Không đọc được danh sách phiếu Reversal ({" "}
          {String(reversals.error ?? "")} ) — bảng dưới đang chỉ hiển thị phiếu
          Nhập/Xuất.
        </DataGapNotice>
      ) : null}

      {documents.isError ? (
        <Box sx={{ mb: 1.5 }}>
          <ApiErrorAlert
            error={documents.error}
            title="Không tải được lịch sử chứng từ"
            onRetry={() => void documents.refetch()}
          />
        </Box>
      ) : null}

      {exporter.exportDenied ? (
        <Box sx={{ mb: 1.5 }} role="alert">
          <UiAlert
            tone="error"
            title="Xuất báo cáo bị từ chối quyền."
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
        emptyText="Không có chứng từ nào theo bộ lọc."
        renderRowActions={(row) => (
          <ActionButton
            kind="view"
            aria-label="Xem chi tiết chứng từ"
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
          title={`Movement tạo ra số "${waterfallDrill.label}"`}
          subtitle={`${chartPeriod.label} · ${fmt(drillRows.length)} biến động`}
          onClose={() => setWaterfallDrill(null)}
        >
          {waterfallDrill.key === "OPENING" ? (
            <Box sx={{ mb: 1.5 }}>
              <UiAlert tone="info">
                Tồn đầu là số dư CỘNG DỒN từ trước ngày bắt đầu kỳ, không phải
                một nhóm biến động trong kỳ. Danh sách dưới đây chỉ gồm các biến
                động loại "Tồn đầu kỳ" phát sinh bên trong kỳ đang lọc (nếu có);
                muốn xem toàn bộ lịch sử thì mở rộng khoảng ngày.
              </UiAlert>
            </Box>
          ) : null}
          <MovementTable rows={drillRows} loading={ledger.isLoading} />
        </DrillDownDialog>
      ) : null}

      {dayDrill ? (
        <DrillDownDialog
          title={`${dayDrill.seriesName} — ngày ${fmtDate(dayDrill.day)}`}
          subtitle={`${fmt(dayDrillRows.length)} biến động`}
          onClose={() => setDayDrill(null)}
        >
          <MovementTable rows={dayDrillRows} loading={ledger.isLoading} />
        </DrillDownDialog>
      ) : null}

      {xntDetailRow ? (
        <ReportRowDetailModal
          title={`Chi tiết cân đối — ${text(xntDetailRow.row.product_code)}`}
          columns={xntColumns}
          row={xntDetailRow.row}
          rowIndex={xntDetailRow.index}
          onClose={() => setXntDetailRow(null)}
        />
      ) : null}

      {detailRow ? (
        <ReportRowDetailModal
          title={`Chi tiết chứng từ ${text(detailRow.row.document_no)}`}
          columns={documentColumns}
          row={detailRow.row}
          rowIndex={detailRow.index}
          onClose={() => setDetailRow(null)}
          extra={
            <>
              <Box sx={{ typography: "subtitle2", fontWeight: 700, mb: 1 }}>
                Danh sách SKU / Item: kế hoạch · đã quét · đã ghi nhận
              </Box>
              <DocumentLinesTable lines={listOf(detailRow.row.lines)} />
              <Box
                sx={{ typography: "subtitle2", fontWeight: 700, mt: 2, mb: 1 }}
              >
                Movement liên quan
              </Box>
              <MovementTable
                rows={ledgerRows.filter(
                  (row) =>
                    text(row.source_id, "") === text(detailRow.row.id, ""),
                )}
                emptyText="Không tìm thấy movement gắn với phiếu này trong kỳ đang lọc ở phần biểu đồ."
              />
            </>
          }
        />
      ) : null}
    </Box>
  );
}
