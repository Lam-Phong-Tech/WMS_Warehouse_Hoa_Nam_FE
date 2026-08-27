import type { CSSProperties } from "react";
import { Alert } from "antd";
import {
  getApiErrorMessage,
  getErrorRequestId,
  isNoPermissionError,
  normalizeError,
} from "@/shared/api/api-error";
import { UI_STATE, uiStateProps } from "@/shared/constants/ui-state";
import { NoPermissionState } from "./NoPermissionState";
import { ActionButton } from "@/shared/components/actions";

export interface ApiErrorAlertProps {
  /** Lỗi bất kỳ (axios / Error / unknown). Falsy → không render gì. */
  error: unknown;
  /** Tiêu đề Alert. */
  title?: string;
  /** Thông điệp khi BE không kèm `message` (network/timeout/lỗi không rõ dạng). */
  fallback?: string;
  /** Có nút "Thử lại" khi truyền onRetry. */
  onRetry?: () => void;
  style?: CSSProperties;
  /** Ghi đè testid khi một màn có nhiều vùng lỗi cần phân biệt. */
  testId?: string;
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
  fallback,
  onRetry,
  style,
  testId,
}: ApiErrorAlertProps) {
  if (!error) return null;

  if (isNoPermissionError(error)) {
    // SRS §8.2: 403 luôn trả request_id để tra soát. Hiển thị mã lỗi +
    // request_id ngay tại chỗ (WWHN-178/179 evidence: "403/request-id") thay vì
    // bắt người dùng mở DevTools khi báo lỗi cho BE.
    const denied = normalizeError(error);
    const deniedRequestId = getErrorRequestId(error);
    return (
      <div style={style} data-ui-state={UI_STATE.PERMISSION_DENIED}>
        <NoPermissionState
          compact
          showHomeButton={false}
          title="Không có quyền truy cập"
          description={
            <>
              Bạn không có quyền thực hiện thao tác này. Liên hệ quản trị viên
              để được cấp quyền.
              {denied.code || deniedRequestId ? (
                <>
                  <br />
                  <span data-testid="permission-denied-trace">
                    HTTP 403{denied.code ? ` · ${denied.code}` : ""}
                    {deniedRequestId ? ` · Request ID: ${deniedRequestId}` : ""}
                  </span>
                </>
              ) : null}
            </>
          }
          actionText={onRetry ? "Thử lại" : "Quay lại"}
          onAction={onRetry}
        />
      </div>
    );
  }

  const { errors } = normalizeError(error);
  const message = fallback
    ? getApiErrorMessage(error, fallback)
    : normalizeError(error).message;
  const fieldMessages = errors
    ? Object.values(errors).flatMap((v) => (Array.isArray(v) ? v : [v]))
    : [];

  // antd v6 không forward thuộc tính lạ xuống DOM của Alert, nên test hook
  // phải nằm trên phần tử bọc do FE tự kiểm soát.
  return (
    <div {...uiStateProps(UI_STATE.ERROR, testId)} role="alert">
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
            <ActionButton kind="refresh" onClick={onRetry}>
              Thử lại
            </ActionButton>
          ) : undefined
        }
      />
    </div>
  );
}
