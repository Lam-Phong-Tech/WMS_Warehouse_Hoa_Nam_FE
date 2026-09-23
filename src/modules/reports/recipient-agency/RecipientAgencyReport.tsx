import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import dayjs, { type Dayjs } from "dayjs";
import { Box, UiSelect, UiVuexyDateRangePicker } from "@/shared/ui";
import {
  CheckCircleOutlined,
  DownOutlined,
  DownloadOutlined,
  FileTextOutlined,
  HistoryOutlined,
  InboxOutlined,
  LockOutlined,
  ReloadOutlined,
  SearchOutlined,
  ShopOutlined,
  StockOutlined,
  TeamOutlined,
  WarningOutlined,
} from "@/shared/components/icons";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { DrillDownDialog } from "@/modules/reports/operations/report-ui";
import { useReportExport } from "@/modules/reports/operations/report-export";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG } from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import {
  useRecipientAgencyLedger,
  type RecipientAgencyLedgerEvent,
} from "./recipient-agency-api";
import "./recipient-agency-report.css";

const DEMO_RANGE: [Dayjs, Dayjs] = [dayjs("2026-09-04"), dayjs("2026-09-10")];

type StatusFilter = "ALL" | "COMPLETE" | "INCOMPLETE";
type ForcedState =
  | "loading"
  | "refreshing"
  | "empty"
  | "no-result"
  | "error"
  | "partial"
  | "warning"
  | "readonly"
  | null;

type AppliedFilters = {
  from: string;
  to: string;
  agency: string;
  status: StatusFilter;
};

type DealerRow = {
  key: string;
  name: string;
  receiver: string;
  totalDocuments: number;
  completedDocuments: number;
  productQuantity: number;
  latestAt: string;
  events: RecipientAgencyLedgerEvent[];
};

type DetailDocument = {
  id: string;
  no: string;
  date: string;
  quantity: number;
  incomplete: boolean;
};

const COLORS = {
  navy: "var(--ops-heading)",
  ocean: "var(--ops-primary)",
  oceanDark: "var(--ops-primary-hover)",
  cyan: "var(--ops-link)",
  cyanSoft: "var(--ops-pale)",
  green: "var(--ops-success)",
  orange: "var(--ops-warning)",
  muted: "var(--ops-muted)",
  border: "var(--ops-line)",
  skeleton: "var(--ops-line)",
} as const;

function readForcedState(): ForcedState {
  const raw = new URLSearchParams(window.location.search).get("state");
  const aliases: Record<string, ForcedState> = {
    loading: "loading",
    "initial-loading": "loading",
    p02: "loading",
    refreshing: "refreshing",
    p03: "refreshing",
    empty: "empty",
    p04: "empty",
    "no-result": "no-result",
    "no-search-result": "no-result",
    p06: "no-result",
    error: "error",
    "load-error": "error",
    p07: "error",
    partial: "partial",
    "partial-stale": "partial",
    p09: "partial",
    warning: "warning",
    "incomplete-warning": "warning",
    p10: "warning",
    readonly: "readonly",
    "readonly-no-export": "readonly",
    p11: "readonly",
  };
  return aliases[(raw ?? "").toLowerCase()] ?? null;
}

function dealerKey(event: RecipientAgencyLedgerEvent): string {
  return (
    event.agency?.id ||
    event.recipient.id ||
    event.agency?.name ||
    event.recipient.name ||
    "unknown"
  );
}

function dealerName(event: RecipientAgencyLedgerEvent): string {
  return event.agency?.name || event.recipient.name || "Chưa xác định";
}

function receiverName(event: RecipientAgencyLedgerEvent): string {
  const recipient = event.recipient.name?.trim() ?? "";
  const agency = event.agency?.name?.trim() ?? "";
  if (recipient && recipient !== agency) return recipient;
  if (event.pii?.contact_name) return event.pii.contact_name;
  return "—";
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(value)));
}

function formatDate(value: string): string {
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.format("DD/MM/YYYY") : "—";
}

function percentage(part: number, total: number): string {
  if (!total) return "—";
  return ((part / total) * 100).toFixed(1).replace(".", ",") + "%";
}

function latestDate(current: string, candidate: string): string {
  if (!candidate) return current;
  if (!current) return candidate;
  return Date.parse(candidate) > Date.parse(current) ? candidate : current;
}

function LoadingBar({
  width = "70%",
  height = 12,
}: {
  width?: string;
  height?: number;
}) {
  return (
    <span
      className="rpt07-skeleton"
      aria-hidden="true"
      style={{ width, height }}
    />
  );
}

