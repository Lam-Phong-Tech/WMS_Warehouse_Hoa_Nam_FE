import { useId, type ReactNode } from "react";
import { useLanguageStore } from "@/shared/i18n/language.store";

export interface DefectMutationNoticeValue {
  kind:
    | "success"
    | "validation"
    | "duplicate"
    | "conflict"
    | "failed"
    | "unknown";
  code?: string;
  name?: string;
  message?: string;
  editing?: boolean;
}

export interface DefectMutationNoticeProps {
  notice: DefectMutationNoticeValue | null;
  placement?: "form" | "list";
  busy?: boolean;
  onDismiss?: () => void;
  /** Read-only verification of an uncertain result; never resubmits the mutation. */
  onCheck?: () => void;
  onReload?: () => void;
  /** Supplied only when the screen knows that retrying is available. */
  onRetry?: () => void;
}

type MutationIconName = "success" | "error" | "warning" | "unknown";

function MutationIcon({ name }: { name: MutationIconName }) {
  const shapes: Record<MutationIconName, ReactNode> = {
    success: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="m8 12 2.6 2.6L16 9" />
      </>
    ),
    error: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v6m0 4h.01" />
      </>
    ),
    warning: (
      <>
        <path d="m12 3 10 18H2Z" />
        <path d="M12 9v5m0 3h.01" />
      </>
    ),
    unknown: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M9.4 8.6a2.7 2.7 0 0 1 5.2 1c0 1.9-2.6 2.2-2.6 4m0 3h.01" />
      </>
    ),
  };
  return (
    <svg
      className="hn-defect-mutation-icon"
      viewBox="0 0 24 24"
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

/** Displays mutation results while the screen owns requests and recovery decisions. */
export function DefectMutationNotice({
  notice,
  placement,
  busy = false,
  onDismiss,
  onCheck,
  onReload,
  onRetry,
}: DefectMutationNoticeProps) {
  const english = useLanguageStore((state) => state.language === "en");
  const titleId = useId();
  const text = (vi: string, en: string) => (english ? en : vi);
  if (!notice) return null;

  const titles: Record<DefectMutationNoticeValue["kind"], string> = {
    success: notice.editing
      ? text("Đã cập nhật bệnh/lỗi", "Defect updated")
      : text("Đã thêm bệnh/lỗi", "Defect added"),
    validation: text(
      "Vui lòng kiểm tra thông tin",
      "Please check the information",
    ),
    duplicate: text("Mã lỗi đã tồn tại", "Defect code already exists"),
    conflict: text("Thông tin đã thay đổi", "Information has changed"),
    failed: text("Không thể lưu bệnh/lỗi", "Unable to save the defect"),
    unknown: text(
      "Chưa xác định được kết quả lưu",
      "The save result is not yet known",
    ),
  };
  const descriptions: Record<DefectMutationNoticeValue["kind"], string[]> = {
    success: [[notice.code, notice.name].filter(Boolean).join(" · ")].filter(
      Boolean,
    ),
    validation: notice.message ? [notice.message] : [],
    duplicate: [
      text(
        "Vui lòng kiểm tra mã lỗi trước khi lưu.",
        "Please check the defect code before saving.",
      ),
    ],
    conflict: [
      text(
        "Hồ sơ đã được cập nhật từ lần bạn mở biểu mẫu.",
        "The record has been updated since you opened the form.",
      ),
      text(
        "Hãy tải dữ liệu mới để kiểm tra trước khi lưu.",
        "Load the latest data and review it before saving.",
      ),
    ],
    failed: [
      notice.message ||
        text("Thông tin chưa được lưu.", "The information has not been saved."),
    ],
    unknown: [
      text(
        "Yêu cầu đã được gửi nhưng chưa nhận được xác nhận.",
        "The request was sent but confirmation has not been received.",
      ),
      text(
        "Chưa thể gửi lại lúc này.",
        "The request cannot be sent again yet.",
      ),
    ],
  };
  const tone =
    notice.kind === "success"
      ? "success"
      : notice.kind === "conflict" || notice.kind === "unknown"
        ? "warning"
        : "error";
  const icon: MutationIconName = notice.kind === "unknown" ? "unknown" : tone;
  const action =
    notice.kind === "conflict" && onReload
      ? {
          onClick: onReload,
          label: text("Tải dữ liệu mới", "Load latest data"),
        }
      : notice.kind === "unknown" && onCheck
        ? { onClick: onCheck, label: text("Kiểm tra kết quả", "Check result") }
        : notice.kind === "failed" && onRetry
          ? { onClick: onRetry, label: text("Thử lưu lại", "Try saving again") }
          : null;

  return (
    <section
      className={`hn-defect-mutation hn-defect-mutation--${tone} hn-defect-mutation--${placement ?? (notice.kind === "success" ? "list" : "form")}`}
      data-mutation-state={notice.kind}
      role={notice.kind === "success" ? "status" : "alert"}
      aria-labelledby={titleId}
      aria-busy={busy || undefined}
      tabIndex={-1}
    >
      <span className="hn-defect-mutation-symbol">
        <MutationIcon name={icon} />
      </span>
      <div className="hn-defect-mutation-copy">
        <h3 id={titleId}>{titles[notice.kind]}</h3>
        {descriptions[notice.kind].map((description, index) => (
          <p key={index}>{description}</p>
        ))}
        {action ? (
          <div className="hn-defect-mutation-actions">
            <button
              type="button"
              className="hn-defect-button hn-defect-button--primary"
              onClick={action.onClick}
              disabled={busy}
            >
              {busy ? (
                <span
                  className="hn-defect-mutation-spinner"
                  aria-hidden="true"
                />
              ) : null}
              {action.label}
            </button>
          </div>
        ) : null}
      </div>
      {notice.kind === "success" && onDismiss ? (
        <button
          type="button"
          className="hn-defect-mutation-dismiss"
          onClick={onDismiss}
          aria-label={text("Đóng thông báo", "Dismiss notification")}
          disabled={busy}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            aria-hidden="true"
            focusable="false"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        </button>
      ) : null}
    </section>
  );
}
