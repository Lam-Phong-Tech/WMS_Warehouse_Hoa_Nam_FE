import { ErrorState } from "@/shared/components/ui-states/ErrorState";
import { UiText } from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import type { PublicApiError } from "@/shared/api/public-http";

/**
 * WWHN-252 / Annex D SCR-PV-01·02 ("Inline + request_id") — một chỗ duy nhất
 * dịch lỗi của nhóm PV ẩn danh sang thông điệp người dùng.
 *
 * Ba trạng thái phải phân biệt được vì cách xử lý của người xem khác hẳn nhau:
 * - offline / không có response: lỗi phía người dùng, bảo họ kiểm tra kết nối.
 * - 429 RATE_LIMIT_EXCEEDED: có Retry-After, phải nói rõ chờ bao lâu chứ không
 *   mời bấm "Thử lại" liên tục (mỗi lần bấm lại kéo dài cửa sổ khoá).
 * - còn lại: lỗi máy chủ, hiện request_id để đối chiếu log (NFR-SRS-008).
 */
export function PvErrorState({
  error,
  onRetry,
}: {
  error: unknown;
  onRetry?: () => void;
}) {
  const t = useT();
  const publicError = error as PublicApiError | undefined;

  if (publicError?.isOffline) {
    return (
      <ErrorState
        testId="pv-error-offline"
        title={t("pv.error.offlineTitle")}
        description={t("pv.error.offlineDesc")}
        onRetry={onRetry}
      />
    );
  }

  if (publicError?.isRateLimited) {
    const waitSeconds = publicError.retryAfterSeconds;
    return (
      <ErrorState
        testId="pv-error-rate-limited"
        title={t("pv.error.rateLimitTitle")}
        description={
          waitSeconds
            ? t("pv.error.rateLimitWait", { seconds: waitSeconds })
            : t("pv.error.rateLimitGeneric")
        }
      />
    );
  }

  return (
    <ErrorState
      testId="pv-error-generic"
      title={t("pv.error.genericTitle")}
      description={
        <>
          {publicError?.message ?? t("pv.error.genericDesc")}
          {publicError?.requestId ? (
            <>
              <br />
              <UiText variant="caption">
                {t("pv.error.requestId", { id: publicError.requestId })}
              </UiText>
            </>
          ) : null}
        </>
      }
      onRetry={onRetry}
    />
  );
}
