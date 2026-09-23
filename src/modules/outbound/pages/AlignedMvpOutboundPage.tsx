/* eslint-disable react-hooks/set-state-in-effect */
import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import {
  Menu,
  MenuItem,
  UiAutocomplete,
  UiIcon,
  UiPagination,
  UiSelect,
  UiTextField,
} from "@/shared/ui";
import { invalidateStockDerived } from "@/shared/cache/invalidation";
import { useT } from "@/shared/i18n/useT";
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
import { useClientSort } from "@/shared/components/data-display/useClientSort";
import { AlignedOutboundDetailModal } from "@/modules/outbound/components/AlignedOutboundDetailModal";
import { OutboundIntakeModal } from "@/modules/outbound/components/OutboundIntakeModal";
import { OutboundOverview } from "@/modules/outbound/components/OutboundOverview";
import {
  fetchOutboundDocuments,
  type OutboundDocumentRecord,
  type OutboundStatus,
} from "@/modules/outbound/services/alignedOutboundService";
import { ActionButton, RowActionButton } from "@/shared/components/actions";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { useActiveWarehouses } from "@/shared/data/reference-queries";
import { formatQuantity } from "@/shared/utils/format-number";
import {
  fetchOutboundRecipientIndex,
  fetchOutboundRowsForRecipient,
} from "./outbound-list-data";
import "./outbound-list.css";

const SEARCH_DEBOUNCE_MS = 250;
const STATUS_OPTIONS = Object.entries(OUTBOUND_STATUS_LABELS).map(
  ([value, label]) => ({ value, label }),
);
const DETAIL_SCREENS = new Set(["OUT-03", "OUT-02", "LBL-01", "RFID-01"]);
const SORT_ACCESSORS = {
  code: (row: OutboundDocumentRecord) => row.code || "",
  request: (row: OutboundDocumentRecord) => row.requestNo ?? "",
  recipientName: (row: OutboundDocumentRecord) => row.recipientName,
  date: (row: OutboundDocumentRecord) => row.date || "",
  note: (row: OutboundDocumentRecord) => row.note || "",
  match: (row: OutboundDocumentRecord) =>
    row.expected > 0 ? row.scanned / row.expected : 0,
  status: (row: OutboundDocumentRecord) => row.status,
};
function displayDate(value?: string) {
  if (!value) return EMPTY_TEXT;
  const date = dayjs(value);
  return date.isValid() ? date.format("DD/MM/YYYY HH:mm") : value;
}
function WarehouseContext() {
  const query = useActiveWarehouses();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const warehouse = query.data?.[0];
  const name =
    warehouse?.name == null ? "Kho xuất hàng" : String(warehouse.name);
  return (
    <>
      <button
        type="button"
        className="hn-outbound-warehouse"
        aria-label="Thông tin kho xuất hàng"
        aria-haspopup="menu"
        aria-expanded={Boolean(anchor)}
        onClick={(event) => setAnchor(event.currentTarget)}
      >
        <UiIcon name="warehouse-alt" />
        <span>
          <strong>{name}</strong>
          <small>
            {query.isError ? (
              "Không tải được thông tin kho"
            ) : query.isLoading ? (
              "Đang tải…"
            ) : warehouse ? (
              <>
                <i />
                Đang hoạt động
              </>
            ) : (
              "Chưa có kho khả dụng"
            )}
          </small>
        </span>
        <UiIcon name="angle-small-down" size="sm" />
      </button>
      <Menu
        anchorEl={anchor}
        open={Boolean(anchor)}
        onClose={() => setAnchor(null)}
        slotProps={{ paper: { className: "hn-outbound-menu" } }}
      >
        <li className="hn-outbound-warehouse-information" role="presentation">
          <strong>{name}</strong>
          <span>{warehouse?.code == null ? "" : String(warehouse.code)}</span>
          <span>
            {warehouse
              ? "Kho đang hoạt động trong phạm vi được cấp quyền."
              : "Thông tin kho chưa khả dụng."}
          </span>
        </li>
        {query.isError ? (
          <MenuItem
            onClick={() => {
              void query.refetch();
              setAnchor(null);
            }}
          >
            Thử lại
          </MenuItem>
        ) : null}
      </Menu>
    </>
  );
}

