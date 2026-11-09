import { EMPTY_TEXT } from "@/shared/constants/display";
import { SkuLink } from "@/shared/components/data-display/SkuLink";
import { UiIcon, UiStatusBadge } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import type { PutawayTask, TrayOption } from "../services/putawayService";

type BoxChainProps = {
  boxes: PutawayTask[];
  selectedTray: TrayOption | null;
};

/**
 * Luồng xếp nhiều BOX vào một khay: mỗi BOX một card, nối bằng mũi tên tới
 * card khay đích. Chỉ trình bày dữ liệu đã có trên `PutawayTask`/`TrayOption`.
 */
export function BoxChain({ boxes, selectedTray }: BoxChainProps) {
  const t = useT();
  return (
    <ol className="ptw-box-chain" aria-label={t("putaway.page.chainAria")}>
      {boxes.map((box, index) => {
        const stored = box.status === "STORED";
        return (
          <li className="ptw-box-chain-step" key={box.box_container_id}>
            <article className="ptw-box-chain-card">
              <header className="ptw-box-chain-card-head">
                <span className="ptw-box-chain-box-label">
                  {t("putaway.page.boxNumber", { index: index + 1 })}
                </span>
                <strong className="ptw-box-chain-box-code">
                  {box.box_code}
                </strong>
              </header>
              <dl className="ptw-box-chain-fields">
                <div className="ptw-box-chain-field is-wide">
                  <dt>{t("putaway.page.colSku")}</dt>
                  <dd>
                    <SkuLink code={box.sku_code} />
                  </dd>
                </div>
                <div className="ptw-box-chain-field">
                  <dt>{t("putaway.page.colQuantity")}</dt>
                  <dd>{box.quantity.toLocaleString("vi-VN")}</dd>
                </div>
                <div className="ptw-box-chain-field">
                  <dt>{t("putaway.page.fieldReceipt")}</dt>
                  <dd>{box.receipt_code || EMPTY_TEXT}</dd>
                </div>
              </dl>
              <UiStatusBadge
                label={
                  stored
                    ? t("putaway.page.boxStatusStored")
                    : t("putaway.page.boxStatusPending")
                }
                tone={stored ? "success" : "warning"}
                sx={{ mt: 1, alignSelf: "flex-start" }}
              />
            </article>
            <span className="ptw-box-chain-arrow" aria-hidden="true">
              <UiIcon name="angle-small-right" />
            </span>
          </li>
        );
      })}
      <li className="ptw-box-chain-step">
        <article className="ptw-box-chain-card is-destination">
          <header className="ptw-box-chain-card-head">
            <span className="ptw-box-chain-box-label">
              {t("putaway.page.trayDestination")}
            </span>
          </header>
          <strong className="ptw-box-chain-tray-code">
            {selectedTray?.container_code ?? t("putaway.page.notChosen")}
          </strong>
          {selectedTray?.location_hint ? (
            <span className="ptw-box-chain-tray-location">
              {selectedTray.location_hint}
            </span>
          ) : null}
        </article>
      </li>
    </ol>
  );
}
