import { useT } from "@/shared/i18n/useT";
import "./loading-skeleton.css";

export type LoadingSkeletonLayout =
  | "list"
  | "report"
  | "reconcile"
  | "overview"
  | "detail"
  | "auth";

export interface LoadingSkeletonProps {
  layout?: LoadingSkeletonLayout;
  testId?: string;
}

function Shape({ kind = "line" }: { kind?: string }) {
  return <span className={`hn-skeleton__shape hn-skeleton__shape--${kind}`} />;
}

function Heading() {
  return (
    <div className="hn-skeleton__heading">
      <div className="hn-skeleton__heading-copy">
        <Shape kind="breadcrumb" />
        <Shape kind="title" />
        <Shape kind="subtitle" />
      </div>
      <Shape kind="action" />
    </div>
  );
}

function Fields({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`hn-skeleton__fields${compact ? " hn-skeleton__fields--compact" : ""}`}>
      {Array.from({ length: 4 }, (_, index) => (
        <div key={index} className="hn-skeleton__field">
          <Shape kind="label" />
          <Shape kind="input" />
        </div>
      ))}
    </div>
  );
}

function Kpis({ count }: { count: number }) {
  return (
    <div className="hn-skeleton__kpis" data-skeleton-kpis={count}>
      {Array.from({ length: count }, (_, index) => (
        <div key={index} className="hn-skeleton__card hn-skeleton__kpi">
          <div className="hn-skeleton__row">
            <Shape kind="label" />
            <Shape kind="icon" />
          </div>
          <Shape kind="value" />
          <Shape kind="caption" />
        </div>
      ))}
    </div>
  );
}

function Charts() {
  return (
    <div className="hn-skeleton__charts" data-skeleton-charts="2">
      <div className="hn-skeleton__card hn-skeleton__chart">
        <Shape kind="section-title" />
        <Shape kind="caption" />
        {/* Neutral plot placeholder, never a fabricated series or zero line. */}
        <Shape kind="plot" />
        <Shape kind="legend" />
      </div>
      <div className="hn-skeleton__card hn-skeleton__chart">
        <Shape kind="section-title" />
        <Shape kind="caption" />
        <div className="hn-skeleton__breakdown">
          <Shape kind="circle" />
          <div className="hn-skeleton__legend">
            <Shape />
            <Shape />
            <Shape />
          </div>
        </div>
        <Shape kind="legend" />
      </div>
    </div>
  );
}

function Table() {
  return (
    <div className="hn-skeleton__card hn-skeleton__table" data-skeleton-table="true">
      <div className="hn-skeleton__row">
        <Shape kind="section-title" />
        <Shape kind="search" />
      </div>
      <div className="hn-skeleton__table-head"><Shape /></div>
      {Array.from({ length: 5 }, (_, row) => (
        <div key={row} className="hn-skeleton__table-row">
          {Array.from({ length: 5 }, (_, column) => <Shape key={column} />)}
        </div>
      ))}
      <div className="hn-skeleton__pagination">
        <Shape kind="caption" />
        <Shape kind="pager" />
      </div>
    </div>
  );
}

/**
 * Eager, presentation-only shell: no query, lazy import or loading participant.
 * The boundary owns the one completion decision. Individual boxes never reveal
 * their data, restart their own animations, or release the group's read tickets.
 */
export function LoadingSkeleton({
  layout = "list",
  testId = "loading-skeleton",
}: LoadingSkeletonProps) {
  const t = useT();
  const detail = layout === "detail" || layout === "auth";
  const kpis = layout === "overview" ? 5 : layout === "reconcile" ? 6 : 4;
  const charts = layout === "report" || layout === "reconcile" || layout === "overview";

  return (
    <div
      className={`hn-skeleton hn-skeleton--${layout}`}
      data-testid={testId}
      data-ui-state="loading"
      data-skeleton-layout={layout}
      role="status"
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="hn-skeleton__status">{t("shared.states.loadingData")}</span>
      {/* One animated parent supplies a single phase to every placeholder. */}
      <div className="hn-skeleton__shapes" aria-hidden="true">
        {layout === "auth" ? <div className="hn-skeleton__hero"><Shape kind="hero" /></div> : null}
        <div className="hn-skeleton__body">
          <Heading />
          {detail ? (
            <div className="hn-skeleton__card">
              <Fields compact />
              <Shape kind="paragraph" />
              <Shape kind="action" />
            </div>
          ) : (
            <>
              <div className="hn-skeleton__card"><Fields /></div>
              <Kpis count={kpis} />
              {charts ? <Charts /> : null}
              <Table />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
