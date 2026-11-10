/**
 * Dialog chi tiết khay — mở từ map hoặc dải "Chưa gán khu vực".
 * Nội dung: ảnh minh họa, mã khay, badge trạng thái, khu vực, vị trí/mô tả;
 * hành động: sao chép mã (clipboard + toast) và (nếu khay có khu vực)
 * "Tìm trên sơ đồ" để cuộn/focus tới khay trên map.
 */
import { ActionButton } from "@/shared/components/actions";
import { EnvironmentOutlined } from "@/shared/components/icons";
import { UiDialog } from "@/shared/ui/components/UiDialog";
import { UiStatusBadge } from "@/shared/ui/components/UiStatusBadge";
import { useT } from "@/shared/i18n/useT";
import { toast } from "sonner";
import { bucketOfStatus, type TrayBucket } from "./warehouse-map";
import { MiniTrayIcon } from "./MiniTrayIcon";
import type { TrayOption } from "@/modules/putaway/services/putawayService";

interface TrayDetailDialogProps {
  tray: TrayOption | null;
  onClose: () => void;
  /** Cuộn map tới khay + focus; chỉ hiện khi khay có khu vực. */
  onLocate?: (tray: TrayOption) => void;
}

const BADGE_TONE: Record<TrayBucket, "success" | "info" | "warning"> = {
  EMPTY: "success",
  PARTIAL: "info",
  ATTENTION: "warning",
};

export function TrayDetailDialog({
  tray,
  onClose,
  onLocate,
}: TrayDetailDialogProps) {
  const t = useT();
  const bucket = tray ? bucketOfStatus(tray.status) : "ATTENTION";
  const bucketLabel =
    bucket === "EMPTY"
      ? t("putaway.trayStatus.empty")
      : bucket === "PARTIAL"
        ? t("putaway.trayStatus.partial")
        : t("putaway.overview.bucketAttention");

  const copyCode = async () => {
    if (!tray) return;
    try {
      await navigator.clipboard.writeText(tray.container_code);
      toast.success(t("putaway.overview.codeCopied"));
    } catch {
      toast.error(t("putaway.overview.codeCopyFailed"));
    }
  };

  return (
    <UiDialog
      open={tray !== null}
      onClose={onClose}
      title={t("putaway.overview.trayDialogTitle")}
      className="tray-detail-dialog"
      actions={
        tray ? (
          <div className="tray-detail-actions">
            <ActionButton
              kind="copy"
              appearance="tonal"
              onClick={() => void copyCode()}
            >
              {t("putaway.overview.copyCode")}
            </ActionButton>
            {tray.zone_code?.trim() ? (
              <ActionButton
                kind="view"
                icon={<EnvironmentOutlined aria-hidden="true" />}
                onClick={() => {
                  onLocate?.(tray);
                  onClose();
                }}
              >
                {t("putaway.overview.locateOnMap")}
              </ActionButton>
            ) : null}
          </div>
        ) : null
      }
    >
      {tray ? (
        <div className="tray-detail-body">
          <MiniTrayIcon bucket={bucket} className="tray-detail-preview" />
          <h3 className="tray-detail-code">{tray.container_code}</h3>
          <UiStatusBadge tone={BADGE_TONE[bucket]} label={bucketLabel} />
          <dl className="tray-detail-fields">
            <div>
              <dt>{t("putaway.overview.trayDialogZone")}</dt>
              <dd>
                {tray.zone_code?.trim()
                  ? tray.zone_code
                  : t("putaway.overview.zoneUnassigned")}
              </dd>
            </div>
            <div>
              <dt>{t("putaway.overview.trayDialogLocation")}</dt>
              <dd>{tray.location_hint?.trim() || "—"}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </UiDialog>
  );
}
