import { useId, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  getApiErrorMessage,
  getErrorRequestId,
  isNoPermissionError,
  normalizeError,
} from "@/shared/api/api-error";
import { DASHBOARD_CANONICAL, ROUTES } from "@/shared/constants/routes";
import { useLanguageStore } from "@/shared/i18n/language.store";

export interface DefectFeedbackProps {
  error?: unknown;
  loading: boolean;
  refreshing: boolean;
  hasRows: boolean;
  hasFilters: boolean;
  offline: boolean;
  readonly: boolean;
  onRetry: () => void;
  onReset: () => void;
  onCreate?: () => void;
  /** Time of the last successful query, never a date copied from a reference. */
  updatedAt?: number;
  onDismiss?: () => void;
}

function useFeedbackText() {
  const english = useLanguageStore((state) => state.language === "en");
  return (vi: string, en: string) => (english ? en : vi);
}

type IconName =
  | "clipboard"
  | "file-search"
  | "file-alert"
  | "offline"
  | "warning"
  | "session"
  | "forbidden"
  | "server"
  | "maintenance"
  | "refresh"
  | "login"
  | "eye";

function FeedbackIcon({ name }: { name: IconName }) {
  const shapes: Record<IconName, ReactNode> = {
    clipboard: (
      <>
        <rect x="5" y="4" width="14" height="18" rx="2" />
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <path d="M8 10h.01M12 10h4M8 15h.01M12 15h4" />
      </>
    ),
    "file-search": (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Zm0 0v6h6" />
        <circle cx="11" cy="14" r="2.5" />
        <path d="m13 16 2 2" />
      </>
    ),
    "file-alert": (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
        <path d="M12 9v5m0 3v.1" />
      </>
    ),
    offline: (
      <>
        <path d="m3 3 18 18M8.5 5a16 16 0 0 1 14 4M2 9a17 17 0 0 1 3-2m7 3a12 12 0 0 1 6 3M6 13a12 12 0 0 1 3-2m0 6a5 5 0 0 1 6 0m-3 4h.01" />
      </>
    ),
    warning: (
      <>
        <path d="m12 3 10 18H2Z" />
        <path d="M12 9v5m0 3v.1" />
      </>
    ),
    session: (
      <>
        <rect x="4" y="10" width="16" height="11" rx="2" />
        <path d="M7 10V7a5 5 0 0 1 10 0v3" />
        <circle cx="12" cy="15.5" r="1" />
      </>
    ),
    forbidden: (
      <>
        <path d="M12 2c3 3 6 4 9 4v7c0 5-4 8-9 10-5-2-9-5-9-10V6c3 0 6-1 9-4Z" />
        <path d="m4 6 15 14" />
      </>
    ),
    server: (
      <>
        <path d="M6 10H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2M6 14H4a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2h-2M6 6h.01M6 18h.01m7-12-4 6h6l-4 6" />
      </>
    ),
    maintenance: (
      <path d="M15 3a6 6 0 0 1 4 0l-4 4 3 3 4-4a6 6 0 0 1-8 8L6 22a2.8 2.8 0 0 1-4-4l8-8a6 6 0 0 1 5-7Z" />
    ),
    refresh: (
      <>
        <path d="M21 3v6h-6M3 21v-6h6" />
        <path d="M5 8a8 8 0 0 1 13-3l3 4M3 15l3 4a8 8 0 0 0 13-3" />
      </>
    ),
    login: (
      <>
        <path d="M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5M3 12h12m-5-5 5 5-5 5" />
      </>
    ),
    eye: (
      <>
        <path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
      </>
    ),
  };
  return (
    <svg
      className="hn-defect-feedback-icon"
      viewBox="0 0 24 26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[name]}
    </svg>
  );
}

export function DefectReadonlyBadge({ readonly }: { readonly: boolean }) {
  const text = useFeedbackText();
  return readonly ? (
    <span className="hn-defect-feedback-readonly">
      <FeedbackIcon name="eye" />
      {text("Chỉ xem", "Read only")}
    </span>
  ) : null;
}

type FeedbackCopy = {
  state: string;
  title: string;
  description: string;
  icon: IconName;
  tone?: "error" | "muted";
  code?: number;
  retry?: boolean;
  retrySecondary?: boolean;
  login?: boolean;
  home?: boolean;
};

function useLoginHref() {
  const location = useLocation();
  const attempted = `${location.pathname}${location.search}${location.hash}`;
  return `${ROUTES.LOGIN}?redirect=${encodeURIComponent(attempted)}`;
}

