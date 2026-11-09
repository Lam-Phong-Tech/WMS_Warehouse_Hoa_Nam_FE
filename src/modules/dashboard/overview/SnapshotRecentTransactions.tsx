import { parseDateTime } from "@/shared/utils/date-time";

import { useIoHistorySnapshot } from "@/modules/reports/io-history/io-history-api";
import { dashboardNow, fmt } from "./overview-data";
import { useT } from "@/shared/i18n/useT";
import { RowActionButton } from "@/shared/components/actions";
import { rowActivationProps } from "@/shared/components/data-display/row-activation";
import { ROUTES } from "@/shared/constants/routes";
import "./dashboard-system-views.css";

export function SnapshotRecentTransactions({
  onNavigate,
}: {
  onNavigate: (route: string) => void;
}) {
  const t = useT();
  const now = dashboardNow();
  const source = useIoHistorySnapshot({
    from: now.subtract(6, "day").format("YYYY-MM-DD"),
    to: now.format("YYYY-MM-DD"),
    type: "",
  });
  const documents = source.snapshot.rows.slice(0, 5);

  return (
    <article className="snapshot-card snapshot-recent">
      <header>
        <h2>{t("dashboard.snapshot.recentDocsTitle")}</h2>
      </header>
      {source.error && documents.length > 0 ? (
        <div className="snapshot-partial-alert" role="status">
          {t("dashboardSnapshot.transactionsStale")}{" "}
          <button type="button" onClick={() => void source.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : null}
      {source.loading ? (
        <div className="snapshot-recent-state" role="status">
          {t("dashboardSnapshot.transactionsLoading")}
        </div>
      ) : source.error && documents.length === 0 ? (
        <div className="snapshot-recent-state" role="alert">
          {t("dashboardSnapshot.transactionsFailed")}{" "}
          <button type="button" onClick={() => void source.refetch()}>
            {t("common.retry")}
          </button>
        </div>
      ) : documents.length === 0 ? (
        <div className="snapshot-recent-state">
          <strong>{t("dashboardSnapshot.transactionsEmpty")}</strong>
          <span>{t("dashboardSnapshot.transactionsEmptyCopy")}</span>
        </div>
      ) : (
        <div
          className="snapshot-recent-table"
          role="region"
          aria-label={t("dashboard.snapshot.recentDocsTitle")}
          tabIndex={0}
        >
          <table>
            <colgroup>
              {[6, 14, 24, 12, 24, 12, 8].map((width, index) => (
                <col key={index} style={{ width: `${width}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col">{t("shared.table.rowNumber")}</th>
                <th>{t("dashboardSnapshot.posted")}</th>
                <th>{t("dashboardSnapshot.document")}</th>
                <th>{t("dashboardSnapshot.type")}</th>
                <th>{t("dashboardSnapshot.partner")}</th>
                <th>{t("dashboardSnapshot.quantity")}</th>
                <th aria-label={t("common.viewDetail")} />
              </tr>
            </thead>
            <tbody>
              {documents.map((document, index) => {
                const detailRoute =
                  document.type === "INBOUND"
                    ? `${ROUTES.REPORTS_INVENTORY_FLOW}?screen=RPT-01&document=${encodeURIComponent(document.id)}`
                    : document.type === "OUTBOUND"
                      ? `${ROUTES.REPORTS_OUTBOUND_FLOW}?screen=RPT-01B&document=${encodeURIComponent(document.id)}`
                      : `${ROUTES.REPORTS_PENDING_EVIDENCE}?screen=RPT-08`;
                return (
                  <tr
                    key={document.id}
                    {...rowActivationProps(() => onNavigate(detailRoute))}
                  >
                    <td>{index + 1}</td>
                    <td>
                      {parseDateTime(document.postedAt).format("DD/MM HH:mm")}
                    </td>
                    <td>
                      <strong>{document.documentNo}</strong>
                    </td>
                    <td>
                      {document.type === "INBOUND"
                        ? t("dashboard.snapshot.tooltipInbound")
                        : document.type === "OUTBOUND"
                          ? t("dashboard.snapshot.tooltipOutbound")
                          : t("dashboardSnapshot.reversal")}
                    </td>
                    <td>{document.party || "—"}</td>
                    <td>
                      {document.qty === null
                        ? "—"
                        : `${document.qty > 0 ? "+" : ""}${fmt(document.qty)}`}
                    </td>
                    <td>
                      <RowActionButton
                        kind="view"
                        aria-label={t("dashboardSnapshot.viewDocument", {
                          document: document.documentNo,
                        })}
                        onClick={() => onNavigate(detailRoute)}
                      >
                        {t("dashboardSnapshot.view")}
                      </RowActionButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}
