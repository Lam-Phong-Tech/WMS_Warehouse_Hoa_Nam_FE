import type { ReactNode } from "react";
import { UiDrawer, UiStatusBadge } from "@/shared/ui";
import { ActionIconButton } from "@/shared/components/actions";
import { useT } from "@/shared/i18n/useT";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { reportStatusLabel, statusTone } from "../../operations/report-labels";
import { displayStamp, number, type HistoryRow } from "./model";
import { TypePill } from "./widgets";
import "./transaction-detail-drawer.css";

function DetailField({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function TransactionDetailDrawer({
  row,
  onClose,
}: {
  row: HistoryRow;
  onClose: () => void;
}) {
  const t = useT();
  const drawer = useDialogExit(onClose);
  const status = row.source?.status || "POSTED";
  return (
    <UiDrawer
      {...drawer.dialogProps}
      width={640}
      className="rpt08-transaction-drawer"
      title={
        <span className="rpt08-transaction-heading">
          <span className="rpt08-transaction-title">
            {t("updatedUi.text_11e692fd1ec1", { value0: row.documentNo })}
          </span>
          <span className="rpt08-transaction-caption">
            {t("updatedUi.text_3244b982398e")}
          </span>
          <ActionIconButton
            kind="close"
            label={t("common.close")}
            onClick={drawer.close}
            className="rpt08-transaction-close"
          />
        </span>
      }
    >
      <dl className="rpt08-transaction-fields">
        <DetailField label={t("updatedUi.text_94c1cbc6d405")}>
          <TypePill type={row.type} />
        </DetailField>
        <DetailField label={t("inventory.movement.colTime")}>
          {displayStamp(row.timestamp)}
        </DetailField>
        <DetailField label={t("audit.colObject")}>
          {row.objectPrimary} · {row.objectSecondary}
        </DetailField>
        <DetailField label={t("dashboard.stockMix.colQuantity")}>
          {row.quantity === null ? "—" : number(row.quantity)}
        </DetailField>
        <DetailField label={t("inventory.trace.colPerformedBy")}>
          {row.actor}
        </DetailField>
        <DetailField label={t("dashboard.composition.colStatus")}>
          <UiStatusBadge
            tone={statusTone(status)}
            label={reportStatusLabel(status)}
          />
        </DetailField>
      </dl>
    </UiDrawer>
  );
}
