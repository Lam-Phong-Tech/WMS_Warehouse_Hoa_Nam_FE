import { useEffect } from "react";
import { useMvpDefects } from "@/modules/master-data/hooks/use-mvp-master";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { useT } from "@/shared/i18n/useT";

/** A one-row query probes metadata; its rows cannot establish the catalog total. */
function totalFromQuery(
  query: ReturnType<typeof useMvpDefects>,
  allowCached: boolean,
): number | null {
  if ((!query.isSuccess || query.isError) && !allowCached) return null;
  const reported = query.data?.meta?.total;
  if (
    (typeof reported !== "number" && typeof reported !== "string") ||
    (typeof reported === "string" && reported.trim() === "")
  ) {
    return null;
  }
  const total = Number(reported);
  return Number.isSafeInteger(total) && total >= 0 ? total : null;
}

interface DefectOverviewProps {
  refreshKey?: number;
  /** Match the list's initial skeleton even when the count queries are cached. */
  loading?: boolean;
  /** Allow last available counts only while the caller labels the list as stale. */
  stale?: boolean;
}

/** Global catalog counts stay independent of list filters, sorting and paging. */
export function DefectOverview({
  refreshKey = 0,
  loading = false,
  stale = false,
}: DefectOverviewProps) {
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const copy = (vi: string, en: string) => (language === "en" ? en : vi);
  const totalQuery = useMvpDefects({ page: 1, per_page: 1 });
  const activeQuery = useMvpDefects({ status: "ACTIVE", page: 1, per_page: 1 });
  const inactiveQuery = useMvpDefects({
    status: "INACTIVE",
    page: 1,
    per_page: 1,
  });
  const { refetch: refetchTotal } = totalQuery;
  const { refetch: refetchActive } = activeQuery;
  const { refetch: refetchInactive } = inactiveQuery;
  useEffect(() => {
    // Queries fetch on mount. Explicit list refreshes also refresh all probes.
    if (refreshKey === 0) return;
    void Promise.allSettled([
      refetchTotal(),
      refetchActive(),
      refetchInactive(),
    ]);
  }, [refreshKey, refetchTotal, refetchActive, refetchInactive]);

  const isLoading =
    loading ||
    totalQuery.isLoading ||
    activeQuery.isLoading ||
    inactiveQuery.isLoading;
  const total = isLoading ? null : totalFromQuery(totalQuery, stale);
  const active = isLoading ? null : totalFromQuery(activeQuery, stale);
  const inactive = isLoading ? null : totalFromQuery(inactiveQuery, stale);
  const ready = total !== null && active !== null && inactive !== null;
  // Concurrent probes can see different revisions. Never chart a false split.
  const hasDistribution = ready && active + inactive === total;
  const percentage = (count: number | null) =>
    hasDistribution && total > 0 && count !== null
      ? (count / total) * 100
      : null;
  const locale = language === "en" ? "en-US" : "vi-VN";
  const formatCount = (value: number | null) =>
    value === null ? "—" : value.toLocaleString(locale);
  const formatPercent = (value: number | null) =>
    value === null
      ? "—"
      : `${value.toLocaleString(locale, { maximumFractionDigits: 1 })}%`;
  const title = copy("Danh mục bệnh / lỗi", "Defect catalog");
  const statuses = [
    {
      key: "active",
      label: t("masterData.status.inUse"),
      count: active,
      percent: percentage(active),
    },
    {
      key: "inactive",
      label: t("masterData.status.notInUse"),
      count: inactive,
      percent: percentage(inactive),
    },
  ];

  return (
    <section
      className="hn-defect-overview"
      aria-label={title}
      aria-busy={isLoading}
      data-state={
        isLoading
          ? "loading"
          : ready
            ? stale
              ? "stale"
              : "ready"
            : "unavailable"
      }
    >
      <div className="hn-defect-overview-heading">
        <span className="hn-defect-overview-icon" aria-hidden="true">
          <svg
            viewBox="0 0 32 32"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 5H8a3 3 0 0 0-3 3v19a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3V8a3 3 0 0 0-3-3h-4" />
            <rect x="12" y="2" width="8" height="6" rx="2" />
            <path d="M15 14h6m-6 7h6M10 14h.01M10 21h.01" />
          </svg>
        </span>
        <div>
          <h2 className="hn-defect-overview-title">{title}</h2>
          <div className="hn-defect-overview-total">
            <strong className="hn-defect-overview-value">
              {formatCount(total)}
            </strong>
            <span className="hn-defect-overview-unit">
              {copy("hồ sơ", "records")}
            </span>
          </div>
        </div>
      </div>
      <div className="hn-defect-overview-distribution">
        <div className="hn-defect-overview-distribution-title">
          {copy("Cơ cấu trạng thái", "Status distribution")}
        </div>
        <div
          className="hn-defect-overview-bar"
          aria-hidden="true"
          data-available={hasDistribution}
        >
          {hasDistribution
            ? statuses.map((status) => (
                <span
                  key={status.key}
                  className={`hn-defect-overview-segment hn-defect-overview-segment--${status.key}`}
                  style={{ width: `${status.percent ?? 0}%` }}
                />
              ))
            : null}
        </div>
        <div className="hn-defect-overview-legend">
          {statuses.map((status) => (
            <div
              key={status.key}
              className={`hn-defect-overview-status hn-defect-overview-status--${status.key}`}
            >
              <span className="hn-defect-overview-dot" aria-hidden="true" />
              <span className="hn-defect-overview-label">{status.label}</span>
              <strong className="hn-defect-overview-count hn-defect-overview-value">
                {formatCount(status.count)}
              </strong>
              {!isLoading && total !== 0 ? (
                <span className="hn-defect-overview-percent">
                  {status.percent !== null ? (
                    <span aria-hidden="true">· </span>
                  ) : null}
                  {formatPercent(status.percent)}
                </span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
      <p className="hn-defect-overview-note">
        <svg
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="8" />
          <path d="M10 9v5m0-8h.01" />
        </svg>
        {copy(
          "Danh mục dùng để ghi nhận bệnh/lỗi trong hồ sơ bảo hành.",
          "The catalog records defects in warranty cases.",
        )}
      </p>
    </section>
  );
}
