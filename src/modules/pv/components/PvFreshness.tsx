import { Tooltip, UiStatusBadge } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import {
  computeFreshness,
  formatDataAsOf,
} from "@/modules/pv/lib/pv-freshness";
import type { PvFreshness } from "@/modules/pv/types/pv.types";

/**
 * WWHN-252 — chỉ báo độ tươi dữ liệu tồn kho trên App PV (NFR-SRS-016).
 * Logic tính tuổi dữ liệu nằm ở `lib/pv-freshness.ts` để component thuần render.
 */
export function PvFreshnessIndicator({ meta }: { meta?: PvFreshness }) {
  const t = useT();
  const { ageSeconds, isDegraded, thresholdSeconds } = computeFreshness(meta);

  return (
    <Tooltip
      title={
        // `isDegraded` chỉ bật khi đo được tuổi dữ liệu (xem computeFreshness),
        // nhưng hai giá trị được destructure rời nên TS không tự thu hẹp —
        // kiểm tra thẳng `ageSeconds` để câu tooltip không bao giờ in "null".
        isDegraded && ageSeconds !== null
          ? t("pv.freshness.staleTooltip", {
              threshold: thresholdSeconds,
              age: ageSeconds,
            })
          : t("pv.freshness.freshTooltip", { threshold: thresholdSeconds })
      }
    >
      <UiStatusBadge
        tone={isDegraded ? "warning" : "neutral"}
        data-testid="pv-freshness"
        data-pv-freshness={isDegraded ? "degraded" : "live"}
        label={
          isDegraded
            ? t("pv.freshness.staleLabel", {
                time: formatDataAsOf(meta?.data_as_of),
              })
            : t("pv.freshness.liveLabel", {
                time: formatDataAsOf(meta?.data_as_of),
              })
        }
      />
    </Tooltip>
  );
}
