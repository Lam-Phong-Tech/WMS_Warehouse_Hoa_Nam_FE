import { Navigate, Outlet } from "react-router-dom";
import { Loading } from "@/shared/components/feedback/Loading";
import { DASHBOARD_CANONICAL } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

/** Wait for refresh before deciding whether the login form is needed. */
export function LoginRoute() {
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isBootstrapped) return <Loading />;
  if (isAuthenticated) return <Navigate to={DASHBOARD_CANONICAL} replace />;
  return <Outlet />;
}
