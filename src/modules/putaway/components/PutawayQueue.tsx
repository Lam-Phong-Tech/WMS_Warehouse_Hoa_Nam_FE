import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";
import { useMemo, useState, type ReactNode } from "react";
import { UiIcon, UiPagination, UiSelect, FILTER_WIDTH } from "@/shared/ui";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import { SortableTh } from "@/shared/components/data-display/SortableTh";
import { useClientSort } from "@/shared/components/data-display/useClientSort";
import { ActionDropdown } from "@/shared/components/feedback/ActionDropdown";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/shared/constants/table-pagination";
import type { PutawayTask } from "../services/putawayService";
import "./putaway-queue-refresh.css";

const SORT = {
  box_code: (row: PutawayTask) => row.box_code,
  sku_code: (row: PutawayTask) => row.sku_code,
  sku_name: (row: PutawayTask) => row.sku_name,
  receipt_code: (row: PutawayTask) => row.receipt_code,
  quantity: (row: PutawayTask) => row.quantity,
  status: (row: PutawayTask) => row.status,
  draft: (row: PutawayTask) => row.to_tray_code,
};
const number = (value: number) => value.toLocaleString("vi-VN");

type Props = {
  tasks: PutawayTask[];
  orders: boolean;
  loading: boolean;
  refreshing: boolean;
  error: ReactNode;
  canManage: boolean;
  search: string;
  onSearch: (value: string) => void;
  onApplySearch: () => void;
  onRefresh: () => void;
  onView: (row: PutawayTask) => void;
  onCreate: (row: PutawayTask) => void;
  onCreateMany: (rows: PutawayTask[]) => void;
  onConfirm: (row: PutawayTask) => void;
  onCancel: (row: PutawayTask) => void;
  onConfirmMany: (rows: PutawayTask[]) => void;
  onCancelMany: (rows: PutawayTask[]) => void;
};

