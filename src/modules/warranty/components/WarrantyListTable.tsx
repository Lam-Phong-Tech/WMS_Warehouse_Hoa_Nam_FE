import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import { useState } from "react";
import { Menu, MenuItem, UiIcon } from "@/shared/ui";
import { SortableTh } from "@/shared/components/data-display/SortableTh";
import { useClientSort } from "@/shared/components/data-display/useClientSort";
import type { ResponsiveDataTableProps } from "@/shared/components/data-display/ResponsiveDataTable";
import type { WarrantyCase } from "@/modules/warranty/types";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { formatDate } from "@/shared/utils/format-date";
import { tStatic as tUi } from "@/shared/i18n/useT";

const formatListDate = (value?: string) =>
  formatDate(value).replaceAll("-", "/");

/** Presentation only: every cell and action keeps the page's existing callbacks. */
export function WarrantyListTable({
  columns,
  rows,
  rowKey,
  loading,
  emptyText,
  onRowClick,
  renderRowActions,
}: ResponsiveDataTableProps<WarrantyCase>) {
  const [menu, setMenu] = useState<{
    anchor: HTMLElement;
    row: WarrantyCase;
  } | null>(null);
  const [sortAnchor, setSortAnchor] = useState<HTMLElement | null>(null);
  const byKey = Object.fromEntries(
    columns.map((column) => [column.key, column]),
  );
  const { sortedRows, sortState, requestSort } = useClientSort(
    rows,
    Object.fromEntries(
      columns
        .filter((column) => column.sortAccessor)
        .map((column) => [column.key, column.sortAccessor!]),
    ),
  );
  const cell = (key: string, row: WarrantyCase) => byKey[key]?.render(row);
  const header = (key: string, label: string, className?: string) => (
    <SortableTh
      label={label}
      sortKey={key}
      sortState={sortState}
      onSort={requestSort}
      sortType={byKey[key]?.sortType}
      className={className}
    />
  );
  return (
    <>
      <div className="hn-war-table-tools">
        <button
          type="button"
          className="hn-war-extra-sort"
          aria-label={tUi("updatedUi.text_0076c0b72a9b")}
          aria-haspopup="menu"
          aria-expanded={Boolean(sortAnchor)}
          onClick={(event) => setSortAnchor(event.currentTarget)}
        >
          {tUi("updatedUi.text_4c530471a69e")}
        </button>
      </div>
      <div className="hn-war-table-wrap" aria-busy={loading}>
        <table
          className="hn-war-table"
          aria-label={tUi("updatedUi.text_158cb245bd0c")}
        >
          <colgroup>
            <col className="hn-war-case-col" />
            <col className="hn-war-product-col" />
            <col className="hn-war-customer-col" />
            <col className="hn-war-date-col" />
            <col className="hn-war-status-col" />
            <col className="hn-war-age-col" />
            <col className="hn-war-action-col" />
          </colgroup>
          <thead>
            <tr>
              {header("case_code", tUi("updatedUi.text_7f401d2e3891"))}
              {header("sku", tUi("updatedUi.text_82730807e057"))}
              {header(
                "customer",
                tUi("warranty.list.colCustomer"),
                "hn-war-customer-col",
              )}
              {header("received_at", tUi("updatedUi.text_2a2f8a4381c7"))}
              {header("status", tUi("dashboard.composition.colStatus"))}
              <th className="hn-war-age-col">
                {tUi("updatedUi.text_9966263bb43d")}
              </th>
              <th>{tUi("outbound.detail.colAction")}</th>
            </tr>
          </thead>
          <tbody>
            {loading && rows.length === 0
              ? Array.from({ length: 7 }, (_, index) => (
                  <tr
                    key={index}
                    className="hn-war-skeleton"
                    aria-hidden="true"
                  >
                    {Array.from({ length: 7 }, (_, column) => (
                      <td
                        key={column}
                        className={
                          column === 2
                            ? "hn-war-customer-col"
                            : column === 5
                              ? "hn-war-age-col"
                              : undefined
                        }
                      >
                        <span />
                        <span />
                      </td>
                    ))}
                  </tr>
                ))
              : sortedRows.map((row) => (
                  <tr
                    key={rowKey(row)}
                    className={
                      menu?.row.id === row.id ? "is-selected" : undefined
                    }
                    onClick={() => onRowClick?.(row)}
                  >
                    <td
                      className="hn-war-case-cell"
                      data-label={tUi("updatedUi.text_7f401d2e3891")}
                    >
                      <button
                        type="button"
                        className="hn-war-code"
                        onClick={(event) => {
                          event.stopPropagation();
                          onRowClick?.(row);
                        }}
                      >
                        {cell("case_code", row)}
                      </button>
                      {row.serial_number || row.item_code ? (
                        <small>SN: {row.serial_number || row.item_code}</small>
                      ) : null}
                      <span
                        className={
                          row.identification_type === "TEMP_ONLY"
                            ? "hn-war-identification"
                            : "hn-war-visually-hidden"
                        }
                      >
                        {cell("identification_type", row)}
                      </span>
                    </td>
                    <td data-label={tUi("updatedUi.text_82730807e057")}>
                      <div className="hn-war-product">
                        <span className="hn-war-product-icon">
                          <UiIcon name="cube" />
                        </span>
                        <div>
                          <div>{cell("sku", row)}</div>
                          {row.sku && row.sku_name ? (
                            <small>{row.sku_name}</small>
                          ) : null}
                          <span className="hn-war-tablet-customer">
                            {cell("customer", row)}
                          </span>
                          <span className="hn-war-defect">
                            <span>
                              {tUi("updatedUi.text_d0500dd9ad98") + " "}
                            </span>
                            {cell("defect", row)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td
                      className="hn-war-customer-col"
                      data-label={tUi("warranty.list.colCustomer")}
                    >
                      {cell("customer", row)}
                    </td>
                    <td
                      className="hn-war-dates"
                      data-label={tUi("updatedUi.text_2a2f8a4381c7")}
                    >
                      <span title={String(cell("received_at", row) || "")}>
                        {formatListDate(row.received_at)}
                      </span>
                      <small title={tUi("updatedUi.text_61151ea4d85c")}>
                        {formatListDate(
                          row.expected_completion_date ||
                            row.estimated_completion_date ||
                            row.expected_return_at,
                        )}
                      </small>
                    </td>
                    <td data-label={tUi("dashboard.composition.colStatus")}>
                      <span
                        className={`hn-war-status hn-war-status--${row.status.toLowerCase()}`}
                      >
                        {cell("status", row)}
                      </span>
                    </td>
                    <td
                      className="hn-war-age-col"
                      data-label={tUi("updatedUi.text_9966263bb43d")}
                    >
                      {typeof row.case_age_days === "number"
                        ? row.case_age_days === 0
                          ? tUi("dashboard.snapshot.periodToday")
                          : tUi("updatedUi.text_62f408a12e00", {
                              value0: String(row.case_age_days),
                            })
                        : EMPTY_TEXT}
                    </td>
                    <td
                      className="hn-war-action-cell"
                      data-label={tUi("outbound.detail.colAction")}
                    >
                      <RowActionGroup
                        className="hn-war-row-actions"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {renderRowActions?.(row)}
                        <RowActionButton
                          kind="more"
                          aria-label={tUi("updatedUi.text_0f5f5be4cde4", {
                            value0: String(row.case_code || EMPTY_TEXT),
                          })}
                          aria-haspopup="menu"
                          aria-expanded={menu?.row.id === row.id}
                          onClick={(event) =>
                            setMenu({ anchor: event.currentTarget, row })
                          }
                        />
                      </RowActionGroup>
                    </td>
                  </tr>
                ))}
          </tbody>
        </table>
        {!loading && rows.length === 0 ? (
          <div className="hn-war-empty" role="status">
            <div>{emptyText}</div>
          </div>
        ) : null}
      </div>
      <Menu
        anchorEl={sortAnchor}
        open={Boolean(sortAnchor)}
        onClose={() => setSortAnchor(null)}
        slotProps={{ paper: { className: "hn-war-menu" } }}
      >
        {[
          { key: "defect", label: tUi("warranty.list.colDefect") },
          {
            key: "identification_type",
            label: tUi("warranty.list.colIdentification"),
          },
        ].map(({ key, label }) => (
          <MenuItem
            key={key}
            aria-label={tUi("updatedUi.text_41572ca3ec9a", {
              value0: String(label.toLowerCase()),
            })}
            selected={sortState.key === key}
            onClick={() => {
              requestSort(key);
              setSortAnchor(null);
            }}
          >
            {label}
            {sortState.key === key
              ? sortState.direction === "asc"
                ? " · A → Z"
                : " · Z → A"
              : ""}
          </MenuItem>
        ))}
      </Menu>
      <Menu
        anchorEl={menu?.anchor ?? null}
        open={Boolean(menu)}
        onClose={() => setMenu(null)}
        slotProps={{ paper: { className: "hn-war-menu" } }}
      >
        <MenuItem
          onClick={() => {
            if (menu) onRowClick?.(menu.row);
            setMenu(null);
          }}
        >
          {tUi("updatedUi.text_aeda5f69ff81")}
        </MenuItem>
      </Menu>
    </>
  );
}
