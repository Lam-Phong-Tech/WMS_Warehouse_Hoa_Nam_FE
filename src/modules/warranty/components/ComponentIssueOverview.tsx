import type { ReactNode } from "react";
import { useComponentIssues } from "@/modules/warranty/hooks/use-warranty";
import type { ComponentIssueStatus } from "@/modules/warranty/services/componentIssueService";
import { formatQuantity } from "@/shared/utils/format-number";

type CountQuery = ReturnType<typeof useComponentIssues>;

interface ComponentIssueOverviewProps {
  onStatusSelect?: (status: ComponentIssueStatus) => void;
}

function totalFrom(query: CountQuery): number | undefined {
  const total = query.data?.meta?.total;
  return !query.isLoading &&
    !query.isFetching &&
    !query.isError &&
    typeof total === "number" &&
    Number.isSafeInteger(total) &&
    total >= 0
    ? total
    : undefined;
}

function displayCount(value: number | undefined): string {
  return value === undefined ? "—" : formatQuantity(value);
}

function Metric({
  className,
  label,
  onClick,
  children,
}: {
  className: string;
  label: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  return onClick ? (
    <button
      type="button"
      className={className}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </button>
  ) : (
    <div className={className}>{children}</div>
  );
}

/** Counts cover all authorized documents, independently of list filters/pages. */
export function ComponentIssueOverview({
  onStatusSelect,
}: ComponentIssueOverviewProps) {
  const drafts = useComponentIssues({ status: "DRAFT", page: 1, per_page: 1 });
  const scanning = useComponentIssues({
    status: "SCANNING",
    page: 1,
    per_page: 1,
  });
  const posted = useComponentIssues({ status: "POSTED", page: 1, per_page: 1 });
  const cancelled = useComponentIssues({
    status: "CANCELLED",
    page: 1,
    per_page: 1,
  });
  const queries = [drafts, scanning, posted, cancelled];
  const busy = queries.some((query) => query.isLoading || query.isFetching);
  const hasError = queries.some((query) => query.isError);
  const counts = queries.map(totalFrom);
  // A partial page is never a global total. All four authoritative status
  // totals must be present before showing the denominator or a percentage.
  const sum = counts.reduce<number>((value, count) => value + (count ?? 0), 0);
  const total =
    counts.every((count) => count !== undefined) && Number.isSafeInteger(sum)
      ? sum
      : undefined;
  const postedTotal = totalFrom(posted);
  const ratio =
    total !== undefined && postedTotal !== undefined
      ? total === 0
        ? 0
        : (postedTotal / total) * 100
      : undefined;
  const ratioLabel =
    ratio === undefined
      ? "—"
      : `${formatQuantity(Math.round(ratio * 10) / 10)}%`;
  const stats = [
    { status: "DRAFT", label: "Nháp", count: totalFrom(drafts) },
    { status: "SCANNING", label: "Đang quét/nhập", count: totalFrom(scanning) },
    { status: "CANCELLED", label: "Đã hủy", count: totalFrom(cancelled) },
  ] as const;

  const retry = () => {
    void Promise.allSettled(queries.map((query) => query.refetch()));
  };

  return (
    <section
      className="hn-war04-overview"
      aria-label="Tổng quan ghi sổ"
      aria-busy={busy}
    >
      <h2>Tổng quan ghi sổ</h2>
      <div className="hn-war04-overview-grid" aria-live="polite">
        <Metric
          className="hn-war04-overview-posted"
          label="Lọc phiếu đã ghi sổ"
          onClick={onStatusSelect ? () => onStatusSelect("POSTED") : undefined}
        >
          <strong className="hn-war04-overview-value">
            {displayCount(postedTotal)} / {displayCount(total)}
          </strong>
          <span className="hn-war04-overview-percent">{ratioLabel}</span>
          <div
            className="hn-war04-progress"
            role="progressbar"
            aria-label="Tỷ lệ phiếu đã ghi sổ"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={ratio}
            aria-valuetext={
              ratio === undefined ? "Chưa có dữ liệu tổng hợp" : ratioLabel
            }
          >
            <span style={{ width: `${ratio ?? 0}%` }} />
          </div>
          <span>phiếu đã ghi sổ</span>
        </Metric>
        {stats.map(({ status, label, count }) => (
          <Metric
            key={status}
            className="hn-war04-overview-stat"
            label={`Lọc phiếu ${label.toLocaleLowerCase("vi-VN")}`}
            onClick={onStatusSelect ? () => onStatusSelect(status) : undefined}
          >
            <strong className="hn-war04-overview-value">
              {displayCount(count)}
            </strong>
            <span>{label}</span>
          </Metric>
        ))}
      </div>
      {hasError ? (
        <p className="hn-war04-overview-retry" role="alert">
          Chưa tải được đầy đủ số liệu.{" "}
          <button type="button" onClick={retry} disabled={busy}>
            {busy ? "Đang tải…" : "Thử lại"}
          </button>
        </p>
      ) : null}
    </section>
  );
}
