/**
 * Nội bộ render bằng design-system foundation (Part 3) — public API giữ nguyên.
 */
import type { ReactNode } from "react";
import { SPACING } from "@/shared/ui/tokens";
import { UiStateSurface } from "@/shared/ui";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { ActionButton } from "@/shared/components/actions";

export interface ErrorStateProps {
  /** Tiêu đề lỗi. */
  title?: ReactNode;
  /** Mô tả chi tiết lỗi. */
  description?: ReactNode;
  /** Hàm xử lý khi người dùng nhấn thử lại. */
  onRetry?: () => void;
  /** Nhãn nút thử lại. */
  retryLabel?: ReactNode;
  /** Nội dung tùy chỉnh bên dưới. */
  children?: ReactNode;
  /** Ghi đè testid khi một màn có nhiều vùng lỗi cần phân biệt. */
  testId?: string;
}

/**
 * Trạng thái lỗi tải dữ liệu.
 * `role="alert"` do UiStateSurface kind="error" tự phát — không lặp ở wrapper.
 */
export function ErrorState({
  title = "Không tải được dữ liệu",
  description = "Hệ thống đang gặp sự cố hoặc mất kết nối mạng. Vui lòng thử lại; nếu vẫn lỗi, liên hệ quản trị viên.",
  onRetry,
  retryLabel = "Thử lại",
  children,
  testId,
}: ErrorStateProps) {
  const action =
    onRetry || children ? (
      <>
        {onRetry && (
          <ActionButton kind="refresh" onClick={onRetry}>
            {retryLabel}
          </ActionButton>
        )}
        {children && <div style={{ marginTop: SPACING.md }}>{children}</div>}
      </>
    ) : undefined;

  return (
    <div {...uiStateProps(UI_STATE.ERROR, testId)}>
      <UiStateSurface
        kind="error"
        title={title}
        description={description}
        action={action}
      />
    </div>
  );
}
