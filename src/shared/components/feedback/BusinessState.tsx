/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { Empty, Space, Spin } from "antd";
import { EmptyState } from "@/shared/components/data-display/EmptyState";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
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
 * WWHN-268 · FE268-D02: trước đây mỗi màn tự viết một chuỗi ternary
 * (`isError ? "Không tải được dữ liệu" : "..."`) nên (a) trạng thái rỗng và
 * trạng thái lỗi trông giống hệt nhau trong bằng chứng QA2 và (b) không có
 * selector ổn định để chụp đúng trạng thái. Helper này là điểm duy nhất quyết
 * định hai trạng thái đó, và phát ra `data-ui-state` theo hợp đồng
 * `src/shared/constants/ui-state.ts`.
 */
export function tableEmptyText(
  error: unknown,
  description = "Không có dữ liệu",
  errorDescription = "Dữ liệu chưa được tải do lỗi API",
) {
  if (error) {
    return (
      <div
        {...uiStateProps(UI_STATE.ERROR, "ui-state-error-table")}
        role="alert"
      >
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description={errorDescription}
        />
      </div>
    );
  }
  return <EmptyState description={description} testId="ui-state-empty-table" />;
}

/**
 * Dải báo "đang tải" đặt ngay trên bảng dữ liệu.
 *
 * WWHN-268 · FE268-D02: spinner mặc định của antd Table không phát ra thuộc
 * tính nào để bằng chứng QA2 khẳng định "đây là trạng thái loading của dữ
 * liệu" — khác với skeleton lúc tải chunk route, vốn cũng là loading nhưng
 * của tầng khác. Dải này vừa là test hook ổn định, vừa là affordance rõ ràng
 * theo Annex D (loading phải nhìn thấy được, không chỉ mờ bảng).
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
        color: "#555",
        fontSize: 13,
      }}
    >
      <Spin size="small" />
      {label}
    </div>
  );
}

export function ResponsiveToolbar({ children }: { children: ReactNode }) {
  return (
    <Space style={{ marginBottom: 16, width: "100%" }} wrap size={[8, 8]}>
      {children}
    </Space>
  );
}
