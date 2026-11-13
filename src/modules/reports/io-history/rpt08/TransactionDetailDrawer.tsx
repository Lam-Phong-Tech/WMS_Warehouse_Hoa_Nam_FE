import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { UiDrawer, UiStatusBadge } from "@/shared/ui";
import { ActionIconButton } from "@/shared/components/actions";
import { ArrowRightOutlined } from "@/shared/components/icons";
import { ROUTES } from "@/shared/constants/routes";
import { useT } from "@/shared/i18n/useT";
import { useDialogExit } from "@/shared/utils/useDialogExit";
import { reportStatusLabel, statusTone } from "../../operations/report-labels";
import { displayDay, displayStamp, number, type HistoryRow } from "./model";
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

/** Ngày chứng từ (chỉ có ngày) và thời điểm đầy đủ hiển thị khác nhau. */
function documentDay(value: string): string {
  if (!value) return "—";
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? displayDay(value) : displayStamp(value);
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
  const navigate = useNavigate();
  const status = row.source?.status || "POSTED";
  // Nút "Xem chi tiết phiếu": deep-link vào màn chi tiết phiếu nhập/xuất
  // (cùng mẫu với thông báo hệ thống). Phiếu đảo không có target.
  const documentTarget =
    row.type === "INBOUND"
      ? `${ROUTES.INBOUND}?screen=IN-03&id=${row.source?.id ?? ""}`
      : row.type === "OUTBOUND"
        ? `${ROUTES.OUTBOUND}?screen=OUT-02&id=${row.source?.id ?? ""}`
        : null;
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
        <DetailField label={t("rpt08.detail.department")}>
          {row.department}
        </DetailField>
        <DetailField label={t("rpt08.detail.createdDate")}>
          {documentDay(row.createdAt)}
        </DetailField>
        <DetailField label={t("rpt08.detail.movement")}>
          {row.movementNo
            ? row.movementNo
            : row.movementCount > 1
              ? t("rpt08.detail.movements", { count: String(row.movementCount) })
              : "—"}
        </DetailField>
        {row.type === "REVERSAL" ? (
          <DetailField label={t("rpt08.detail.originalDocument")}>
            {row.source?.originalDocumentNo || "—"}
          </DetailField>
        ) : null}
        <DetailField label={t("dashboard.composition.colStatus")}>
          <UiStatusBadge
            tone={statusTone(status)}
            label={reportStatusLabel(status)}
          />
        </DetailField>
      </dl>

      {documentTarget ? (
        <button
          type="button"
          className="rpt08-transaction-action"
          onClick={() => navigate(documentTarget)}
        >
          <span>
            {row.type === "INBOUND"
              ? t("rpt08.detail.viewInboundDocument")
              : t("rpt08.detail.viewOutboundDocument")}
          </span>
          <ArrowRightOutlined />
        </button>
      ) : null}

      {row.type !== "REVERSAL" && row.lines.length > 0 ? (
        <div className="rpt08-lines">
          <div className="rpt08-lines__head">
            <h3>{t("rpt08.detail.linesTitle")}</h3>
            <span>{t("rpt08.detail.linesCount", { count: String(row.lines.length) })}</span>
          </div>
          <ul className="rpt08-lines__list">
            {row.lines.map((line, index) => (
              <li key={index}>
                <span className="rpt08-lines__sku">{line.code || "—"}</span>
                <span className="rpt08-lines__name" title={line.name}>
                  {line.name || "—"}
                </span>
                <span className="rpt08-lines__qty">
                  {line.qty === null ? "—" : number(line.qty)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </UiDrawer>
  );
}
