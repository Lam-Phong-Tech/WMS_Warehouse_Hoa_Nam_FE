import type { RecipientAgencyLedgerEvent } from "./recipient-agency-api";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { UiButton, UiStatusBadge } from "@/shared/ui";
import { reportStatusLabel, statusTone } from "../operations/report-labels";
import { useT } from "@/shared/i18n/useT";
import { formatDateTime } from "@/shared/utils/format-date";
import { buildRecipientReturnReconciliation } from "./recipient-return-model";

type IssueEvent = Pick<
  RecipientAgencyLedgerEvent,
  | "event_type"
  | "outbound_document_id"
  | "outbound_no"
  | "occurred_at"
  | "quantity"
>;

export function RecipientReturnPanel({
  recipientName,
  events,
  reversalRows,
  loading,
  error,
  onRetry,
}: {
  recipientName: string;
  events: IssueEvent[];
  reversalRows: Record<string, unknown>[];
  loading: boolean;
  error: Error | null;
  onRetry: () => void;
}) {
  const t = useT();
  const result = buildRecipientReturnReconciliation(events, reversalRows);
  const number = (value: number) =>
    new Intl.NumberFormat("vi-VN").format(value);

  return (
    <div className="rpt07-recipient-return">
      <h3>{recipientName}</h3>
      {loading ? <p role="status">{t("common.loadingData")}</p> : null}
      {error ? (
        <div role="alert">
          <p>{error.message}</p>
          <UiButton appearance="outlined" onClick={onRetry}>
            {t("common.retry")}
          </UiButton>
        </div>
      ) : null}
      {!loading && !error ? (
        <>
          <div className="rpt07-recipient-totals">
            <div>
              <small>{t("reports.recipientAgency.colGross")}</small>
              <strong>{number(result.totals.gross)}</strong>
            </div>
            <span>−</span>
            <div>
              <small>{t("reports.recipientAgency.colReversed")}</small>
              <strong>{number(result.totals.reversed)}</strong>
            </div>
            <span>=</span>
            <div>
              <small>{t("reports.recipientAgency.colNet")}</small>
              <strong data-testid="return-net-total">
                {number(result.totals.net)}
              </strong>
            </div>
          </div>
          <section>
            <h4>
              {t("reports.recipientAgency.returnDocuments")} (
              {result.reversals.length})
            </h4>
            {result.reversals.length === 0 ? (
              <p>{t("reports.recipientAgency.returnEmpty")}</p>
            ) : (
              <div className="rpt07-recipient-table">
                <ResponsiveDataTable
                  rows={result.reversals}
                  rowKey={(row) => row.id}
                  columns={[
                    {
                      key: "code",
                      header: t("reports.recipientAgency.returnDocument"),
                      width: "24%",
                      truncate: 0,
                      render: (row) => (
                        <span className="rpt07-recipient-code">{row.code}</span>
                      ),
                    },
                    {
                      key: "date",
                      header: t("reports.recipientAgency.returnPostedAt"),
                      width: "22%",
                      truncate: 0,
                      render: (row) =>
                        row.postedAt ? formatDateTime(row.postedAt) : "—",
                    },
                    {
                      key: "source",
                      header: t("reports.recipientAgency.returnSource"),
                      width: "24%",
                      truncate: 0,
                      render: (row) => (
                        <span className="rpt07-recipient-code">
                          {row.sourceCode}
                        </span>
                      ),
                    },
                    {
                      key: "quantity",
                      header: t("reports.recipientAgency.colReversed"),
                      width: "10%",
                      align: "right",
                      truncate: 0,
                      render: (row) => number(row.quantity),
                    },
                    {
                      key: "status",
                      header: t("reports.recipientAgency.returnStatus"),
                      width: "20%",
                      render: (row) => (
                        <UiStatusBadge
                          className="rpt07-recipient-status"
                          data-tone={statusTone(row.status)}
                          tone={statusTone(row.status)}
                          label={reportStatusLabel(row.status)}
                        />
                      ),
                    },
                  ]}
                />
              </div>
            )}
          </section>
          <section>
            <h4>{t("reports.recipientAgency.returnSources")}</h4>
            <div className="rpt07-recipient-table">
              <ResponsiveDataTable
                rows={result.sources}
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: "code",
                    header: t("reports.recipientAgency.returnSource"),
                    width: "46%",
                    truncate: 0,
                    render: (row) => (
                      <span className="rpt07-recipient-code">{row.code}</span>
                    ),
                  },
                  {
                    key: "gross",
                    header: t("reports.recipientAgency.colGross"),
                    width: "18%",
                    align: "right",
                    truncate: 0,
                    render: (row) => number(row.gross),
                  },
                  {
                    key: "reversed",
                    header: t("reports.recipientAgency.colReversed"),
                    width: "18%",
                    align: "right",
                    truncate: 0,
                    render: (row) => number(row.reversed),
                  },
                  {
                    key: "net",
                    header: t("reports.recipientAgency.colNet"),
                    width: "18%",
                    align: "right",
                    truncate: 0,
                    render: (row) => number(row.net),
                  },
                ]}
              />
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
