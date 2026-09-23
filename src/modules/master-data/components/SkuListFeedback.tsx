import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { isNoPermissionError, normalizeError } from "@/shared/api/api-error";
import { DASHBOARD_CANONICAL } from "@/shared/constants/routes";
import { useLanguageStore } from "@/shared/i18n/language.store";
import "./sku-list-feedback.css";

function useSkuFeedbackText() {
  const english = useLanguageStore((state) => state.language === "en");
  return (vi: string, en: string) => (english ? en : vi);
}

export interface SkuListFeedbackProps {
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
  /** Timestamp of the actual successful query, never a reference-image date. */
  updatedAt?: number;
  onDismiss?: () => void;
}

type IconName =
  | "box"
  | "search"
  | "warning"
  | "error"
  | "offline"
  | "lock"
  | "file-search"
  | "server"
  | "maintenance";

function FeedbackIcon({ name }: { name: IconName }) {
  const shapes: Record<IconName, ReactNode> = {
    box: (
      <>
        <path d="m12 2 9 5v10l-9 5-9-5V7Z" />
        <path d="m3 7 9 5 9-5M12 12v10" />
      </>
    ),
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="7" />
        <path d="m16 16 6 6" />
      </>
    ),
    warning: (
      <>
        <path d="m12 3 10 18H2Z" />
        <path d="M12 9v5m0 3v.2" />
      </>
    ),
    error: (
      <>
        <circle cx="12" cy="12" r="10" />
        <path d="M12 6v7m0 4v.2" />
      </>
    ),
    offline: (
      <>
        <path d="m3 3 18 18M8.6 4.6A7 7 0 0 1 19 11a4.5 4.5 0 0 1 1.7 7.7M16.5 20H7a5 5 0 0 1-2-9.6 7 7 0 0 1 .7-2.6" />
      </>
    ),
    lock: (
      <>
        <path d="m12 2 9 3.5V12c0 4.5-4.8 8-9 10-4.2-2-9-5.5-9-10V5.5Z" />
        <rect x="8" y="11" width="8" height="7" rx="1.4" />
        <path d="M9.5 11V8a2.5 2.5 0 0 1 5 0v3M12 14v1.5" />
      </>
    ),
    "file-search": (
      <>
        <path d="M12.5 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7M12.5 2v6H19l-6.5-6ZM7 11h4m-4 4h2" />
        <circle cx="16.5" cy="16" r="4.5" />
        <path d="m20 19.5 3 3" />
      </>
    ),
    server: (
      <>
        <rect x="2" y="3" width="19" height="7" rx="1.5" />
        <path d="M5 6.5h1m4 0h7M9 20H3.5A1.5 1.5 0 0 1 2 18.5v-4A1.5 1.5 0 0 1 3.5 13H11m-6 3.5h1" />
        <circle cx="17" cy="18" r="5" />
        <path d="M17 15v3m0 3h.01" />
      </>
    ),
    maintenance: (
      <>
        <rect x="1.5" y="2" width="19" height="15" rx="1.5" />
        <path d="M2 6h18M5 4h.01M8 4h.01m-2 5-2 2 2 2m4-4 2 2-2 2m-2 4v4m-3 0h7" />
        <path d="m18 13 1 .7 1.3-.2.8 1.3-.6 1.2.5 1.1 1.2.6-.2 1.6-1.3.5-.6 1 .2 1.3-1.4.8-1.2-.6-1.1.3-.6 1.2-1.6-.3-.4-1.3-1.1-.5-1.2.2-.8-1.4.7-1.1-.4-1.2-1.2-.6.2-1.6 1.3-.5.5-1.1-.2-1.2 1.4-.8 1.2.6 1.1-.4.6-1.2Z" />
        <circle cx="17" cy="18.5" r="2" />
      </>
    ),
  };
  return (
    <svg
      className="hn-sku-feedback-icon"
      viewBox="0 0 24 26"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.45"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {shapes[name]}
    </svg>
  );
}

export function SkuListReadonlyBadge({ readonly }: { readonly: boolean }) {
  const text = useSkuFeedbackText();
  return readonly ? (
    <span className="hn-sku-readonly-badge">
      {text("Chỉ xem", "Read only")}
    </span>
  ) : null;
}

