import { UiStatusBadge, type UiStatusTone } from "@/shared/ui";
import type { ReversalPhysicalReturnStatus, ReversalStatus } from "../types";
import {
  PHYSICAL_RETURN_STATUS_LABELS,
  REVERSAL_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { useT } from "@/shared/i18n/useT";

/**
 * SRS §6: raw enum vẫn giữ nguyên để khớp contract BE; component này chỉ chịu
 * trách nhiệm chuyển sang nhãn tiếng Việt cho người dùng.
 *
 * Part 4 Vuexy sync: antd Tag → UiStatusBadge (soft-tint); mapping màu cũ
 * processing/success/error giữ nguyên ngữ nghĩa qua tone tương ứng.
 */
const STATUS_TONE: Record<ReversalStatus, UiStatusTone> = {
  DRAFT: "info",
  POSTED: "success",
  CANCELLED: "error",
};

export function ReversalStatusTag({
  status,
  physicalReturnStatus,
  compact = false,
}: {
  status?: string;
  physicalReturnStatus?: ReversalPhysicalReturnStatus;
  compact?: boolean;
}) {
  const t = useT();
  const value = (status ?? "") as ReversalStatus;
  const tone = STATUS_TONE[value] ?? "neutral";
  const label = businessLabel(
    REVERSAL_STATUS_LABELS,
    status,
    t("reverse.common.unknown"),
  );
  const showReturnBadge = value === "DRAFT" && Boolean(physicalReturnStatus);

  return (
    <>
      <UiStatusBadge
        data-reversal-status={value}
        tone={tone}
        label={compact ? label.replace(/ ·.*$/, "") : label}
        sx={showReturnBadge ? { mr: 0.5, mb: 0.5 } : undefined}
      />
      {showReturnBadge ? (
        <UiStatusBadge
          tone={physicalReturnStatus === "CONFIRMED" ? "info" : "warning"}
          label={businessLabel(
            PHYSICAL_RETURN_STATUS_LABELS,
            physicalReturnStatus,
            t("reverse.statusTag.returnUnknown"),
          )}
        />
      ) : null}
    </>
  );
}
