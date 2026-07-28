import { type ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loading } from '@/shared/components/feedback/Loading';
import { ROUTES } from '@/shared/constants/routes';
import { useAuthStore } from '@/shared/store/auth.store';

interface Props {
  /**
   * Minimal permission required for a route. Array means OR.
   * Empty or undefined means any authenticated user may enter.
   */
  permission?: string | string[];
  children: ReactNode;
}

function normalizePermissions(permission?: string | string[]): string[] {
  if (!permission) return [];
  return Array.isArray(permission) ? permission.filter(Boolean) : [permission];
}

/**
 * Route-level RBAC guard. Menu filtering and disabled action buttons are useful
 * hints, but protected screens must also be blocked at the router boundary.
 */
export function RequirePermission({ permission, children }: Props) {
  const location = useLocation();
  const isProfileLoaded = useAuthStore((s) => s.isProfileLoaded);
  const isSuperAdmin = useAuthStore((s) => s.isSuperAdmin);
  const permissionCodes = useAuthStore((s) => s.permissionCodes);
  const required = normalizePermissions(permission);

  if (required.length === 0 || isSuperAdmin) return <>{children}</>;

  if (!isProfileLoaded) return <Loading />;

  const canEnter = required.some((code) => permissionCodes.includes(code));
  if (!canEnter) {
    if (location.pathname === ROUTES.NO_PERMISSION) return null;
    return (
      <Navigate
        to={ROUTES.NO_PERMISSION}
        replace
        state={{ from: location, requiredPermissions: required }}
      />
    );
  }

  return <>{children}</>;
}
