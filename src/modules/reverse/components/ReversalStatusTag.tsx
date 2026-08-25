import { Tag } from "antd";
import type { ReversalPhysicalReturnStatus, ReversalStatus } from "../types";
import {
  PHYSICAL_RETURN_STATUS_LABELS,
  REVERSAL_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";

/**
 * SRS §6: raw enum vẫn giữ nguyên để khớp contract BE; component này chỉ chịu
 * trách nhiệm chuyển sang nhãn tiếng Việt cho người dùng.
 */
const STATUS_COLOR: Record<ReversalStatus, string> = {
  DRAFT: "processing",
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
  const value = (status ?? "") as ReversalStatus;
  const color = STATUS_COLOR[value] ?? "default";
  const label = businessLabel(REVERSAL_STATUS_LABELS, status, "Chưa xác định");

  return (
    <>
      <Tag color={color}>{compact ? label.replace(/ ·.*$/, "") : label}</Tag>
      {value === "DRAFT" && physicalReturnStatus ? (
        <Tag color={physicalReturnStatus === "CONFIRMED" ? "blue" : "warning"}>
          {businessLabel(
            PHYSICAL_RETURN_STATUS_LABELS,
            physicalReturnStatus,
            "Chưa xác định tình trạng hàng về kho",
          )}
        </Tag>
      ) : null}
    </>
  );
}
