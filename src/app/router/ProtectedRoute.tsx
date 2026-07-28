import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useMe } from '@/modules/auth/hooks/use-me';
import { Loading } from '@/shared/components/feedback/Loading';
import { ROUTES } from '@/shared/constants/routes';
import { useAuthStore } from '@/shared/store/auth.store';

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

  useMe();

  if (!isBootstrapped) return <Loading />;

  if (!isAuthenticated) {
    return <Navigate to={ROUTES.LOGIN} replace state={{ from: location }} />;
  }

  if (!isProfileLoaded) return <Loading />;

  return <Outlet />;
}
