import dayjs from "dayjs";
import { useState } from "react";
import { useT } from "@/shared/i18n/useT";
import { UiPagination, UiSelect, FILTER_WIDTH } from "@/shared/ui";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/shared/constants/table-pagination";
import { activeLocale, type FlowRow, type TrendRow } from "./overview-data";
import { stockFlowDays } from "./snapshot-stock-flow-model";

export function SnapshotFlowTable({
  rows,
  trend,
}: {
  rows: readonly FlowRow[];
  trend: readonly TrendRow[];
}) {
  const t = useT();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(5);
  const number = new Intl.NumberFormat(activeLocale(), {
    maximumFractionDigits: 3,
  });
  const format = (value: number | null | undefined) =>
    value == null ? "—" : number.format(value);
  const flowByDate = new Map(rows.map((row) => [row.date, row]));
  const days = stockFlowDays(rows, trend);
  const currentPage = Math.min(
    page,
    Math.max(1, Math.ceil(days.length / pageSize)),
  );
  const start = (currentPage - 1) * pageSize;
  const pageDays = days.slice(start, start + pageSize);
  const totals = rows.reduce(
    (sum, row) => ({
      receiptProduct: sum.receiptProduct + row.receiptProduct,
      receiptComponent: sum.receiptComponent + row.receiptComponent,
      product: sum.product + row.product,
      component: sum.component + row.component,
    }),
    { receiptProduct: 0, receiptComponent: 0, product: 0, component: 0 },
  );

  return (
    <div className="snapshot-flow-table-panel">
      <div className="snapshot-flow-table-scroll">
        <table
          className="snapshot-flow-table"
          aria-label={t("dashboard.snapshot.tableAria")}
        >
          <thead>
            <tr>
              <th scope="col">{t("dashboard.snapshot.tableDate")}</th>
              <th scope="col">{t("dashboard.snapshot.tableReceiptProduct")}</th>
              <th scope="col">
                {t("dashboard.snapshot.tableReceiptComponent")}
              </th>
              <th scope="col">{t("dashboard.snapshot.tableIssueProduct")}</th>
              <th scope="col">{t("dashboard.snapshot.tableIssueComponent")}</th>
              <th scope="col">{t("dashboard.snapshot.closingStock")}</th>
            </tr>
          </thead>
          <tbody>
            {pageDays.map((day) => {
              const flow = flowByDate.get(day.date);
              return (
                <tr key={day.date}>
                  <td>{dayjs(day.date).format("DD/MM/YYYY")}</td>
                  <td>{format(flow?.receiptProduct)}</td>
                  <td>{format(flow?.receiptComponent)}</td>
                  <td>{format(flow?.product)}</td>
                  <td>{format(flow?.component)}</td>
                  <td>{format(day.closing)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr>
              <td>{t("dashboard.snapshot.tableTotal")}</td>
              <td>{format(totals.receiptProduct)}</td>
              <td>{format(totals.receiptComponent)}</td>
              <td>{format(totals.product)}</td>
              <td>{format(totals.component)}</td>
              <td>—</td>
            </tr>
          </tfoot>
        </table>
      </div>
      <footer className="snapshot-flow-table-pagination">
        <div className="snapshot-flow-table-page-info">
          <span>
            {t("inventory.rangeLabel", {
              from: days.length ? start + 1 : 0,
              to: Math.min(start + pageSize, days.length),
              total: days.length,
            })}
          </span>
          <UiSelect
            value={pageSize}
            aria-label={t("shared.table.rowsPerPageAria")}
            minWidth={FILTER_WIDTH.pageSize}
            options={[5, ...TABLE_PAGE_SIZE_OPTIONS].map((size) => ({
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
          page={currentPage}
          pageSize={pageSize}
          total={days.length}
          onPageChange={setPage}
          showTotal={false}
        />
      </footer>
    </div>
  );
}
