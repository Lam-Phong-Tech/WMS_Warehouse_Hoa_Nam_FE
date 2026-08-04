import { Navigate, Outlet, useLocation } from "react-router-dom";
import { isAxiosError } from "axios";
import { bootstrapAuth } from "@/app/bootstrap-auth";
import { useMe } from "@/modules/auth/hooks/use-me";
import { Loading } from "@/shared/components/feedback/Loading";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";
import { getErrorCode, type ApiErrorResponse } from "@/shared/types/api-response";

/**
 * Auth route guard fail-closed:
 * - chờ bootstrap;
 * - không biến lỗi hạ tầng refresh thành anonymous redirect;
 * - chờ /auth/me xác nhận permission/data-scope của đúng JWT hiện tại.
 */
export function ProtectedRoute() {
  const location = useLocation();
  const isBootstrapped = useAuthStore((s) => s.isBootstrapped);
  const bootstrapError = useAuthStore((s) => s.bootstrapError);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isProfileLoaded = useAuthStore((s) => s.isProfileLoaded);
  const meQuery = useMe();

  if (!isBootstrapped) return <Loading />;

  if (bootstrapError) {
    return (
      <div style={{ margin: "48px auto", maxWidth: 720, padding: 24 }}>
        <ApiErrorAlert
          error={bootstrapError}
          title="Không thể khôi phục phiên làm việc"
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

    return (
      <div style={{ margin: "48px auto", maxWidth: 720, padding: 24 }}>
        <ApiErrorAlert
          error={meQuery.error}
          title="Không thể tải hồ sơ và phân quyền"
          onRetry={() => {
            void meQuery.refetch();
          }}
        />
      </div>
    );
  }

  if (!isProfileLoaded) return <Loading />;
  return <Outlet />;
}
