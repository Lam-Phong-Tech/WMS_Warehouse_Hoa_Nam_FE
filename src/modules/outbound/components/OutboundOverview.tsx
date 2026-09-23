import { useQueries } from "@tanstack/react-query";
import { UiIcon } from "@/shared/ui";
import {
  fetchOutboundDocuments,
  type OutboundListResult,
  type OutboundStatus,
} from "@/modules/outbound/services/alignedOutboundService";
import { formatQuantity } from "@/shared/utils/format-number";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";

const STATUS_CARDS: ReadonlyArray<{
  status: OutboundStatus;
  label: string;
}> = [
  { status: "DRAFT", label: "Nháp" },
  { status: "SCANNING", label: "Đang quét xuất hàng" },
  { status: "POSTED", label: "Đã xuất kho" },
  { status: "CANCELLED", label: "Đã hủy" },
];

type CountResult = {
  data?: OutboundListResult;
  isLoading: boolean;
  isFetching: boolean;
  isError: boolean;
};

function displayTotal(query: CountResult): string {
  const total = query.data?.meta.total;
  // Only the server's total describes the entire authorized collection.
  // A single returned row, unavailable response or stale failed query is not zero.
  return !query.isLoading &&
    !query.isFetching &&
    !query.isError &&
    typeof total === "number" &&
    Number.isSafeInteger(total) &&
    total >= 0
    ? formatQuantity(total)
    : "—";
}

/** OUT-01 overview remains independent of the list's current page and filters. */
export function OutboundOverview({ onRefresh }: { onRefresh?: () => void }) {
  const queries = useQueries({
    queries: [undefined, ...STATUS_CARDS.map(({ status }) => status)].map(
      (status) => ({
        queryKey: ["mvp-outbound", "overview", status ?? "all"],
        queryFn: () =>
          fetchOutboundDocuments({
            page: 1,
            per_page: 1,
            ...(status ? { status } : {}),
          }),
      }),
    ),
  });
  const busy = queries.some((query) => query.isLoading || query.isFetching);
  const hasError = queries.some((query) => query.isError);

  const refresh = () => {
    void Promise.allSettled(queries.map((query) => query.refetch()));
    onRefresh?.();
  };

  return (
    <section
      className="hn-outbound-overview hn-outbound-card"
      aria-label="Tình trạng xử lý phiếu"
      aria-busy={busy}
    >
      <h2>Tình trạng xử lý phiếu</h2>
      <div className="hn-outbound-overview-metrics" aria-live="polite">
        <div className="hn-outbound-total">
          <strong>{displayTotal(queries[0])}</strong>
          <span>Tổng phiếu xuất</span>
        </div>
        <div className="hn-outbound-stats">
          {STATUS_CARDS.map(({ status, label }, index) => (
            <div
              className="hn-outbound-stat"
              data-status={status}
              key={status}
              aria-label={label}
            >
              <strong>{displayTotal(queries[index + 1])}</strong>
              <span>{label}</span>
            </div>
          ))}
        </div>
      </div>
      {hasError ? (
        <div
          className="hn-outbound-overview-error"
          role="alert"
          {...uiStateProps(UI_STATE.ERROR, "outbound-overview-error")}
        >
          <span>Chưa tải được đầy đủ số liệu xử lý phiếu.</span>
          <button type="button" onClick={refresh} disabled={busy}>
            <UiIcon name="refresh" size="sm" />
            {busy ? "Đang tải…" : "Thử lại"}
          </button>
        </div>
      ) : null}
      <div className="hn-outbound-overview-note">
        <UiIcon name="info" size="sm" />
        <span>
          Quét và đối chiếu thực hiện trên Scanner App. Chỉ Post Issue thành
          công mới làm giảm tồn kho; in hoặc in lại nhãn không làm thay đổi tồn.
        </span>
      </div>
    </section>
  );
}
