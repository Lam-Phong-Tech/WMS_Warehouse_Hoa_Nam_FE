import { useId, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { isNoPermissionError, normalizeError } from "@/shared/api/api-error";
import { DASHBOARD_CANONICAL } from "@/shared/constants/routes";
import { useLanguageStore } from "@/shared/i18n/language.store";
import "./catalog-feedback.css";

export interface CatalogFeedbackProps {
  error?: unknown;
  loading: boolean;
  refreshing: boolean;
  hasRows: boolean;
  hasFilters: boolean;
  offline: boolean;
  onRetry: () => void;
  onReset: () => void;
  updatedAt?: number;
}

export interface CatalogNoticeProps extends CatalogFeedbackProps {
  onDismiss?: () => void;
}

type IconName =
  | "boxes"
  | "search"
  | "error"
  | "warning"
  | "offline"
  | "lock"
  | "file-search"
  | "server"
  | "maintenance";

function CatalogFeedbackIcon({ name }: { name: IconName }) {
  const shapes: Record<IconName, ReactNode> = {
    boxes: (
      <>
        <path d="m24 3 10 6v12l-10 6-10-6V9Zm-10 6 10 6 10-6m-10 6v12M9 27l9 5v10l-9 5-9-5V32Zm-9 5 9 5 9-5m-9 5v10m30-20 9 5v10l-9 5-9-5V32Zm-9 5 9 5 9-5m-9 5v10" />
      </>
    ),
    search: (
      <>
        <circle cx="20" cy="20" r="13" />
        <path d="m30 30 12 12" />
      </>
    ),
    error: (
      <>
        <circle cx="24" cy="24" r="19" />
        <path d="M24 13v14m0 7v1" />
      </>
    ),
    warning: <path d="m24 5 21 37H3Zm0 12v12m0 6v1" />,
    offline: (
      <>
        <path d="M5 16a31 31 0 0 1 3-2m7-3a31 31 0 0 1 29 5M11 24a22 22 0 0 1 7-4m9-1a22 22 0 0 1 11 5M17 32a12 12 0 0 1 13-1M24 39v1M4 4l40 40" />
      </>
    ),
    lock: (
      <>
        <path d="M24 2c7 5 14 7 19 8v14c0 12-9 19-19 23C14 43 5 36 5 24V10c5-1 12-3 19-8Z" />
        <g className="hn-catalog-feedback-lock">
          <rect x="16" y="22" width="16" height="15" rx="2" />
          <path d="M19 22v-5a5 5 0 0 1 10 0v5M24 28v4" />
        </g>
      </>
    ),
    "file-search": (
      <>
        <path d="M27 43H8a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h19l12 12v11M27 2v12h12M12 20h15m-15 7h10m-10 7h7" />
        <circle cx="32" cy="33" r="9" />
        <path d="m39 40 7 7" />
      </>
    ),
    server: (
      <>
        <rect x="3" y="5" width="41" height="16" rx="3" />
        <path d="M12 13h.1M20 13h16M25 41H6a3 3 0 0 1-3-3V28a3 3 0 0 1 3-3h35a3 3 0 0 1 3 3v2M12 33h.1m8-.1h8" />
        <circle
          className="hn-catalog-feedback-server-alert"
          cx="36"
          cy="38"
          r="10"
        />
        <path className="hn-catalog-feedback-server-mark" d="M36 33v6m0 4v.1" />
      </>
    ),
    maintenance: (
      <>
        <path d="M31 33H4a3 3 0 0 1-3-3V5a3 3 0 0 1 3-3h34a3 3 0 0 1 3 3v20M1 25h36M18 33v11m7-11v11M10 44h19M7 9h24M7 15h16" />
        <path d="m30 41 10-10a8 8 0 0 0 8-10l-5 5-5-5 5-5a8 8 0 0 0-10 8L23 34a5 5 0 0 0 7 7Z" />
      </>
    ),
  };
  return (
    <svg
      className="hn-catalog-feedback-icon"
      viewBox="-1 -1 51 51"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[name]}
    </svg>
  );
}