/** Presentation only: the query and global auth layers retain their existing behavior. */
export function DefectEmptyState({
  error,
  loading,
  refreshing,
  hasRows,
  hasFilters,
  offline,
  onRetry,
  onReset,
}: DefectFeedbackProps) {
  const text = useFeedbackText();
  const titleId = useId();
  const loginHref = useLoginHref();
  if (loading || hasRows) return null;
  let copy: FeedbackCopy = hasFilters
    ? {
        state: "no-results",
        title: text("Không tìm thấy bệnh/lỗi", "No defects found"),
        description: text(
          "Thử đổi từ khóa hoặc kiểm tra lại bộ lọc.",
          "Try another keyword or check the filters.",
        ),
        icon: "file-search",
      }
    : {
        state: "empty",
        title: text("Chưa có bệnh/lỗi", "No defects yet"),
        description: text(
          "Danh mục bệnh/lỗi chưa có dữ liệu.",
          "The defect catalog has no data yet.",
        ),
        icon: "clipboard",
      };
  if (error || offline) {
    const status = error ? normalizeError(error).status : undefined;
    if (status === 401) {
      copy = {
        state: "session-expired",
        title: text("Phiên đăng nhập đã hết hạn", "Your session has expired"),
        description: text(
          "Vui lòng đăng nhập lại để tiếp tục.",
          "Please sign in again to continue.",
        ),
        icon: "session",
        login: true,
      };
    } else if (error && isNoPermissionError(error)) {
      copy = {
        state: "forbidden",
        title: text("Bạn không có quyền truy cập", "You do not have access"),
        description: text(
          "Tài khoản hiện tại không được phép xem danh mục bệnh/lỗi.",
          "Your account does not have permission to view the defect catalog.",
        ),
        icon: "forbidden",
        home: true,
      };
    } else if (offline) {
      copy = {
        state: "offline",
        title: text("Không có kết nối mạng", "No internet connection"),
        description: text(
          "Kiểm tra kết nối rồi thử lại.",
          "Check your connection and try again.",
        ),
        icon: "offline",
        tone: "muted",
        retry: true,
      };
    } else if (status === 404) {
      copy = {
        state: "not-found",
        title: text("Không tìm thấy trang", "Page not found"),
        description: text(
          "Trang bạn đang tìm không khả dụng tại địa chỉ này.",
          "The page you are looking for is unavailable at this address.",
        ),
        icon: "file-search",
        code: 404,
      };
    } else if (status === 503) {
      copy = {
        state: "maintenance",
        title: text("Hệ thống đang bảo trì", "System maintenance"),
        description: text(
          "Một số chức năng tạm thời chưa khả dụng. Vui lòng quay lại sau.",
          "Some features are temporarily unavailable. Please come back later.",
        ),
        icon: "maintenance",
        retry: true,
        retrySecondary: true,
      };
    } else if (status && status >= 500) {
      copy = {
        state: "server-error",
        title: text(
          "Hệ thống đang gặp sự cố",
          "The system is experiencing an issue",
        ),
        description: text(
          "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.",
          "Your request cannot be processed right now. Please try again later.",
        ),
        icon: "server",
        code: status,
        retry: true,
      };
    } else {
      copy = {
        state: "load-error",
        title: text(
          "Không thể tải danh sách bệnh/lỗi",
          "Unable to load the defect list",
        ),
        description: getApiErrorMessage(
          error,
          text(
            "Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.",
            "An error occurred while loading data. Please try again.",
          ),
        ),
        icon: "file-alert",
        tone: "error",
        retry: true,
      };
    }
  }
  const requestId = error ? getErrorRequestId(error) : undefined;
  const accessError =
    copy.state === "forbidden" || copy.state === "session-expired";
  return (
    <section
      className={`hn-defect-feedback${copy.tone ? ` hn-defect-feedback--${copy.tone}` : ""}`}
      data-feedback-state={copy.state}
      role={error || offline ? "alert" : "status"}
      aria-labelledby={titleId}
    >
      <span className="hn-defect-feedback-illustration">
        <FeedbackIcon name={copy.icon} />
        {copy.state === "session-expired" ? (
          <span className="hn-defect-feedback-clock">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
              <circle cx="12" cy="12" r="9" />
              <path d="M12 6v6h5" />
            </svg>
          </span>
        ) : null}
      </span>
      {copy.code ? (
        <span className="hn-defect-feedback-code">{copy.code}</span>
      ) : null}
      <h3 id={titleId}>{copy.title}</h3>
      <p>{copy.description}</p>
      {accessError && requestId ? (
        <p className="hn-defect-feedback-trace">
          {text("Mã yêu cầu:", "Request ID:")} {requestId}
        </p>
      ) : null}
      {copy.retry || copy.login || copy.home || copy.state === "no-results" ? (
        <div className="hn-defect-feedback-actions">
          {copy.retry ? (
            <button
              type="button"
              className={`hn-defect-feedback-button${copy.retrySecondary ? "" : " hn-defect-feedback-button--primary"}`}
              onClick={onRetry}
              disabled={refreshing}
            >
              {refreshing ? (
                <span
                  className="hn-defect-feedback-spinner"
                  aria-hidden="true"
                />
              ) : (
                <FeedbackIcon name="refresh" />
              )}
              {copy.state === "offline"
                ? text("Kiểm tra kết nối", "Check connection")
                : text("Thử lại", "Try again")}
            </button>
          ) : null}
          {copy.login ? (
            <Link
              className="hn-defect-feedback-button hn-defect-feedback-button--primary"
              to={loginHref}
            >
              <FeedbackIcon name="login" />
              {text("Đăng nhập lại", "Sign in again")}
            </Link>
          ) : null}
          {copy.home ? (
            <Link
              className="hn-defect-feedback-button hn-defect-feedback-button--primary"
              to={DASHBOARD_CANONICAL}
            >
              {text("Quay lại Tổng quan", "Back to overview")}
            </Link>
          ) : null}
          {copy.state === "no-results" ? (
            <button
              type="button"
              className="hn-defect-feedback-button"
              onClick={onReset}
              disabled={refreshing}
            >
              {text("Xóa tìm kiếm", "Clear search")}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

/** Retained data stays owned by the caller; this notice never changes query or auth state. */
export function DefectNotice({
  error,
  loading,
  refreshing,
  hasRows,
  offline,
  onRetry,
  updatedAt,
  onDismiss,
}: DefectFeedbackProps) {
  const text = useFeedbackText();
  const loginHref = useLoginHref();
  if (loading || !hasRows) return null;
  if (refreshing)
    return (
      <div
        className="hn-defect-notice hn-defect-notice--refreshing"
        role="status"
        aria-live="polite"
      >
        <span>
          {text(
            "Đang cập nhật danh sách bệnh/lỗi...",
            "Updating the defect list...",
          )}
        </span>
        <span className="hn-defect-notice-progress" aria-hidden="true" />
      </div>
    );
  if (!error && !offline) return null;
  const status = error ? normalizeError(error).status : undefined;
  const sessionExpired = status === 401;
  const forbidden = Boolean(error && isNoPermissionError(error));
  const accessError = sessionExpired || forbidden;
  const title = sessionExpired
    ? text("Phiên đăng nhập đã hết hạn", "Your session has expired")
    : forbidden
      ? text("Bạn không có quyền truy cập", "You do not have access")
      : text("Dữ liệu có thể chưa mới nhất", "Data may be out of date");
  const description = sessionExpired
    ? text(
        "Vui lòng đăng nhập lại để tiếp tục.",
        "Please sign in again to continue.",
      )
    : forbidden
      ? text(
          "Tài khoản hiện tại không được phép xem danh mục bệnh/lỗi.",
          "Your account does not have permission to view the defect catalog.",
        )
      : text(
          "Đang hiển thị bản dữ liệu gần nhất đã tải thành công.",
          "Showing the latest successfully loaded data.",
        );
  const updatedLabel =
    !accessError && updatedAt && Number.isFinite(updatedAt)
      ? new Intl.DateTimeFormat(text("vi-VN", "en-US"), {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(updatedAt)
      : undefined;
  const requestId = accessError && error ? getErrorRequestId(error) : undefined;
  return (
    <div
      className="hn-defect-notice hn-defect-notice--warning"
      role={accessError ? "alert" : "status"}
      aria-live="polite"
      data-feedback-state={
        sessionExpired ? "session-expired" : forbidden ? "forbidden" : "stale"
      }
    >
      <FeedbackIcon name="warning" />
      <div className="hn-defect-notice-copy">
        <strong>{title}</strong>
        <p
          title={
            updatedLabel
              ? `${text("Cập nhật lần cuối:", "Last updated:")} ${updatedLabel}`
              : undefined
          }
        >
          {description}
        </p>
        {requestId ? (
          <p className="hn-defect-feedback-trace">
            {text("Mã yêu cầu:", "Request ID:")} {requestId}
          </p>
        ) : null}
      </div>
      {sessionExpired ? (
        <Link className="hn-defect-feedback-button" to={loginHref}>
          {text("Đăng nhập lại", "Sign in again")}
        </Link>
      ) : forbidden ? (
        <Link className="hn-defect-feedback-button" to={DASHBOARD_CANONICAL}>
          {text("Quay lại Tổng quan", "Back to overview")}
        </Link>
      ) : (
        <button
          type="button"
          className="hn-defect-feedback-button"
          onClick={onRetry}
        >
          <FeedbackIcon name="refresh" />
          {text("Thử cập nhật", "Refresh data")}
        </button>
      )}
      {onDismiss && !accessError ? (
        <button
          type="button"
          className="hn-defect-notice-dismiss"
          onClick={onDismiss}
          aria-label={text("Đóng thông báo", "Dismiss notification")}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.7"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}
