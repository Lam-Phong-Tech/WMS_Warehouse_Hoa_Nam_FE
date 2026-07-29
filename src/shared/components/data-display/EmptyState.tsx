import type { ReactNode } from "react";
import { Empty } from "antd";

export interface EmptyStateProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Nút/hành động gợi ý (vd "Thêm mới"). */
  children?: ReactNode;
}

export function EmptyState({
  title,
  description = "Không có dữ liệu",
  children,
}: EmptyStateProps) {
  const descriptionNode = title ? (
    <div
      style={{
        display: "grid",
        gap: 8,
        justifyItems: "center",
        maxWidth: 360,
        textAlign: "center",
      }}
    >
      <div style={{ fontWeight: 600, fontSize: 16 }}>{title}</div>
      <div style={{ color: "#666", fontSize: 14 }}>{description}</div>
    </div>
  ) : (
    description
  );

  return (
    <Empty
      image={Empty.PRESENTED_IMAGE_SIMPLE}
      description={descriptionNode}
      style={{ padding: "32px 0" }}
    >
      {children}
    </Empty>
  );
}
