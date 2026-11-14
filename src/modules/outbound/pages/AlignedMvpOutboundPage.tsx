import { localizedValue as localizedUiValue } from "@/shared/i18n/localized-value";
/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import type { Dayjs } from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { BarChartOutlined, FilterOutlined } from "@/shared/components/icons";
import {
  FILTER_WIDTH,
  UiAutocomplete,
  UiIcon,
  UiPagination,
  UiSelect,
  UiTextField,
} from "@/shared/ui";
import { invalidateStockDerived } from "@/shared/cache/invalidation";
import { useT } from "@/shared/i18n/useT";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  MVP_PAGE_SIZE_OPTIONS,
  resolveApiPagination,
} from "@/shared/components/mvp/mvp-pagination";
import { useHasPermission } from "@/shared/components/permission";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import {
  OUTBOUND_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";
import { SortableTh } from "@/shared/components/data-display/SortableTh";
import { TruncatedText } from "@/shared/components/data-display/TruncatedText";
import { rowActivationProps } from "@/shared/components/data-display/row-activation";
import { useClientSort } from "@/shared/components/data-display/useClientSort";
import { AlignedOutboundDetailModal } from "@/modules/outbound/components/AlignedOutboundDetailModal";
import { OutboundIntakeModal } from "@/modules/outbound/components/OutboundIntakeModal";
import { OutboundOverview } from "@/modules/outbound/components/OutboundOverview";
import { OutboundNfcProducts } from "@/modules/outbound/components/OutboundNfcProducts";
import { ReportDateRangePicker } from "@/modules/reports/components/ReportDateRangePicker";
import {
  fetchOutboundDocuments,
  type OutboundDocumentRecord,
  type OutboundStatus,
} from "@/modules/outbound/services/alignedOutboundService";
import { ActionButton, RowActionButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { formatQuantity } from "@/shared/utils/format-number";
import { formatDateTime } from "@/shared/utils/format-date";
import {
  fetchOutboundRecipientIndex,
  fetchOutboundRowsForRecipient,
} from "./outbound-list-data";
import "./outbound-list.css";
import { tStatic as tUi } from "@/shared/i18n/useT";

const SEARCH_DEBOUNCE_MS = 250;
const OVERVIEW_STORAGE_KEY = "hn-out01-overview-open";
/** Nhãn cột ngày — inline vì messages.en/zh đang có thay đổi dở của người khác. */
const getDateColumnLabel = (language: string) =>
  language === "vi"
    ? "Ngày tạo/xuất"
    : language === "zh"
      ? "创建 / 出库"
      : "Created / Exported";
const EMPTY_DATE_PLACEHOLDER = "____";
const getSTATUS_OPTIONS = localizedUiValue(() =>
  Object.entries(OUTBOUND_STATUS_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
);
const DETAIL_SCREENS = new Set(["OUT-03", "OUT-02", "LBL-01", "RFID-01"]);
const SORT_ACCESSORS = {
  code: (row: OutboundDocumentRecord) => row.code || "",
  recipientName: (row: OutboundDocumentRecord) => row.recipientName,
  match: (row: OutboundDocumentRecord) =>
    row.expected > 0 ? row.scanned / row.expected : 0,
  status: (row: OutboundDocumentRecord) => row.status,
};
/** OUT-01: presentation and filtering over the existing outbound contracts. */
export default function AlignedMvpOutboundPage() {
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const dateColLabel = getDateColumnLabel(language);
  const can = useHasPermission();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab =
    searchParams.get("tab") === "products" ? "products" : "documents";
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OutboundStatus | "">("");
  const [recipient, setRecipient] = useState("");
  const [recipientOptionsOpen, setRecipientOptionsOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [createdRange, setCreatedRange] = useState<
    [Dayjs | null, Dayjs | null] | null
  >(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [overviewExpanded, setOverviewExpanded] = useState(() => {
    try {
      return window.localStorage.getItem(OVERVIEW_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const canImport =
    WMS_ACTION_PERMISSIONS.OUTBOUND_REQUEST_IMPORT.some(can) ||
    WMS_ACTION_PERMISSIONS.OUTBOUND_REQUEST_MANUAL_CREATE.some(can);
  const canAttach = can("outbound.scan") || can("outbound.post");
  const canScan = can("outbound.scan");
  const createdFrom = createdRange?.[0]?.format("YYYY-MM-DD");
  const createdTo = createdRange?.[1]?.format("YYYY-MM-DD");
  const listParams = {
    search: search || undefined,
    status: status || undefined,
    fromDate: createdFrom,
    toDate: createdTo,
    page,
    per_page: perPage,
    sortOrder,
  };
  const listQuery = useQuery({
    queryKey: [
      "mvp-outbound",
      "list",
      search,
      status,
      createdFrom,
      createdTo,
      page,
      perPage,
      sortOrder,
      recipient,
    ],
    queryFn: ({ signal }) =>
      recipient
        ? fetchOutboundRowsForRecipient(
            { ...listParams, recipientName: recipient },
            signal,
          )
        : fetchOutboundDocuments(listParams),
    enabled: activeTab === "documents",
  });
  // Load all authorized pages only on demand; never offer an incomplete list
  // of recipients or filter only the currently visible page.
  const recipientQuery = useQuery({
    queryKey: ["mvp-outbound", "recipient-options"],
    queryFn: ({ signal }) => fetchOutboundRecipientIndex(signal),
    enabled: recipientOptionsOpen,
  });
  const recipientOptions = Array.from(
    new Set(
      (recipientQuery.data ?? [])
        .map((row) => row.recipientName)
        .filter(Boolean),
    ),
  )
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((name) => ({ value: name, label: name }));
  const rows = listQuery.data?.data ?? [];
  const pagination = resolveApiPagination(listQuery.data?.meta, {
    page,
    pageSize: perPage,
    rowCount: rows.length,
  });
  const { sortedRows, sortState, requestSort } = useClientSort(
    rows,
    SORT_ACCESSORS,
  );
  const loading = listQuery.isLoading;
  const hasFilters = Boolean(
    searchInput || search || status || recipient || createdFrom || createdTo,
  );
  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setRecipient("");
    setCreatedRange(null);
    setPage(1);
  };
  const first = rows.length
    ? (pagination.current - 1) * pagination.pageSize + 1
    : 0;
  const last = rows.length
    ? Math.min(pagination.total, first + rows.length - 1)
    : 0;

  useEffect(() => {
    const nextSearch = searchInput.trim();
    if (nextSearch === search) return;
    const timer = window.setTimeout(() => {
      setSearch(nextSearch);
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput, search]);
  useEffect(() => {
    const screen = searchParams.get("screen");
    if (!screen || screen === "OUT-01") return;
    if (screen === "OUT-REQ-01") setIntakeOpen(true);
    else if (DETAIL_SCREENS.has(screen)) {
      const id = searchParams.get("id");
      if (id) setDetailId(id);
    } else return;
    const next = new URLSearchParams(searchParams);
    next.set("screen", "OUT-01");
    next.delete("id");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  useOverlayBackDismiss(
    intakeOpen || detailId !== null,
    () => {
      setIntakeOpen(false);
      setDetailId(null);
    },
    "OUT-01-overlay",
  );
  const refreshAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["mvp-outbound"] });
    void invalidateStockDerived(queryClient);
  };
  const progress = (row: OutboundDocumentRecord) => {
    if (row.status === "CANCELLED")
      return (
        <span aria-label={tUi("updatedUi.text_0a1c02f926e9")}>
          {EMPTY_TEXT}
        </span>
      );
    const percent =
      row.expected > 0
        ? Math.max(
            0,
            Math.min(100, Math.round((row.scanned / row.expected) * 100)),
          )
        : 0;
    return (
      <div className="hn-outbound-progress" data-status={row.status}>
        <span
          className="hn-outbound-progress-track"
          role="progressbar"
          aria-label={tUi("updatedUi.text_dc7b03b9635d", {
            value0: String(row.code || t("outbound.list.colDocument")),
          })}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          aria-valuetext={`${row.scanned}/${row.expected}`}
        >
          <span style={{ width: `${percent}%` }} />
        </span>
        <span>
          {row.scanned}/{row.expected}
        </span>
      </div>
    );
  };
  const rowActions = (row: OutboundDocumentRecord) => {
    const mutable =
      (row.status === "DRAFT" || row.status === "SCANNING") && canScan;
    return (
      <RowActionButton kind="view" onClick={() => setDetailId(row.id)}>
        {mutable ? t("outbound.list.open") : t("outbound.list.view")}
      </RowActionButton>
    );
  };
  const sortHeader = (
    label: string,
    key: keyof typeof SORT_ACCESSORS,
    className?: string,
  ) => (
    <SortableTh
      label={label}
      tooltipLabel={label}
      sortKey={key}
      className={className}
      sortState={sortState}
      onSort={requestSort}
      sortType={key === "match" || key === "status" ? "value" : "text"}
    />
  );

  return (
    <div className="outbound-page hn-mvp-source-screen hn-outbound-list">
      <header className="hn-outbound-header">
        <div>
          <h1>{tUi("updatedUi.text_d3eb457df55e")}</h1>
          <p>{tUi("updatedUi.text_a7149a55bd87")}</p>
        </div>
        <div className="hn-outbound-header-actions">
          {activeTab === "documents" ? (
            <button
              type="button"
              className="hn-outbound-overview-toggle"
              aria-label={
                overviewExpanded ? tUi("common.collapse") : tUi("common.expand")
              }
              aria-expanded={overviewExpanded}
              title={tUi("updatedUi.text_b11b59304497")}
              aria-controls="hn-outbound-overview"
              onClick={() => {
                const expanded = !overviewExpanded;
                setOverviewExpanded(expanded);
                try {
                  window.localStorage.setItem(
                    OVERVIEW_STORAGE_KEY,
                    String(expanded),
                  );
                } catch {
                  // Keep the toggle usable when browser storage is unavailable.
                }
              }}
            >
              <BarChartOutlined aria-hidden="true" />
            </button>
          ) : null}
          {canImport ? (
            <ActionButton
              kind="create"
              className="hn-outbound-intake"
              onClick={() => setIntakeOpen(true)}
            >
              {t("outbound.list.intake")}
            </ActionButton>
          ) : null}
        </div>
      </header>
      <div
        className="hn-outbound-content-tabs"
        role="tablist"
        aria-label={t("iam.permissionModule.outbound")}
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "documents"}
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.delete("tab");
            setSearchParams(next);
          }}
        >
          {t("nfc.outboundDocumentsTab")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === "products"}
          onClick={() => {
            const next = new URLSearchParams(searchParams);
            next.set("tab", "products");
            setSearchParams(next);
          }}
        >
          {t("nfc.outboundProductsTab")}
        </button>
      </div>
      {activeTab === "documents" ? (
        <>
          <OutboundOverview
            expanded={overviewExpanded}
            onRefresh={() => {
              void listQuery.refetch();
            }}
          />
          <section
            className="hn-outbound-list-card"
            aria-label={tUi("updatedUi.text_b6f8caf7b7cc")}
          >
            <form
              className="hn-outbound-filters"
              onSubmit={(event) => {
                event.preventDefault();
              }}
            >
              <div className="hn-outbound-filter hn-outbound-search">
                <label htmlFor="hn-outbound-search">
                  {tUi("reports.packingLabel.searchLabel")}
                </label>
                <div className="hn-outbound-search-field">
                  <UiIcon name="search" />
                  <UiTextField
                    id="hn-outbound-search"
                    value={searchInput}
                    placeholder={tUi("updatedUi.text_b87f26abcd90")}
                    fullWidth
                    slotProps={{
                      htmlInput: {
                        "aria-label": t("outbound.list.searchAria"),
                      },
                    }}
                    onChange={(event) => setSearchInput(event.target.value)}
                  />
                  {searchInput ? (
                    <button
                      type="button"
                      className="hn-outbound-search-clear"
                      aria-label={tUi("updatedUi.text_431466c48cf0")}
                      onClick={() => setSearchInput("")}
                    >
                      <UiIcon name="cross-small" size="sm" />
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="hn-outbound-filter">
                <label htmlFor="hn-outbound-status">
                  {tUi("dashboard.composition.colStatus")}
                </label>
                <UiSelect
                  id="hn-outbound-status"
                  value={status}
                  fullWidth
                  displayEmpty
                  searchable={false}
                  aria-label={t("outbound.list.statusFilterAria")}
                  menuClassName="hn-outbound-menu"
                  options={[
                    {
                      value: "",
                      label: `${tUi("dashboard.composition.colStatus")}: ${tUi("dashboard.operations.filterAll")}`,
                    },
                    ...getSTATUS_OPTIONS().map((option) => ({
                      ...option,
                      label: `${tUi("dashboard.composition.colStatus")}: ${option.label}`,
                    })),
                  ]}
                  onChange={(value) => {
                    setStatus(value as OutboundStatus | "");
                    setPage(1);
                  }}
                />
              </div>
              <div
                className="hn-outbound-filter hn-outbound-recipient"
                onFocusCapture={() => setRecipientOptionsOpen(true)}
                onPointerDown={() => setRecipientOptionsOpen(true)}
              >
                <label id="hn-outbound-recipient-label">
                  {tUi("outbound.list.colRecipient")}
                </label>
                <UiAutocomplete
                  aria-label={tUi("reports.recipientAgency.recipientAria")}
                  value={recipient || null}
                  placeholder={`${tUi("outbound.list.colRecipient")}: ${tUi("dashboard.operations.filterAll")}`}
                  options={recipientOptions.map((option) => ({
                    ...option,
                    label: `${tUi("outbound.list.colRecipient")}: ${option.label}`,
                  }))}
                  loading={recipientQuery.isFetching}
                  noOptionsText={
                    recipientQuery.isError
                      ? tUi("updatedUi.text_db79a7eae981")
                      : tUi("updatedUi.text_c8299787a419")
                  }
                  onChange={(value) => {
                    setRecipient(value == null ? "" : String(value));
                    setPage(1);
                  }}
                />
                {recipientQuery.isError ? (
                  <button
                    type="button"
                    className="hn-outbound-recipient-retry"
                    onClick={() => {
                      void recipientQuery.refetch();
                    }}
                  >
                    {tUi("updatedUi.text_aaf4e361fb1b")}
                  </button>
                ) : null}
              </div>
              <div className="hn-outbound-sort">
                <UiSelect
                  value={sortOrder}
                  fullWidth
                  aria-label={t("outbound.list.sortAria")}
                  menuClassName="hn-outbound-menu"
                  options={[
                    {
                      value: "desc",
                      label: `${t("outbound.list.sortLabel")}: ${tUi("updatedUi.text_83ddf4187c12")}`,
                    },
                    {
                      value: "asc",
                      label: `${t("outbound.list.sortLabel")}: ${t("outbound.list.sortOldest")}`,
                    },
                  ]}
                  onChange={(value) => {
                    setSortOrder(value === "asc" ? "asc" : "desc");
                    setPage(1);
                  }}
                />
                <button
                  type="button"
                  className="hn-outbound-more-filters"
                  aria-expanded={filtersOpen}
                  aria-controls="hn-outbound-extra-filters"
                  onClick={() => setFiltersOpen((current) => !current)}
                >
                  <FilterOutlined aria-hidden="true" />
                  {t("outbound.list.filterButton")}
                </button>
              </div>
            </form>
            <div
              id="hn-outbound-extra-filters"
              className="hn-outbound-extra-filters"
              hidden={!filtersOpen}
            >
              <div className="hn-outbound-date-filter">
                <span className="hn-outbound-date-label">
                  {t("outbound.list.dateFilterLabel")}
                </span>
                <ReportDateRangePicker
                  value={createdRange}
                  aria-label={t("outbound.list.dateFilterAria")}
                  showFieldPrefixes={false}
                  onChange={(value) => {
                    setCreatedRange(value);
                    setPage(1);
                  }}
                />
              </div>
              {hasFilters ? (
                <button
                  type="button"
                  className="hn-outbound-clear-filters"
                  onClick={resetFilters}
                >
                  {t("outbound.list.clearFilters")}
                </button>
              ) : null}
            </div>
            {listQuery.isError ? (
              <div className="hn-outbound-error">
                <ApiErrorAlert
                  error={listQuery.error}
                  title={t("outbound.list.loadError")}
                  hideDetails
                  onRetry={() => listQuery.refetch()}
                />
              </div>
            ) : null}
            <div
              className={`hn-outbound-table-region${loading ? " is-loading" : ""}`}
              aria-busy={listQuery.isFetching}
            >
              {loading ? (
                <div
                  className="hn-outbound-loading"
                  role="status"
                  {...uiStateProps(UI_STATE.LOADING, "ui-state-loading-table")}
                >
                  {rows.length
                    ? tUi("updatedUi.text_10db055811ab")
                    : tUi("updatedUi.text_811584ce5c49")}
                </div>
              ) : null}
              <table className="hn-outbound-table">
                <thead>
                  <tr>
                    <th className="hn-outbound-col-index" scope="col">
                      {t("shared.table.rowNumber")}
                    </th>
                    {sortHeader(
                      t("outbound.list.colDocument"),
                      "code",
                      "hn-outbound-col-code",
                    )}
                    {sortHeader(
                      t("outbound.list.colRecipient"),
                      "recipientName",
                      "hn-outbound-col-recipient",
                    )}
                    <th scope="col" className="hn-outbound-col-datetime">
                      {dateColLabel}
                    </th>
                    {sortHeader(
                      t("outbound.list.colReconcile"),
                      "match",
                      "hn-outbound-col-match",
                    )}
                    {sortHeader(
                      t("outbound.list.colStatus"),
                      "status",
                      "hn-outbound-col-status",
                    )}
                    <th
                      className="hn-outbound-col-actions"
                      scope="col"
                      aria-label={tUi("outbound.detail.colAction")}
                    />
                  </tr>
                </thead>
                <tbody>
                  {sortedRows.map((row, index) => (
                    <tr
                      key={row.id}
                      {...rowActivationProps(() => setDetailId(row.id))}
                    >
                      <td className="hn-outbound-index">{first + index}</td>
                      <td className="hn-outbound-code">
                        <strong>{row.code || EMPTY_TEXT}</strong>
                      </td>
                      <td className="hn-outbound-recipient-cell">
                        <TruncatedText lines={2} maxWidth="100%">
                          {row.recipientName || EMPTY_TEXT}
                        </TruncatedText>
                      </td>
                      <td className="hn-outbound-datetime-cell">
                        <div className="hn-outbound-datetime-line">
                          {row.createdAt
                            ? formatDateTime(row.createdAt)
                            : EMPTY_DATE_PLACEHOLDER}
                        </div>
                        <div className="hn-outbound-datetime-line is-posted">
                          {row.postedAt
                            ? formatDateTime(row.postedAt)
                            : EMPTY_DATE_PLACEHOLDER}
                        </div>
                      </td>
                      <td className="hn-outbound-match">{progress(row)}</td>
                      <td className="hn-outbound-status-cell">
                        <span
                          className="hn-outbound-status"
                          data-status={row.status}
                        >
                          {businessLabel(
                            OUTBOUND_STATUS_LABELS,
                            row.status,
                            t("outbound.list.statusUnknown"),
                          )}
                        </span>
                      </td>
                      <td className="hn-outbound-actions-cell">
                        {rowActions(row)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!rows.length && !loading ? (
                <div
                  className="hn-outbound-empty"
                  role="status"
                  {...(listQuery.isError
                    ? {}
                    : uiStateProps(UI_STATE.EMPTY, "ui-state-empty-table"))}
                >
                  <UiIcon
                    name={listQuery.isError ? "exclamation" : "document"}
                    size="lg"
                  />
                  <strong>
                    {listQuery.isError
                      ? tUi("updatedUi.text_1761f054f161")
                      : hasFilters
                        ? tUi("updatedUi.text_d0a12f6ddeb3")
                        : t("outbound.list.empty")}
                  </strong>
                  <span>
                    {listQuery.isError
                      ? tUi("updatedUi.text_a8c4ecd17312")
                      : hasFilters
                        ? tUi("updatedUi.text_369f96fc8284")
                        : tUi("updatedUi.text_d543bd203651")}
                  </span>
                </div>
              ) : null}
              {!rows.length && loading ? (
                <div className="hn-outbound-skeleton" aria-hidden="true">
                  {Array.from({ length: 7 }, (_, index) => (
                    <div key={index}>
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                      <span />
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
            <footer className="hn-outbound-pagination">
              <div className="hn-outbound-page-info">
                <span aria-live="polite">
                  {listQuery.data
                    ? tUi("updatedUi.text_ed9314f2e7c6", {
                        value0: String(first),
                        value1: String(last),
                        value2: String(formatQuantity(pagination.total)),
                      })
                    : loading
                      ? tUi("updatedUi.text_5412ced1c478")
                      : tUi("updatedUi.text_324e2c9b114d")}
                </span>
                <UiSelect
                  kind="page-size"
                  value={perPage}
                  aria-label={t("outbound.list.pageSizeAria")}
                  menuClassName="hn-outbound-menu"
                  minWidth={FILTER_WIDTH.pageSize}
                  options={MVP_PAGE_SIZE_OPTIONS.map((size) => ({
                    value: size,
                    label: t("shared.table.perPage", { size }),
                  }))}
                  onChange={(value) => {
                    setPerPage(Number(value));
                    setPage(1);
                  }}
                />
              </div>
              <div className="hn-outbound-pagination-controls">
                <UiPagination
                  total={pagination.total}
                  page={pagination.current}
                  pageSize={pagination.pageSize}
                  showTotal={false}
                  disabled={loading}
                  onPageChange={setPage}
                />
              </div>
            </footer>
          </section>
        </>
      ) : (
        <OutboundNfcProducts onOpenDocument={setDetailId} />
      )}
      {intakeOpen ? (
        <OutboundIntakeModal
          open
          canImport={canImport}
          canAttach={canAttach}
          onClose={() => setIntakeOpen(false)}
          onConsumed={(documentIds) => {
            setIntakeOpen(false);
            refreshAll();
            if (documentIds[0]) setDetailId(documentIds[0]);
          }}
        />
      ) : null}
      {detailId ? (
        <AlignedOutboundDetailModal
          documentId={detailId}
          onClose={() => setDetailId(null)}
          onChanged={refreshAll}
        />
      ) : null}
    </div>
  );
}
