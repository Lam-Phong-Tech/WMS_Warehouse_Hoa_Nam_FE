import { Navigate, Outlet } from "react-router-dom";
import { Loading } from "@/shared/components/feedback/Loading";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

/** Wait for refresh before deciding whether the login form is needed. */
export function LoginRoute() {
  const isBootstrapped = useAuthStore((state) => state.isBootstrapped);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isBootstrapped) return <Loading />;
  // Authenticated users must pass through AccountLandingPage so the saved
  // default homepage is resolved once /me permissions are available. A fixed
  // dashboard redirect here runs on the login -> authenticated transition and
  // bypasses that resolver.
  if (isAuthenticated) return <Navigate to={ROUTES.HOME} replace />;
  return <Outlet />;
}
