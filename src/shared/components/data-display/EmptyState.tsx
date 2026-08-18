import type { ReactNode } from "react";
import { Empty } from "antd";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";

export interface EmptyStateProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Nút/hành động gợi ý (vd "Thêm mới"). */
  children?: ReactNode;
  /** Ghi đè testid khi một màn có nhiều vùng rỗng cần phân biệt. */
  testId?: string;
}

/** WWHN-268: phát `data-ui-state="empty"` cho ma trận bằng chứng QA2. */
export function EmptyState({
  title,
  description = "Không có dữ liệu",
  children,
  testId,
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

  // antd v6 không forward thuộc tính lạ xuống DOM của Empty, nên test hook
  // phải nằm trên phần tử bọc do FE tự kiểm soát.
  return (
    <div {...uiStateProps(UI_STATE.EMPTY, testId)}>
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description={descriptionNode}
        style={{ padding: "32px 0" }}
      >
        {children}
      </Empty>
    </div>
  );
}
