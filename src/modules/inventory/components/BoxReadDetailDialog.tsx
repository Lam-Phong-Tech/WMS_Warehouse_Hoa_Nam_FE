import { useT } from "@/shared/i18n";
import { useState } from "react";
import { UiDialog } from "@/shared/ui";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  useBoxReadProjection,
  useContainerRegisterDetail,
} from "../hooks/use-inventory";

type Props = {
  containerId: string;
  warehouseId: string;
  code: string;
  onClose: () => void;
};

/** Read-only BOX register detail. The API deliberately does not promise availability or physical placement. */
export function BoxReadDetailDialog({
  containerId,
  warehouseId,
  code,
  onClose,
}: Props) {
  const t = useT();
  const [showTray, setShowTray] = useState(false);
  const box = useBoxReadProjection(containerId, warehouseId);
  const trayId = showTray ? box.data?.parent_container_id : null;
  const tray = useContainerRegisterDetail(trayId);

  return (
    <UiDialog
      open
      onClose={onClose}
      title={t("dashboardAudit.boxTitle", { code })}
      maxWidth="md"
      fullWidth
      className="hn-box-read-dialog"
    >
      <div className="hn-box-read">
        {box.isLoading ? (
          <p role="status">{t("dashboardAudit.boxLoading")}</p>
        ) : null}
        {box.isError ? (
          <ApiErrorAlert
            error={box.error}
            title={t("dashboardAudit.boxFailed")}
            onRetry={() => box.refetch()}
          />
        ) : null}
        {box.data ? (
          <>
            <div className="hn-box-read__grid">
              <div>
                <span>{t("dashboardAudit.boxCode")}</span>
                <strong>{box.data.container_code}</strong>
              </div>
              <div>
                <span>{t("dashboardAudit.recordedSku")}</span>
                <strong>
                  {box.data.sku?.code || t("dashboardAudit.unassigned")}
                </strong>
              </div>
              <div>
                <span>{t("dashboardAudit.status")}</span>
                <strong>{box.data.status || "—"}</strong>
              </div>
              <div>
                <span>{t("dashboardAudit.boxQuantity")}</span>
                <strong>
                  {box.data.contained_qty === null
                    ? t("dashboardAudit.notRecorded")
                    : box.data.contained_qty.toLocaleString("vi-VN")}
                </strong>
              </div>
              <div>
                <span>{t("dashboardAudit.locationHint")}</span>
                <strong>
                  {box.data.location_hint || t("dashboardAudit.notAvailable")}
                </strong>
              </div>
              <div>
                <span>{t("dashboardAudit.linkedTray")}</span>
                <strong>
                  {box.data.parent_container_id ||
                    t("dashboardAudit.notAvailable")}
                </strong>
              </div>
            </div>
            <p className="hn-box-read__note">{t("dashboardAudit.boxNote")}</p>
            {box.data.parent_container_id ? (
              <button
                type="button"
                className="hn-box-read__link"
                onClick={() => setShowTray((value) => !value)}
              >
                {showTray
                  ? t("dashboardAudit.hideTray")
                  : t("dashboardAudit.viewTray")}
              </button>
            ) : null}
            {showTray ? (
              <section className="hn-box-read__tray">
                <h3>{t("dashboardAudit.trayDetails")}</h3>
                {tray.isLoading ? (
                  <p role="status">{t("dashboardAudit.trayLoading")}</p>
                ) : null}
                {tray.isError ? (
                  <ApiErrorAlert
                    error={tray.error}
                    title={t("dashboardAudit.trayFailed")}
                    onRetry={() => tray.refetch()}
                  />
                ) : null}
                {tray.data ? (
                  tray.data.container_type === "TRAY" ? (
                    <div className="hn-box-read__grid">
                      <div>
                        <span>{t("dashboardAudit.trayCode")}</span>
                        <strong>{tray.data.container_code}</strong>
                      </div>
                      <div>
                        <span>{t("dashboardAudit.status")}</span>
                        <strong>{tray.data.status || "—"}</strong>
                      </div>
                      <div>
                        <span>{t("dashboardAudit.locationHint")}</span>
                        <strong>
                          {tray.data.location_hint ||
                            t("dashboardAudit.notAvailable")}
                        </strong>
                      </div>
                    </div>
                  ) : (
                    <p>{t("dashboardAudit.notTray")}</p>
                  )
                ) : null}
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </UiDialog>
  );
}