function FilterLabel({ children }: { children: ReactNode }) {
  return <div className="rpt07-filter-label">{children}</div>;
}

function MetricCard({
  label,
  value,
  hint,
  icon,
  tone,
  loading,
  unknown,
  warning,
}: {
  label: string;
  value: string;
  hint: string;
  icon: ReactNode;
  tone: "primary" | "info" | "success" | "warning";
  loading?: boolean;
  unknown?: boolean;
  warning?: boolean;
}) {
  return (
    <section
      className={
        "rpt07-kpi rpt07-kpi--" + tone + (warning ? " is-warning" : "")
      }
      aria-label={label}
    >
      <div className="rpt07-kpi__icon">{loading ? null : icon}</div>
      <div className="rpt07-kpi__body">
        <div className="rpt07-kpi__label">{label}</div>
        {loading ? (
          <div className="rpt07-kpi__loading">
            <LoadingBar width="44%" height={28} />
            <LoadingBar width="68%" height={10} />
          </div>
        ) : (
          <>
            <div className="rpt07-kpi__value">{unknown ? "—" : value}</div>
            <div className="rpt07-kpi__hint">
              {unknown ? "Chưa có dữ liệu" : hint}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

function PanelEmpty({
  compact = false,
  partial = false,
}: {
  compact?: boolean;
  partial?: boolean;
}) {
  return (
    <div className={"rpt07-panel-empty" + (compact ? " is-compact" : "")}>
      <div className="rpt07-panel-empty__icon">
        {partial ? "—" : <InboxOutlined />}
      </div>
      <strong>
        {partial ? "Chưa có dữ liệu" : "Chưa có dữ liệu trong kỳ"}
      </strong>
      <span>
        {partial
          ? "Chưa đủ dữ liệu để xác nhận báo cáo."
          : "Hãy chọn khoảng thời gian khác để xem báo cáo."}
      </span>
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  disabled,
  onChange,
}: {
  page: number;
  totalPages: number;
  disabled?: boolean;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) {
    return (
      <div
        className="rpt07-pagination hn-report-pagination"
        aria-label="Phân trang"
      >
        <button type="button" className="is-active" disabled={disabled}>
          1
        </button>
      </div>
    );
  }

  const candidates = new Set<number>([
    1,
    2,
    3,
    page - 1,
    page,
    page + 1,
    totalPages,
  ]);
  const pages = [...candidates]
    .filter((value) => value >= 1 && value <= totalPages)
    .sort((left, right) => left - right);

  const nodes: ReactNode[] = [];
  let previous = 0;
  for (const value of pages) {
    if (previous && value - previous > 1) {
      nodes.push(
        <span key={"gap-" + previous} className="rpt07-pagination__gap">
          …
        </span>,
      );
    }
    nodes.push(
      <button
        key={value}
        type="button"
        className={value === page ? "is-active" : ""}
        disabled={disabled}
        aria-current={value === page ? "page" : undefined}
        onClick={() => onChange(value)}
      >
        {value}
      </button>,
    );
    previous = value;
  }

  return (
    <div
      className="rpt07-pagination hn-report-pagination"
      aria-label="Phân trang"
    >
      {nodes}
    </div>
  );
}

function DateRangeControl({
  range,
  disabled,
  onChange,
}: {
  range: [Dayjs, Dayjs];
  disabled: boolean;
  onChange: (range: [Dayjs, Dayjs]) => void;
}) {
  return (
    <div className="rpt07-date-control">
      <div className="rpt07-date-control__visual" aria-hidden="true">
        <HistoryOutlined />
        <span>
          {range[0].format("DD/MM/YYYY")}–{range[1].format("DD/MM/YYYY")}
        </span>
        <DownOutlined />
      </div>
      <UiVuexyDateRangePicker
        value={range}
        disabled={disabled}
        allowClear={false}
        format="DD/MM/YYYY"
        className="rpt07-date-proxy"
        popupClassName="rpt07-date-popup"
        aria-label="Khoảng thời gian"
        onChange={(value) => {
          if (value?.[0] && value?.[1]) {
            onChange([value[0], value[1]]);
          }
        }}
      />
    </div>
  );
}

export default function RecipientAgencyReport() {
  const forcedState = useMemo(() => readForcedState(), []);
  const canExportPermission = useCan(WMS_PERMISSION_CATALOG.REPORT_EXPORT);
  const warehouseName =
    useAuthStore((state) => state.currentContext?.warehouse_name) ||
    "Kho Hoa Nam";

  const [draftRange, setDraftRange] = useState<[Dayjs, Dayjs]>(DEMO_RANGE);
  const [draftAgency, setDraftAgency] = useState("");
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("ALL");
  const [applied, setApplied] = useState<AppliedFilters>({
    from: DEMO_RANGE[0].format("YYYY-MM-DD"),
    to: DEMO_RANGE[1].format("YYYY-MM-DD"),
    agency: "",
    status: "ALL",
  });
  const [search, setSearch] = useState(
    forcedState === "no-result" ? "zzzz" : "",
  );
  const [page, setPage] = useState(1);
  const [detailRow, setDetailRow] = useState<DealerRow | null>(null);

  const source = useRecipientAgencyLedger({
    from: applied.from,
    to: applied.to,
  });
  const exporter = useReportExport();

  const initialLoading =
    forcedState === "loading" ||
    (source.isLoading && source.events.length === 0);
  const refreshing =
    forcedState === "refreshing" || (!initialLoading && source.isFetching);
  const hardError =
    forcedState === "error" ||
    Boolean(source.error && source.events.length === 0);
  const partial =
    forcedState === "partial" ||
    source.truncated ||
    Boolean(source.error && source.events.length > 0);
  const readonly = forcedState === "readonly" || !canExportPermission;
  const warning = forcedState === "warning";
  const controlsBusy = initialLoading || refreshing;

  const baseEvents = useMemo(
    () => (forcedState === "empty" ? [] : source.events),
    [forcedState, source.events],
  );

  const incompleteDocumentIds = useMemo(() => {
    const ids = new Set<string>();
    for (const event of baseEvents) {
      if (
        event.event_type === "ISSUE_REVERSED" ||
        event.reversed_quantity > 0
      ) {
        ids.add(event.outbound_document_id);
      }
    }
    return ids;
  }, [baseEvents]);

  const filteredEvents = useMemo(
    () =>
      baseEvents.filter((event) => {
        if (applied.agency && dealerKey(event) !== applied.agency) return false;
        const incomplete = incompleteDocumentIds.has(
          event.outbound_document_id,
        );
        if (applied.status === "COMPLETE" && incomplete) return false;
        if (applied.status === "INCOMPLETE" && !incomplete) return false;
        return true;
      }),
    [applied.agency, applied.status, baseEvents, incompleteDocumentIds],
  );

  const dealers = useMemo<DealerRow[]>(() => {
    const groups = new Map<
      string,
      {
        key: string;
        name: string;
        receiver: string;
        documents: Set<string>;
        events: RecipientAgencyLedgerEvent[];
        gross: number;
        reversed: number;
        latestAt: string;
      }
    >();

    for (const event of filteredEvents) {
      const key = dealerKey(event);
      const current = groups.get(key) ?? {
        key,
        name: dealerName(event),
        receiver: receiverName(event),
        documents: new Set<string>(),
        events: [],
        gross: 0,
        reversed: 0,
        latestAt: "",
      };

      current.events.push(event);
      if (current.receiver === "—") {
        current.receiver = receiverName(event);
      }
      if (event.event_type === "ISSUE_POSTED") {
        current.documents.add(event.outbound_document_id);
        current.gross += event.quantity;
        current.latestAt = latestDate(current.latestAt, event.occurred_at);
      } else {
        current.reversed += event.quantity;
      }
      groups.set(key, current);
    }

    return [...groups.values()]
      .map((group) => {
        let incompleteCount = 0;
        for (const id of group.documents) {
          if (incompleteDocumentIds.has(id)) incompleteCount += 1;
        }
        return {
          key: group.key,
          name: group.name,
          receiver: group.receiver,
          totalDocuments: group.documents.size,
          completedDocuments: Math.max(
            0,
            group.documents.size - incompleteCount,
          ),
          productQuantity: Math.max(0, group.gross - group.reversed),
          latestAt: group.latestAt,
          events: group.events,
        };
      })
      .sort((left, right) => {
        if (right.totalDocuments !== left.totalDocuments) {
          return right.totalDocuments - left.totalDocuments;
        }
        return left.name.localeCompare(right.name, "vi");
      });
  }, [filteredEvents, incompleteDocumentIds]);

  const documentTotals = useMemo(() => {
    const docs = new Set<string>();
    const incomplete = new Set<string>();
    for (const event of filteredEvents) {
      if (event.event_type === "ISSUE_POSTED") {
        docs.add(event.outbound_document_id);
      }
      if (
        event.event_type === "ISSUE_REVERSED" ||
        event.reversed_quantity > 0
      ) {
        incomplete.add(event.outbound_document_id);
      }
    }
    let incompleteCount = 0;
    for (const id of docs) {
      if (incomplete.has(id)) incompleteCount += 1;
    }
    return {
      total: docs.size,
      incomplete: incompleteCount,
      complete: Math.max(0, docs.size - incompleteCount),
    };
  }, [filteredEvents]);

  const agencyOptions = useMemo(() => {
    const unique = new Map<string, string>();
    for (const event of baseEvents) {
      unique.set(dealerKey(event), dealerName(event));
    }
    return [...unique.entries()]
      .sort((left, right) => left[1].localeCompare(right[1], "vi"))
      .map(([value, label]) => ({ value, label }));
  }, [baseEvents]);

  const tableRows = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("vi");
    if (!needle) return dealers;
    return dealers.filter((row) => {
      const docNos = row.events.map((event) => event.outbound_no).join(" ");
      return (row.name + " " + row.receiver + " " + docNos)
        .toLocaleLowerCase("vi")
        .includes(needle);
    });
  }, [dealers, search]);

  const noSearchResult =
    (search.trim().length > 0 &&
      tableRows.length === 0 &&
      dealers.length > 0) ||
    forcedState === "no-result";
  const reportEmpty =
    !initialLoading &&
    !hardError &&
    !partial &&
    !noSearchResult &&
    dealers.length === 0;

  const totalPages = Math.max(1, Math.ceil(tableRows.length / 5));
  const visiblePage = Math.min(page, totalPages);
  const pageRows = tableRows.slice((visiblePage - 1) * 5, visiblePage * 5);

  useEffect(() => {
    setPage(1);
  }, [search, applied.agency, applied.status, applied.from, applied.to]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const topRows = dealers.slice(0, 5);
  const topMax = Math.max(
    10,
    Math.ceil(Math.max(0, ...topRows.map((row) => row.totalDocuments)) / 10) *
      10,
  );
  const axisTicks = Array.from({ length: 6 }, (_, index) =>
    Math.round((topMax * index) / 5),
  );
  const topFiveDocuments = topRows.reduce(
    (sum, row) => sum + row.totalDocuments,
    0,
  );
  const completionRate =
    documentTotals.total > 0
      ? (documentTotals.complete / documentTotals.total) * 100
      : 0;
  const completionLabel = percentage(
    documentTotals.complete,
    documentTotals.total,
  );
  const incompleteLabel = percentage(
    documentTotals.incomplete,
    documentTotals.total,
  );
  const topFiveLabel = percentage(topFiveDocuments, documentTotals.total);

  const detailDocuments = useMemo<DetailDocument[]>(() => {
    if (!detailRow) return [];
    const map = new Map<
      string,
      {
        id: string;
        no: string;
        date: string;
        gross: number;
        reversed: number;
      }
    >();
    for (const event of detailRow.events) {
      const current = map.get(event.outbound_document_id) ?? {
        id: event.outbound_document_id,
        no: event.outbound_no || "—",
        date: event.occurred_at,
        gross: 0,
        reversed: 0,
      };
      if (event.event_type === "ISSUE_POSTED") {
        current.gross += event.quantity;
        current.date = event.occurred_at || current.date;
      } else {
        current.reversed += event.quantity;
      }
      map.set(event.outbound_document_id, current);
    }
    return [...map.values()]
      .map((item) => ({
        id: item.id,
        no: item.no,
        date: item.date,
        quantity: Math.max(0, item.gross - item.reversed),
        incomplete: incompleteDocumentIds.has(item.id),
      }))
      .sort((left, right) => Date.parse(right.date) - Date.parse(left.date));
  }, [detailRow, incompleteDocumentIds]);

  const applyFilters = () => {
    setApplied({
      from: draftRange[0].format("YYYY-MM-DD"),
      to: draftRange[1].format("YYYY-MM-DD"),
      agency: draftAgency,
      status: draftStatus,
    });
  };

  const resetFilters = () => {
    setDraftRange(DEMO_RANGE);
    setDraftAgency("");
    setDraftStatus("ALL");
    setApplied({
      from: DEMO_RANGE[0].format("YYYY-MM-DD"),
      to: DEMO_RANGE[1].format("YYYY-MM-DD"),
      agency: "",
      status: "ALL",
    });
    setSearch("");
  };

  const exportReport = () => {
    const selectedRecipientId = applied.agency
      ? (baseEvents.find((event) => dealerKey(event) === applied.agency)
          ?.recipient.id ?? "")
      : "";
    void exporter.exportReport("xlsx", {
      reportCode: "outbound-by-agency",
      fileStem: "xuat-theo-nguoi-nhan-dai-ly",
      fileSuffix: "-" + applied.from + "-" + applied.to,
      filters: {
        from_date: applied.from,
        to_date: applied.to,
        ...(selectedRecipientId ? { recipient_id: selectedRecipientId } : {}),
      },
    });
  };

  const exporting = exporter.exporting === "xlsx";
  const exportDisabled =
    readonly ||
    initialLoading ||
    refreshing ||
    hardError ||
    partial ||
    documentTotals.total === 0;

  const fromDisplay = dayjs(applied.from).format("DD");
  const toDisplay = dayjs(applied.to).format("DD/MM/YYYY");

  return (
    <Box
      id="recipient-agency-rpt07"
      className={
        "rpt07-report" +
        (initialLoading ? " is-loading" : "") +
        (refreshing ? " is-refreshing" : "") +
        (partial ? " is-partial" : "") +
        (readonly ? " is-readonly" : "")
      }
      data-testid="report-08-recipient-agency"
      data-report-screen="RPT-07"
    >
      <span className="rpt07-sr-only">Bảng đối soát xuất thuần</span>

      <header className="rpt07-header">
        <div className="rpt07-heading">
          <h1 className="hn-report-page-title">
            Báo cáo Xuất theo người nhận đại lý
          </h1>
          <p>Theo dõi sản lượng xuất và tình trạng giao nhận theo đại lý</p>
        </div>
        <div className="rpt07-head-actions">
          <div
            className="rpt07-warehouse-card"
            aria-label={"Kho " + warehouseName}
          >
            <StockOutlined />
            <span>
              <strong>{warehouseName}</strong>
              <small>
                <i />
                Đang hoạt động
              </small>
            </span>
          </div>
          <div className="rpt07-export-wrap">
            {readonly ? (
              <div className="rpt07-readonly-note">
                <LockOutlined />
                Bạn không có quyền xuất báo cáo.
              </div>
            ) : null}
            <button
              type="button"
              className="rpt07-export-button"
              disabled={exportDisabled}
              onClick={exportReport}
            >
              {exporting ? (
                <span className="rpt07-spinner" />
              ) : (
                <DownloadOutlined />
              )}
              {exporting ? "Đang xuất..." : "Xuất báo cáo"}
            </button>
          </div>
        </div>
      </header>

      <section className="rpt07-filter-card" aria-label="Bộ lọc báo cáo">
        <div className="rpt07-filter-grid">
          <div className="rpt07-filter-field rpt07-filter-field--date">
            <FilterLabel>Khoảng thời gian</FilterLabel>
            <DateRangeControl
              range={draftRange}
              disabled={controlsBusy}
              onChange={setDraftRange}
            />
            <div className="rpt07-filter-helper">
              7 ngày gần nhất · Múi giờ Việt Nam
            </div>
          </div>

          <div className="rpt07-filter-field">
            <FilterLabel>Kho</FilterLabel>
            <div className="rpt07-readonly-field" aria-label="Kho">
              <StockOutlined />
              <span>{warehouseName}</span>
            </div>
          </div>

          <div className="rpt07-filter-field rpt07-select">
            <FilterLabel>Đại lý</FilterLabel>
            <UiSelect
              fullWidth
              searchable={false}
              disabled={controlsBusy}
              value={draftAgency}
              onChange={setDraftAgency}
              options={agencyOptions}
              placeholder="Tất cả đại lý"
              aria-label="Đại lý"
              menuClassName="rpt07-select-menu"
            />
          </div>

          <div className="rpt07-filter-field rpt07-select">
            <FilterLabel>Trạng thái</FilterLabel>
            <UiSelect
              fullWidth
              searchable={false}
              disabled={controlsBusy}
              value={draftStatus}
              onChange={(value) => setDraftStatus(value as StatusFilter)}
              options={[
                { value: "ALL", label: "Tất cả" },
                { value: "COMPLETE", label: "Đã hoàn tất" },
                { value: "INCOMPLETE", label: "Chưa hoàn tất" },
              ]}
              aria-label="Trạng thái"
              menuClassName="rpt07-select-menu"
            />
          </div>

          <div className="rpt07-filter-action">
            <button
              type="button"
              className="rpt07-apply"
              disabled={initialLoading}
              onClick={applyFilters}
            >
              {controlsBusy ? <span className="rpt07-spinner" /> : null}
              {initialLoading ? "Đang tải dữ liệu" : "Áp dụng"}
            </button>
          </div>
          <div className="rpt07-filter-reset">
            <button
              type="button"
              onClick={resetFilters}
              disabled={initialLoading}
            >
              Đặt lại
            </button>
          </div>

          {refreshing ? (
            <div className="rpt07-refresh-note" aria-live="polite">
              <strong>Đang cập nhật dữ liệu...</strong>
              <span>
                Kết quả gần nhất, chưa phải dữ liệu của bộ lọc vừa áp dụng.
              </span>
            </div>
          ) : null}
        </div>
      </section>

      {partial ? (
        <section
          className="rpt07-partial-banner"
          role="status"
          aria-live="polite"
        >
          <WarningOutlined />
          <div>
            <strong>Dữ liệu chưa đầy đủ</strong>
            <span>
              Một số nguồn chưa đồng bộ. Số liệu có thể thay đổi sau khi tải
              lại.
            </span>
            <small>Cập nhật gần nhất: —</small>
          </div>
          <button type="button" onClick={() => void source.refetch()}>
            <ReloadOutlined />
            Tải lại dữ liệu
          </button>
        </section>
      ) : null}

      {hardError ? (
        <section className="rpt07-failure-panel" role="alert">
          <div className="rpt07-failure-panel__icon">
            <FileTextOutlined />
            <WarningOutlined />
          </div>
          <h2>Không tải được báo cáo</h2>
          <p>Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.</p>
          <div className="rpt07-failure-panel__actions">
            <button
              type="button"
              className="rpt07-primary-button"
              onClick={() => void source.refetch()}
            >
              <ReloadOutlined />
              Thử lại
            </button>
            <button
              type="button"
              className="rpt07-secondary-button"
              onClick={resetFilters}
            >
              Đặt lại bộ lọc
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="rpt07-kpi-grid" aria-label="Tổng quan vận hành">
            <MetricCard
              label="Tổng phiếu xuất"
              value={formatNumber(documentTotals.total)}
              hint="Tất cả phiếu trong kỳ"
              icon={<FileTextOutlined />}
              tone="primary"
              loading={initialLoading}
              unknown={partial}
            />
            <MetricCard
              label="Đại lý nhận"
              value={formatNumber(dealers.length)}
              hint="Có phát sinh xuất trong kỳ"
              icon={<TeamOutlined />}
              tone="info"
              loading={initialLoading}
              unknown={partial}
            />
            <MetricCard
              label="Đã hoàn tất"
              value={formatNumber(documentTotals.complete)}
              hint={completionLabel}
              icon={<CheckCircleOutlined />}
              tone="success"
              loading={initialLoading}
              unknown={partial}
            />
            <MetricCard
              label="Chưa hoàn tất"
              value={formatNumber(documentTotals.incomplete)}
              hint={incompleteLabel}
              icon={<HistoryOutlined />}
              tone="warning"
              loading={initialLoading}
              unknown={partial}
              warning={warning}
            />
          </section>

          <section
            className="rpt07-analysis-grid"
            aria-label="Phân tích theo đại lý"
          >
            <div className="rpt07-panel rpt07-bar-panel">
              <div className="rpt07-panel__header">
                <div>
                  <h2>Top đại lý theo số phiếu xuất</h2>
                  <p>Số phiếu xuất trong kỳ</p>
                </div>
              </div>
              {initialLoading ? (
                <div className="rpt07-bar-skeleton" aria-hidden="true">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <div key={index}>
                      <LoadingBar width="90px" />
                      <LoadingBar width="100%" height={18} />
                      <LoadingBar width="24px" />
                    </div>
                  ))}
                </div>
              ) : partial ? (
                <PanelEmpty partial />
              ) : reportEmpty ? (
                <PanelEmpty />
              ) : (
                <div
                  className="rpt07-bars"
                  role="img"
                  aria-label="Top đại lý theo số phiếu xuất"
                >
                  <div className="rpt07-bars__rows">
                    {topRows.map((row) => (
                      <div className="rpt07-bar-row" key={row.key}>
                        <span className="rpt07-bar-row__label" title={row.name}>
                          {row.name}
                        </span>
                        <span className="rpt07-bar-row__track">
                          <i
                            style={{
                              width:
                                Math.max(
                                  4,
                                  (row.totalDocuments / topMax) * 100,
                                ) + "%",
                            }}
                          />
                        </span>
                        <strong>{row.totalDocuments}</strong>
                      </div>
                    ))}
                  </div>
                  <div className="rpt07-bars__axis">
                    {axisTicks.map((tick) => (
                      <span key={tick}>{tick}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div
              className={
                "rpt07-panel rpt07-ratio-panel" + (warning ? " is-warning" : "")
              }
            >
              <div className="rpt07-panel__header">
                <div>
                  <h2>Tỷ lệ hoàn tất</h2>
                  <p>Tình trạng giao nhận trong kỳ</p>
                </div>
              </div>
              {initialLoading ? (
                <div className="rpt07-ratio-skeleton" aria-hidden="true">
                  <span className="rpt07-donut-skeleton" />
                  <div>
                    <LoadingBar width="150px" />
                    <LoadingBar width="130px" />
                    <LoadingBar width="100%" height={64} />
                  </div>
                </div>
              ) : partial ? (
                <PanelEmpty compact partial />
              ) : reportEmpty ? (
                <PanelEmpty compact />
              ) : (
                <div className="rpt07-ratio-body">
                  <div
                    className="rpt07-donut"
                    role="img"
                    aria-label={"Tỷ lệ hoàn tất " + completionLabel}
                    style={{
                      background:
                        "conic-gradient(" +
                        COLORS.green +
                        " 0 " +
                        completionRate +
                        "%, " +
                        COLORS.orange +
                        " " +
                        completionRate +
                        "% 100%)",
                    }}
                  >
                    <span>
                      <strong>{completionLabel}</strong>
                      <small>Tỷ lệ hoàn tất</small>
                    </span>
                  </div>
                  <div className="rpt07-ratio-copy">
                    <div className="rpt07-legend-row is-success">
                      <i />
                      <strong>{formatNumber(documentTotals.complete)}</strong>
                      <span>Hoàn tất</span>
                    </div>
                    <div
                      className={
                        "rpt07-legend-row is-warning" +
                        (warning ? " is-emphasized" : "")
                      }
                    >
                      <i />
                      <strong>{formatNumber(documentTotals.incomplete)}</strong>
                      <span>
                        {warning ? "phiếu chưa hoàn tất" : "Chưa hoàn tất"}
                      </span>
                      {warning ? (
                        <small>{incompleteLabel} tổng phiếu</small>
                      ) : null}
                    </div>
                    <div className="rpt07-top-five">
                      <span>Top 5 đại lý</span>
                      <strong>{formatNumber(topFiveDocuments)} phiếu</strong>
                      <small>{topFiveLabel} tổng phiếu</small>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </section>

          <section
            className="rpt07-table-card"
            aria-labelledby="rpt07-table-title"
          >
            <div className="rpt07-table-toolbar">
              <div className="rpt07-table-title">
                <h2 id="rpt07-table-title">Danh sách đại lý nhận hàng</h2>
                {initialLoading ? (
                  <LoadingBar width="42px" height={22} />
                ) : (
                  <span>
                    {partial
                      ? "—"
                      : noSearchResult
                        ? "0 kết quả / " + dealers.length + " đại lý"
                        : dealers.length}
                  </span>
                )}
              </div>
              <div className="rpt07-search-wrap">
                <SearchInput
                  className="rpt07-search"
                  width="100%"
                  disabled={initialLoading || partial}
                  value={search}
                  onChange={setSearch}
                  aria-label="Tìm trong danh sách đại lý"
                  placeholder="Tên đại lý, người nhận, mã phiếu..."
                />
              </div>
            </div>

            <div className="rpt07-table-scroll">
              <table className="rpt07-table">
                <thead>
                  <tr>
                    <th>Đại lý / Người nhận</th>
                    <th className="is-number">Số phiếu</th>
                    <th className="is-number">Số sản phẩm</th>
                    <th>Tiến độ</th>
                    <th>Lần xuất gần nhất</th>
                    <th>Chi tiết</th>
                  </tr>
                </thead>
                <tbody>
                  {initialLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={"loading-" + index}>
                        <td>
                          <LoadingBar width="78%" />
                          <LoadingBar width="55%" height={9} />
                        </td>
                        <td>
                          <LoadingBar width="30px" />
                        </td>
                        <td>
                          <LoadingBar width="46px" />
                        </td>
                        <td>
                          <LoadingBar width="78%" />
                        </td>
                        <td>
                          <LoadingBar width="72px" />
                        </td>
                        <td>
                          <LoadingBar width="36px" />
                        </td>
                      </tr>
                    ))
                  ) : partial ? (
                    <tr className="rpt07-empty-row">
                      <td colSpan={6}>
                        <PanelEmpty partial />
                      </td>
                    </tr>
                  ) : noSearchResult ? (
                    <tr className="rpt07-empty-row">
                      <td colSpan={6}>
                        <div className="rpt07-search-empty">
                          <div className="rpt07-search-empty__icon">
                            <SearchOutlined />
                          </div>
                          <strong>Không tìm thấy kết quả phù hợp</strong>
                          <span>
                            Hãy kiểm tra tên đại lý, người nhận hoặc mã phiếu.
                          </span>
                          <button
                            type="button"
                            className="rpt07-primary-button"
                            onClick={() => setSearch("")}
                          >
                            <ReloadOutlined />
                            Đặt lại tìm kiếm
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : reportEmpty ? (
                    <tr className="rpt07-empty-row">
                      <td colSpan={6}>
                        <div className="rpt07-table-empty">
                          <div className="rpt07-panel-empty__icon">
                            <InboxOutlined />
                          </div>
                          <strong>Chưa có dữ liệu trong kỳ</strong>
                          <span>
                            Hãy chọn khoảng thời gian khác để xem báo cáo.
                          </span>
                          <button
                            type="button"
                            className="rpt07-primary-button"
                            onClick={resetFilters}
                          >
                            <HistoryOutlined />
                            Chọn lại thời gian
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => {
                      const progress =
                        row.totalDocuments > 0
                          ? (row.completedDocuments / row.totalDocuments) * 100
                          : 0;
                      return (
                        <tr key={row.key}>
                          <td data-label="Đại lý / Người nhận">
                            <strong
                              className="rpt07-dealer-name"
                              title={row.name}
                            >
                              {row.name}
                            </strong>
                            <span
                              className="rpt07-receiver-name"
                              title={row.receiver}
                            >
                              {row.receiver}
                            </span>
                          </td>
                          <td data-label="Số phiếu" className="is-number">
                            {formatNumber(row.totalDocuments)}
                          </td>
                          <td data-label="Số sản phẩm" className="is-number">
                            {formatNumber(row.productQuantity)}
                          </td>
                          <td data-label="Tiến độ">
                            <div className="rpt07-progress">
                              <span className="rpt07-progress__track">
                                <i
                                  className="is-complete"
                                  style={{ width: progress + "%" }}
                                />
                                <i
                                  className="is-pending"
                                  style={{ width: 100 - progress + "%" }}
                                />
                              </span>
                              <strong>
                                {row.completedDocuments}/{row.totalDocuments}
                              </strong>
                            </div>
                          </td>
                          <td data-label="Lần xuất gần nhất">
                            {formatDate(row.latestAt)}
                          </td>
                          <td data-label="Chi tiết">
                            <RowActionGroup>
                              <RowActionButton
                                kind="view"
                                type="button"
                                onClick={() => setDetailRow(row)}
                              >
                                Xem
                              </RowActionButton>
                            </RowActionGroup>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <div className="rpt07-table-footer hn-report-pagination-footer">
              <div className="rpt07-table-footer__count">
                {initialLoading ? (
                  <LoadingBar width="135px" />
                ) : noSearchResult || partial || reportEmpty ? (
                  <span>
                    Hiển thị 0–0 / {partial ? "—" : tableRows.length} đại lý
                  </span>
                ) : (
                  <span>
                    Hiển thị {(visiblePage - 1) * 5 + 1}–
                    {Math.min(visiblePage * 5, tableRows.length)} /{" "}
                    {tableRows.length} đại lý
                  </span>
                )}
              </div>
              <div className="rpt07-table-footer__meta">
                {fromDisplay}–{toDisplay}
              </div>
              <Pagination
                page={visiblePage}
                totalPages={totalPages}
                disabled={
                  initialLoading || partial || reportEmpty || noSearchResult
                }
                onChange={setPage}
              />
            </div>
          </section>
        </>
      )}

      {detailRow ? (
        <DrillDownDialog
          title={"Chi tiết nhận hàng · " + detailRow.name}
          maxWidth="md"
          onClose={() => setDetailRow(null)}
        >
          <div className="rpt07-detail-dialog">
            <div className="rpt07-detail-dialog__summary">
              <ShopOutlined />
              <div>
                <strong>{detailRow.name}</strong>
                <span>
                  {detailRow.receiver === "—"
                    ? "Tổng hợp phiếu xuất trong kỳ"
                    : "Người nhận: " + detailRow.receiver}
                </span>
              </div>
            </div>
            <div className="rpt07-detail-dialog__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mã phiếu</th>
                    <th>Ngày xuất</th>
                    <th>Số sản phẩm</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {detailDocuments.map((document) => (
                    <tr key={document.id}>
                      <td>{document.no}</td>
                      <td>{formatDate(document.date)}</td>
                      <td>{formatNumber(document.quantity)}</td>
                      <td>
                        <span
                          className={
                            document.incomplete ? "is-pending" : "is-complete"
                          }
                        >
                          {document.incomplete ? "Chưa hoàn tất" : "Hoàn tất"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </DrillDownDialog>
      ) : null}
    </Box>
  );
}
