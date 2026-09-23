import { useEffect, useState } from "react";
import dayjs from "dayjs";
import { useSearchParams } from "react-router-dom";
import {
  Menu,
  MenuItem,
  UiIcon,
  UiPagination,
  UiSelect,
  UiTextField,
} from "@/shared/ui";
import {
  ActionButton,
  RowActionButton,
  RowActionGroup,
} from "@/shared/components/actions";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { SortableTh } from "@/shared/components/data-display/SortableTh";
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
import { useActiveWarehouses } from "@/shared/data/reference-queries";
import { useT } from "@/shared/i18n/useT";
import { InboundDraftModal } from "@/modules/inbound/components/InboundDraftModal";
import { InboundOverview } from "@/modules/inbound/components/InboundOverview";
import { useInboundDocuments } from "@/modules/inbound/hooks/use-inbound";
import { InboundScanModal } from "@/modules/inbound/pages/MvpInboundScreens";
import type { InboundDocument } from "@/modules/inbound/types";
import { formatQuantity } from "@/shared/utils/format-number";
import "./inbound-list.css";

const STATUS_OPTIONS = Object.entries(INBOUND_STATUS_LABELS).map(
  ([value, label]) => ({
    value,
    label: value === "SCANNING" ? "Đang ghi nhận" : label,
  }),
);
const SORT_ACCESSORS = {
  code: (row: InboundDocument) => row.code,
  source: (row: InboundDocument) => row.source,
  scanned: (row: InboundDocument) => row.scanned,
  createdBy: (row: InboundDocument) => row.createdBy,
  status: (row: InboundDocument) => row.status,
  updatedAt: (row: InboundDocument) => row.updatedAt ?? row.date,
};

function displayValue(value?: string) {
  return !value || value === "-" ? EMPTY_TEXT : value;
}
function displayDate(value?: string, format = "DD/MM/YYYY HH:mm") {
  if (!value) return EMPTY_TEXT;
  const date = dayjs(value);
  return date.isValid() ? date.format(format) : value;
}
function useInboundPermission(code: string) {
  const permissionCodes = useAuthStore((state) => state.permissionCodes);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  return hasAnyWmsPermission(permissionCodes, [code], isSuperAdmin);
}
function WarehouseContext() {
  const query = useActiveWarehouses();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  const warehouse = query.data?.[0];
  const name =
    warehouse?.name == null ? "Kho nhập hàng" : String(warehouse.name);
  return (
    <>
      <button
        type="button"
        className="hn-inbound-warehouse"
        aria-label="Thông tin kho nhập hàng"
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
        slotProps={{ paper: { className: "hn-inbound-menu" } }}
      >
        <li className="hn-inbound-menu-information" role="presentation">
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
        <MenuItem onClick={() => setAnchor(null)}>Đóng</MenuItem>
      </Menu>
    </>
  );
}

