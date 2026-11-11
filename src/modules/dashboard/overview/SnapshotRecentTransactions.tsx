import { parseDateTime } from "@/shared/utils/date-time";

import { useIoHistorySnapshot } from "@/modules/reports/io-history/io-history-api";
import { dashboardNow, fmt } from "./overview-data";
import { useT } from "@/shared/i18n/useT";
import { RowActionButton } from "@/shared/components/actions";
import { rowActivationProps } from "@/shared/components/data-display/row-activation";
import { ROUTES } from "@/shared/constants/routes";
import {
  INBOUND_STATUS_LABELS,
  OUTBOUND_STATUS_LABELS,
  REVERSAL_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import "./dashboard-system-views.css";

function statusLabel(type: "INBOUND" | "OUTBOUND" | "REVERSAL", status: string) {
  const labels =
    type === "INBOUND"
      ? INBOUND_STATUS_LABELS
      : type === "OUTBOUND"
        ? OUTBOUND_STATUS_LABELS
        : REVERSAL_STATUS_LABELS;
  return businessLabel(labels, status);
}

function statusTone(type: "INBOUND" | "OUTBOUND" | "REVERSAL", status: string) {
  if (!status) return "neutral";
  if (status === "CANCELLED") return "danger";
  if (status === "DRAFT" || status === "SCANNING") return "warning";
  // Trong phạm vi "Giao dịch gần đây", phiếu nhập/xuất/hoàn tác đã ghi sổ.
  return type === "REVERSAL" || status === "POSTED" ? "success" : "neutral";
}

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
              {[5, 12, 21, 10, 17, 15, 11, 9].map((width, index) => (
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
                <th>{t("dashboard.composition.colStatus")}</th>
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
                      <span
                        className="snapshot-recent-status"
                        data-tone={statusTone(
                          document.type,
                          document.status,
                        )}
                      >
                        {statusLabel(document.type, document.status)}
                      </span>
                    </td>
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
