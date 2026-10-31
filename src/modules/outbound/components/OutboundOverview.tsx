import { localizedValue as localizedUiValue } from "@/shared/i18n/localized-value";
import { useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { UiIcon } from "@/shared/ui";
import {
  fetchOutboundDocuments,
  type OutboundListResult,
  type OutboundStatus,
} from "@/modules/outbound/services/alignedOutboundService";
import { formatQuantity } from "@/shared/utils/format-number";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { tStatic as tUi } from "@/shared/i18n/useT";

const getSTATUS_CARDS = localizedUiValue(
  (): ReadonlyArray<{
    status: OutboundStatus;
    label: string;
  }> => [
    { status: "DRAFT", label: tUi("outbound.detail.labelStatusDraft") },
    { status: "SCANNING", label: tUi("updatedUi.text_71e1f4001cc2") },
    { status: "POSTED", label: tUi("reports.traceability.issued") },
    { status: "CANCELLED", label: tUi("warranty.status.cancelled") },
  ],
);

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
  const [expanded, setExpanded] = useState(true);
  const queries = useQueries({
    queries: [undefined, ...getSTATUS_CARDS().map(({ status }) => status)].map(
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
      aria-label={tUi("updatedUi.text_b11b59304497")}
      aria-busy={busy}
    >
      <div className="hn-outbound-overview-heading">
        <h2>{tUi("updatedUi.text_b11b59304497")}</h2>
        <button
          type="button"
          className="hn-outbound-overview-toggle"
          aria-label={expanded ? tUi("common.collapse") : tUi("common.expand")}
          aria-expanded={expanded}
          aria-controls="hn-outbound-overview-content"
          onClick={() => setExpanded((value) => !value)}
        >
          <UiIcon name="angle-small-down" size="sm" />
        </button>
      </div>
      <div id="hn-outbound-overview-content" hidden={!expanded}>
      <div className="hn-outbound-overview-metrics" aria-live="polite">
        <div className="hn-outbound-total">
          <strong>{displayTotal(queries[0])}</strong>
          <span>{tUi("updatedUi.text_b825b57a8a53")}</span>
        </div>
        <div className="hn-outbound-stats">
          {getSTATUS_CARDS().map(({ status, label }, index) => (
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
          <span>{tUi("updatedUi.text_66b84b6f7dee")}</span>
          <button type="button" onClick={refresh} disabled={busy}>
            <UiIcon name="refresh" size="sm" />
            {busy ? tUi("warranty.detail.uploading") : tUi("common.retry")}
          </button>
        </div>
      ) : null}
      <div className="hn-outbound-overview-note">
        <UiIcon name="info" size="sm" />
        <span>{tUi("updatedUi.text_ef700a3a2f41")}</span>
      </div>
      </div>
    </section>
  );
}
