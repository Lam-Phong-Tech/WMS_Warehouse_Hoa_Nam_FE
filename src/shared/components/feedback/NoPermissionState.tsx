/**
 * Nội bộ render bằng design-system foundation (Part 3) — public API giữ nguyên.
 */
import { useNavigate } from "react-router-dom";
import { ROUTES } from "@/shared/constants/routes";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { ActionButton } from "@/shared/components/actions";
import { UiStateSurface } from "@/shared/ui";
import { SPACING } from "@/shared/ui/tokens";

/**
 * Reusable "No Permission" state component for 403 errors.
 *
 * Usage:
 * ```tsx
 * try {
 *   await someApiCall();
 * } catch (error) {
 *   if (isNoPermissionError(error)) {
 *     setShowNoPermission(true);
 *   }
 * }
 *
 * {showNoPermission && <NoPermissionState />}
 * ```
 */
export interface NoPermissionStateProps {
  title?: string;
  description?: string | React.ReactNode;
  actionText?: string;
  onAction?: () => void;
  showHomeButton?: boolean;
  /** Bản thu gọn để nhúng trong 1 khối/section (vd thay cho ApiErrorAlert), không chiếm toàn trang. */
  compact?: boolean;
  /** Ghi đè testid khi một màn có nhiều vùng 403 cần phân biệt. */
  testId?: string;
}

export function NoPermissionState({
  title = "Bạn không có quyền truy cập",
  description = "Bạn không có quyền thực hiện thao tác này. Liên hệ quản trị viên để được cấp quyền.",
  actionText = "Quay lại",
  onAction,
  showHomeButton = true,
  compact = false,
  testId,
}: NoPermissionStateProps) {
  const navigate = useNavigate();

  const handleAction = () => {
    if (onAction) {
      onAction();
    } else {
      navigate(-1); // Go back to previous page
    }
  };

  const handleGoHome = () => {
    navigate(ROUTES.HOME);
  };

  return (
    <div
      {...uiStateProps(UI_STATE.PERMISSION_DENIED, testId)}
      role="alert"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: compact ? undefined : "400px",
        padding: compact ? `${SPACING.xl}px 0` : SPACING.xl,
      }}
    >
      <UiStateSurface
        kind="no-permission"
        title={title}
        description={description}
        action={
          <div
            style={{
              display: "flex",
              gap: SPACING.sm,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            <ActionButton kind="back" onClick={handleAction}>
              {actionText}
            </ActionButton>
            {showHomeButton && (
              <ActionButton kind="back" onClick={handleGoHome}>
                Về trang chủ
              </ActionButton>
            )}
          </div>
        }
      />
    </div>
  );
}
