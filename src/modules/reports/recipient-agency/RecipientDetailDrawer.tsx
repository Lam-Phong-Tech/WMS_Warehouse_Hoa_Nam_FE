import { useLayoutEffect, useRef, useState } from "react";
import { UiButton, UiDrawer, UiStatusBadge } from "@/shared/ui";
import { ActionIconButton } from "@/shared/components/actions";
import { ShopOutlined } from "@/shared/components/icons";
import { ResponsiveDataTable } from "@/shared/components/data-display/ResponsiveDataTable";
import { useT } from "@/shared/i18n/useT";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { useReversalDocuments } from "../operations/report-data";
import type { RecipientAgencyLedgerEvent } from "./recipient-agency-api";
import { RecipientReturnPanel } from "./RecipientReturnPanel";
import "./recipient-detail-drawer.css";

export type RecipientDetailDocument = {
  id: string;
  no: string;
  date: string;
  quantity: number;
  incomplete: boolean;
};
type Props = {
  recipientName: string;
  receiver: string;
  documents: RecipientDetailDocument[];
  events: RecipientAgencyLedgerEvent[];
  range: { from: string; to: string };
  formatDocumentDate: (value: string) => string;
  onClose: () => void;
};

function ReturnView({
  recipientName,
  events,
  range,
}: Pick<Props, "recipientName" | "events" | "range">) {
  const query = useReversalDocuments(range);
  return (
    <RecipientReturnPanel
      recipientName={recipientName}
      events={events}
      reversalRows={Array.isArray(query.data?.data) ? query.data.data : []}
      loading={query.isPending}
      error={query.error instanceof Error ? query.error : null}
      onRetry={() => void query.refetch()}
    />
  );
}

export function RecipientDetailDrawer({
  recipientName,
  receiver,
  documents,
  events,
  range,
  formatDocumentDate,
  onClose,
}: Props) {
  const t = useT();
  const drawer = useDialogExit(onClose);
  const [returns, setReturns] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const body = contentRef.current?.closest<HTMLElement>(
      "[data-ui-drawer-body]",
    );
    if (body) body.scrollTop = 0;
  }, [returns]);
  const count = (value: number) =>
    new Intl.NumberFormat("vi-VN").format(Math.max(0, Math.round(value)));
  return (
    <UiDrawer
      {...drawer.dialogProps}
      width={820}
      className="rpt07-recipient-drawer"
      title={
        <span className="rpt07-recipient-heading">
          <span>
            {returns
              ? `${t("reports.recipientAgency.returnTitle")} · ${recipientName}`
              : `${t("updatedUi.text_264600c191dc")} ${recipientName}`}
          </span>
          <ActionIconButton
            kind="close"
            label={t("common.close")}
            onClick={drawer.close}
            className="rpt07-recipient-close"
          />
        </span>
      }
      actions={
        <UiButton
          appearance="outlined"
          onClick={() => setReturns((value) => !value)}
        >
          {t(
            returns
              ? "reports.recipientAgency.returnBack"
              : "reports.recipientAgency.returnOpen",
          )}
        </UiButton>
      }
    >
      <div className="rpt07-recipient-content" ref={contentRef}>
        {returns ? (
          <ReturnView
            recipientName={recipientName}
            events={events}
            range={range}
          />
        ) : (
          <>
            <div className="rpt07-recipient-summary">
              <ShopOutlined aria-hidden="true" />
              <div>
                <strong>{recipientName}</strong>
                <span>
                  {receiver === "—"
                    ? t("updatedUi.text_7e49f04ad717")
                    : `${t("updatedUi.text_1339766f6a53")} ${receiver}`}
                </span>
              </div>
            </div>
            <div className="rpt07-recipient-table">
              <ResponsiveDataTable<RecipientDetailDocument>
                rows={documents}
                rowKey={(row) => row.id}
                columns={[
                  {
                    key: "no",
                    header: t("warranty.componentList.colCode"),
                    width: "42%",
                    truncate: 0,
                    render: (row) => (
                      <span className="rpt07-recipient-code">{row.no}</span>
                    ),
                  },
                  {
                    key: "date",
                    header: t("reports.warranty.colIssueDate"),
                    width: "20%",
                    truncate: 0,
                    render: (row) => formatDocumentDate(row.date),
                  },
                  {
                    key: "quantity",
                    header: t("outbound.detail.fieldItemCount"),
                    width: "18%",
                    align: "right",
                    truncate: 0,
                    render: (row) => count(row.quantity),
                  },
                  {
                    key: "status",
                    header: t("dashboard.composition.colStatus"),
                    width: "20%",
                    render: (row) => (
                      <UiStatusBadge
                        className="rpt07-recipient-status"
                        data-tone={row.incomplete ? "warning" : "success"}
                        tone={row.incomplete ? "warning" : "success"}
                        label={t(
                          row.incomplete
                            ? "updatedUi.text_0e27d3ce9670"
                            : "iam.permissionAction.post",
                        )}
                      />
                    ),
                  },
                ]}
              />
            </div>
          </>
        )}
      </div>
    </UiDrawer>
  );
}
