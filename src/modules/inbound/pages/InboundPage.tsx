import { localizedValue as localizedUiValue } from "@/shared/i18n/localized-value";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { UiIcon, UiPagination, UiSelect, UiTextField } from "@/shared/ui";
import { ActionButton } from "@/shared/components/actions";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { SortableTh } from "@/shared/components/data-display/SortableTh";
import {
  ArrowRightOutlined,
  BarChartOutlined,
  FilterOutlined,
} from "@/shared/components/icons";
import { useClientSort } from "@/shared/components/data-display/useClientSort";
import { MVP_PAGE_SIZE_OPTIONS } from "@/shared/components/mvp/mvp-pagination";
import {
  hasAnyWmsPermission,
  WMS_PERMISSION_CATALOG as P,
} from "@/shared/constants/wms-permissions";
import {
  INBOUND_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { useOverlayBackDismiss } from "@/shared/hooks/useOverlayBackDismiss";
import { useAuthStore } from "@/shared/store/auth.store";
import { useT } from "@/shared/i18n/useT";
import { InboundDraftModal } from "@/modules/inbound/components/InboundDraftModal";
import { InboundOverview } from "@/modules/inbound/components/InboundOverview";
import { useInboundDocuments } from "@/modules/inbound/hooks/use-inbound";
import { InboundScanModal } from "@/modules/inbound/pages/MvpInboundScreens";
import type { InboundDocument } from "@/modules/inbound/types";
import { formatQuantity } from "@/shared/utils/format-number";
import "./inbound-list.css";
import { tStatic as tUi } from "@/shared/i18n/useT";

const getSTATUS_OPTIONS = localizedUiValue(() =>
  Object.entries(INBOUND_STATUS_LABELS).map(([value, label]) => ({
    value,
    label: value === "SCANNING" ? tUi("updatedUi.text_0be7d9b1d01d") : label,
  })),
);
const SORT_ACCESSORS = {
  code: (row: InboundDocument) => row.code,
  source: (row: InboundDocument) => row.source,
  scanned: (row: InboundDocument) => row.scanned,
  status: (row: InboundDocument) => row.status,
};

function displayValue(value?: string) {
  return !value || value === "-" ? EMPTY_TEXT : value;
}
function useInboundPermission(code: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return hasAnyWmsPermission(permissionCodes, [code], isSuperAdmin);
}
function InboundListScreen() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [pendingInfo, setPendingInfo] = useState<boolean | undefined>();
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftDocumentId, setDraftDocumentId] = useState<string | null>(null);
  const [scanDocumentId, setScanDocumentId] = useState<string | null>(null);
  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const query = useInboundDocuments({
    search: search || undefined,
    status,
    page,
    per_page: perPage,
    pendingProductInfo: pendingInfo,
    sortOrder,
  });
  const rows = query.data?.data ?? [];
  const meta = query.data?.meta;
  const total = Number(meta?.total ?? rows.length);
  const currentPage = Number(meta?.current_page ?? page);
  const { sortedRows, sortState, requestSort } = useClientSort(
    rows,
    SORT_ACCESSORS,
  );
  const loading = query.isLoading || query.isFetching;
  const hasFilters = Boolean(
    searchInput || status || pendingInfo !== undefined || sortOrder !== "desc",
  );

  useEffect(() => {
    const requestedScreen = searchParams.get("screen");
    if (requestedScreen !== "IN-02" && requestedScreen !== "IN-03") return;
    const id = searchParams.get("id");
    if (requestedScreen === "IN-02") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- State follows a changed external input or route.
      setDraftDocumentId(id);
      setDraftOpen(true);
    } else if (id) setScanDocumentId(id);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("screen", "IN-01");
    nextParams.delete("id");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const closeDraftModal = () => {
    setDraftOpen(false);
    setDraftDocumentId(null);
  };
  const handleSaved = (documentId: string) => {
    closeDraftModal();
    setScanDocumentId(documentId);
  };
  useOverlayBackDismiss(
    draftOpen || scanDocumentId !== null,
    () => {
      setDraftOpen(false);
      setDraftDocumentId(null);
      setScanDocumentId(null);
    },
    "IN-01-overlay",
  );
  const editDocument = (id: string | null) => {
    setScanDocumentId(null);
    setDraftDocumentId(id);
    setDraftOpen(true);
  };
  const openDocument = (id: string) => {
    setScanDocumentId(id);
  };
  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus(undefined);
    setPendingInfo(undefined);
    setSortOrder("desc");
    setPage(1);
  };
  const applyFilters = () => {
    setSearch(searchInput.trim());
    setPage(1);
    if (search === searchInput.trim() && page === 1) void query.refetch();
  };
  const statusBadge = (row: InboundDocument) => (
    <div className="hn-inbound-status-stack">
      <span
        className={`hn-inbound-status hn-inbound-status--${row.status.toLowerCase()}`}
      >
        <i />
        {row.status === "SCANNING"
          ? tUi("updatedUi.text_0be7d9b1d01d")
          : businessLabel(
              INBOUND_STATUS_LABELS,
              row.status,
              t("inbound.list.statusUnknown"),
            )}
      </span>
      {row.pendingProductInfo ? (
        <span className="hn-inbound-pending">
          {row.pendingProductInfoCount > 0
            ? t("inbound.list.pendingInfoBadgeCount", {
                count: row.pendingProductInfoCount,
              })
            : t("inbound.list.pendingInfoBadge")}
        </span>
      ) : null}
    </div>
  );
  const progress = (row: InboundDocument) => (
    <>
      {row.skuCount == null ? "" : `${formatQuantity(row.skuCount)} SKU · `}
      {formatQuantity(row.scanned)}
      {" " + tUi("updatedUi.text_11589f1a7b52")}
    </>
  );
  const rowActions = (row: InboundDocument) => {
    return (
      <button
        type="button"
        className="hn-inbound-detail-link"
        aria-label={tUi("reports.importMatchReport.detail")}
        title={tUi("reports.importMatchReport.detail")}
        onClick={() => openDocument(row.id)}
      >
        <ArrowRightOutlined aria-hidden="true" />
      </button>
    );
  };
  const sortHeader = (
    label: string,
    key: keyof typeof SORT_ACCESSORS,
    className?: string,
  ) => (
    <SortableTh
      label={label}
      sortKey={key}
      sortState={sortState}
      onSort={requestSort}
      className={className}
      sortType={key === "scanned" ? "value" : "text"}
    />
  );
  const first = rows.length ? (currentPage - 1) * perPage + 1 : 0;
  const last = rows.length ? Math.min(total, first + rows.length - 1) : 0;

  return (
    <div
      className="inbound-page hn-mvp-source-screen hn-inbound-list"
      data-screen="IN-01"
    >
      <header className="hn-inbound-header">
        <div>
          <h1>{tUi("updatedUi.text_6e410870eb7f")}</h1>
        </div>
        <div className="hn-inbound-header-actions">
          <button
            type="button"
            className="hn-inbound-overview-toggle"
            aria-label={tUi("updatedUi.text_c4cea6eb5467")}
            title={tUi("updatedUi.text_c4cea6eb5467")}
            aria-expanded={overviewOpen}
            aria-controls="hn-inbound-overview-content"
            onClick={() => setOverviewOpen((current) => !current)}
          >
            <BarChartOutlined aria-hidden="true" />
          </button>
          {canCreate ? (
            <ActionButton
              kind="create"
              icon={<UiIcon name="plus" />}
              className="hn-inbound-create"
              onClick={() => editDocument(null)}
            >
              {t("inbound.list.create")}
            </ActionButton>
          ) : null}
        </div>
      </header>
      <div id="hn-inbound-overview-content" hidden={!overviewOpen}>
        {overviewOpen ? <InboundOverview /> : null}
      </div>
      <section
        className="hn-inbound-search-panel"
        aria-label={t("inbound.list.filterAria")}
      >
        <form
          className="hn-inbound-filters"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <div className="hn-inbound-filter hn-inbound-search">
            <div className="hn-inbound-search-field">
              <UiIcon name="search" />
              <UiTextField
                id="hn-inbound-search"
                value={searchInput}
                placeholder={tUi("updatedUi.text_16bb8e8dabab")}
                fullWidth
                slotProps={{
                  htmlInput: { "aria-label": t("inbound.list.searchAria") },
                }}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {searchInput ? (
                <button
                  type="button"
                  className="hn-inbound-search-clear"
                  aria-label={tUi("updatedUi.text_431466c48cf0")}
                  onClick={() => setSearchInput("")}
                >
                  <UiIcon name="cross-small" size="sm" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="hn-inbound-filter">
            <UiSelect
              id="hn-inbound-status-filter"
              fullWidth
              value={status ?? ""}
              aria-label={t("inbound.list.statusFilterAria")}
              placeholder={t("inbound.list.statusFilterPlaceholder")}
              menuClassName="hn-inbound-menu"
              options={getSTATUS_OPTIONS().map((option) => ({
                ...option,
                label: `${tUi("dashboard.composition.colStatus")}: ${option.label}`,
              }))}
              onChange={(value) => {
                setStatus(value || undefined);
                setPage(1);
              }}
            />
          </div>
          <div className="hn-inbound-filter">
            <UiSelect
              id="hn-inbound-info-filter"
              fullWidth
              value={pendingInfo === undefined ? "" : pendingInfo ? "1" : "0"}
              aria-label={t("inbound.list.infoFilterAria")}
              placeholder={t("inbound.list.infoFilterPlaceholder")}
              menuClassName="hn-inbound-menu"
              options={[
                {
                  value: "1",
                  label: `${tUi("inbound.detail.colInfo")}: ${t("inbound.list.infoFilterPending")}`,
                },
                {
                  value: "0",
                  label: `${tUi("inbound.detail.colInfo")}: ${t("inbound.list.infoFilterComplete")}`,
                },
              ]}
              onChange={(value) => {
                setPendingInfo(value === "" ? undefined : value === "1");
                setPage(1);
              }}
            />
          </div>
          <button
            type="button"
            className="hn-inbound-more-filters"
            aria-expanded={filtersOpen}
            aria-controls="hn-inbound-extra-filters"
            onClick={() => setFiltersOpen((current) => !current)}
          >
            <FilterOutlined aria-hidden="true" />
            {t("inbound.list.filterButton")}
          </button>
          {hasFilters ? (
            <button
              type="button"
              className="hn-inbound-clear-filters"
              onClick={resetFilters}
            >
              {t("inbound.list.clearFilters")}
            </button>
          ) : null}
        </form>
        <div
          id="hn-inbound-extra-filters"
          className="hn-inbound-extra-filters"
          hidden={!filtersOpen}
        >
          <UiSelect
            value={sortOrder}
            aria-label={t("inbound.list.sortAria")}
            menuClassName="hn-inbound-menu"
            options={[
              { value: "desc", label: tUi("updatedUi.text_83ddf4187c12") },
              { value: "asc", label: t("inbound.list.sortOldest") },
            ]}
            onChange={(value) => {
              setSortOrder(value === "asc" ? "asc" : "desc");
              setPage(1);
            }}
          />
        </div>
      </section>
      <section
        className="hn-inbound-list-card"
        aria-label={tUi("updatedUi.text_b7f7bae4ff19")}
      >
        {query.isError ? (
          <div className="hn-inbound-error">
            <ApiErrorAlert
              error={query.error}
              title={t("inbound.list.loadError")}
              onRetry={() => query.refetch()}
            />
          </div>
        ) : null}
        <div
          className={`hn-inbound-table-region${loading ? " is-loading" : ""}`}
          aria-busy={loading}
        >
          {loading ? (
            <div
              className="hn-inbound-loading"
              role="status"
              {...uiStateProps(UI_STATE.LOADING, "ui-state-loading-table")}
            >
              {rows.length
                ? tUi("updatedUi.text_10db055811ab")
                : tUi("updatedUi.text_ed527a82edf6")}
            </div>
          ) : null}
          <table className="hn-inbound-table">
            <thead>
              <tr>
                <th className="hn-inbound-col-index">STT</th>
                {sortHeader(
                  tUi("inbound.detail.fieldDocument"),
                  "code",
                  "hn-inbound-col-code",
                )}
                {sortHeader(
                  tUi("updatedUi.text_766b3eccf90f"),
                  "source",
                  "hn-inbound-col-source",
                )}
                {sortHeader(
                  tUi("updatedUi.text_5306083bc2fb"),
                  "scanned",
                  "hn-inbound-desktop hn-inbound-col-progress",
                )}
                {sortHeader(
                  tUi("dashboard.composition.colStatus"),
                  "status",
                  "hn-inbound-col-status",
                )}
                <th
                  className="hn-inbound-col-actions"
                  aria-label={tUi("outbound.detail.colAction")}
                />
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, index) => (
                <tr key={row.id}>
                  <td className="hn-inbound-index">
                    {(currentPage - 1) * perPage + index + 1}
                  </td>
                  <td className="hn-inbound-code">
                    <button
                      type="button"
                      onClick={() => openDocument(row.id)}
                      title={displayValue(row.code)}
                    >
                      {displayValue(row.code)}
                    </button>
                  </td>
                  <td className="hn-inbound-source">
                    <span
                      className="hn-inbound-source-name"
                      title={displayValue(row.source)}
                    >
                      {displayValue(row.source)}
                    </span>
                    <span className="hn-inbound-compact">{progress(row)}</span>
                  </td>
                  <td className="hn-inbound-desktop hn-inbound-progress-cell">
                    {progress(row)}
                  </td>
                  <td className="hn-inbound-status-cell">{statusBadge(row)}</td>
                  <td className="hn-inbound-actions-cell">{rowActions(row)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!rows.length && !loading ? (
            <div
              className="hn-inbound-empty"
              role="status"
              {...(query.isError
                ? {}
                : uiStateProps(UI_STATE.EMPTY, "ui-state-empty-table"))}
            >
              <UiIcon
                name={query.isError ? "exclamation" : "document"}
                size="lg"
              />
              <strong>
                {query.isError
                  ? tUi("updatedUi.text_9e4db3a2417e")
                  : hasFilters
                    ? tUi("updatedUi.text_cb254eb425d2")
                    : t("inbound.list.empty")}
              </strong>
              <span>
                {query.isError
                  ? tUi("updatedUi.text_a8c4ecd17312")
                  : hasFilters
                    ? tUi("updatedUi.text_369f96fc8284")
                    : tUi("updatedUi.text_d275583f99ae")}
              </span>
              {hasFilters && !query.isError ? (
                <ActionButton kind="reset" onClick={resetFilters}>
                  {tUi("updatedUi.text_49ced19e7f1d")}
                </ActionButton>
              ) : null}
            </div>
          ) : null}
          {!rows.length && loading ? (
            <div className="hn-inbound-skeleton" aria-hidden="true">
              {Array.from({ length: 7 }, (_, i) => (
                <div key={i}>
                  <span />
                  <span />
                  <span />
                  <span />
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <footer className="hn-inbound-pagination">
          <div className="hn-inbound-page-info">
            <span aria-live="polite">
              {query.data
                ? tUi("updatedUi.text_ed9314f2e7c6", {
                    value0: String(first),
                    value1: String(last),
                    value2: String(formatQuantity(total)),
                  })
                : loading
                  ? tUi("updatedUi.text_5412ced1c478")
                  : tUi("updatedUi.text_324e2c9b114d")}
            </span>
            <UiSelect
              value={perPage}
              aria-label={t("inbound.list.pageSizeAria")}
              menuClassName="hn-inbound-menu"
              options={MVP_PAGE_SIZE_OPTIONS.map((size) => ({
                value: size,
                label: `${size} / trang`,
              }))}
              onChange={(value) => {
                setPerPage(Number(value));
                setPage(1);
              }}
            />
          </div>
          <div className="hn-inbound-pagination-controls">
            <UiPagination
              page={currentPage}
              pageSize={perPage}
              total={total}
              showTotal={false}
              onPageChange={setPage}
            />
          </div>
        </footer>
      </section>
      {draftOpen ? (
        <InboundDraftModal
          documentId={draftDocumentId}
          onClose={closeDraftModal}
          onSaved={handleSaved}
        />
      ) : null}
      {scanDocumentId ? (
        <InboundScanModal
          documentId={scanDocumentId}
          onClose={() => setScanDocumentId(null)}
          onChanged={() => void query.refetch()}
          onEdit={canCreate ? () => editDocument(scanDocumentId) : undefined}
        />
      ) : null}
    </div>
  );
}
export default function InboundPage() {
  return <InboundListScreen />;
}
