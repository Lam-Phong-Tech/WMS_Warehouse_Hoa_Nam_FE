import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ProtectedRoute } from '@/app/router/ProtectedRoute';
import { useAuthStore } from '@/shared/store/auth.store';
import { ROUTES } from '@/shared/constants/routes';

// useMe() gọi thật GET /auth/me qua React Query — không liên quan tới điều
// P1.3 muốn khoá lại (3 trạng thái của ProtectedRoute), nên mock để test
// không phụ thuộc network.
vi.mock('@/modules/auth/hooks/use-me', () => ({
  useMe: () => ({ data: undefined, isError: false }),
}));

function renderProtectedRoute() {
  return render(
    <MemoryRouter initialEntries={[ROUTES.ORG_UNITS]}>
      <Routes>
        <Route path={ROUTES.LOGIN} element={<div>Login Page</div>} />
        <Route element={<ProtectedRoute />}>
          <Route path={ROUTES.ORG_UNITS} element={<div>Org Units Page</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    // Trong app thật, main.tsx set true sau khi rehydrate cookie xong (P2).
    // Test giả lập bootstrap đã xong để kiểm 3 trạng thái auth/profile như cũ.
    useAuthStore.setState({ isBootstrapped: true });
  });

  it('chưa bootstrap xong (rehydrate cookie chưa resolve) → hiện Loading, không redirect nhầm', () => {
    useAuthStore.setState({ isBootstrapped: false, isAuthenticated: false });
    renderProtectedRoute();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Org Units Page')).not.toBeInTheDocument();
  });

  it('chưa đăng nhập → redirect về /login', () => {
    useAuthStore.setState({ isAuthenticated: false });
    renderProtectedRoute();
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Org Units Page')).not.toBeInTheDocument();
  });

  it('đã đăng nhập nhưng chưa nạp profile (F5) → hiện Loading, chưa render Outlet', () => {
    useAuthStore.setState({ isAuthenticated: true, isProfileLoaded: false });
    renderProtectedRoute();
    expect(screen.queryByText('Org Units Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
  });

  it('đã đăng nhập + đã nạp profile → render Outlet', () => {
    useAuthStore.setState({ isAuthenticated: true, isProfileLoaded: true });
    renderProtectedRoute();
    expect(screen.getByText('Org Units Page')).toBeInTheDocument();
  });
});
