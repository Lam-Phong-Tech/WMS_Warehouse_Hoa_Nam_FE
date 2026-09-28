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
import { getErrorCode, type ApiErrorResponse } from "@/shared/types/api-response";
import { useT } from "@/shared/i18n/useT";
import { runtimeConfig } from "@/shared/config/env";
import { SessionConfirmationGate } from "@/modules/auth/components/SessionConfirmationGate";
import { AuthSessionCheck } from "@/modules/auth/components/AuthSessionCheck";
import { readWorkSessionActivity } from "@/shared/lib/session-idle";

/** Nhịp tự thử lại khi ở chế độ máy quét (ms). */
const KIOSK_RETRY_MS = 5000;
function useKioskRetry(active: boolean, retry: () => void) {
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(retry, KIOSK_RETRY_MS);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- retry is rebuilt on each render.
  }, [active]);
}

/** Fail-closed: bootstrap, exact JWT profile/permissions, identity-bound cache,
 * then explicit session confirmation. Existing kiosk and permission rules stay intact. */
export function ProtectedRoute() {
  const t = useT();
  const location = useLocation();
  const isBootstrapped = useAuthStore((s) => s.isBootstrapped);
  const bootstrapError = useAuthStore((s) => s.bootstrapError);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const contexts = useAuthStore((s) => s.contexts);
  const isProfileLoaded = useAuthStore((s) => s.isProfileLoaded);
  const meQuery = useMe();
  const isCacheReady = usePersistedQueryCache();
  const kiosk = runtimeConfig.scannerKioskMode;
  const initialConfirmation = isAuthenticated && !runtimeConfig.temporaryAutoLogin &&
    readWorkSessionActivity() === null;
  useKioskRetry(kiosk && Boolean(bootstrapError), () => { void bootstrapAuth(); });
  useKioskRetry(kiosk && !isProfileLoaded && meQuery.isError, () => { void meQuery.refetch(); });

  if (!isBootstrapped) return <Loading />;
  if (bootstrapError) {
    if (kiosk) return <Loading />;
    return (
      <div style={{ margin: "48px auto", maxWidth: 720, padding: 24 }}>
        <ApiErrorAlert error={bootstrapError} title={t("shared.states.sessionRestoreError")}
          onRetry={() => { void bootstrapAuth(); }} />
      </div>
    );
  }
  if (!isAuthenticated) return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  if (!isProfileLoaded && meQuery.isError) {
    if (isAxiosError<ApiErrorResponse>(meQuery.error) && meQuery.error.response?.status === 403 &&
      getErrorCode(meQuery.error.response.data) === "PASSWORD_CHANGE_REQUIRED") {
      return <Navigate to={ROUTES.CHANGE_PASSWORD} replace />;
    }
    if (kiosk) return <Loading />;
    if (initialConfirmation) {
      return <AuthSessionCheck failed={!meQuery.isFetching}
        denied={isAxiosError(meQuery.error) && meQuery.error.response?.status === 403} onRetry={() => { void meQuery.refetch(); }} />;
    }
    return (
      <div style={{ margin: "48px auto", maxWidth: 720, padding: 24 }}>
        <ApiErrorAlert error={meQuery.error} title={t("shared.states.profileLoadError")}
          onRetry={() => { void meQuery.refetch(); }} />
      </div>
    );
  }
  if (!isProfileLoaded || !isCacheReady) {
    return initialConfirmation
      ? <AuthSessionCheck onRetry={() => { void meQuery.refetch(); }} />
      : <Loading />;
  }
  mark("gate:open");
  if (user === null) return <Navigate to={ROUTES.LOGIN} replace />;
  if (runtimeConfig.temporaryAutoLogin) return <Outlet />;
  return <SessionConfirmationGate user={user} contexts={contexts} />;
}