/** OUT-01: presentation and filtering over the existing outbound contracts. */
export default function AlignedMvpOutboundPage() {
  const t = useT();
  const can = useHasPermission();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<OutboundStatus | "">("");
  const [recipient, setRecipient] = useState("");
  const [recipientOptionsOpen, setRecipientOptionsOpen] = useState(false);
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [intakeOpen, setIntakeOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);
  const canImport =
    WMS_ACTION_PERMISSIONS.OUTBOUND_REQUEST_IMPORT.some(can) ||
    WMS_ACTION_PERMISSIONS.OUTBOUND_REQUEST_MANUAL_CREATE.some(can);
  const canScan = can("outbound.scan");
  const listParams = {
    search: search || undefined,
    status: status || undefined,
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
  const loading = listQuery.isLoading || listQuery.isFetching;
  const hasFilters = Boolean(search || status || recipient);
  const first = rows.length
    ? (pagination.current - 1) * pagination.pageSize + 1
    : 0;
  const last = rows.length
    ? Math.min(pagination.total, first + rows.length - 1)
    : 0;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);
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
  const applyFilters = () => {
    const nextSearch = searchInput.trim();
    if (nextSearch === search && page === 1) void listQuery.refetch();
    setSearch(nextSearch);
    setPage(1);
  };
  const resetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setRecipient("");
    setPage(1);
    setSortOrder("desc");
    if (!hasFilters && page === 1 && sortOrder === "desc")
      void listQuery.refetch();
  };
  const requestNumber = (row: OutboundDocumentRecord) =>
    !row.outboundRequestId ? (
      <span className="hn-outbound-data-warning" data-tone="error">
        {t("outbound.list.missingRequest")}
      </span>
    ) : (
      row.requestNo || (
        <span className="hn-outbound-data-warning">
          {t("outbound.list.noRequestNo")}
        </span>
      )
    );
  const progress = (row: OutboundDocumentRecord) => {
    if (row.status === "CANCELLED")
      return <span aria-label="Phiếu đã hủy">{EMPTY_TEXT}</span>;
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
          aria-label={`Đối chiếu ${row.code || t("outbound.list.colDocument")}`}
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
      label={
        key === "code" || key === "recipientName" ? (
          <>
            <span className="hn-outbound-desktop-label">{label}</span>
            <span className="hn-outbound-compact-label">
              {key === "code" ? "Phiếu / Toa" : "Người nhận / Ngày"}
            </span>
          </>
        ) : (
          label
        )
      }
      tooltipLabel={label}
      sortKey={key}
      className={className}
      sortState={sortState}
      onSort={requestSort}
      sortType={
        key === "date" || key === "match" || key === "status" ? "value" : "text"
      }
    />
  );

  return (
    <div className="outbound-page hn-mvp-source-screen hn-outbound-list">
      <header className="hn-outbound-header">
        <div>
          <h1>Phiếu xuất kho</h1>
          <p>Tiếp nhận, quản lý và theo dõi tiến độ xuất kho từ Scanner App</p>
        </div>
        <div className="hn-outbound-header-actions">
          <WarehouseContext />
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
      <OutboundOverview
        onRefresh={() => {
          void listQuery.refetch();
        }}
      />
      <section
        className="hn-outbound-list-card"
        aria-labelledby="hn-outbound-list-title"
      >
        <div className="hn-outbound-list-heading">
          <h2 id="hn-outbound-list-title">
            Danh sách phiếu xuất{" "}
            <span>
              {listQuery.data ? formatQuantity(pagination.total) : EMPTY_TEXT}
            </span>
          </h2>
          <div className="hn-outbound-sort">
            <UiSelect
              value={sortOrder}
              aria-label={t("outbound.list.sortAria")}
              menuClassName="hn-outbound-menu"
              options={[
                { value: "desc", label: "Cập nhật mới nhất" },
                { value: "asc", label: t("outbound.list.sortOldest") },
              ]}
              onChange={(value) => {
                setSortOrder(value === "asc" ? "asc" : "desc");
                setPage(1);
              }}
            />
          </div>
        </div>
        <form
          className="hn-outbound-filters"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <div className="hn-outbound-filter hn-outbound-search">
            <label htmlFor="hn-outbound-search">Tìm kiếm</label>
            <div className="hn-outbound-search-field">
              <UiIcon name="search" />
              <UiTextField
                id="hn-outbound-search"
                value={searchInput}
                placeholder="Mã phiếu hoặc ghi chú…"
                fullWidth
                slotProps={{
                  htmlInput: { "aria-label": t("outbound.list.searchAria") },
                }}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              {searchInput ? (
                <button
                  type="button"
                  className="hn-outbound-search-clear"
                  aria-label="Xóa từ khóa tìm kiếm"
                  onClick={() => setSearchInput("")}
                >
                  <UiIcon name="cross-small" size="sm" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="hn-outbound-filter">
            <label htmlFor="hn-outbound-status">Trạng thái</label>
            <UiSelect
              id="hn-outbound-status"
              value={status}
              fullWidth
              displayEmpty
              searchable={false}
              aria-label={t("outbound.list.statusFilterAria")}
              menuClassName="hn-outbound-menu"
              options={[{ value: "", label: "Tất cả" }, ...STATUS_OPTIONS]}
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
            <label id="hn-outbound-recipient-label">Người nhận</label>
            <UiAutocomplete
              aria-label="Lọc người nhận"
              value={recipient || null}
              placeholder="Tất cả"
              options={recipientOptions}
              loading={recipientQuery.isFetching}
              noOptionsText={
                recipientQuery.isError
                  ? "Không tải được người nhận"
                  : "Không tìm thấy người nhận"
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
                Thử lại danh sách người nhận
              </button>
            ) : null}
          </div>
          <ActionButton
            kind="filter"
            type="submit"
            className="hn-outbound-apply"
            icon={<></>}
            disabled={loading}
          >
            Áp dụng
          </ActionButton>
          <ActionButton
            kind="reset"
            type="button"
            className="hn-outbound-reset"
            icon={<></>}
            onClick={resetFilters}
          >
            Đặt lại
          </ActionButton>
        </form>
        {listQuery.isError ? (
          <div className="hn-outbound-error">
            <ApiErrorAlert
              error={listQuery.error}
              title={t("outbound.list.loadError")}
              onRetry={() => listQuery.refetch()}
            />
          </div>
        ) : null}
        <div
          className={`hn-outbound-table-region${loading ? " is-loading" : ""}`}
          aria-busy={loading}
        >
          {loading ? (
            <div
              className="hn-outbound-loading"
              role="status"
              {...uiStateProps(UI_STATE.LOADING, "ui-state-loading-table")}
            >
              {rows.length
                ? "Đang cập nhật danh sách…"
                : "Đang tải danh sách phiếu xuất…"}
            </div>
          ) : null}
          <table className="hn-outbound-table">
            <thead>
              <tr>
                {sortHeader(
                  t("outbound.list.colDocument"),
                  "code",
                  "hn-outbound-col-code",
                )}
                {sortHeader(
                  t("outbound.list.colRequestNo"),
                  "request",
                  "hn-outbound-col-request",
                )}
                {sortHeader(
                  t("outbound.list.colRecipient"),
                  "recipientName",
                  "hn-outbound-col-recipient",
                )}
                {sortHeader(
                  t("outbound.list.colCreated"),
                  "date",
                  "hn-outbound-col-date",
                )}
                {sortHeader(
                  t("outbound.list.colNote"),
                  "note",
                  "hn-outbound-col-note",
                )}
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
                <th className="hn-outbound-col-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.id}>
                  <td className="hn-outbound-code">
                    <strong>{row.code || EMPTY_TEXT}</strong>
                  </td>
                  <td className="hn-outbound-request">{requestNumber(row)}</td>
                  <td className="hn-outbound-recipient-cell">
                    {row.recipientName || EMPTY_TEXT}
                  </td>
                  <td className="hn-outbound-date">{displayDate(row.date)}</td>
                  <td className="hn-outbound-note">{row.note || EMPTY_TEXT}</td>
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
                  ? "Chưa tải được danh sách phiếu xuất"
                  : hasFilters
                    ? "Không tìm thấy phiếu xuất phù hợp"
                    : t("outbound.list.empty")}
              </strong>
              <span>
                {listQuery.isError
                  ? "Sử dụng nút Thử lại để tải lại dữ liệu."
                  : hasFilters
                    ? "Thử từ khóa khác hoặc đặt lại bộ lọc."
                    : "Phiếu xuất sẽ xuất hiện tại đây sau khi tiếp nhận yêu cầu."}
              </span>
              {hasFilters && !listQuery.isError ? (
                <ActionButton kind="reset" onClick={resetFilters}>
                  Đặt lại bộ lọc
                </ActionButton>
              ) : null}
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
                </div>
              ))}
            </div>
          ) : null}
        </div>
        <footer className="hn-outbound-pagination">
          <span aria-live="polite">
            {listQuery.data
              ? `Hiển thị ${first} – ${last} / ${formatQuantity(pagination.total)} phiếu`
              : loading
                ? "Đang tải số lượng phiếu…"
                : "Chưa có số liệu danh sách"}
          </span>
          <div className="hn-outbound-pagination-controls">
            <UiSelect
              value={perPage}
              aria-label={t("outbound.list.pageSizeAria")}
              menuClassName="hn-outbound-menu"
              options={MVP_PAGE_SIZE_OPTIONS.map((size) => ({
                value: size,
                label: `${size} / trang`,
              }))}
              onChange={(value) => {
                setPerPage(Number(value));
                setPage(1);
              }}
            />
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
      {intakeOpen ? (
        <OutboundIntakeModal
          open
          canImport={canImport}
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