export function PutawayQueue(props: Props) {
  const t = useT();
  const { tasks, orders, loading, refreshing, error, canManage } = props;
  const [filters, setFilters] = useState({
    receipt: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(TABLE_PAGE_SIZE_OPTIONS[0]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const baseRows = useMemo(
    () =>
      tasks.filter((row) => (orders ? Boolean(row.draft_id) : !row.draft_id)),
    [tasks, orders],
  );
  const receipts = useMemo(
    () =>
      [
        ...new Set(
          [...baseRows.map((row) => row.receipt_code), filters.receipt].filter(
            (code): code is string => Boolean(code),
          ),
        ),
      ].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })),
    [baseRows, filters.receipt],
  );
  const rows = useMemo(
    () =>
      baseRows.filter(
        (row) => !filters.receipt || row.receipt_code === filters.receipt,
      ),
    [baseRows, filters.receipt],
  );
  const { sortedRows, sortState, requestSort } = useClientSort(rows, SORT);
  const safePage = Math.min(
    page,
    Math.max(1, Math.ceil(rows.length / pageSize)),
  );
  const pageRows = sortedRows.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize,
  );
  const selectedRows = rows.filter((row) => selectedIds.has(row.id));
  const multiPending =
    !orders &&
    selectedRows.length >= 2 &&
    selectedRows.every((row) => row.status === "RECEIVED_PENDING_PUTAWAY");
  const multiOrders =
    orders &&
    selectedRows.length >= 2 &&
    selectedRows.every((row) => Boolean(row.draft_id));
  const allChecked =
    pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));
  const someChecked = pageRows.some((row) => selectedIds.has(row.id));
  const columnCount = orders ? 9 : 7;
  const toggle = (id: string, checked: boolean) =>
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  const sort = (key: string) => {
    requestSort(key);
    setPage(1);
  };
  const heading = orders
    ? t("putaway.queue.ordersList")
    : t("putaway.queue.pendingList");
  return (
    <>
      <form
        className="ptw-filters"
        aria-label={t("putaway.queue.filtersAria")}
        onSubmit={(event) => {
          event.preventDefault();
          props.onApplySearch();
        }}
      >
        <div className="ptw-search">
          <label className="ptw-visually-hidden" htmlFor="ptw-search">
            {t("putaway.queue.search")}
          </label>
          <div className="ptw-search-control">
            <UiIcon name="search" />
            <input
              id="ptw-search"
              type="search"
              value={props.search}
              placeholder={t("putaway.queue.searchPlaceholder")}
              onChange={(event) => {
                props.onSearch(event.target.value);
                setPage(1);
                setSelectedIds(new Set());
              }}
            />
          </div>
        </div>
        <div className="ptw-receipt-filter">
          <label className="ptw-inline-label" htmlFor="ptw-receipt">
            {t("putaway.queue.receipt")}:
          </label>
          <UiSelect
            id="ptw-receipt"
            aria-label={t("putaway.queue.receipt")}
            fullWidth
            displayEmpty
            menuClassName="ptw-filter-menu"
            value={filters.receipt}
            onChange={(receipt) => {
              setFilters((current) => ({ ...current, receipt }));
              setPage(1);
              setSelectedIds(new Set());
            }}
            options={[
              { value: "", label: t("putaway.queue.all") },
              ...receipts.map((value) => ({ value, label: value })),
            ]}
          />
        </div>
      </form>
      {error ? (
        <div className="ptw-error" role="status">
          {error}
          <button
            className="ptw-row-action"
            onClick={props.onRefresh}
            disabled={refreshing}
          >
            {t("common.retry")}
          </button>
        </div>
      ) : null}
      <section
        className="ptw-list"
        data-queue={orders ? "orders" : "pending"}
        aria-label={heading}
        aria-busy={loading || refreshing}
      >
        {!loading && !error && selectedRows.length ? (
          <div className="ptw-selection" role="status">
            <span>
              {t("putaway.queue.selectedCount", { count: selectedRows.length })}
            </span>
            <div className="ptw-selection-actions">
              {!orders &&
              selectedRows.length === 1 &&
              selectedRows[0].status === "RECEIVED_PENDING_PUTAWAY" ? (
                <button
                  type="button"
                  className="ptw-row-action"
                  disabled={!canManage}
                  onClick={() => props.onCreate(selectedRows[0])}
                >
                  {t("putaway.queue.createSelected")}
                </button>
              ) : null}
              {multiPending ? (
                <button
                  type="button"
                  className="ptw-row-action ptw-selection-action"
                  disabled={!canManage}
                  onClick={() => props.onCreateMany(selectedRows)}
                >
                  {t("putaway.queue.packMultiple")}
                </button>
              ) : null}
              {multiOrders ? (
                <>
                  <button
                    type="button"
                    className="ptw-row-action ptw-selection-action"
                    disabled={!canManage}
                    onClick={() => props.onConfirmMany(selectedRows)}
                  >
                    {t("putaway.queue.confirm")}
                  </button>
                  <button
                    type="button"
                    className="ptw-row-action ptw-selection-action is-danger"
                    disabled={!canManage}
                    onClick={() => props.onCancelMany(selectedRows)}
                  >
                    {t("putaway.queue.cancelDraft")}
                  </button>
                </>
              ) : null}
              <button
                type="button"
                className="ptw-text-button"
                onClick={() => setSelectedIds(new Set())}
              >
                {t("putaway.queue.clearSelection")}
              </button>
            </div>
          </div>
        ) : null}
        <div
          className="ptw-table-wrap"
          role="region"
          aria-label={heading}
          tabIndex={0}
        >
          <table className="ptw-table">
            <thead>
              <tr>
                <th className="ptw-check-col">
                  <input
                    type="checkbox"
                    aria-label={t("putaway.queue.selectPage")}
                    checked={allChecked}
                    ref={(node) => {
                      if (node) node.indeterminate = someChecked && !allChecked;
                    }}
                    disabled={!pageRows.length || loading || Boolean(error)}
                    onChange={(event) => {
                      const checked = event.target.checked;
                      setSelectedIds((current) => {
                        const next = new Set(current);
                        pageRows.forEach((row) => {
                          if (checked) next.add(row.id);
                          else next.delete(row.id);
                        });
                        return next;
                      });
                    }}
                  />
                </th>
                <SortableTh
                  label={t("putaway.queue.boxCode")}
                  sortKey="box_code"
                  sortState={sortState}
                  onSort={sort}
                  className="ptw-box-col"
                />
                {orders ? (
                  <SortableTh
                    label="SKU"
                    sortKey="sku_code"
                    sortState={sortState}
                    onSort={sort}
                    className="ptw-sku-col"
                  />
                ) : null}
                <SortableTh
                  label={t("putaway.queue.componentName")}
                  sortKey="sku_name"
                  sortState={sortState}
                  onSort={sort}
                  className="ptw-name-col"
                />
                <SortableTh
                  label={t("putaway.queue.receipt")}
                  sortKey="receipt_code"
                  sortState={sortState}
                  onSort={sort}
                  className="ptw-receipt-col"
                />
                <SortableTh
                  label={t("putaway.queue.quantity")}
                  sortKey="quantity"
                  sortState={sortState}
                  onSort={sort}
                  className="ptw-quantity-col"
                  sortType="value"
                />
                <SortableTh
                  label={t("putaway.queue.status")}
                  sortKey="status"
                  sortState={sortState}
                  onSort={sort}
                  className="ptw-status-col"
                />
                {orders ? (
                  <SortableTh
                    label={t("putaway.queue.plannedTray")}
                    sortKey="draft"
                    sortState={sortState}
                    onSort={sort}
                    className="ptw-updated-col"
                  />
                ) : null}
                <th
                  className="ptw-action-col"
                  aria-label={t("putaway.queue.actions")}
                />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 7 }, (_, i) => (
                  <tr className="ptw-loading" key={i} aria-hidden="true">
                    {Array.from({ length: columnCount }, (_, j) => (
                      <td key={j}>
                        <span />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={columnCount} className="ptw-empty">
                    {t("putaway.queue.loadFailed")}
                  </td>
                </tr>
              ) : !pageRows.length ? (
                <tr>
                  <td colSpan={columnCount} className="ptw-empty">
                    <UiIcon name="cube" size="lg" />
                    <strong>
                      {props.search || filters.receipt
                        ? t("putaway.queue.emptyFiltered")
                        : orders
                          ? t("putaway.queue.emptyOrders")
                          : t("putaway.queue.emptyPending")}
                    </strong>
                    <span>
                      {props.search || filters.receipt
                        ? t("putaway.queue.emptyFilteredHint")
                        : t("putaway.queue.emptyHint")}
                    </span>
                    <button
                      type="button"
                      className="ptw-row-action"
                      onClick={props.onRefresh}
                      disabled={refreshing}
                    >
                      {refreshing
                        ? t("putaway.queue.refreshing")
                        : t("putaway.queue.refresh")}
                    </button>
                  </td>
                </tr>
              ) : (
                pageRows.map((row) => {
                  return (
                    <tr
                      key={row.id}
                      className={
                        selectedIds.has(row.id) ? "is-selected" : undefined
                      }
                    >
                      <td className="ptw-check-col">
                        <input
                          type="checkbox"
                          aria-label={t("putaway.queue.selectBox", {
                            code: row.box_code,
                          })}
                          checked={selectedIds.has(row.id)}
                          onChange={(event) =>
                            toggle(row.id, event.target.checked)
                          }
                        />
                      </td>
                      <td className="ptw-box-col">
                        <span className="ptw-box-cell">
                          <button
                            type="button"
                            className="ptw-text-button"
                            title={t("putaway.queue.viewBox", {
                              code: row.box_code,
                            })}
                            onClick={() => props.onView(row)}
                          >
                            {row.box_code}
                          </button>
                        </span>
                      </td>
                      {orders ? (
                        <td className="ptw-sku-col">
                          <SkuLink code={row.sku_code} />
                        </td>
                      ) : null}
                      <td className="ptw-name-col">{row.sku_name || "—"}</td>
                      <td className="ptw-receipt-col">
                        {row.receipt_code || "—"}
                      </td>
                      <td className="ptw-quantity-col">
                        {number(row.quantity)}
                      </td>
                      <td className="ptw-status-col">
                        <span
                          className={`ptw-badge${row.status === "STORED" ? " is-stored" : ""}`}
                        >
                          {row.status === "STORED"
                            ? t("putaway.queue.storedStatus")
                            : t("putaway.queue.pendingStatus")}
                        </span>
                      </td>
                      {orders ? (
                        <td className="ptw-updated-col">
                          {row.to_tray_code || t("putaway.queue.notChosen")}
                        </td>
                      ) : null}
                      <td className="ptw-action-col">
                        {/* MUI 9 removed system props; alignment must be in sx. */}
                        <RowActionGroup
                          sx={{ justifyContent: "center", width: "100%" }}
                        >
                          {row.draft_id ? (
                            <ActionDropdown
                              row
                              tooltip={t("putaway.queue.boxActions", {
                                code: row.box_code,
                              })}
                              items={[
                                {
                                  key: "confirm",
                                  kind: "confirm",
                                  label: t("putaway.queue.confirm"),
                                  disabled: !canManage,
                                  onClick: () => props.onConfirm(row),
                                },
                                {
                                  key: "cancel",
                                  kind: "cancel",
                                  label: t("putaway.queue.cancelDraft"),
                                  danger: true,
                                  disabled: !canManage,
                                  onClick: () => props.onCancel(row),
                                },
                              ]}
                            />
                          ) : row.status === "RECEIVED_PENDING_PUTAWAY" ? (
                            <RowActionButton
                              kind="create"
                              disabled={!canManage}
                              title={
                                !canManage
                                  ? t("putaway.queue.createForbidden")
                                  : t("putaway.queue.createForBox", {
                                      code: row.box_code,
                                    })
                              }
                              onClick={() => props.onCreate(row)}
                            >
                              {t("putaway.queue.create")}
                            </RowActionButton>
                          ) : (
                            <RowActionButton
                              kind="view"
                              onClick={() => props.onView(row)}
                            >
                              {t("putaway.queue.view")}
                            </RowActionButton>
                          )}
                        </RowActionGroup>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {loading ? (
          <span className="ptw-sr-only" role="status">
            {t("putaway.queue.loading")}
          </span>
        ) : null}
        <footer className="ptw-footer">
          <div className="ptw-footer-start">
            <span className="ptw-range">
              {t("putaway.queue.showing")}{" "}
              {loading || error || !rows.length
                ? 0
                : (safePage - 1) * pageSize + 1}
              –
              {loading || error
                ? 0
                : Math.min(safePage * pageSize, rows.length)}{" "}
              / {loading || error ? 0 : number(rows.length)} BOX
            </span>
            <label className="ptw-page-size">
              <span>{t("putaway.queue.rows")}</span>
              <UiSelect
                aria-label={t("putaway.queue.rowsPerPage")}
                value={pageSize}
                minWidth={FILTER_WIDTH.pageSize}
                options={TABLE_PAGE_SIZE_OPTIONS.map((size) => ({
                  value: size,
                  label: t("shared.table.perPage", { size }),
                }))}
                onChange={(value) => {
                  setPageSize(Number(value));
                  setPage(1);
                }}
              />
            </label>
          </div>
          <UiPagination
            page={safePage}
            pageSize={pageSize}
            total={error ? 0 : rows.length}
            onPageChange={setPage}
            showTotal={false}
            disabled={loading || Boolean(error)}
          />
        </footer>
      </section>
    </>
  );
}