type FeedbackCopy = {
  state: string;
  title: string;
  description: string;
  icon: IconName;
  tone?: "error" | "muted" | "warning";
  code?: number;
  home?: boolean;
  retry?: boolean;
  retrySecondary?: boolean;
};

/** Presentation only; the caller retains authentication, queries and retry behavior. */
export function CatalogFeedback({
  error,
  loading,
  refreshing,
  hasRows,
  hasFilters,
  offline,
  onRetry,
  onReset,
}: CatalogFeedbackProps) {
  const english = useLanguageStore((state) => state.language === "en");
  const titleId = useId();
  const text = (vi: string, en: string) => (english ? en : vi);
  if (loading || hasRows) return null;

  let copy: FeedbackCopy = hasFilters
    ? {
        state: "no-results",
        title: text("Không tìm thấy danh mục", "No catalog entries found"),
        description: text(
          "Không có dữ liệu nào khớp với điều kiện tìm kiếm.",
          "No entries match the search criteria.",
        ),
        icon: "search",
      }
    : {
        state: "empty",
        title: text("Chưa có dữ liệu danh mục", "No catalog entries yet"),
        description: text(
          "Danh mục hiện chưa có dữ liệu.",
          "The catalog does not have any entries yet.",
        ),
        icon: "boxes",
      };

  if (error || offline) {
    const normalized = error ? normalizeError(error) : undefined;
    const status = normalized?.status;
    if (status === 401) {
      copy = {
        state: "session-expired",
        title: text("Phiên đăng nhập đã hết hạn", "Your session has expired"),
        description: text(
          "Vui lòng đăng nhập lại để tiếp tục.",
          "Please sign in again to continue.",
        ),
        icon: "warning",
        tone: "warning",
        retry: true,
      };
    } else if (status === 403 || (error && isNoPermissionError(error))) {
      copy = {
        state: "forbidden",
        code: 403,
        title: text("Bạn không có quyền truy cập", "You do not have access"),
        description: text(
          "Tài khoản hiện tại không được phép xem danh mục sản phẩm.",
          "Your account does not have permission to view the product catalog.",
        ),
        icon: "lock",
        home: true,
      };
    } else if (offline) {
      copy = {
        state: "offline",
        title: text("Không có kết nối mạng", "No internet connection"),
        description: text(
          "Kiểm tra kết nối Internet rồi thử lại.",
          "Check your internet connection and try again.",
        ),
        icon: "offline",
        tone: "muted",
        retry: true,
      };
    } else if (status === 404) {
      copy = {
        state: "not-found",
        code: 404,
        title: text("Không tìm thấy trang", "Page not found"),
        description: text(
          "Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.",
          "The page you are looking for does not exist or has been moved.",
        ),
        icon: "file-search",
        home: true,
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
        code: status,
        title: text(
          "Hệ thống đang gặp sự cố",
          "The system is experiencing an issue",
        ),
        description: text(
          "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.",
          "Your request cannot be processed right now. Please try again later.",
        ),
        icon: "server",
        tone: "error",
        retry: true,
        home: true,
      };
    } else {
      copy = {
        state: "load-error",
        title: text(
          "Không thể tải danh mục sản phẩm",
          "Unable to load the product catalog",
        ),
        description:
          normalized?.message ||
          text(
            "Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.",
            "An error occurred while loading data. Please try again.",
          ),
        icon: "error",
        tone: "error",
        retry: true,
        home: true,
      };
    }
  }

  return (
    <section
      className={`hn-catalog-feedback${copy.tone ? ` hn-catalog-feedback--${copy.tone}` : ""}`}
      data-feedback-state={copy.state}
      aria-labelledby={titleId}
      role={error || offline ? "alert" : "status"}
    >
      <span className="hn-catalog-feedback-illustration">
        <CatalogFeedbackIcon name={copy.icon} />
      </span>
      {copy.code ? (
        <span className="hn-catalog-feedback-code">{copy.code}</span>
      ) : null}
      <h3 id={titleId}>{copy.title}</h3>
      <p>{copy.description}</p>
      {copy.retry || copy.home || copy.state === "no-results" ? (
        <div className="hn-catalog-feedback-actions">
          {copy.retry ? (
            <button
              type="button"
              className={`hn-catalog-feedback-button${copy.retrySecondary ? "" : " hn-catalog-feedback-button--primary"}`}
              onClick={onRetry}
              disabled={refreshing}
            >
              {refreshing ? (
                <span
                  className="hn-catalog-feedback-spinner"
                  aria-hidden="true"
                />
              ) : null}
              {text("Thử lại", "Try again")}
            </button>
          ) : null}
          {copy.home ? (
            <Link
              className={`hn-catalog-feedback-button${copy.retry ? "" : " hn-catalog-feedback-button--primary"}`}
              to={DASHBOARD_CANONICAL}
            >
              {text("Quay lại Tổng quan", "Back to overview")}
            </Link>
          ) : null}
          {copy.state === "no-results" ? (
            <button
              type="button"
              className="hn-catalog-feedback-button"
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

/** Retained rows remain visible while refreshing or showing their last confirmed state. */
export function CatalogNotice({
  error,
  loading,
  refreshing,
  hasRows,
  offline,
  onRetry,
  updatedAt,
  onDismiss,
}: CatalogNoticeProps) {
  const english = useLanguageStore((state) => state.language === "en");
  const text = (vi: string, en: string) => (english ? en : vi);
  if (loading || !hasRows) return null;
  if (refreshing) {
    return (
      <div
        className="hn-catalog-notice hn-catalog-notice--refreshing"
        role="status"
        aria-live="polite"
      >
        <span className="hn-catalog-notice-progress" aria-hidden="true" />
        <span>
          {text(
            "Đang cập nhật danh mục sản phẩm...",
            "Updating the product catalog...",
          )}
        </span>
      </div>
    );
  }
  if (!error && !offline) return null;
  const normalized = error ? normalizeError(error) : undefined;
  const sessionExpired = normalized?.status === 401;
  const permissionDenied =
    normalized?.status === 403 || Boolean(error && isNoPermissionError(error));
  const accessError = sessionExpired || permissionDenied;
  const title = sessionExpired
    ? text("Phiên đăng nhập đã hết hạn", "Your session has expired")
    : permissionDenied
      ? text("Bạn không có quyền truy cập", "You do not have access")
      : text("Dữ liệu có thể chưa mới nhất", "Data may be out of date");
  const description = sessionExpired
    ? text(
        "Vui lòng đăng nhập lại để tiếp tục.",
        "Please sign in again to continue.",
      )
    : permissionDenied
      ? text(
          "Tài khoản hiện tại không được phép xem danh mục sản phẩm.",
          "Your account does not have permission to view the product catalog.",
        )
      : text(
          "Đang hiển thị bản cập nhật gần nhất.",
          "Showing the latest available data.",
        );
  const updatedLabel =
    updatedAt && Number.isFinite(updatedAt)
      ? new Intl.DateTimeFormat(english ? "en-US" : "vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(updatedAt) +
        " · " +
        new Intl.DateTimeFormat(english ? "en-US" : "vi-VN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(updatedAt)
      : undefined;
  return (
    <div
      className="hn-catalog-notice hn-catalog-notice--warning"
      role={accessError ? "alert" : "status"}
      data-feedback-state={
        sessionExpired
          ? "session-expired"
          : permissionDenied
            ? "forbidden"
            : "stale"
      }
      aria-live="polite"
    >
      <CatalogFeedbackIcon name="warning" />
      <div className="hn-catalog-notice-copy">
        <strong>{title}</strong>
        <p>
          {description}
          {!accessError && updatedLabel
            ? ` ${text("Cập nhật lần cuối:", "Last updated:")} ${updatedLabel}.`
            : ""}
        </p>
      </div>
      <button
        type="button"
        className="hn-catalog-feedback-button"
        onClick={onRetry}
      >
        {text("Thử cập nhật", "Refresh data")}
      </button>
      {onDismiss ? (
        <button
          type="button"
          className="hn-catalog-notice-dismiss"
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
