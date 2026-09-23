import { Tooltip, UiIcon } from "@/shared/ui";
import { useInboundDocuments } from "@/modules/inbound/hooks/use-inbound";
import { formatQuantity } from "@/shared/utils/format-number";

type InboundCountQuery = ReturnType<typeof useInboundDocuments>;

const UNAVAILABLE_SCAN_TOTAL = "Chưa có số liệu tổng hợp mã quét";

function totalFrom(query: InboundCountQuery): number | undefined {
  const value = query.data?.meta?.total;
  if (
    query.isLoading ||
    query.isFetching ||
    query.isError ||
    typeof value !== "number" ||
    !Number.isSafeInteger(value) ||
    value < 0
  ) {
    return undefined;
  }
  return value;
}

function displayCount(value: number | undefined): string {
  return value === undefined ? "—" : formatQuantity(value);
}

/** Overview counts cover all receipts visible to the actor, across every page. */
export function InboundOverview({ onRefresh }: { onRefresh: () => void }) {
  const all = useInboundDocuments({ page: 1, per_page: 1 });
  const drafts = useInboundDocuments({
    page: 1,
    per_page: 1,
    status: "DRAFT",
  });
  const scanning = useInboundDocuments({
    page: 1,
    per_page: 1,
    status: "SCANNING",
  });
  const posted = useInboundDocuments({
    page: 1,
    per_page: 1,
    status: "POSTED",
  });
  const queries = [all, drafts, scanning, posted];
  const busy = queries.some((query) => query.isLoading || query.isFetching);
  const hasError = queries.some((query) => query.isError);
  const total = totalFrom(all);
  const postedTotal = totalFrom(posted);
  // Independently cached totals can briefly represent different server moments.
  // Never show an impossible percentage while those queries converge.
  const ratio =
    total !== undefined && postedTotal !== undefined && postedTotal <= total
      ? total === 0
        ? 0
        : (postedTotal / total) * 100
      : undefined;
  const ratioLabel =
    ratio === undefined
      ? "—"
      : `${formatQuantity(Math.round(ratio * 10) / 10)}%`;

  const refresh = () => {
    void Promise.allSettled(queries.map((query) => query.refetch()));
    onRefresh();
  };

  return (
    <section
      className="hn-inbound-overview hn-inbound-card"
      aria-label="Theo dõi nhập kho"
      aria-busy={busy}
    >
      <div className="hn-inbound-overview-head">
        <h2>Theo dõi nhập kho</h2>
        <button
          type="button"
          className="hn-inbound-sync"
          onClick={refresh}
          disabled={busy}
        >
          <UiIcon name="refresh" size="sm" />
          <span>{busy ? "Đang đồng bộ…" : "Đồng bộ từ Scanner App"}</span>
        </button>
      </div>

      <div className="hn-inbound-overview-metrics" aria-live="polite">
        <div className="hn-inbound-completion">
          <div className="hn-inbound-completion-count">
            <strong>
              {displayCount(postedTotal)} / {displayCount(total)}
            </strong>
            <span>phiếu đã nhập kho</span>
          </div>
          <div className="hn-inbound-completion-meter">
            <div
              className="hn-inbound-progress"
              role="progressbar"
              aria-label="Tỷ lệ phiếu đã nhập kho"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ratio}
              aria-valuetext={
                ratio === undefined ? "Chưa có dữ liệu tổng hợp" : ratioLabel
              }
            >
              <span style={{ width: `${ratio ?? 0}%` }} />
            </div>
            <strong>{ratioLabel}</strong>
          </div>
        </div>

        <div className="hn-inbound-stat">
          <span className="hn-inbound-stat-icon">
            <UiIcon name="document" size="lg" />
          </span>
          <div>
            <strong>{displayCount(totalFrom(drafts))}</strong>
            <span>Nháp</span>
          </div>
        </div>
        <div className="hn-inbound-stat">
          <span className="hn-inbound-stat-icon">
            <UiIcon name="waveform" size="lg" />
          </span>
          <div>
            <strong>{displayCount(totalFrom(scanning))}</strong>
            <span>Đang ghi nhận</span>
          </div>
        </div>
        <div className="hn-inbound-stat">
          <span className="hn-inbound-stat-icon">
            <UiIcon name="barcode" size="lg" />
          </span>
          <div>
            <Tooltip title={UNAVAILABLE_SCAN_TOTAL} describeChild arrow>
              <strong
                tabIndex={0}
                aria-label={`Mã đã quét: ${UNAVAILABLE_SCAN_TOTAL}`}
              >
                —
              </strong>
            </Tooltip>
            <span>Mã đã quét</span>
          </div>
        </div>
      </div>

      {hasError ? (
        <p className="hn-inbound-overview-error" role="alert">
          Chưa tải được đầy đủ số liệu theo dõi. Bấm đồng bộ để thử lại.
        </p>
      ) : null}
      <div className="hn-inbound-overview-note">
        <UiIcon name="info" size="sm" />
        <span>
          Quét hàng thực hiện trên Scanner App. Web dùng để quản lý và theo dõi;
          chỉ phiếu Đã nhập kho mới làm tăng tồn.
        </span>
      </div>
    </section>
  );
}