function InboundListScreen() {
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<string | undefined>();
  const [pendingInfo, setPendingInfo] = useState<boolean | undefined>();
  const [sortOrder, setSortOrder] = useState<"desc" | "asc">("desc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftDocumentId, setDraftDocumentId] = useState<string | null>(null);
  const [scanDocumentId, setScanDocumentId] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<{
    anchor: HTMLElement;
    row: InboundDocument;
  } | null>(null);
  const canCreate = useInboundPermission(P.INBOUND_CREATE);
  const canScan = useInboundPermission(P.INBOUND_SCAN);
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
    searchInput || status || pendingInfo !== undefined,
  );

  useEffect(() => {
    const requestedScreen = searchParams.get("screen");
    if (requestedScreen !== "IN-02" && requestedScreen !== "IN-03") return;
    const id = searchParams.get("id");
    if (requestedScreen === "IN-02") {
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
    setDraftDocumentId(id);
    setDraftOpen(true);
    setRowMenu(null);
  };
  const openDocument = (id: string) => {
    setScanDocumentId(id);
    setRowMenu(null);
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
          ? "Đang ghi nhận"
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
      {formatQuantity(row.scanned)} đã quét
    </>
  );
  const rowActions = (row: InboundDocument) => {
    const editable = row.status === "DRAFT" && canCreate;
    const tracking = row.status === "SCANNING";
    return (
      <RowActionGroup className="hn-inbound-row-actions">
        <RowActionButton
          kind={editable ? "edit" : "view"}
          onClick={() =>
            editable ? editDocument(row.id) : openDocument(row.id)
          }
        >
          {editable ? "Chỉnh sửa" : tracking ? "Theo dõi" : "Chi tiết"}
        </RowActionButton>
        <RowActionButton
          kind="more"
          aria-label={`Thao tác khác cho ${displayValue(row.code)}`}
          aria-haspopup="menu"
          aria-expanded={rowMenu?.row.id === row.id}
          onClick={(event) => setRowMenu({ anchor: event.currentTarget, row })}
        />
      </RowActionGroup>
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
      sortType={key === "scanned" || key === "updatedAt" ? "value" : "text"}
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
          <h1>Phiếu nhập kho</h1>
          <p>Tạo phiếu, quản lý và theo dõi tiến độ nhập kho từ Scanner App</p>
        </div>
        <div className="hn-inbound-header-actions">
          <WarehouseContext />
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
      <InboundOverview
        onRefresh={() => {
          void query.refetch();
        }}
      />
      <section
        className="hn-inbound-list-card"
        aria-labelledby="hn-inbound-list-title"
      >
        <div className="hn-inbound-list-heading">
          <h2 id="hn-inbound-list-title">
            Danh sách phiếu nhập{" "}
            <span>{query.data ? formatQuantity(total) : EMPTY_TEXT}</span>
          </h2>
          <div className="hn-inbound-sort">
            <UiSelect
              value={sortOrder}
              aria-label={t("inbound.list.sortAria")}
              menuClassName="hn-inbound-menu"
              options={[
                { value: "desc", label: "Cập nhật mới nhất" },
                { value: "asc", label: t("inbound.list.sortOldest") },
              ]}
              onChange={(value) => {
                setSortOrder(value === "asc" ? "asc" : "desc");
                setPage(1);
              }}
            />
          </div>
        </div>
        <form
          className="hn-inbound-filters"
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters();
          }}
        >
          <div className="hn-inbound-filter hn-inbound-search">
            <label htmlFor="hn-inbound-search">Tìm kiếm</label>
            <div className="hn-inbound-search-field">
              <UiIcon name="search" />
              <UiTextField
                id="hn-inbound-search"
                value={searchInput}
                placeholder="Mã phiếu, nguồn hoặc tham chiếu…"
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
                  aria-label="Xóa từ khóa tìm kiếm"
                  onClick={() => setSearchInput("")}
                >
                  <UiIcon name="cross-small" size="sm" />
                </button>
              ) : null}
            </div>
          </div>
          <div className="hn-inbound-filter">
            <label htmlFor="hn-inbound-status-filter">Trạng thái</label>
            <UiSelect
              id="hn-inbound-status-filter"
              fullWidth
              displayEmpty
              value={status ?? ""}
              aria-label={t("inbound.list.statusFilterAria")}
              menuClassName="hn-inbound-menu"
              options={[{ value: "", label: "Tất cả" }, ...STATUS_OPTIONS]}
              onChange={(value) => {
                setStatus(value || undefined);
                setPage(1);
              }}
            />
          </div>
          <div className="hn-inbound-filter">
            <label htmlFor="hn-inbound-info-filter">Thông tin SKU</label>
            <UiSelect
              id="hn-inbound-info-filter"
              fullWidth
              displayEmpty
              value={pendingInfo === undefined ? "" : pendingInfo ? "1" : "0"}
              aria-label={t("inbound.list.infoFilterAria")}
              menuClassName="hn-inbound-menu"
              options={[
                { value: "", label: "Tất cả" },
                { value: "1", label: t("inbound.list.infoFilterPending") },
                { value: "0", label: t("inbound.list.infoFilterComplete") },
              ]}
              onChange={(value) => {
                setPendingInfo(value === "" ? undefined : value === "1");
                setPage(1);
              }}
            />
          </div>
          <ActionButton
            kind="filter"
            type="submit"
            className="hn-inbound-apply"
            icon={<></>}
          >
            Áp dụng
          </ActionButton>
          <ActionButton
            kind="reset"
            type="button"
            className="hn-inbound-reset"
            icon={<></>}
            onClick={resetFilters}
          >
            Đặt lại
          </ActionButton>
        </form>
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
                ? "Đang cập nhật danh sách…"
                : "Đang tải danh sách phiếu nhập…"}
            </div>
          ) : null}
          <table className="hn-inbound-table">
            <thead>
              <tr>
                {sortHeader("Phiếu", "code", "hn-inbound-col-code")}
                {sortHeader(
                  "Nguồn / Tham chiếu",
                  "source",
                  "hn-inbound-col-source",
                )}
                {sortHeader(
                  "Tiến độ ghi nhận",
                  "scanned",
                  "hn-inbound-desktop hn-inbound-col-progress",
                )}
                {sortHeader(
                  "Người tạo",
                  "createdBy",
                  "hn-inbound-desktop hn-inbound-col-creator",
                )}
                {sortHeader("Trạng thái", "status", "hn-inbound-col-status")}
                {sortHeader(
                  "Cập nhật",
                  "updatedAt",
                  "hn-inbound-desktop hn-inbound-col-date",
                )}
                <th className="hn-inbound-col-actions">Thao tác</th>
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row) => (
                <tr key={row.id}>
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
                    <span className="hn-inbound-compact hn-inbound-secondary">
                      {displayValue(row.createdBy)} ·{" "}
                      {displayDate(row.updatedAt ?? row.date)}
                    </span>
                  </td>
                  <td className="hn-inbound-desktop hn-inbound-progress-cell">
                    {progress(row)}
                  </td>
                  <td
                    className="hn-inbound-desktop hn-inbound-creator"
                    title={displayValue(row.createdBy)}
                  >
                    {displayValue(row.createdBy)}
                  </td>
                  <td className="hn-inbound-status-cell">{statusBadge(row)}</td>
                  <td className="hn-inbound-desktop hn-inbound-date">
                    <span>
                      {displayDate(row.updatedAt ?? row.date, "DD/MM/YYYY")}
                    </span>
                    <small>
                      {displayDate(row.updatedAt ?? row.date, "HH:mm")}
                    </small>
                  </td>
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
                  ? "Chưa tải được danh sách phiếu nhập"
                  : hasFilters
                    ? "Không tìm thấy phiếu nhập phù hợp"
                    : t("inbound.list.empty")}
              </strong>
              <span>
                {query.isError
                  ? "Sử dụng nút Thử lại để tải lại dữ liệu."
                  : hasFilters
                    ? "Thử từ khóa khác hoặc đặt lại bộ lọc."
                    : "Phiếu nhập sẽ xuất hiện tại đây khi được tạo."}
              </span>
              {hasFilters && !query.isError ? (
                <ActionButton kind="reset" onClick={resetFilters}>
                  Đặt lại bộ lọc
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
          <span aria-live="polite">
            {query.data
              ? `Hiển thị ${first} – ${last} / ${formatQuantity(total)} phiếu`
              : loading
                ? "Đang tải số lượng phiếu…"
                : "Chưa có số liệu danh sách"}
          </span>
          <div className="hn-inbound-pagination-controls">
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
      <Menu
        anchorEl={rowMenu?.anchor}
        open={Boolean(rowMenu)}
        onClose={() => setRowMenu(null)}
        slotProps={{ paper: { className: "hn-inbound-menu" } }}
      >
        {rowMenu ? (
          <li className="hn-inbound-menu-information" role="presentation">
            <strong>{displayValue(rowMenu.row.code)}</strong>
            <span>Ngày tạo: {displayDate(rowMenu.row.date)}</span>
            <span>Người tạo: {displayValue(rowMenu.row.createdBy)}</span>
            <span>Ghi chú: {displayValue(rowMenu.row.note)}</span>
          </li>
        ) : null}
        {rowMenu ? (
          <MenuItem onClick={() => openDocument(rowMenu.row.id)}>
            <UiIcon name="eye" size="sm" />
            {(rowMenu.row.status === "DRAFT" ||
              rowMenu.row.status === "SCANNING") &&
            canScan
              ? rowMenu.row.status === "DRAFT"
                ? t("inbound.list.startScan")
                : t("inbound.list.continueScan")
              : t("inbound.list.view")}
          </MenuItem>
        ) : null}
        {rowMenu &&
        canCreate &&
        (rowMenu.row.status === "DRAFT" ||
          rowMenu.row.status === "SCANNING") ? (
          <MenuItem onClick={() => editDocument(rowMenu.row.id)}>
            <UiIcon name="pencil" size="sm" />
            {t("inbound.list.editInfo")}
          </MenuItem>
        ) : null}
      </Menu>
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
        />
      ) : null}
    </div>
  );
}
export default function InboundPage() {
  return <InboundListScreen />;
}
