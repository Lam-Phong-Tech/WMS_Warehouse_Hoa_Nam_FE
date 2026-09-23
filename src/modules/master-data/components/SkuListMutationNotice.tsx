import { useLanguageStore } from "@/shared/i18n/language.store";
import "./sku-list-mutation-notice.css";
import { tStatic as tUi } from "@/shared/i18n/useT";

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
      title: english
        ? "SKU added successfully"
        : tUi("updatedUi.text_6c2636acef6b"),
      description: english
        ? `${notice.code} has been added to the catalog.`
        : tUi("updatedUi.text_88cdc7c41433", { value0: String(notice.code) }),
      action: english
        ? "Dismiss notification"
        : tUi("updatedUi.text_8af6ba927e1f"),
    },
    duplicate: {
      title: english
        ? "SKU code already exists"
        : tUi("updatedUi.text_e100305427de"),
      description: english
        ? `${notice.code} is already in the catalog. Please check before creating a new SKU.`
        : tUi("updatedUi.text_a6a61dfcc0c9", { value0: String(notice.code) }),
      action: english ? "Close" : tUi("common.close"),
    },
    failed: {
      title: english ? "Unable to add SKU" : tUi("updatedUi.text_dc7919efb154"),
      description: english
        ? "The information was not saved. Please try again."
        : tUi("updatedUi.text_18a738b00e9e"),
      action: english ? "Try again" : tUi("common.retry"),
    },
    unknown: {
      title: english
        ? "SKU creation result is unknown"
        : tUi("updatedUi.text_53a48561f33c"),
      description: english
        ? "No confirmation was received from the system. Search for the SKU in the list before trying again to avoid duplicates."
        : tUi("updatedUi.text_7133c366466e"),
      action: english ? "Check the list" : tUi("updatedUi.text_fcbcf47fe1e3"),
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
