import { ReportWarehouseCard } from "@/modules/reports/components/ReportWarehouseCard";
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
import { useReversalDocuments } from "@/modules/reports/operations/report-data";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG } from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import {
  useRecipientAgencyLedger,
  type RecipientAgencyLedgerEvent,
} from "./recipient-agency-api";
import { RecipientReturnDialog } from "./RecipientReturnDialog";
import "./recipient-agency-report.css";
import { tStatic as tUi } from "@/shared/i18n/useT";

function currentSevenDayRange(): [Dayjs, Dayjs] {
  const end = dayjs().startOf("day");
  return [end.subtract(6, "day"), end];
}

type StatusFilter = "ALL" | "COMPLETE" | "INCOMPLETE";

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
  return (
    event.agency?.name ||
    event.recipient.name ||
    tUi("inbound.list.statusUnknown")
  );
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
              {unknown ? tUi("dashboard.lastUpdated.none") : hint}
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
        {partial
          ? tUi("dashboard.lastUpdated.none")
          : tUi("updatedUi.text_58818ad0e4a0")}
      </strong>
      <span>
        {partial
          ? tUi("updatedUi.text_1e55f6da18ef")
          : tUi("updatedUi.text_6bd5ce3b1254")}
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
        aria-label={tUi("shared.table.pagination")}
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
      aria-label={tUi("shared.table.pagination")}
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
        aria-label={tUi("reports.packingLabel.dateRangeLabel")}
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
  const canExportPermission = useCan(WMS_PERMISSION_CATALOG.REPORT_EXPORT);
  const warehouseName =
    useAuthStore((state) => state.currentContext?.warehouse_name)?.trim() ||
    "—";
  const initialRange = useMemo<[Dayjs, Dayjs]>(
    () => currentSevenDayRange(),
    [],
  );

  const [draftRange, setDraftRange] = useState<[Dayjs, Dayjs]>(initialRange);
  const [draftAgency, setDraftAgency] = useState("");
  const [draftStatus, setDraftStatus] = useState<StatusFilter>("ALL");
  const [applied, setApplied] = useState<AppliedFilters>({
    from: initialRange[0].format("YYYY-MM-DD"),
    to: initialRange[1].format("YYYY-MM-DD"),
    agency: "",
    status: "ALL",
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [detailRow, setDetailRow] = useState<DealerRow | null>(null);
  const [returnRow, setReturnRow] = useState<DealerRow | null>(null);

  const source = useRecipientAgencyLedger({
    from: applied.from,
    to: applied.to,
  });
  const returnDocuments = useReversalDocuments({
    from: applied.from,
    to: applied.to,
    enabled: returnRow !== null,
  });
  const exporter = useReportExport();

  const initialLoading = source.isLoading && source.events.length === 0;
  const refreshing = !initialLoading && source.isFetching;
  const hardError = Boolean(source.error && source.events.length === 0);
  const partial =
    source.truncated || Boolean(source.error && source.events.length > 0);
  const readonly = !canExportPermission;
  const controlsBusy = initialLoading || refreshing;

  const baseEvents = source.events;

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
    search.trim().length > 0 && tableRows.length === 0 && dealers.length > 0;
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
  const warning = documentTotals.incomplete > 0;
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
    const nextRange = currentSevenDayRange();
    setDraftRange(nextRange);
    setDraftAgency("");
    setDraftStatus("ALL");
    setApplied({
      from: nextRange[0].format("YYYY-MM-DD"),
      to: nextRange[1].format("YYYY-MM-DD"),
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
      <span className="rpt07-sr-only">
        {tUi("reports.recipientAgency.tableTitle")}
      </span>

      <header className="rpt07-header">
        <div className="rpt07-heading">
          <h1 className="hn-report-page-title">
            {tUi("updatedUi.text_08f22bdc2cc0")}
          </h1>
          <p>{tUi("updatedUi.text_6440ff9ad26f")}</p>
        </div>
        <div className="rpt07-head-actions hn-report-warehouse-actions">
          <ReportWarehouseCard />
          <div className="rpt07-export-wrap">
            {readonly ? (
              <div className="rpt07-readonly-note">
                <LockOutlined />
                {tUi("updatedUi.text_5fea0a9ca57b")}
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
              {exporting
                ? tUi("updatedUi.text_f218a6c991e2")
                : tUi("reports.traceability.exportReport")}
            </button>
          </div>
        </div>
      </header>

      <section
        className="rpt07-filter-card"
        aria-label={tUi("reports.recipientAgency.filterTitle")}
      >
        <div className="rpt07-filter-grid">
          <div className="rpt07-filter-field rpt07-filter-field--date">
            <FilterLabel>
              {tUi("reports.packingLabel.dateRangeLabel")}
            </FilterLabel>
            <DateRangeControl
              range={draftRange}
              disabled={controlsBusy}
              onChange={setDraftRange}
            />
            <div className="rpt07-filter-helper">
              {tUi("updatedUi.text_e0958e093414")}
            </div>
          </div>

          <div className="rpt07-filter-field">
            <FilterLabel>{tUi("updatedUi.text_19c608bfa103")}</FilterLabel>
            <div
              className="rpt07-readonly-field"
              aria-label={tUi("updatedUi.text_19c608bfa103")}
            >
              <StockOutlined />
              <span>{warehouseName}</span>
            </div>
          </div>

          <div className="rpt07-filter-field rpt07-select">
            <FilterLabel>
              {tUi("reports.recipientAgency.typeAgency")}
            </FilterLabel>
            <UiSelect
              fullWidth
              searchable={false}
              disabled={controlsBusy}
              value={draftAgency}
              onChange={setDraftAgency}
              options={agencyOptions}
              placeholder={tUi("reports.recipientAgency.agencyAll")}
              aria-label={tUi("reports.recipientAgency.typeAgency")}
              menuClassName="rpt07-select-menu"
            />
          </div>

          <div className="rpt07-filter-field rpt07-select">
            <FilterLabel>{tUi("dashboard.composition.colStatus")}</FilterLabel>
            <UiSelect
              fullWidth
              searchable={false}
              disabled={controlsBusy}
              value={draftStatus}
              onChange={(value) => setDraftStatus(value as StatusFilter)}
              options={[
                { value: "ALL", label: tUi("dashboard.operations.filterAll") },
                {
                  value: "COMPLETE",
                  label: tUi("reports.warrantyReport.statDone"),
                },
                {
                  value: "INCOMPLETE",
                  label: tUi("updatedUi.text_0e27d3ce9670"),
                },
              ]}
              aria-label={tUi("dashboard.composition.colStatus")}
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
              {initialLoading
                ? tUi("dashboard.insight.loadingTitle")
                : tUi("dashboard.snapshot.apply")}
            </button>
          </div>
          <div className="rpt07-filter-reset">
            <button
              type="button"
              onClick={resetFilters}
              disabled={initialLoading}
            >
              {tUi("reports.packingLabel.reset")}
            </button>
          </div>

          {refreshing ? (
            <div className="rpt07-refresh-note" aria-live="polite">
              <strong>{tUi("updatedUi.text_0c576314af49")}</strong>
              <span>{tUi("updatedUi.text_a84e8e7a2a07")}</span>
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
            <strong>{tUi("updatedUi.text_353db8f23007")}</strong>
            <span>{tUi("updatedUi.text_ac090f26974c")}</span>
            <small>{tUi("updatedUi.text_a37595da4216")}</small>
          </div>
          <button type="button" onClick={() => void source.refetch()}>
            <ReloadOutlined />
            {tUi("updatedUi.text_b91e5cc7eece")}
          </button>
        </section>
      ) : null}

      {hardError ? (
        <section className="rpt07-failure-panel" role="alert">
          <div className="rpt07-failure-panel__icon">
            <FileTextOutlined />
            <WarningOutlined />
          </div>
          <h2>{tUi("updatedUi.text_fd4197d181df")}</h2>
          <p>{tUi("updatedUi.text_1ec35f35e954")}</p>
          <div className="rpt07-failure-panel__actions">
            <button
              type="button"
              className="rpt07-primary-button"
              onClick={() => void source.refetch()}
            >
              <ReloadOutlined />
              {tUi("common.retry")}
            </button>
            <button
              type="button"
              className="rpt07-secondary-button"
              onClick={resetFilters}
            >
              {tUi("updatedUi.text_49ced19e7f1d")}
            </button>
          </div>
        </section>
      ) : (
        <>
          <section
            className="rpt07-kpi-grid"
            aria-label={tUi("dashboard.title")}
          >
            <MetricCard
              label={tUi("updatedUi.text_b825b57a8a53")}
              value={formatNumber(documentTotals.total)}
              hint="Tất cả phiếu trong kỳ"
              icon={<FileTextOutlined />}
              tone="primary"
              loading={initialLoading}
              unknown={partial}
            />
            <MetricCard
              label={tUi("updatedUi.text_623dac20f796")}
              value={formatNumber(dealers.length)}
              hint="Có phát sinh xuất trong kỳ"
              icon={<TeamOutlined />}
              tone="info"
              loading={initialLoading}
              unknown={partial}
            />
            <MetricCard
              label={tUi("reports.warrantyReport.statDone")}
              value={formatNumber(documentTotals.complete)}
              hint={completionLabel}
              icon={<CheckCircleOutlined />}
              tone="success"
              loading={initialLoading}
              unknown={partial}
            />
            <MetricCard
              label={tUi("updatedUi.text_0e27d3ce9670")}
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
            aria-label={tUi("updatedUi.text_9fdeddd24671")}
          >
            <div className="rpt07-panel rpt07-bar-panel">
              <div className="rpt07-panel__header">
                <div>
                  <h2>{tUi("updatedUi.text_b696a811369d")}</h2>
                  <p>{tUi("updatedUi.text_14857b14851b")}</p>
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
                  aria-label={tUi("updatedUi.text_b696a811369d")}
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
                  <h2>{tUi("reports.packingLabel.kpiPrintedMeta")}</h2>
                  <p>{tUi("updatedUi.text_bf9b957f0425")}</p>
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
                    aria-label={
                      tUi("reports.packingLabel.kpiPrintedMeta") +
                      " " +
                      completionLabel
                    }
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
                      <small>
                        {tUi("reports.packingLabel.kpiPrintedMeta")}
                      </small>
                    </span>
                  </div>
                  <div className="rpt07-ratio-copy">
                    <div className="rpt07-legend-row is-success">
                      <i />
                      <strong>{formatNumber(documentTotals.complete)}</strong>
                      <span>{tUi("iam.permissionAction.post")}</span>
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
                        {warning
                          ? tUi("updatedUi.text_6703ab94972c")
                          : tUi("updatedUi.text_0e27d3ce9670")}
                      </span>
                      {warning ? (
                        <small>
                          {incompleteLabel}
                          {" " + tUi("updatedUi.text_9871199f609c")}
                        </small>
                      ) : null}
                    </div>
                    <div className="rpt07-top-five">
                      <span>{tUi("updatedUi.text_344afda43e7e")}</span>
                      <strong>
                        {formatNumber(topFiveDocuments)}
                        {" " + tUi("updatedUi.text_20d8a6e7893b")}
                      </strong>
                      <small>
                        {topFiveLabel}
                        {" " + tUi("updatedUi.text_9871199f609c")}
                      </small>
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
                <h2 id="rpt07-table-title">
                  {tUi("updatedUi.text_3a0b9ba89a40")}
                </h2>
                {initialLoading ? (
                  <LoadingBar width="42px" height={22} />
                ) : (
                  <span>
                    {partial
                      ? "—"
                      : noSearchResult
                        ? tUi("updatedUi.text_f3674c04b5e8") +
                          " " +
                          dealers.length +
                          " " +
                          tUi("updatedUi.text_9fe632fd6866")
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
                  aria-label={tUi("updatedUi.text_4d0f6cce1add")}
                  placeholder={tUi("updatedUi.text_a54b781eab7e")}
                />
              </div>
            </div>

            <div className="rpt07-table-scroll">
              <table className="rpt07-table">
                <thead>
                  <tr>
                    <th>{tUi("updatedUi.text_61d6c9f042ea")}</th>
                    <th className="is-number">
                      {tUi("reports.pendingEvidence.colDocNo")}
                    </th>
                    <th className="is-number">
                      {tUi("outbound.detail.fieldItemCount")}
                    </th>
                    <th>{tUi("updatedUi.text_e59478450504")}</th>
                    <th>{tUi("updatedUi.text_4c5b6a1284da")}</th>
                    <th>{tUi("reports.importMatchReport.detail")}</th>
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
                          <strong>{tUi("updatedUi.text_e6b29ea29c8e")}</strong>
                          <span>{tUi("updatedUi.text_c760704470b3")}</span>
                          <button
                            type="button"
                            className="rpt07-primary-button"
                            onClick={() => setSearch("")}
                          >
                            <ReloadOutlined />
                            {tUi("updatedUi.text_a6630c450335")}
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
                          <strong>{tUi("updatedUi.text_58818ad0e4a0")}</strong>
                          <span>{tUi("updatedUi.text_6bd5ce3b1254")}</span>
                          <button
                            type="button"
                            className="rpt07-primary-button"
                            onClick={resetFilters}
                          >
                            <HistoryOutlined />
                            {tUi("updatedUi.text_2612a3bf2e9a")}
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
                          <td data-label={tUi("updatedUi.text_61d6c9f042ea")}>
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
                          <td
                            data-label={tUi("reports.pendingEvidence.colDocNo")}
                            className="is-number"
                          >
                            {formatNumber(row.totalDocuments)}
                          </td>
                          <td
                            data-label={tUi("outbound.detail.fieldItemCount")}
                            className="is-number"
                          >
                            {formatNumber(row.productQuantity)}
                          </td>
                          <td data-label={tUi("updatedUi.text_e59478450504")}>
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
                          <td data-label={tUi("updatedUi.text_4c5b6a1284da")}>
                            {formatDate(row.latestAt)}
                          </td>
                          <td
                            data-label={tUi("reports.importMatchReport.detail")}
                          >
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
                    {tUi("updatedUi.text_2ba40e3017eb") + " "}
                    {partial ? "—" : tableRows.length}
                    {" " + tUi("updatedUi.text_9fe632fd6866")}
                  </span>
                ) : (
                  <span>
                    {tUi("putaway.queue.showing") + " "}
                    {(visiblePage - 1) * 5 + 1}–
                    {Math.min(visiblePage * 5, tableRows.length)} /{" "}
                    {tableRows.length}
                    {" " + tUi("updatedUi.text_9fe632fd6866")}
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
          title={tUi("updatedUi.text_264600c191dc") + " " + detailRow.name}
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
                    ? tUi("updatedUi.text_7e49f04ad717")
                    : tUi("updatedUi.text_1339766f6a53") +
                      " " +
                      detailRow.receiver}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="rpt07-return-dialog__back"
              onClick={() => {
                setReturnRow(detailRow);
                setDetailRow(null);
              }}
            >
              {tUi("reports.recipientAgency.returnOpen")}
            </button>
            <div className="rpt07-detail-dialog__table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>{tUi("warranty.componentList.colCode")}</th>
                    <th>{tUi("reports.warranty.colIssueDate")}</th>
                    <th>{tUi("outbound.detail.fieldItemCount")}</th>
                    <th>{tUi("dashboard.composition.colStatus")}</th>
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
                          {document.incomplete
                            ? tUi("updatedUi.text_0e27d3ce9670")
                            : tUi("iam.permissionAction.post")}
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
      {returnRow ? (
        <RecipientReturnDialog
          recipientName={returnRow.name}
          events={returnRow.events}
          reversalRows={Array.isArray(returnDocuments.data?.data) ? returnDocuments.data.data : []}
          loading={returnDocuments.isPending}
          error={returnDocuments.error instanceof Error ? returnDocuments.error : null}
          onRetry={() => void returnDocuments.refetch()}
          onBack={() => { setDetailRow(returnRow); setReturnRow(null); }}
          onClose={() => setReturnRow(null)}
        />
      ) : null}
    </Box>
  );
}