/** Query feedback only: callbacks retain the screen's existing data flow. */
export function SkuListNotice({
  error,
  loading,
  refreshing,
  hasRows,
  offline,
  onRetry,
  updatedAt,
  onDismiss,
}: SkuListFeedbackProps) {
  const text = useSkuFeedbackText();
  if (loading) return null;
  if (refreshing)
    return (
      <div className="hn-sku-refresh-feedback" role="status" aria-live="polite">
        <span className="hn-sku-refresh-progress" aria-hidden="true" />
        <span>
          {text("Đang cập nhật danh sách SKU...", "Updating the SKU list...")}
        </span>
      </div>
    );
  if (!hasRows || (!error && !offline)) return null;
  const updatedLabel =
    updatedAt && Number.isFinite(updatedAt)
      ? new Intl.DateTimeFormat(text("vi-VN", "en-US"), {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        }).format(updatedAt) +
        " · " +
        new Intl.DateTimeFormat(text("vi-VN", "en-US"), {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }).format(updatedAt)
      : undefined;
  return (
    <div
      className="hn-sku-feedback-notice hn-sku-feedback-notice--warning"
      role="status"
      aria-live="polite"
    >
      <FeedbackIcon name="warning" />
      <div className="hn-sku-feedback-copy">
        <strong>
          {text("Dữ liệu có thể chưa mới nhất", "Data may be out of date")}
        </strong>
        <p>
          {text(
            "Đang hiển thị bản cập nhật gần nhất.",
            "Showing the latest available data.",
          )}
          {updatedLabel
            ? ` ${text("Cập nhật lần cuối:", "Last updated:")} ${updatedLabel}.`
            : ""}
        </p>
      </div>
      <button
        type="button"
        className="hn-sku-feedback-button"
        onClick={onRetry}
      >
        {text("Thử cập nhật", "Refresh data")}
      </button>
      {onDismiss ? (
        <button
          type="button"
          className="hn-sku-feedback-dismiss"
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

function TableSkeleton() {
  const text = useSkuFeedbackText();
  return (
    <div
      className="hn-sku-feedback-skeleton"
      role="status"
      aria-label={text("Đang tải danh sách SKU", "Loading the SKU list")}
      aria-busy="true"
    >
      <div className="hn-sku-feedback-loading">
        <span className="hn-sku-feedback-spinner" aria-hidden="true" />
        {text("Đang tải danh sách SKU...", "Loading the SKU list...")}
      </div>
      <div aria-hidden="true">
        {Array.from({ length: 7 }, (_, row) => (
          <div className="hn-sku-feedback-skeleton-row" key={row}>
            <span className="hn-sku-feedback-skeleton-code hn-sku-feedback-skeleton-line" />
            <span className="hn-sku-feedback-skeleton-product">
              <span className="hn-sku-feedback-skeleton-square" />
              <span>
                <span className="hn-sku-feedback-skeleton-line" />
                <span className="hn-sku-feedback-skeleton-line" />
              </span>
            </span>
            <span className="hn-sku-feedback-skeleton-line" />
            <span className="hn-sku-feedback-skeleton-line" />
            <span className="hn-sku-feedback-skeleton-line" />
            <span className="hn-sku-feedback-skeleton-pill" />
            <span className="hn-sku-feedback-skeleton-date">
              <span className="hn-sku-feedback-skeleton-line" />
              <span className="hn-sku-feedback-skeleton-line" />
            </span>
            <span className="hn-sku-feedback-skeleton-line" />
          </div>
        ))}
      </div>
    </div>
  );
}

type EmptyCopy = {
  title: string;
  description: string;
  icon: IconName;
  tone?: "error" | "muted" | "warning";
  code?: number;
  home?: boolean;
  retry?: boolean;
  retrySecondary?: boolean;
};

export function SkuListEmptyState({
  error,
  loading,
  refreshing,
  hasRows,
  hasFilters,
  offline,
  onRetry,
  onReset,
}: SkuListFeedbackProps) {
  const text = useSkuFeedbackText();
  if (hasRows) return null;
  if (loading) return <TableSkeleton />;
  let state = hasFilters ? "no-results" : "empty";
  let copy: EmptyCopy = hasFilters
    ? {
        title: text("Không tìm thấy SKU", "No SKUs found"),
        description: text(
          "Không có sản phẩm nào khớp với từ khóa đã nhập.",
          "No products match the entered keyword.",
        ),
        icon: "search",
      }
    : {
        title: text("Chưa có SKU", "No SKUs yet"),
        description: text(
          "Danh mục sản phẩm chưa có dữ liệu.",
          "The product catalog has no data yet.",
        ),
        icon: "box",
      };
  if (error || offline) {
    const normalized = error ? normalizeError(error) : undefined;
    const status = normalized?.status;
    if (status === 401) {
      state = "session-expired";
      copy = {
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
      state = "forbidden";
      copy = {
        code: 403,
        title: text("Bạn không có quyền truy cập", "You do not have access"),
        description: text(
          "Tài khoản hiện tại không được phép xem danh mục SKU.",
          "Your account does not have permission to view the SKU catalog.",
        ),
        icon: "lock",
        home: true,
      };
    } else if (offline) {
      state = "offline";
      copy = {
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
      state = "not-found";
      copy = {
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
      state = "maintenance";
      copy = {
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
      state = "server-error";
      copy = {
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
      state = "load-error";
      copy = {
        title: text(
          "Không thể tải danh sách SKU",
          "Unable to load the SKU list",
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
      className={`hn-sku-feedback-empty${copy.tone ? ` hn-sku-feedback-empty--${copy.tone}` : ""}`}
      data-feedback-state={state}
      role={error || offline ? "alert" : "status"}
    >
      <div className="hn-sku-feedback-illustration">
        <FeedbackIcon name={copy.icon} />
      </div>
      {copy.code ? (
        <span className="hn-sku-feedback-status-code">{copy.code}</span>
      ) : null}
      <h3>{copy.title}</h3>
      <p>{copy.description}</p>
      {copy.retry || copy.home || state === "no-results" ? (
        <div className="hn-sku-feedback-actions">
          {copy.retry ? (
            <button
              type="button"
              className={`hn-sku-feedback-button${copy.retrySecondary ? "" : " hn-sku-feedback-button--primary"}`}
              onClick={onRetry}
              disabled={refreshing}
            >
              {refreshing ? (
                <span className="hn-sku-feedback-spinner" aria-hidden="true" />
              ) : null}
              {text("Thử lại", "Try again")}
            </button>
          ) : null}
          {copy.home ? (
            <Link
              className={`hn-sku-feedback-button${copy.retry ? "" : " hn-sku-feedback-button--primary"}`}
              to={DASHBOARD_CANONICAL}
            >
              {text("Quay lại Tổng quan", "Back to overview")}
            </Link>
          ) : null}
          {state === "no-results" ? (
            <button
              type="button"
              className="hn-sku-feedback-button"
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
