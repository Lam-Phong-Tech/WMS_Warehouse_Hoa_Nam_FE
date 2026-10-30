import type { RecipientAgencyLedgerEvent } from "./recipient-agency-api";
import { DrillDownDialog } from "@/modules/reports/operations/report-ui";
import { useT } from "@/shared/i18n/useT";
import { formatDateTime } from "@/shared/utils/format-date";
import { buildRecipientReturnReconciliation } from "./recipient-return-model";

type IssueEvent = Pick<
  RecipientAgencyLedgerEvent,
  "event_type" | "outbound_document_id" | "outbound_no" | "occurred_at" | "quantity"
>;

export function RecipientReturnDialog({
  recipientName,
  events,
  reversalRows,
  loading,
  error,
  onRetry,
  onBack,
  onClose,
}: {
  recipientName: string;
  events: IssueEvent[];
  reversalRows: Record<string, unknown>[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const t = useT();
  const result = buildRecipientReturnReconciliation(events, reversalRows);
  const number = (value: number) => new Intl.NumberFormat("vi-VN").format(value);

  return (
    <DrillDownDialog title={t("reports.recipientAgency.returnTitle")} maxWidth="lg" onClose={onClose}>
      <div className="rpt07-return-dialog">
        <button type="button" className="rpt07-return-dialog__back" onClick={onBack}>{t("reports.recipientAgency.returnBack")}</button>
        <h3>{recipientName}</h3>
        {loading ? <p role="status">{t("common.loadingData")}</p> : null}
        {error ? <div role="alert"><p>{error.message}</p><button type="button" onClick={onRetry}>{t("common.retry")}</button></div> : null}
        {!loading && !error ? (
          <>
            <div className="rpt07-return-dialog__totals">
              <div><small>{t("reports.recipientAgency.colGross")}</small><strong>{number(result.totals.gross)}</strong></div>
              <span>−</span>
              <div><small>{t("reports.recipientAgency.colReversed")}</small><strong>{number(result.totals.reversed)}</strong></div>
              <span>=</span>
              <div><small>{t("reports.recipientAgency.colNet")}</small><strong data-testid="return-net-total">{number(result.totals.net)}</strong></div>
            </div>
            <section>
              <h4>{t("reports.recipientAgency.returnDocuments")} ({result.reversals.length})</h4>
              {result.reversals.length === 0 ? <p>{t("reports.recipientAgency.returnEmpty")}</p> : (
                <div className="rpt07-return-dialog__table-wrap"><table>
                  <thead><tr><th>{t("reports.recipientAgency.returnDocument")}</th><th>{t("reports.recipientAgency.returnPostedAt")}</th><th>{t("reports.recipientAgency.returnSource")}</th><th>{t("reports.recipientAgency.colReversed")}</th><th>{t("reports.recipientAgency.returnStatus")}</th></tr></thead>
                  <tbody>{result.reversals.map((row) => <tr key={row.id}><td>{row.code}</td><td>{row.postedAt ? formatDateTime(row.postedAt) : "—"}</td><td>{row.sourceCode}</td><td>{number(row.quantity)}</td><td>{row.status}</td></tr>)}</tbody>
                </table></div>
              )}
            </section>
            <section>
              <h4>{t("reports.recipientAgency.returnSources")}</h4>
              <div className="rpt07-return-dialog__table-wrap"><table>
                <thead><tr><th>{t("reports.recipientAgency.returnSource")}</th><th>{t("reports.recipientAgency.colGross")}</th><th>{t("reports.recipientAgency.colReversed")}</th><th>{t("reports.recipientAgency.colNet")}</th></tr></thead>
                <tbody>{result.sources.map((row) => <tr key={row.id}><td>{row.code}</td><td>{number(row.gross)}</td><td>{number(row.reversed)}</td><td>{number(row.net)}</td></tr>)}</tbody>
              </table></div>
            </section>
          </>
        ) : null}
      </div>
    </DrillDownDialog>
  );
}
