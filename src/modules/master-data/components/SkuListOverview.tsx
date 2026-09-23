import { useEffect } from "react";
import { useMvpSkus } from "@/modules/master-data/hooks/use-mvp-master";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { useT } from "@/shared/i18n/useT";

/** A one-row response is only a count probe: never treat its row count as a total. */
function totalFromQuery(query: ReturnType<typeof useMvpSkus>): number | null {
  if (!query.isSuccess || query.isError) return null;
  const reportedTotal = query.data?.meta?.total;
  if (
    reportedTotal === undefined ||
    reportedTotal === null ||
    reportedTotal === ""
  ) {
    return null;
  }
  const total = Number(reportedTotal);
  if (!Number.isSafeInteger(total) || total < 0) return null;
  return resolveApiPagination(query.data.meta, {
    page: 1,
    pageSize: 1,
    rowCount: 0,
  }).total;
}

/** Unfiltered catalog totals stay independent of the current list filters/page. */
export function SkuListOverview({ refreshKey = 0 }: { refreshKey?: number }) {
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const totalQuery = useMvpSkus({ page: 1, per_page: 1 });
  const activeQuery = useMvpSkus({ status: "ACTIVE", page: 1, per_page: 1 });
  const inactiveQuery = useMvpSkus({
    status: "INACTIVE",
    page: 1,
    per_page: 1,
  });
  const { refetch: refetchTotal } = totalQuery;
  const { refetch: refetchActive } = activeQuery;
  const { refetch: refetchInactive } = inactiveQuery;
  useEffect(() => {
    // Each query already fetches on mount. Refresh only for a later explicit
    // list refresh/import completion, preserving the existing query contracts.
    if (refreshKey === 0) return;
    void Promise.allSettled([
      refetchTotal(),
      refetchActive(),
      refetchInactive(),
    ]);
  }, [refreshKey, refetchTotal, refetchActive, refetchInactive]);
  const total = totalFromQuery(totalQuery);
  const active = totalFromQuery(activeQuery);
  const inactive = totalFromQuery(inactiveQuery);
  const loading =
    totalQuery.isLoading || activeQuery.isLoading || inactiveQuery.isLoading;
  const ready = total !== null && active !== null && inactive !== null;
  // Separate count requests may briefly observe different revisions. Only draw
  // a complete distribution once both status counts reconcile with the total.
  const hasDistribution = ready && active + inactive === total;
  const activePercent = hasDistribution
    ? total > 0
      ? (active / total) * 100
      : 0
    : null;
  const inactivePercent = hasDistribution
    ? total > 0
      ? (inactive / total) * 100
      : 0
    : null;
  const locale = language === "en" ? "en-US" : "vi-VN";
  const formatCount = (value: number | null) =>
    value === null ? "—" : value.toLocaleString(locale);
  const formatPercent = (value: number | null) =>
    value === null
      ? "—"
      : `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const title = language === "en" ? "SKU catalog" : "Danh mục SKU";
  const statuses = [
    {
      key: "active",
      label: t("masterData.status.inUse"),
      count: active,
      percent: activePercent,
    },
    {
      key: "inactive",
      label: t("masterData.status.notInUse"),
      count: inactive,
      percent: inactivePercent,
    },
  ];

  return (
    <section
      className="hn-sku-overview"
      aria-label={title}
      aria-busy={loading}
      data-state={loading ? "loading" : ready ? "ready" : "unavailable"}
    >
      <div className="hn-sku-overview-heading">
        <span className="hn-sku-overview-icon" aria-hidden="true">
          <svg
            viewBox="0 0 48 48"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m24 3 19 10v22L24 45 5 35V13Z" />
            <path d="m5 13 19 11 19-11M24 24v21" />
          </svg>
        </span>
        <div>
          <h2 className="hn-sku-overview-title">{title}</h2>
          <div className="hn-sku-overview-total">
            <strong>{formatCount(total)}</strong>
            <span className="hn-sku-overview-unit">SKU</span>
          </div>
        </div>
      </div>
      <div className="hn-sku-overview-distribution">
        <div
          className="hn-sku-overview-bar"
          aria-hidden="true"
          data-available={hasDistribution}
        >
          {hasDistribution
            ? statuses.map((status) => (
                <span
                  key={status.key}
                  className={`hn-sku-overview-segment hn-sku-overview-segment--${status.key}`}
                  style={{ width: `${status.percent ?? 0}%` }}
                />
              ))
            : null}
        </div>
        <div className="hn-sku-overview-legend">
          {statuses.map((status) => (
            <div
              key={status.key}
              className={`hn-sku-overview-status hn-sku-overview-status--${status.key}`}
            >
              <span className="hn-sku-overview-dot" aria-hidden="true" />
              <span className="hn-sku-overview-label">{status.label}</span>
              <strong className="hn-sku-overview-count">
                {formatCount(status.count)}
              </strong>
              <span className="hn-sku-overview-percent">
                {formatPercent(status.percent)}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
