import { useState, type ReactNode } from "react";
import { FILTER_WIDTH, UiPagination, UiSelect } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import { formatQuantity } from "@/shared/utils/format-number";

export interface InventoryRecordField<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
}

/** Narrow drawer records: identity first, secondary fields expand vertically. */
export function InventoryRecordList<T>({
  rows,
  fields,
  summaryKeys,
  rowKey,
  loading,
  emptyText,
  renderAction,
}: {
  rows: T[];
  fields: InventoryRecordField<T>[];
  summaryKeys: string[];
  rowKey: (row: T) => string | number;
  loading?: boolean;
  emptyText: string;
  renderAction?: (row: T) => ReactNode;
}) {
  const t = useT();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(rows.length / pageSize)),
  );
  const first = (currentPage - 1) * pageSize;
  const primary = fields[0];
  const summary = fields
    .slice(1)
    .filter((field) => summaryKeys.includes(field.key));
  const secondary = fields
    .slice(1)
    .filter((field) => !summaryKeys.includes(field.key));
  if (loading)
    return (
      <p className="hn-balance-state" role="status">
        {t("common.loadingData")}
      </p>
    );
  if (!rows.length) return <p className="hn-balance-state">{emptyText}</p>;
  return (
    <div className="hn-balance-records">
      <ul className="hn-balance-record-list">
        {rows.slice(first, first + pageSize).map((row) => (
          <li key={rowKey(row)}>
            <div className="hn-balance-record-header">
              <div className="hn-balance-record-code">
                {primary.render(row)}
              </div>
              <div className="hn-balance-record-summary">
                {summary.map((field) => (
                  <div key={field.key} aria-label={field.header}>
                    {field.key === "quantity" ? `${field.header}: ` : null}
                    {field.render(row)}
                  </div>
                ))}
                {renderAction?.(row)}
              </div>
            </div>
            <details className="hn-balance-record-details">
              <summary>{t("inventory.detail.recordDetails")}</summary>
              <dl className="hn-balance-fields">
                {secondary.map((field) => (
                  <div key={field.key}>
                    <dt>{field.header}</dt>
                    <dd>{field.render(row)}</dd>
                  </div>
                ))}
              </dl>
            </details>
          </li>
        ))}
      </ul>
      <div className="hn-balance-record-footer">
        <div>
          <span aria-live="polite">
            {t("inventory.rangeLabel", {
              from: formatQuantity(first + 1),
              to: formatQuantity(Math.min(first + pageSize, rows.length)),
              total: formatQuantity(rows.length),
            })}
          </span>
          <UiSelect
            value={pageSize}
            aria-label={t("shared.table.perPageAria")}
            minWidth={FILTER_WIDTH.pageSize}
            options={[10, 20, 50].map((size) => ({
              value: size,
              label: t("shared.table.perPage", { size }),
            }))}
            onChange={(value) => {
              setPageSize(Number(value));
              setPage(1);
            }}
          />
        </div>
        <UiPagination
          total={rows.length}
          page={currentPage}
          pageSize={pageSize}
          showTotal={false}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}
