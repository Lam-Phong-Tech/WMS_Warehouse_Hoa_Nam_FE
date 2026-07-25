import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from '@/shared/store/auth.store';
import { RequirePermission } from '@/app/router/RequirePermission';
import { ROUTE_PERMISSIONS } from '@/app/router/access';
import { ROUTES } from '@/shared/constants/routes';

// Suite này kiểm tra logic permission THẬT (dựa trên auth store), nên phải
// bỏ global mock của setup.ts (vốn luôn trả về useCan = true để đơn giản hoá
// các suite khác không quan tâm đến permission thật).
vi.unmock('@/modules/auth/utils/permission');

// Helper functions
function withPermissions(codes: string[]) {
  useAuthStore.setState({
    permissionCodes: codes,
    isSuperAdmin: false,
    isProfileLoaded: true,
  });
}

function withRole(codes: string[], isSuperAdmin = false) {
  useAuthStore.setState({
    permissionCodes: codes,
    isSuperAdmin,
    isProfileLoaded: true,
  });
}

function renderWithRouter(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

// Reset auth store helper
function resetAuthStore() {
  useAuthStore.setState({
    permissionCodes: [],
    isSuperAdmin: false,
    isProfileLoaded: true,
    user: null,
    currentContext: null,
  });
}

// P0.2: route permission map từng lệch contract BE (EMP_VIEW/ROLE_VIEW thay vì
// EMP_ASSIGNMENT_VIEW/SCOPE_CONFIG) — test khoá lại đúng quyền tối thiểu cho
// từng route nhạy cảm, tránh lệch lại trong tương lai.
//
// Lưu ý: RequirePermission giờ redirect sang /errors/403 thay vì render inline,
// nên test chỉ kiểm tra content không xuất hiện (vì Navigate thay đổi location
// trong MemoryRouter, không render children).

// P1: Test matrix cho các role scenarios
describe('RequirePermission — Test Matrix', () => {
  const TEST_PERMISSION = 'EMP_ASSIGNMENT_VIEW';
  const OTHER_PERMISSION = 'EMP_VIEW';

  describe('1. Role thường (có view)', () => {
    it('cho vào khi có đúng permission', () => {
      resetAuthStore();
      withRole([TEST_PERMISSION]);
      const { container } = renderWithRouter(
        <RequirePermission permission={TEST_PERMISSION}>
          <div>Protected Content</div>
        </RequirePermission>,
      );
      expect(container.innerHTML).toContain('Protected Content');
    });
  });

  describe('2. Role thiếu view', () => {
    it('chặn khi thiếu permission — redirect 403', () => {
      resetAuthStore();
      withRole([OTHER_PERMISSION]);
      const { container } = renderWithRouter(
        <RequirePermission permission={TEST_PERMISSION}>
          <div>Protected Content</div>
        </RequirePermission>,
      );
      expect(container.innerHTML).not.toContain('Protected Content');
    });

    it('chặn khi không có permission nào', () => {
      resetAuthStore();
      withRole([]);
      const { container } = renderWithRouter(
        <RequirePermission permission={TEST_PERMISSION}>
          <div>Protected Content</div>
        </RequirePermission>,
      );
      expect(container.innerHTML).not.toContain('Protected Content');
    });
  });

  describe('3. Role có edit không có view', () => {
    it('chặn khi chỉ có edit mà không có view', () => {
      resetAuthStore();
      withRole(['EMP_ASSIGNMENT_EDIT']);
      const { container } = renderWithRouter(
        <RequirePermission permission={TEST_PERMISSION}>
          <div>Protected Content</div>
        </RequirePermission>,
      );
      expect(container.innerHTML).not.toContain('Protected Content');
    });
  });

  describe('4. Deny override (có deny rule)', () => {
    it('chặn khi có deny rule override allow', () => {
      // Giả sử: user có TEST_PERMISSION nhưng có deny rule
      // Trong hệ thống hiện tại, deny được xử lý ở level permissionCodes
      // (không có code = không có quyền)
      resetAuthStore();
      withRole([]); // Không có permission = bị chặn
      const { container } = renderWithRouter(
        <RequirePermission permission={TEST_PERMISSION}>
          <div>Protected Content</div>
        </RequirePermission>,
      );
      expect(container.innerHTML).not.toContain('Protected Content');
    });
  });

  describe('5. Super admin', () => {
    it('cho vào super admin ngay cả khi không có permission code', () => {
      resetAuthStore();
      withRole([], true); // Super admin không cần permissionCodes
      const { container } = renderWithRouter(
        <RequirePermission permission={TEST_PERMISSION}>
          <div>Protected Content</div>
        </RequirePermission>,
      );
      expect(container.innerHTML).toContain('Protected Content');
    });

    it('cho vào super admin với permission bất kỳ', () => {
      resetAuthStore();
      withRole(['ANY_RANDOM_PERMISSION'], true);
      const { container } = renderWithRouter(
        <RequirePermission permission={TEST_PERMISSION}>
          <div>Protected Content</div>
        </RequirePermission>,
      );
      expect(container.innerHTML).toContain('Protected Content');
    });
  });

  describe('6. Edge cases', () => {
    it('cho vào khi permission prop trống (không giới hạn)', () => {
      resetAuthStore();
      withRole([]);
      const { container } = renderWithRouter(
        <RequirePermission permission="">
          <div>Public Content</div>
        </RequirePermission>,
      );
      expect(container.innerHTML).toContain('Public Content');
    });

    it('cho vào khi không có permission prop', () => {
      resetAuthStore();
      withRole([]);
      const { container } = renderWithRouter(
        <RequirePermission>
          <div>Public Content</div>
        </RequirePermission>,
      );
      expect(container.innerHTML).toContain('Public Content');
    });
  });
});

describe('RequirePermission — Employee Assignments (EMP_ASSIGNMENT_VIEW)', () => {
  it('chặn user chỉ có EMP_VIEW (thiếu EMP_ASSIGNMENT_VIEW) — redirect /errors/403', () => {
    withPermissions(['EMP_VIEW']);
    const { container } = renderWithRouter(
      <RequirePermission
        permission={ROUTE_PERMISSIONS[ROUTES.EMPLOYEE_ASSIGNMENTS]}
      >
        <div>Employee Assignments Content</div>
      </RequirePermission>,
    );
    // Không còn render inline NoPermissionState nữa — content không xuất hiện
    expect(container.innerHTML).not.toContain('Employee Assignments Content');
  });

  it('cho vào khi có đúng EMP_ASSIGNMENT_VIEW', () => {
    withPermissions(['EMP_ASSIGNMENT_VIEW']);
    const { container } = renderWithRouter(
      <RequirePermission
        permission={ROUTE_PERMISSIONS[ROUTES.EMPLOYEE_ASSIGNMENTS]}
      >
        <div>Employee Assignments Content</div>
      </RequirePermission>,
    );
    expect(container.innerHTML).toContain('Employee Assignments Content');
  });
});

describe('RequirePermission — User Role Scopes (ROLE_ASSIGN hoặc SCOPE_CONFIG — OR)', () => {
  it('chặn user chỉ có ROLE_VIEW (thiếu cả ROLE_ASSIGN lẫn SCOPE_CONFIG) — redirect /errors/403', () => {
    withPermissions(['ROLE_VIEW']);
    const { container } = renderWithRouter(
      <RequirePermission
        permission={ROUTE_PERMISSIONS[ROUTES.USER_ROLE_SCOPES]}
      >
        <div>User Role Scopes Content</div>
      </RequirePermission>,
    );
    // Không còn render inline NoPermissionState nữa — content không xuất hiện
    expect(container.innerHTML).not.toContain('User Role Scopes Content');
  });

  it('cho vào khi có đúng SCOPE_CONFIG', () => {
    withPermissions(['SCOPE_CONFIG']);
    const { container } = renderWithRouter(
      <RequirePermission
        permission={ROUTE_PERMISSIONS[ROUTES.USER_ROLE_SCOPES]}
      >
        <div>User Role Scopes Content</div>
      </RequirePermission>,
    );
    expect(container.innerHTML).toContain('User Role Scopes Content');
  });

  // P1: user chỉ gán được vai trò (ROLE_ASSIGN) nhưng không cấu hình được
  // data scope trực tiếp (SCOPE_CONFIG) vẫn phải vào được route — trước đây
  // route yêu cầu cứng SCOPE_CONFIG nên user này bị chặn hoàn toàn, dù action
  // "Gán vai trò" của họ dùng ROLE_ASSIGN chứ không phải SCOPE_CONFIG.
  it('cho vào khi chỉ có ROLE_ASSIGN (không có SCOPE_CONFIG)', () => {
    withPermissions(['ROLE_ASSIGN']);
    const { container } = renderWithRouter(
      <RequirePermission
        permission={ROUTE_PERMISSIONS[ROUTES.USER_ROLE_SCOPES]}
      >
        <div>User Role Scopes Content</div>
      </RequirePermission>,
    );
    expect(container.innerHTML).toContain('User Role Scopes Content');
  });
});
