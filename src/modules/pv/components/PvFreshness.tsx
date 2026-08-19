import { Tag, Tooltip } from "antd";
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
  const { ageSeconds, isDegraded, thresholdSeconds } = computeFreshness(meta);

  return (
    <Tooltip
      title={
        isDegraded
          ? `Dữ liệu tồn kho cũ hơn ${thresholdSeconds}s (${ageSeconds}s). Tải lại để lấy số mới nhất.`
          : `Ngưỡng độ tươi cho phép: ${thresholdSeconds}s.`
      }
    >
      <Tag
        color={isDegraded ? "warning" : "default"}
        data-testid="pv-freshness"
        data-pv-freshness={isDegraded ? "degraded" : "live"}
        style={{ marginInlineEnd: 0 }}
      >
        {isDegraded ? "Dữ liệu có thể cũ · " : "Cập nhật lúc "}
        {formatDataAsOf(meta?.data_as_of)}
      </Tag>
    </Tooltip>
  );
}
