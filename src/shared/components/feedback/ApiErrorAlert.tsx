import type { CSSProperties } from "react";
import { Alert, Button } from "antd";
import { ReloadOutlined } from "@ant-design/icons";
import { isNoPermissionError, normalizeError } from "@/shared/api/api-error";
import { NoPermissionState } from "./NoPermissionState";

export interface ApiErrorAlertProps {
  /** Lỗi bất kỳ (axios / Error / unknown). Falsy → không render gì. */
  error: unknown;
  /** Tiêu đề Alert. */
  title?: string;
  /** Có nút "Thử lại" khi truyền onRetry. */
  onRetry?: () => void;
  style?: CSSProperties;
}

/**
 * Hiển thị lỗi API theo contract chuẩn ({ message, error_code, errors }).
 * Gom `errors` (lỗi validation theo field) thành danh sách dưới message chính.
 *
 * Lỗi 403 (no-permission) được nhận diện qua `isNoPermissionError` và luôn
 * render `NoPermissionState` (dạng compact) thay vì Alert đỏ thông thường,
 * để mọi màn dùng ApiErrorAlert đều hiển thị 403 nhất quán.
 */
export function ApiErrorAlert({
  error,
  title = "Đã xảy ra lỗi",
  onRetry,
  style,
}: ApiErrorAlertProps) {
  if (!error) return null;

  if (isNoPermissionError(error)) {
    return (
      <div style={style}>
        <NoPermissionState
          compact
          showHomeButton={false}
          title="Không có quyền truy cập"
          actionText={onRetry ? "Thử lại" : "Quay lại"}
          onAction={onRetry}
        />
      </div>
    );
  }

  const { message, errors } = normalizeError(error);
  const fieldMessages = errors
    ? Object.values(errors).flatMap((v) => (Array.isArray(v) ? v : [v]))
    : [];

  return (
    <Alert
      type="error"
      showIcon
      style={style}
      title={title}
      description={
        <>
          <div>{message}</div>
          {fieldMessages.length > 0 && (
            <ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>
              {fieldMessages.map((m, i) => (
                <li key={i}>{m}</li>
              ))}
            </ul>
          )}
        </>
      }
      action={
        onRetry ? (
          <Button size="small" icon={<ReloadOutlined />} onClick={onRetry}>
            Thử lại
          </Button>
        ) : undefined
      }
    />
  );
}
