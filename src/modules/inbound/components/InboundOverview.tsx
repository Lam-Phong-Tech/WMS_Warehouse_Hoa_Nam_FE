import { localizedValue as localizedUiValue } from "@/shared/i18n/localized-value";
import { Tooltip, UiIcon } from "@/shared/ui";
import { useInboundDocuments } from "@/modules/inbound/hooks/use-inbound";
import { formatQuantity } from "@/shared/utils/format-number";
import { tStatic as tUi } from "@/shared/i18n/useT";

type InboundCountQuery = ReturnType<typeof useInboundDocuments>;

const getUNAVAILABLE_SCAN_TOTAL = localizedUiValue(() =>
  tUi("updatedUi.text_b4f2ee5e17a8"),
);

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
      aria-label={tUi("updatedUi.text_c4cea6eb5467")}
      aria-busy={busy}
    >
      <div className="hn-inbound-overview-head">
        <h2>{tUi("updatedUi.text_c4cea6eb5467")}</h2>
        <button
          type="button"
          className="hn-inbound-sync"
          onClick={refresh}
          disabled={busy}
        >
          <UiIcon name="refresh" size="sm" />
          <span>
            {busy
              ? tUi("updatedUi.text_34ce6b8a0c0e")
              : tUi("updatedUi.text_13de81cea04b")}
          </span>
        </button>
      </div>

      <div className="hn-inbound-overview-metrics" aria-live="polite">
        <div className="hn-inbound-completion">
          <div className="hn-inbound-completion-count">
            <strong>
              {displayCount(postedTotal)} / {displayCount(total)}
            </strong>
            <span>{tUi("updatedUi.text_764ef6758c30")}</span>
          </div>
          <div className="hn-inbound-completion-meter">
            <div
              className="hn-inbound-progress"
              role="progressbar"
              aria-label={tUi("updatedUi.text_31bf15e983e9")}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={ratio}
              aria-valuetext={
                ratio === undefined
                  ? tUi("updatedUi.text_63530aef77b4")
                  : ratioLabel
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
            <span>{tUi("outbound.detail.labelStatusDraft")}</span>
          </div>
        </div>
        <div className="hn-inbound-stat">
          <span className="hn-inbound-stat-icon">
            <UiIcon name="waveform" size="lg" />
          </span>
          <div>
            <strong>{displayCount(totalFrom(scanning))}</strong>
            <span>{tUi("updatedUi.text_0be7d9b1d01d")}</span>
          </div>
        </div>
        <div className="hn-inbound-stat">
          <span className="hn-inbound-stat-icon">
            <UiIcon name="barcode" size="lg" />
          </span>
          <div>
            <Tooltip title={getUNAVAILABLE_SCAN_TOTAL()} describeChild arrow>
              <strong
                tabIndex={0}
                aria-label={tUi("updatedUi.text_179b88983ff5", {
                  value0: String(getUNAVAILABLE_SCAN_TOTAL()),
                })}
              >
                —
              </strong>
            </Tooltip>
            <span>{tUi("updatedUi.text_05ea4b62f14a")}</span>
          </div>
        </div>
      </div>

      {hasError ? (
        <p className="hn-inbound-overview-error" role="alert">
          {tUi("updatedUi.text_7ccd0847f18c")}
        </p>
      ) : null}
      <div className="hn-inbound-overview-note">
        <UiIcon name="info" size="sm" />
        <span>{tUi("updatedUi.text_a8888f21db98")}</span>
      </div>
    </section>
  );
}
