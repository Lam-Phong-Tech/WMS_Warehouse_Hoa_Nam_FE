/** Nội bộ render bằng design-system foundation (Part 4) — public API giữ nguyên. */
/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { UiSpinner } from "@/shared/ui";
import Box from "@mui/material/Box";
import { EmptyState } from "@/shared/components/data-display/EmptyState";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { SEMANTIC_LIGHT as S, UiIcon } from "@/shared/ui";
import { ApiErrorAlert } from "./ApiErrorAlert";

export function InlineApiError({
  error,
  title = "Không thể tải dữ liệu",
  onRetry,
}: {
  error: unknown;
  title?: string;
  onRetry?: () => void;
}) {
  if (!error) return null;
  return (
    <ApiErrorAlert
      error={error}
      title={title}
      onRetry={onRetry}
      style={{ marginBottom: 16 }}
    />
  );
}

/**
 * Nội dung thân bảng khi không có dòng nào.
 *
 * WWHN-268 · FE268-D02: điểm duy nhất quyết định trạng thái rỗng vs lỗi của
 * bảng, phát `data-ui-state` theo hợp đồng `src/shared/constants/ui-state.ts`.
 */
export function tableEmptyText(
  error: unknown,
  description = "Không có dữ liệu",
  errorDescription = "Không tải được dữ liệu. Kiểm tra kết nối mạng rồi thử tải lại; nếu vẫn lỗi, liên hệ quản trị viên.",
) {
  if (error) {
    return (
      <div
        {...uiStateProps(UI_STATE.ERROR, "ui-state-error-table")}
        role="alert"
      >
        <Box
          sx={{
            display: "grid",
            justifyItems: "center",
            gap: 1,
            py: 2,
            color: S.textMedium,
          }}
        >
          <UiIcon name="cross-circle" color={S.error} size="lg" />
          {errorDescription}
        </Box>
      </div>
    );
  }
  return <EmptyState description={description} testId="ui-state-empty-table" />;
}

/**
 * Dải báo "đang tải" đặt ngay trên bảng dữ liệu.
 *
 * WWHN-268 · FE268-D02: test hook ổn định cho trạng thái loading của DỮ LIỆU
 * (khác skeleton tải chunk route) + affordance rõ ràng theo Annex D.
 */
export function TableLoadingBanner({
  loading,
  label = "Đang tải dữ liệu…",
}: {
  loading?: boolean;
  label?: string;
}) {
  if (!loading) return null;
  return (
    <div
      {...uiStateProps(UI_STATE.LOADING, "ui-state-loading-table")}
      aria-busy="true"
      aria-live="polite"
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        marginBottom: 8,
        color: S.textMedium,
        fontSize: 13,
      }}
    >
      <UiSpinner size={14} />
      {label}
    </div>
  );
}

export function ResponsiveToolbar({ children }: { children: ReactNode }) {
  return (
    <Box
      sx={{
        marginBottom: 2,
        width: "100%",
        display: "flex",
        flexWrap: "wrap",
        gap: 1,
        alignItems: "center",
      }}
    >
      {children}
    </Box>
  );
}
