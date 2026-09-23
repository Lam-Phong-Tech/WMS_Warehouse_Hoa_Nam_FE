import type { ReactNode } from "react";
import "./io-history-feedback.css";

export type IoHistoryFeedbackState =
  | "refreshing"
  | "stale"
  | "export-success"
  | "export-partial"
  | "export-error"
  | "export-unknown"
  | "load-error"
  | "offline"
  | "session-expired"
  | "forbidden"
  | "not-found"
  | "server-error"
  | "maintenance";

export interface IoHistoryFeedbackProps {
  state: IoHistoryFeedbackState;
  /** An actual API explanation may replace the reference's generic wording. */
  message?: string;
  /** Already formatted timestamp supplied by the report's real snapshot. */
  updatedAt?: string;
  onRetry?: () => void;
  onHome?: () => void;
  onLogin?: () => void;
  onDismiss?: () => void;
  busy?: boolean;
}

type FeedbackIconName =
  | "warning"
  | "error"
  | "success"
  | "offline"
  | "lock"
  | "file-search"
  | "server"
  | "tool"
  | "box";

function FeedbackIcon({ name }: { name: FeedbackIconName }) {
  const paths: Record<FeedbackIconName, ReactNode> = {
    warning: (
      <>
        <path d="m10.3 3.8-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0Z" />
        <path d="M12 8v5m0 4h.01" />
      </>
    ),
    error: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6m0 4h.01" />
      </>
    ),
    success: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m7.5 12 3 3 6-6" />
      </>
    ),
    offline: (
      <>
        <path d="m3 3 18 18M2 8a17 17 0 0 1 2-1.3M8 5.1A17 17 0 0 1 22 8M5 12a12 12 0 0 1 3-1.9m4-1a12 12 0 0 1 7 2.9M8.5 15.5a5 5 0 0 1 7 0M12 19h.01" />
      </>
    ),
    lock: (
      <>
        <path d="m12 2 9 4v6c0 5-6 9-9 10-3-1-9-5-9-10V6Z" />
        <rect x="8" y="10" width="8" height="8" rx="1.5" />
        <path d="M10 10V8a2 2 0 0 1 4 0v2m-2 3v2" />
      </>
    ),
    "file-search": (
      <>
        <path d="M13 2H5a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h5M13 2v6h6V8l-6-6ZM7 8h2m-2 4h5m-5 4h2" />
        <circle cx="16" cy="16" r="4" />
        <path d="m19 19 3 3m-8-6h4" />
      </>
    ),
    server: (
      <>
        <rect x="2" y="3" width="19" height="7" rx="1.5" />
        <path d="M5 6.5h.01M10 6.5h7M8 21H3a1 1 0 0 1-1-1v-5a1 1 0 0 1 1-1h7m-5 3.5h.01" />
        <circle cx="17" cy="17" r="5" />
        <path d="M17 14v3m0 3h.01" />
      </>
    ),
    tool: (
      <path d="M14.2 6.1 18 2.3a6 6 0 0 0-7.5 7.5l-8 8a2.3 2.3 0 0 0 3.2 3.2l8-8A6 6 0 0 0 21.2 5L17.4 8.8Z" />
    ),
    box: (
      <>
        <path d="m12 7 8 4v9l-8 4-8-4v-9ZM4 11l8 4 8-4M12 15v9M4 11 1 6l7-4 4 5 4-5 7 4-3 5M1 24h22" />
      </>
    ),
  };
  return (
    <svg
      className="io-feedback-icon"
      viewBox={name === "box" ? "0 0 24 26" : "0 0 24 24"}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
}

type FeedbackCopy = {
  title: string;
  description: string;
  icon: FeedbackIconName;
  tone: "neutral" | "warning" | "error" | "success";
  code?: string;
};

const COPY: Record<
  Exclude<IoHistoryFeedbackState, "refreshing">,
  FeedbackCopy
