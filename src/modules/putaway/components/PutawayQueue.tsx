import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import dayjs from "dayjs";
import { useT } from "@/shared/i18n/useT";
import { useMemo, useState, type ReactNode } from "react";
import { UiIcon, UiPagination, UiSelect } from "@/shared/ui";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import { SortableTh } from "@/shared/components/data-display/SortableTh";
import { useClientSort } from "@/shared/components/data-display/useClientSort";
import { ActionDropdown } from "@/shared/components/feedback/ActionDropdown";
import { formatDateTime } from "@/shared/utils/format-date";
import type { PutawayTask } from "../services/putawayService";

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

// The task contract does not require a timestamp. Never replace missing API
// information with the sample times from the design or the query refresh time.
function updatedAt(row: PutawayTask) {
  if (!("updated_at" in row) || typeof row.updated_at !== "string") return null;
  return Number.isNaN(Date.parse(row.updated_at)) ? null : row.updated_at;
}

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
  onConfirm: (row: PutawayTask) => void;
  onCancel: (row: PutawayTask) => void;
};

export function PutawayQueue(props: Props) {
  const t = useT();
  const { tasks, orders, loading, refreshing, error, canManage } = props;
  const [statusDraft, setStatusDraft] = useState("RECEIVED_PENDING_PUTAWAY");
  const [receiptDraft, setReceiptDraft] = useState("");
  const [filters, setFilters] = useState({
    status: "RECEIVED_PENDING_PUTAWAY",
    receipt: "",
  });
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(7);
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
          [
            ...baseRows.map((row) => row.receipt_code),
            receiptDraft,
            filters.receipt,
          ].filter((code): code is string => Boolean(code)),
        ),
      ].sort((a, b) => a.localeCompare(b, "vi", { numeric: true })),
    [baseRows, receiptDraft, filters.receipt],
  );
  const rows = useMemo(
    () =>
      baseRows.filter(
        (row) =>
          (!filters.status || row.status === filters.status) &&
          (!filters.receipt || row.receipt_code === filters.receipt),
      ),
    [baseRows, filters],
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
  const allChecked =
    pageRows.length > 0 && pageRows.every((row) => selectedIds.has(row.id));
  const someChecked = pageRows.some((row) => selectedIds.has(row.id));
  const totalQuantity = rows.reduce((sum, row) => sum + row.quantity, 0);
  const skuCount = new Set(rows.map((row) => row.sku_id || row.sku_code)).size;
  const reset = () => {
    props.onSearch("");
    setStatusDraft("RECEIVED_PENDING_PUTAWAY");
    setReceiptDraft("");
    setFilters({ status: "RECEIVED_PENDING_PUTAWAY", receipt: "" });
    setPage(1);
    setSelectedIds(new Set());
  };
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
          setFilters({ status: statusDraft, receipt: receiptDraft });
          setPage(1);
          setSelectedIds(new Set());
        }}
      >
        <div className="ptw-search">
          <label htmlFor="ptw-search">{t("putaway.queue.search")}</label>
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
        <div className="ptw-status-filter">
          <label htmlFor="ptw-status">{t("putaway.queue.boxStatus")}</label>
          <UiSelect
            id="ptw-status"
            aria-label={t("putaway.queue.boxStatus")}
            fullWidth
            displayEmpty
            searchable={false}
            menuClassName="ptw-filter-menu"
            value={statusDraft}
            onChange={setStatusDraft}
            options={[
              {
                value: "RECEIVED_PENDING_PUTAWAY",
                label: t("putaway.queue.pendingStatus"),
              },
              { value: "", label: t("putaway.queue.all") },
              { value: "STORED", label: t("putaway.queue.storedStatus") },
            ]}
          />
        </div>
        <div className="ptw-receipt-filter">
          <label htmlFor="ptw-receipt">{t("putaway.queue.receipt")}</label>
          <UiSelect
            id="ptw-receipt"
            aria-label={t("putaway.queue.receipt")}
            fullWidth
            displayEmpty
            menuClassName="ptw-filter-menu"
            value={receiptDraft}
            onChange={setReceiptDraft}
            options={[
              { value: "", label: t("putaway.queue.all") },
              ...receipts.map((value) => ({ value, label: value })),
            ]}
          />
        </div>
        <div className="ptw-filter-actions">
          <button className="ptw-primary" type="submit">
            {t("putaway.queue.apply")}
          </button>
          <button className="ptw-reset" type="button" onClick={reset}>
            {t("putaway.queue.reset")}
          </button>
        </div>
        <p className="ptw-filter-hint">
          {orders
            ? t("putaway.queue.ordersHint")
            : t("putaway.queue.pendingHint")}
        </p>
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
        className="ptw-stats"
        aria-label={t("putaway.queue.summaryAria")}
        aria-busy={loading}
      >
        {[
          {
            icon: "cube",
            label: orders
              ? t("putaway.queue.ordersTab")
              : t("putaway.queue.pendingBoxes"),
            value: rows.length,
          },
          {
            icon: "document",
            label: t("putaway.queue.componentSkus"),
            value: skuCount,
          },
          {
            icon: "cube",
            label: t("putaway.queue.totalQuantity"),
            value: totalQuantity,
          },
        ].map((stat) => (
          <article key={stat.label}>
            <span className="ptw-stat-icon">
              <UiIcon name={stat.icon} size="lg" />
            </span>
            <div>
              <span>{stat.label}</span>
              <strong>{loading || error ? "—" : number(stat.value)}</strong>
            </div>
          </article>
        ))}
      </section>
      <section
        className="ptw-list"
        aria-labelledby="ptw-list-title"
        aria-busy={loading || refreshing}
      >
        <div className="ptw-list-heading">
          <h2 id="ptw-list-title">
            {heading}{" "}
            <span className="ptw-count">
              {loading || error ? "—" : number(rows.length)}{" "}
              {orders ? t("putaway.queue.orderUnit") : "BOX"}
            </span>
          </h2>
          <p>{t("putaway.queue.stockNeutral")}</p>
        </div>
        {!loading && !error && selectedRows.length ? (
          <div className="ptw-selection" role="status">
            <span>
              {t("putaway.queue.selectedCount", { count: selectedRows.length })}
            </span>
            <button
              type="button"
              className="ptw-text-button"
              onClick={() => setSelectedIds(new Set())}
            >
              {t("putaway.queue.clearSelection")}
            </button>
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
                <SortableTh
                  label="SKU"
                  sortKey="sku_code"
                  sortState={sortState}
                  onSort={sort}
                  className="ptw-sku-col"
                />
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
                ) : (
                  <th className="ptw-updated-col">
                    {t("putaway.queue.updated")}
                  </th>
                )}
                <th className="ptw-action-col">{t("putaway.queue.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 7 }, (_, i) => (
                  <tr className="ptw-loading" key={i} aria-hidden="true">
                    {Array.from({ length: 9 }, (_, j) => (
                      <td key={j}>
                        <span />
                      </td>
                    ))}
                  </tr>
                ))
              ) : error ? (
                <tr>
                  <td colSpan={9} className="ptw-empty">
                    {t("putaway.queue.loadFailed")}
                  </td>
                </tr>
              ) : !pageRows.length ? (
                <tr>
                  <td colSpan={9} className="ptw-empty">
                    <UiIcon name="cube" size="lg" />
                    <strong>
                      {props.search ||
                      filters.receipt ||
                      filters.status !== "RECEIVED_PENDING_PUTAWAY"
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
                  const timestamp = updatedAt(row);
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
                      </td>
                      <td className="ptw-sku-col">
                        <SkuLink code={row.sku_code} />
                      </td>
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
                      <td className="ptw-updated-col">
                        {orders ? (
                          row.to_tray_code || t("putaway.queue.notChosen")
                        ) : timestamp ? (
                          <time
                            dateTime={timestamp}
                            title={formatDateTime(timestamp)}
                          >
                            {dayjs(timestamp).isSame(dayjs(), "day")
                              ? dayjs(timestamp).format("HH:mm")
                              : dayjs(timestamp).isSame(
                                    dayjs().subtract(1, "day"),
                                    "day",
                                  )
                                ? t("putaway.queue.yesterday")
                                : dayjs(timestamp).format("DD/MM")}
                          </time>
                        ) : (
                          <span title={t("putaway.queue.noUpdate")}>—</span>
                        )}
                      </td>
                      <td className="ptw-action-col">
                        <RowActionGroup>
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
          <span className="ptw-range">
            {t("putaway.queue.showing")}{" "}
            {loading || error || !rows.length
              ? 0
              : (safePage - 1) * pageSize + 1}
            –{loading || error ? 0 : Math.min(safePage * pageSize, rows.length)}{" "}
            / {loading || error ? 0 : number(rows.length)} BOX
          </span>
          <UiPagination
            page={safePage}
            pageSize={pageSize}
            total={error ? 0 : rows.length}
            onPageChange={setPage}
            showTotal={false}
            disabled={loading || Boolean(error)}
          />
          <label className="ptw-page-size">
            <span>{t("putaway.queue.rows")}</span>
            <select
              aria-label={t("putaway.queue.rowsPerPage")}
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              {[7, 10, 20, 50].map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
        </footer>
      </section>
    </>
  );
}
