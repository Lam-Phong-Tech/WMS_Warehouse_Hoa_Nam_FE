import { Tag } from "antd";
import type { ReversalPhysicalReturnStatus, ReversalStatus } from "../types";

/**
 * SRS §6: Reversal chỉ có DRAFT / POSTED / CANCELLED (ERD bảng 33 CHECK), bước
 * CONFIRMED được biểu diễn bằng physical_return_status. Dùng chung một helper cho
 * REV-00 và REV-01 để hai màn không hiển thị lệch nhau.
 */
const STATUS_COLOR: Record<ReversalStatus, string> = {
  DRAFT: "processing",
  POSTED: "success",
  CANCELLED: "error",
};

const STATUS_LABEL: Record<ReversalStatus, string> = {
  DRAFT: "DRAFT · chưa phát sinh tồn",
  POSTED: "POSTED · đã ghi movement đối ứng",
  CANCELLED: "CANCELLED · đã huỷ",
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
  const label = compact
    ? status || "-"
    : (STATUS_LABEL[value] ?? status ?? "-");

  return (
    <>
      <Tag color={color}>{label}</Tag>
      {value === "DRAFT" && physicalReturnStatus ? (
        <Tag color={physicalReturnStatus === "CONFIRMED" ? "blue" : "warning"}>
          {physicalReturnStatus === "CONFIRMED"
            ? "CONFIRMED · hàng đã về"
            : "PENDING_RETURN · chờ hàng về"}
        </Tag>
      ) : null}
    </>
  );
}
