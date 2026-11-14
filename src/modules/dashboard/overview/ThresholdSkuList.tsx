import { useT, type TranslateFn } from "@/shared/i18n";
import { useEffect, useRef, useState } from "react";
import { UiButton, UiPagination, UiSelect, FILTER_WIDTH } from "@/shared/ui";
import { ActionIconButton, RowActionButton } from "@/shared/components/actions";
import { SearchInput } from "@/shared/components/data-display/SearchInput";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { TABLE_PAGE_SIZE_OPTIONS } from "@/shared/constants/table-pagination";
import type { DashboardThresholdRow } from "./dashboard-threshold-model";
import { fmt } from "./overview-data";
import "./threshold-sku-list.css";

type Filter = "alerts" | "low" | "high" | "all";
type Props = {
  rows: DashboardThresholdRow[];
  onNavigate: (route: string) => void;
};
const stateLabel = (state: DashboardThresholdRow["state"], t: TranslateFn) =>
  state === "low"
    ? t("dashboardAudit.low")
    : state === "high"
      ? t("dashboardAudit.high")
      : t("dashboardAudit.within");

export function ThresholdSkuList({ rows, onNavigate }: Props) {
  const t = useT();
  const [filter, setFilter] = useState<Filter>("alerts");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedSku, setSelectedSku] = useState<string | null>(null);
  const [previousRows, setPreviousRows] = useState(rows);
  const trigger = useRef<HTMLElement | null>(null);
  const detailHeading = useRef<HTMLHeadingElement | null>(null);
  const query = search.trim().toLocaleLowerCase("vi-VN");
  const filtered = rows.filter(
    (row) =>
      (filter === "all" ||
        (filter === "alerts" ? row.state !== "ok" : row.state === filter)) &&
      (!query ||
        `${row.sku} ${row.name}`.toLocaleLowerCase("vi-VN").includes(query)),
  );
  const current = Math.min(
    page,
    Math.max(1, Math.ceil(filtered.length / pageSize)),
  );
  const start = (current - 1) * pageSize;
  const visible = filtered
    .slice(start, start + pageSize)
    .map((row, i) => ({ ...row, order: start + i + 1 }));
  const selected = visible.find((row) => row.sku === selectedSku);
  // Persist bounds after refresh so restored data cannot reopen a hidden selection.
  if (previousRows !== rows) {
    setPreviousRows(rows);
    if (page !== current) setPage(current);
    if (selectedSku !== null && !selected) setSelectedSku(null);
  }
  useEffect(() => {
    detailHeading.current?.focus();
  }, [selected?.sku]);

  const resetPage = () => {
    setPage(1);
    setSelectedSku(null);
  };
  const open = (sku: string, element: HTMLElement | null) => {
    trigger.current = element;
    setSelectedSku(sku);
  };
  const close = () => {
    setSelectedSku(null);
    trigger.current?.focus();
  };
  return (
    <div className={`threshold-layout${selected ? " has-selection" : ""}`}>
      <section
        className="threshold-list"
        aria-labelledby="threshold-list-title"
      >
        <h2 id="threshold-list-title">{t("dashboardAudit.skuList")}</h2>
        <div className="threshold-filters">
          <SearchInput
            className="threshold-search"
            width="100%"
            value={search}
            placeholder={t("dashboardAudit.search")}
            onChange={(value) => {
              setSearch(value);
              resetPage();
            }}
          />
          <select
            aria-label={t("dashboardAudit.filterStatus")}
            value={filter}
            onChange={(event) => {
              setFilter(event.target.value as Filter);
              resetPage();
            }}
          >
            <option value="alerts">{t("dashboardAudit.filterAlerts")}</option>
            <option value="low">{t("dashboardAudit.filterLow")}</option>
            <option value="high">{t("dashboardAudit.filterHigh")}</option>
            <option value="all">{t("dashboardAudit.filterAll")}</option>
          </select>
          {(search || filter !== "alerts") && (
            <UiButton
              appearance="outlined"
              onClick={() => {
                setSearch("");
                setFilter("alerts");
                resetPage();
              }}
            >
              {t("dashboardAudit.clearFilters")}
            </UiButton>
          )}
        </div>
        <div className="threshold-table">
          <ResponsiveDataTable
            rows={visible}
            rowKey={(row) => row.sku}
            onRowClick={(row) => open(row.sku, null)}
            mobileBreakpoint="lg"
            emptyText={t("dashboardAudit.noSkus")}
            headerCellStyle={{
              backgroundColor: "var(--ops-table-header)",
              backgroundImage: "none",
              color: "var(--ops-heading)",
              fontSize: 16,
              fontWeight: 800,
              lineHeight: "24px",
              padding: "12px 18px",
              textTransform: "none",
              letterSpacing: "0.02em",
            }}
            columns={[
              {
                key: "order",
                header: "#",
                width: "9%",
                truncate: 0,
                render: (row) => row.order,
              },
              {
                key: "sku",
                header: "SKU",
                width: "18%",
                truncate: 0,
                render: (row) => (
                  <button
                    type="button"
                    className="threshold-sku"
                    aria-pressed={row.sku === selectedSku}
                    onClick={(event) => open(row.sku, event.currentTarget)}
                  >
                    {row.sku}
                  </button>
                ),
              },
              {
                key: "name",
                header: t("dashboardAudit.name"),
                width: "20%",
                truncate: 0,
                render: (row) => row.name || "—",
              },
              {
                key: "available",
                header: t("dashboardAudit.available"),
                width: "12%",
                align: "right",
                truncate: 0,
                render: (row) => fmt(row.available),
              },
              {
                key: "min",
                header: "Min",
                width: "9%",
                align: "right",
                truncate: 0,
                render: (row) => (row.min === null ? "—" : fmt(row.min)),
              },
              {
                key: "max",
                header: "Max",
                width: "9%",
                align: "right",
                truncate: 0,
                render: (row) => (row.max === null ? "—" : fmt(row.max)),
              },
              {
                key: "state",
                header: t("dashboardAudit.status"),
                width: "15%",
                truncate: 0,
                render: (row) => (
                  <span className="threshold-status" data-state={row.state}>
                    {stateLabel(row.state, t)}
                  </span>
                ),
              },
              {
                key: "action",
                header: t("dashboardAudit.actions"),
                isAction: true,
                width: "8%",
                render: (row) => (
                  <RowActionButton
                    kind="view"
                    label={t("dashboardAudit.viewThreshold", { sku: row.sku })}
                    onClick={(event) => open(row.sku, event.currentTarget)}
                  />
                ),
              },
            ]}
          />
          <div className="threshold-pagination">
            <div className="threshold-pagination-info">
              <span aria-live="polite">
                {t("dashboardAudit.showing")} {filtered.length ? start + 1 : 0}–
                {Math.min(start + pageSize, filtered.length)} /{" "}
                {fmt(filtered.length)} SKU
              </span>
              <UiSelect
                kind="page-size"
                value={pageSize}
                aria-label={t("dashboardAudit.pageSize")}
                minWidth={FILTER_WIDTH.pageSize}
                options={TABLE_PAGE_SIZE_OPTIONS.map((size) => ({
                  value: size,
                  label: t("shared.table.perPage", { size }),
                }))}
                onChange={(value) => {
                  setPageSize(Number(value));
                  resetPage();
                }}
              />
            </div>
            <UiPagination
              page={current}
              pageSize={pageSize}
              total={filtered.length}
              showTotal={false}
              onPageChange={(value) => {
                setPage(value);
                setSelectedSku(null);
              }}
            />
          </div>
        </div>
      </section>
      {selected && (
        <section
          className="threshold-detail"
          aria-labelledby="threshold-detail-title"
        >
          <header>
            <h2 id="threshold-detail-title" tabIndex={-1} ref={detailHeading}>
              {t("dashboardAudit.thresholdDetails")}
            </h2>
            <ActionIconButton
              kind="close"
              label={t("dashboardAudit.closeDetails")}
              onClick={close}
            />
          </header>
          <strong className="threshold-detail-code">{selected.sku}</strong>
          {selected.name && selected.name !== selected.sku && (
            <p>{selected.name}</p>
          )}
          <dl>
            <div>
              <dt>{t("dashboardAudit.itemKind")}</dt>
              <dd>
                {selected.kind === "PRODUCT"
                  ? t("dashboardAudit.product")
                  : selected.kind === "COMPONENT"
                    ? t("dashboardAudit.component")
                    : "—"}
              </dd>
            </div>
            <div>
              <dt>{t("dashboardAudit.availableStock")}</dt>
              <dd>{fmt(selected.available)}</dd>
            </div>
            <div>
              <dt>{t("dashboardAudit.minThreshold")}</dt>
              <dd>
                {selected.min === null
                  ? t("dashboardAudit.notSet")
                  : fmt(selected.min)}
              </dd>
            </div>
            <div>
              <dt>{t("dashboardAudit.maxThreshold")}</dt>
              <dd>
                {selected.max === null
                  ? t("dashboardAudit.notSet")
                  : fmt(selected.max)}
              </dd>
            </div>
            <div>
              <dt>{t("dashboardAudit.reviewLevel")}</dt>
              <dd>
                {selected.state === "low"
                  ? t("dashboardAudit.shortfall", {
                      quantity: fmt((selected.min ?? 0) - selected.available),
                    })
                  : selected.state === "high"
                    ? t("dashboardAudit.excess", {
                        quantity: fmt(selected.available - (selected.max ?? 0)),
                      })
                    : t("dashboardAudit.within")}
              </dd>
            </div>
          </dl>
          <p className="threshold-detail-note">
            {t("dashboardAudit.thresholdNote")}
          </p>
          <UiButton
            appearance="filled"
            onClick={() => onNavigate("/inventory")}
          >
            {t("dashboardAudit.viewInventory")}
          </UiButton>
        </section>
      )}
    </div>
  );
}
