/**
 * Nội bộ render bằng design-system foundation (Part 3) — public API giữ nguyên.
 */
import type { ReactNode } from "react";
import { UiStateSurface } from "@/shared/ui";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { useT } from "@/shared/i18n/useT";

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
  description,
  children,
  testId,
}: EmptyStateProps) {
  const t = useT();
  const resolvedDescription =
    description === undefined ? t("shared.states.noData") : description;
  // Test hook nằm trên phần tử bọc do FE tự kiểm soát (UiStateSurface không
  // nhận data-attribute) — giữ nguyên hợp đồng WWHN-268.
  return (
    <div {...uiStateProps(UI_STATE.EMPTY, testId)}>
      {title != null ? (
        <UiStateSurface
          kind="empty"
          title={title}
          description={resolvedDescription}
          action={children}
        />
      ) : (
        // Không có title: mô tả (mặc định "Không có dữ liệu") là dòng chính —
        // giữ nguyên từng ký tự text hiển thị như bản antd Empty cũ.
        <UiStateSurface
          kind="empty"
          title={resolvedDescription}
          action={children}
        />
      )}
    </div>
  );
}