> = {
  stale: {
    title: "Dữ liệu có thể chưa mới nhất",
    description: "Đang hiển thị bản cập nhật gần nhất.",
    icon: "warning",
    tone: "warning",
  },
  "export-success": {
    title: "Đã xuất báo cáo thành công",
    description: "Tệp báo cáo đã được tạo.",
    icon: "success",
    tone: "success",
  },
  "export-partial": {
    title: "Báo cáo đã được xuất nhưng chưa đầy đủ",
    description:
      "Một phần dữ liệu chưa thể đưa vào báo cáo. Hãy kiểm tra trước khi sử dụng.",
    icon: "warning",
    tone: "warning",
  },
  "export-error": {
    title: "Không thể xuất báo cáo",
    description: "Báo cáo chưa được tạo. Vui lòng thử lại.",
    icon: "error",
    tone: "error",
  },
  "export-unknown": {
    title: "Chưa xác định kết quả xuất báo cáo",
    description:
      "Không nhận được xác nhận từ hệ thống. Hãy kiểm tra các tệp đã tải trước khi xuất lại để tránh trùng lặp.",
    icon: "warning",
    tone: "warning",
  },
  "load-error": {
    title: "Không thể tải báo cáo",
    description: "Đã xảy ra lỗi khi tải dữ liệu. Vui lòng thử lại.",
    icon: "warning",
    tone: "error",
  },
  offline: {
    title: "Không có kết nối mạng",
    description: "Kiểm tra kết nối Internet rồi thử lại.",
    icon: "offline",
    tone: "neutral",
  },
  "session-expired": {
    title: "Xác nhận phiên đăng nhập",
    description: "Vui lòng đăng nhập lại để tiếp tục.",
    icon: "warning",
    tone: "warning",
  },
  forbidden: {
    title: "Bạn không có quyền truy cập",
    description: "Tài khoản hiện tại không được phép xem báo cáo này.",
    icon: "lock",
    tone: "neutral",
    code: "403",
  },
  "not-found": {
    title: "Không tìm thấy trang",
    description:
      "Trang bạn đang tìm kiếm không tồn tại hoặc đã được di chuyển.",
    icon: "file-search",
    tone: "neutral",
    code: "404",
  },
  "server-error": {
    title: "Hệ thống đang gặp sự cố",
    description: "Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.",
    icon: "server",
    tone: "error",
    code: "500",
  },
  maintenance: {
    title: "Hệ thống đang bảo trì",
    description:
      "Một số chức năng tạm thời chưa khả dụng. Vui lòng quay lại sau.",
    icon: "tool",
    tone: "neutral",
  },
};

const INLINE_STATES: ReadonlySet<IoHistoryFeedbackState> = new Set([
  "stale",
  "export-success",
  "export-partial",
  "export-error",
  "export-unknown",
]);

