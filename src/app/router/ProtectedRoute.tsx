import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useMe } from "@/modules/auth/hooks/use-me";
import { Loading } from "@/shared/components/feedback/Loading";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

/**
 * Auth route guard:
 * 1. Wait for cookie/store bootstrap before trusting auth state.
 * 2. Redirect anonymous users to login and preserve the attempted URL.
 * 3. Fetch /auth/me for permissions/profile before rendering protected routes.
 */
export function ProtectedRoute() {
  const location = useLocation();
  const isBootstrapped = useAuthStore((s) => s.isBootstrapped);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isProfileLoaded = useAuthStore((s) => s.isProfileLoaded);

  const meQuery = useMe();

  if (!isBootstrapped) return <Loading />;

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  if (!isProfileLoaded && meQuery.isError) {
    return (
      <div style={{ margin: "48px auto", maxWidth: 720, padding: 24 }}>
        <ApiErrorAlert
          error={meQuery.error}
          title="Khong the tai ho so va phan quyen"
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
