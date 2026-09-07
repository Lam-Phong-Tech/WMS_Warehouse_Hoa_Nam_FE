import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAxiosError } from "axios";
import { bootstrapAuth } from "@/app/bootstrap-auth";
import { useMe } from "@/modules/auth/hooks/use-me";
import { Loading } from "@/shared/components/feedback/Loading";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ROUTES } from "@/shared/constants/routes";
import { mark } from "@/shared/perf/marks";
import { useAuthStore } from "@/shared/store/auth.store";
import { usePersistedQueryCache } from "@/shared/cache/use-persisted-cache";
import {
  getErrorCode,
  type ApiErrorResponse,
} from "@/shared/types/api-response";
import { useT } from "@/shared/i18n/useT";
import { runtimeConfig } from "@/shared/config/env";

/** Nhịp tự thử lại khi ở chế độ máy quét (ms). */
const KIOSK_RETRY_MS = 5000;

/**
 * TẠM THỜI — chế độ máy quét: lỗi HẠ TẦNG (mất mạng/5xx/timeout) tự thử lại
 * ngầm thay vì dựng thẻ đỏ chặn màn. Nhân viên cầm máy quét không phải dừng tay
 * bấm "Thử lại" mỗi lần sóng chập chờn. Xem runtimeConfig.scannerKioskMode.
 */
function useKioskRetry(active: boolean, retry: () => void) {
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(retry, KIOSK_RETRY_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `retry` là hàm
    // dựng lại mỗi lần render; chỉ cần lập lịch lại khi `active` đổi.
  }, [active]);
}

/**
 * Auth route guard fail-closed:
 * - chờ bootstrap;
 * - không biến lỗi hạ tầng refresh thành anonymous redirect;
 * - chờ /auth/me xác nhận permission/data-scope của đúng JWT hiện tại;
 * - chờ nạp persisted query cache của ĐÚNG danh tính vừa được xác nhận.
 */
export function ProtectedRoute() {
  const t = useT();
  const location = useLocation();
  const isBootstrapped = useAuthStore((s) => s.isBootstrapped);
  const bootstrapError = useAuthStore((s) => s.bootstrapError);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isProfileLoaded = useAuthStore((s) => s.isProfileLoaded);
  const meQuery = useMe();
  const isCacheReady = usePersistedQueryCache();
  const kiosk = runtimeConfig.scannerKioskMode;

  // Hai hook dưới phải đứng TRƯỚC mọi nhánh return sớm (quy tắc hook).
  useKioskRetry(kiosk && Boolean(bootstrapError), () => {
    void bootstrapAuth();
  });
  useKioskRetry(kiosk && !isProfileLoaded && meQuery.isError, () => {
    void meQuery.refetch();
  });

  if (!isBootstrapped) return <Loading />;

  if (bootstrapError) {
    // Chế độ máy quét: giữ màn chờ, hook ở trên tự gọi lại bootstrapAuth().
    if (kiosk) return <Loading />;
    return (
      <div style={{ margin: "48px auto", maxWidth: 720, padding: 24 }}>
        <ApiErrorAlert
          error={bootstrapError}
          title={t("shared.states.sessionRestoreError")}
          onRetry={() => {
            void bootstrapAuth();
          }}
        />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  if (!isProfileLoaded && meQuery.isError) {
    if (
      isAxiosError<ApiErrorResponse>(meQuery.error) &&
      meQuery.error.response?.status === 403 &&
      getErrorCode(meQuery.error.response.data) === "PASSWORD_CHANGE_REQUIRED"
    ) {
      return <Navigate to={ROUTES.CHANGE_PASSWORD} replace />;
    }

    // Chế độ máy quét: /auth/me lỗi hạ tầng cũng tự thử lại ngầm.
    if (kiosk) return <Loading />;

    return (
      <div style={{ margin: "48px auto", maxWidth: 720, padding: 24 }}>
        <ApiErrorAlert
          error={meQuery.error}
          title={t("shared.states.profileLoadError")}
          onRetry={() => {
            void meQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (!isProfileLoaded) return <Loading />;

  // Nạp persisted cache TRƯỚC khi màn hình dữ liệu đầu tiên render. Nếu để Outlet
  // render trước, các query sẽ bắn request ngay rồi cache mới nạp xong — đúng thứ
  // tự làm cho toàn bộ lớp persist trở nên vô nghĩa sau mỗi lần F5.
  if (!isCacheReady) return <Loading />;

  // Mốc "cổng mở": từ đây trang đích mới được render và mới bắt đầu gọi API.
  mark("gate:open");
  return <Outlet />;
}
