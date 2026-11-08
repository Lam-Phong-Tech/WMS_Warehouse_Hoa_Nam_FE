import { RowActionGroup } from "@/shared/components/actions";
import { UiIcon } from "@/shared/ui";
import { SortableTh } from "@/shared/components/data-display/SortableTh";
import { useClientSort } from "@/shared/components/data-display/useClientSort";
import type { ResponsiveDataTableProps } from "@/shared/components/data-display/ResponsiveDataTable";
import type { WarrantyCase } from "@/modules/warranty/types";
import { formatDate } from "@/shared/utils/format-date";
import { tStatic as tUi } from "@/shared/i18n/useT";

const formatListDate = (value?: string) =>
  formatDate(value).replaceAll("-", "/");

export type WarrantyListSort = {
  key: "defect" | "identification_type";
  direction: "asc" | "desc";
} | null;

type WarrantyListTableProps = ResponsiveDataTableProps<WarrantyCase> & {
  listSort?: WarrantyListSort;
  rowNumberOffset?: number;
};

/** Presentation only: every cell and action keeps the page's existing callbacks. */
export function WarrantyListTable({
  columns,
  rows,
  rowKey,
  loading,
  emptyText,
  onRowClick,
  renderRowActions,
  listSort = null,
  rowNumberOffset = 0,
}: WarrantyListTableProps) {
  const byKey = Object.fromEntries(
    columns.map((column) => [column.key, column]),
  );
  const {
    sortedRows: headerSortedRows,
    sortState,
    requestSort,
  } = useClientSort(
    rows,
    Object.fromEntries(
      columns
        .filter((column) => column.sortAccessor)
        .map((column) => [column.key, column.sortAccessor!]),
    ),
  );
  const listSortAccessor = listSort && byKey[listSort.key]?.sortAccessor;
  const sortedRows =
    listSort && listSortAccessor
      ? [...rows].sort((a, b) => {
          const comparison = String(listSortAccessor(a) ?? "").localeCompare(
            String(listSortAccessor(b) ?? ""),
            "vi",
            { numeric: true, sensitivity: "base" },
          );
          return listSort.direction === "asc" ? comparison : -comparison;
        })
      : headerSortedRows;
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
      <div className="hn-war-table-wrap" aria-busy={loading}>
        <table
          className="hn-war-table"
          aria-label={tUi("updatedUi.text_158cb245bd0c")}
        >
          <colgroup>
            <col className="hn-war-index-col" />
            <col className="hn-war-case-col" />
            <col className="hn-war-product-col" />
            <col className="hn-war-customer-col" />
            <col className="hn-war-date-col" />
            <col className="hn-war-status-col" />
            <col className="hn-war-action-col" />
          </colgroup>
          <thead>
            <tr>
              <th className="hn-war-index-col">STT</th>
              {header("case_code", tUi("updatedUi.text_7f401d2e3891"))}
              {header("sku", tUi("updatedUi.text_82730807e057"))}
              {header(
                "customer",
                tUi("warranty.list.colCustomer"),
                "hn-war-customer-col",
              )}
              {header("received_at", tUi("updatedUi.text_2a2f8a4381c7"))}
              {header("status", tUi("dashboard.composition.colStatus"))}
              <th scope="col" aria-label={tUi("outbound.detail.colAction")} />
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
                          column === 3 ? "hn-war-customer-col" : undefined
                        }
                      >
                        <span />
                        <span />
                      </td>
                    ))}
                  </tr>
                ))
              : sortedRows.map((row, index) => (
                  <tr key={rowKey(row)} onClick={() => onRowClick?.(row)}>
                    <td className="hn-war-index-col" data-label="STT">
                      {rowNumberOffset + index + 1}
                    </td>
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
                    <td className="hn-war-action-cell">
                      <RowActionGroup
                        className="hn-war-row-actions"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {renderRowActions?.(row)}
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
    </>
  );
}
