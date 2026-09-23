import { RowActionButton, RowActionGroup } from "@/shared/components/actions";
import { useState } from "react";
import { Menu, MenuItem, UiIcon } from "@/shared/ui";
import { SortableTh } from "@/shared/components/data-display/SortableTh";
import { useClientSort } from "@/shared/components/data-display/useClientSort";
import type { ResponsiveDataTableProps } from "@/shared/components/data-display/ResponsiveDataTable";
import type { WarrantyCase } from "@/modules/warranty/types";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { formatDate } from "@/shared/utils/format-date";

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
          aria-label="Sắp xếp khác cho danh sách bảo hành"
          aria-haspopup="menu"
          aria-expanded={Boolean(sortAnchor)}
          onClick={(event) => setSortAnchor(event.currentTarget)}
        >
          Sắp xếp khác
        </button>
      </div>
      <div className="hn-war-table-wrap" aria-busy={loading}>
        <table className="hn-war-table" aria-label="Danh sách hồ sơ bảo hành">
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
              {header("case_code", "Hồ sơ")}
              {header("sku", "Thiết bị / Sản phẩm")}
              {header("customer", "Khách hàng", "hn-war-customer-col")}
              {header("received_at", "Tiếp nhận / Hạn xử lý")}
              {header("status", "Trạng thái")}
              <th className="hn-war-age-col">Tuổi hồ sơ</th>
              <th>Thao tác</th>
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
                    <td className="hn-war-case-cell" data-label="Hồ sơ">
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
                    <td data-label="Thiết bị / Sản phẩm">
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
                            <span>Bệnh/lỗi: </span>
                            {cell("defect", row)}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="hn-war-customer-col" data-label="Khách hàng">
                      {cell("customer", row)}
                    </td>
                    <td
                      className="hn-war-dates"
                      data-label="Tiếp nhận / Hạn xử lý"
                    >
                      <span title={String(cell("received_at", row) || "")}>
                        {formatListDate(row.received_at)}
                      </span>
                      <small title="Hạn xử lý">
                        {formatListDate(
                          row.expected_completion_date ||
                            row.estimated_completion_date ||
                            row.expected_return_at,
                        )}
                      </small>
                    </td>
                    <td data-label="Trạng thái">
                      <span
                        className={`hn-war-status hn-war-status--${row.status.toLowerCase()}`}
                      >
                        {cell("status", row)}
                      </span>
                    </td>
                    <td className="hn-war-age-col" data-label="Tuổi hồ sơ">
                      {typeof row.case_age_days === "number"
                        ? row.case_age_days === 0
                          ? "Hôm nay"
                          : `${row.case_age_days} ngày`
                        : EMPTY_TEXT}
                    </td>
                    <td className="hn-war-action-cell" data-label="Thao tác">
                      <RowActionGroup
                        className="hn-war-row-actions"
                        onClick={(event) => event.stopPropagation()}
                      >
                        {renderRowActions?.(row)}
                        <RowActionButton
                          kind="more"
                          aria-label={`Thao tác hồ sơ ${row.case_code || EMPTY_TEXT}`}
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
          { key: "defect", label: "Bệnh/lỗi" },
          { key: "identification_type", label: "Nhận diện" },
        ].map(({ key, label }) => (
          <MenuItem
            key={key}
            aria-label={`Sắp xếp theo ${label.toLowerCase()}`}
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
          Xem chi tiết hồ sơ
        </MenuItem>
      </Menu>
    </>
  );
}