/** Presentation only: the page decides these states from its existing request lifecycle. */
export function IoHistoryFeedback({
  state,
  message,
  updatedAt,
  onRetry,
  onHome,
  onLogin,
  onDismiss,
  busy = false,
}: IoHistoryFeedbackProps) {
  if (state === "refreshing") {
    return (
      <div
        className="io-feedback io-feedback--refreshing"
        role="status"
        aria-live="polite"
        aria-busy="true"
      >
        <div className="io-feedback-refresh-label">
          <span className="io-feedback-spinner" aria-hidden="true" />
          Đang cập nhật dữ liệu...
        </div>
        <div className="io-feedback-progress" aria-hidden="true">
          <span />
        </div>
      </div>
    );
  }

  const copy = COPY[state];
  const description =
    message ??
    (state === "stale" && updatedAt
      ? `${copy.description} Cập nhật lần cuối: ${updatedAt}.`
      : copy.description);
  const inline = INLINE_STATES.has(state);
  const reportFailure = state === "load-error" || state === "offline";
  const sessionExpired = state === "session-expired";
  const retryVisible =
    onRetry &&
    [
      "stale",
      "export-error",
      "load-error",
      "offline",
      "server-error",
      "maintenance",
    ].includes(state);
  const homeVisible =
    onHome &&
    ["load-error", "forbidden", "not-found", "server-error"].includes(state);
  const dismissAsText =
    state === "export-partial" ||
    state === "export-error" ||
    state === "export-unknown";
  const retrySecondary = state === "stale" || state === "maintenance";

  if (sessionExpired) {
    return (
      <section
        className="io-feedback-session"
        role="alert"
        data-feedback-state={state}
      >
        <h2>{copy.title}</h2>
        <div className="io-feedback io-feedback--warning">
          <FeedbackIcon name="warning" />
          <div className="io-feedback-copy">
            <strong>Phiên đăng nhập đã hết hạn</strong>
            <p>{description}</p>
          </div>
        </div>
        {onLogin ? (
          <button
            type="button"
            className="io-feedback-button io-feedback-button--primary"
            onClick={onLogin}
            disabled={busy}
          >
            Đăng nhập lại
          </button>
        ) : null}
      </section>
    );
  }

  return (
    <section
      className={
        inline
          ? `io-feedback io-feedback--${copy.tone}`
          : `io-feedback-page${reportFailure ? " io-feedback-page--report" : ""}`
      }
      role={copy.tone === "error" ? "alert" : "status"}
      aria-live={copy.tone === "error" ? "assertive" : "polite"}
      data-feedback-state={state}
      aria-busy={busy || undefined}
    >
      <div
        className={
          inline
            ? "io-feedback-symbol"
            : `io-feedback-emblem io-feedback-emblem--${copy.tone}`
        }
      >
        <FeedbackIcon name={copy.icon} />
      </div>
      <div className="io-feedback-copy">
        {copy.code ? <div className="io-feedback-code">{copy.code}</div> : null}
        {inline ? <strong>{copy.title}</strong> : <h2>{copy.title}</h2>}
        <p>{description}</p>
      </div>
      {retryVisible || homeVisible || (inline && onDismiss) ? (
        <div className="io-feedback-actions">
          {retryVisible ? (
            <button
              type="button"
              className={`io-feedback-button${retrySecondary ? "" : " io-feedback-button--primary"}`}
              disabled={busy}
              onClick={onRetry}
            >
              {busy ? (
                <span className="io-feedback-spinner" aria-hidden="true" />
              ) : null}
              {state === "stale" ? "Thử cập nhật" : "Thử lại"}
            </button>
          ) : null}
          {homeVisible ? (
            <button
              type="button"
              className={`io-feedback-button${state === "forbidden" || state === "not-found" ? " io-feedback-button--primary" : ""}`}
              onClick={onHome}
            >
              Quay lại Tổng quan
            </button>
          ) : null}
          {inline && onDismiss ? (
            <button
              type="button"
              className={
                dismissAsText ? "io-feedback-button" : "io-feedback-dismiss"
              }
              aria-label="Đóng"
              onClick={onDismiss}
            >
              {dismissAsText ? (
                state === "export-unknown" ? (
                  "Đã hiểu"
                ) : (
                  "Đóng"
                )
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
                  <path d="m6 6 12 12M18 6 6 18" />
                </svg>
              )}
            </button>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

export interface IoHistoryTableStateProps {
  state: "loading" | "empty" | "no-results";
  onReset?: () => void;
  busy?: boolean;
}

/** Render inside a table's full-width td or in the report's card body. */
export function IoHistoryTableState({
  state,
  onReset,
  busy = false,
}: IoHistoryTableStateProps) {
  if (state === "loading") {
    return (
      <div
        className="io-feedback-table-skeleton"
        role="status"
        aria-label="Đang tải lịch sử nhập - xuất kho"
        aria-busy="true"
      >
        {Array.from({ length: 5 }, (_, row) => (
          <div className="io-feedback-skeleton-row" key={row}>
            {Array.from({ length: 7 }, (_, cell) => (
              <span className="io-feedback-skeleton-line" key={cell} />
            ))}
          </div>
        ))}
      </div>
    );
  }
  const empty = state === "empty";
  return (
    <div
      className="io-feedback-table-empty"
      role="status"
      data-feedback-state={state}
    >
      {empty ? <FeedbackIcon name="box" /> : null}
      <h3>
        {empty ? "Chưa có giao dịch nhập - xuất" : "Không tìm thấy kết quả"}
      </h3>
      <p>
        {empty
          ? "Hãy chọn khoảng thời gian khác để xem dữ liệu."
          : "Không có giao dịch nào khớp với từ khóa đã nhập."}
      </p>
      {onReset ? (
        <button
          type="button"
          className="io-feedback-button"
          onClick={onReset}
          disabled={busy}
        >
          {empty ? "Điều chỉnh khoảng thời gian" : "Xóa tìm kiếm"}
        </button>
      ) : null}
    </div>
  );
}

export interface IoHistorySkeletonProps {
  includeFilters?: boolean;
}

export function IoHistorySkeleton({
  includeFilters = true,
}: IoHistorySkeletonProps) {
  return (
    <div
      className="io-feedback-skeleton"
      role="status"
      aria-label="Đang tải báo cáo"
      aria-busy="true"
    >
      {includeFilters ? (
        <div
          className="io-feedback-skeleton-card io-feedback-skeleton-filters"
          aria-hidden="true"
        >
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index}>
              <span className="io-feedback-skeleton-line" />
              <span className="io-feedback-skeleton-field" />
            </div>
          ))}
          <span className="io-feedback-skeleton-line" />
          <span className="io-feedback-skeleton-line" />
        </div>
      ) : null}
      <div className="io-feedback-skeleton-summary" aria-hidden="true">
        {[0, 1].map((index) => (
          <div className="io-feedback-skeleton-card" key={index}>
            <span className="io-feedback-skeleton-circle" />
            <div>
              <span className="io-feedback-skeleton-line" />
              <span className="io-feedback-skeleton-line" />
              <span className="io-feedback-skeleton-line" />
            </div>
            <span className="io-feedback-skeleton-line" />
          </div>
        ))}
      </div>
      <div className="io-feedback-skeleton-charts" aria-hidden="true">
        <div className="io-feedback-skeleton-card">
          <span className="io-feedback-skeleton-line" />
          <span className="io-feedback-skeleton-line" />
          <div className="io-feedback-skeleton-bars">
            {[44, 35, 61, 43, 55, 39, 68, 52, 49, 33, 64, 47, 58, 41].map(
              (height, index) => (
                <span key={index} style={{ height: `${height}%` }} />
              ),
            )}
          </div>
        </div>
        <div className="io-feedback-skeleton-card">
          <span className="io-feedback-skeleton-line" />
          <span className="io-feedback-skeleton-line" />
          <div className="io-feedback-skeleton-donut" />
          <span className="io-feedback-skeleton-line" />
        </div>
      </div>
      <div
        className="io-feedback-skeleton-card io-feedback-skeleton-table"
        aria-hidden="true"
      >
        <span className="io-feedback-skeleton-line" />
        <div className="io-feedback-skeleton-tablehead" />
        {Array.from({ length: 5 }, (_, row) => (
          <div className="io-feedback-skeleton-row" key={row}>
            {Array.from({ length: 7 }, (_, cell) => (
              <span className="io-feedback-skeleton-line" key={cell} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
