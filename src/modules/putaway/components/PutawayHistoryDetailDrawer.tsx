import type { ReactNode } from "react";
import { ActionIconButton } from "@/shared/components/actions";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { useT } from "@/shared/i18n/useT";
import { UiDrawer, UiIcon, UiStatusBadge } from "@/shared/ui";
import { formatDateTime } from "@/shared/utils/format-date";
import type { PutawayHistory } from "../services/putawayService";
import "./putaway-history-detail.css";

function DetailField({
  label,
  value,
  full = false,
}: {
  label: string;
  value: ReactNode;
  full?: boolean;
}) {
  return (
    <div className={`ptw-history-detail__field${full ? " is-full" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

export function PutawayHistoryDetailDrawer({
  history,
  onClose,
}: {
  history: PutawayHistory | null;
  onClose: () => void;
}) {
  const t = useT();
  if (!history) return null;
  const quantity = history.quantity ?? 0;

  return (
    <UiDrawer
      open
      onClose={onClose}
      width={640}
      className="ptw-history-drawer"
      title={t("putaway.page.detailTitleWithBox", { code: history.box_code })}
      headerEnd={
        <ActionIconButton
          kind="close"
          label={t("common.close")}
          onClick={onClose}
        />
      }
      slotProps={{ paper: { role: "dialog", "aria-modal": true } }}
    >
      <div className="ptw-history-detail">
        <div className="ptw-history-detail__summary">
          <UiStatusBadge
            tone="success"
            label={t("putaway.page.boxStatusStored")}
          />
          <span>
            {t("putaway.page.colTime")}: {formatDateTime(history.created_at)}
          </span>
        </div>

        <section
          className="ptw-history-detail__section"
          aria-labelledby="ptw-history-info"
        >
          <h3 id="ptw-history-info">{t("putaway.page.historyInfoSection")}</h3>
          <dl className="ptw-history-detail__grid">
            <DetailField
              label={t("putaway.page.colBox")}
              value={history.box_code}
            />
            <DetailField
              label={t("putaway.page.colOldTray")}
              value={history.old_tray_code || EMPTY_TEXT}
            />
            <DetailField
              label={t("putaway.page.colNewTray")}
              value={history.new_tray_code || EMPTY_TEXT}
            />
            <DetailField
              label={t("putaway.page.colLocation")}
              value={history.location_hint || EMPTY_TEXT}
            />
            <DetailField
              label={t("putaway.page.colActor")}
              value={history.actor_name || EMPTY_TEXT}
            />
            <DetailField
              label={t("putaway.queue.receipt")}
              value={history.receipt_code || EMPTY_TEXT}
            />
            <DetailField
              label={t("putaway.page.colStockEffect")}
              value={t("putaway.page.stockUnchanged")}
            />
            <DetailField
              label={t("putaway.page.historyNote")}
              value={history.note || EMPTY_TEXT}
              full
            />
          </dl>
        </section>

        <section
          className="ptw-history-detail__section"
          aria-labelledby="ptw-history-sku"
        >
          <h3 id="ptw-history-sku">{t("putaway.page.historySkuSection")}</h3>
          {history.sku_code ? (
            <div className="ptw-history-sku">
              <div className="ptw-history-sku__main">
                <span className="ptw-history-sku__label">
                  {t("putaway.page.colSku")}
                </span>
                <SkuLink code={history.sku_code} />
                <span>{history.sku_name || EMPTY_TEXT}</span>
              </div>
              <div className="ptw-history-sku__qty">
                <span className="ptw-history-sku__label">
                  {t("putaway.page.colQuantity")}
                </span>
                <strong>{quantity.toLocaleString("vi-VN")}</strong>
                <span>{history.unit || EMPTY_TEXT}</span>
              </div>
            </div>
          ) : (
            <p className="ptw-history-detail__empty">
              {t("putaway.page.historyNoSku")}
            </p>
          )}
        </section>

        <p className="ptw-history-detail__readonly">
          <UiIcon name="info" size="sm" />
          <span>{t("putaway.page.historyReadOnly")}</span>
        </p>
      </div>
    </UiDrawer>
  );
}
