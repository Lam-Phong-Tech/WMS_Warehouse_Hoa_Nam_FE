/* eslint-disable react-refresh/only-export-components */
import type { ReactNode } from "react";
import { Empty, Space } from "antd";
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

export function tableEmptyText(
  error: unknown,
  description = "Không có dữ liệu",
) {
  if (error) {
    return (
      <Empty
        image={Empty.PRESENTED_IMAGE_SIMPLE}
        description="Dữ liệu chưa được tải do lỗi API"
      />
    );
  }
  return (
    <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={description} />
  );
}

export function ResponsiveToolbar({ children }: { children: ReactNode }) {
  return (
    <Space style={{ marginBottom: 16, width: "100%" }} wrap size={[8, 8]}>
      {children}
    </Space>
  );
}
