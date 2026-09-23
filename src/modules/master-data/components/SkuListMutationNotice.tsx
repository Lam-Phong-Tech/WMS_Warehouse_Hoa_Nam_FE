import { useLanguageStore } from "@/shared/i18n/language.store";
import "./sku-list-mutation-notice.css";

export interface SkuListMutationNoticeValue {
  kind: "success" | "duplicate" | "failed" | "unknown";
  code: string;
  message?: string;
}

export interface SkuListMutationNoticeProps {
  notice: SkuListMutationNoticeValue | null;
  onDismiss: () => void;
  onCheck: () => void;
  onRetry: () => void;
}

/** Displays an existing mutation outcome; actions never submit or retry writes here. */
export function SkuListMutationNotice({
  notice,
  onDismiss,
  onCheck,
  onRetry,
}: SkuListMutationNoticeProps) {
  const english = useLanguageStore((state) => state.language === "en");
  if (!notice) return null;
  const content = {
    success: {
      title: english ? "SKU added successfully" : "Đã thêm SKU thành công",
      description: english
        ? `${notice.code} has been added to the catalog.`
        : `${notice.code} đã được thêm vào danh mục.`,
      action: english ? "Dismiss notification" : "Đóng thông báo",
    },
    duplicate: {
      title: english ? "SKU code already exists" : "Mã SKU đã tồn tại",
      description: english
        ? `${notice.code} is already in the catalog. Please check before creating a new SKU.`
        : `${notice.code} đã có trong danh mục. Vui lòng kiểm tra trước khi tạo mới.`,
      action: english ? "Close" : "Đóng",
    },
    failed: {
      title: english ? "Unable to add SKU" : "Không thể thêm SKU",
      description: english
        ? "The information was not saved. Please try again."
        : "Thông tin chưa được lưu. Vui lòng thử lại.",
      action: english ? "Try again" : "Thử lại",
    },
    unknown: {
      title: english
        ? "SKU creation result is unknown"
        : "Chưa xác định kết quả thêm SKU",
      description: english
        ? "No confirmation was received from the system. Search for the SKU in the list before trying again to avoid duplicates."
        : "Không nhận được xác nhận từ hệ thống. Hãy tìm mã SKU trong danh sách trước khi thử lại để tránh tạo trùng.",
      action: english ? "Check the list" : "Kiểm tra danh sách",
    },
  }[notice.kind];
  const success = notice.kind === "success";
  const unknown = notice.kind === "unknown";
  const action = unknown
    ? onCheck
    : notice.kind === "failed"
      ? onRetry
      : onDismiss;
  return (
    <div
      className={`hn-sku-mutation-notice hn-sku-mutation-notice--${notice.kind}`}
      role={success ? "status" : "alert"}
    >
      <svg
        className="hn-sku-mutation-icon"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        focusable="false"
      >
        {unknown ? (
          <>
            <path d="m12 3 10 18H2Z" />
            <path d="M12 9v5m0 3v.2" />
          </>
        ) : (
          <>
            <circle cx="12" cy="12" r="9.5" />
            {success ? (
              <path d="m7 12 3.3 3.3 6.7-7" />
            ) : (
              <path d="M12 7v6m0 4v.1" />
            )}
          </>
        )}
      </svg>
      <div className="hn-sku-mutation-copy">
        <strong>{content.title}</strong>
        <p>{notice.message || content.description}</p>
      </div>
      <button
        type="button"
        className={
          success
            ? "hn-sku-mutation-dismiss"
            : `hn-sku-mutation-button${unknown ? " hn-sku-mutation-button--primary" : ""}`
        }
        onClick={action}
        aria-label={success ? content.action : undefined}
      >
        {success ? (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            aria-hidden="true"
          >
            <path d="m6 6 12 12M18 6 6 18" />
          </svg>
        ) : (
          content.action
        )}
      </button>
    </div>
  );
}
