import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { useAuthStore } from '@/shared/store/auth.store';

// Mocks phải đăng ký trước khi import component under test
vi.mock('@/modules/employee-status/hooks/use-employee-status', () => ({
  useEmployeeStatusHistories: vi.fn(),
  useStatusHistoryDetail: () => ({ data: null, isLoading: false }),
}));

vi.mock('@/modules/employees/hooks/use-employees', () => ({
  useEmployees: vi.fn(),
  useChangeEmployeeStatus: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock('@/modules/users/hooks/use-users', () => ({
  useUsers: () => ({ data: [] }),
}));

// Mặc định setup.ts mock '@/modules/auth/utils/permission' với 1 danh sách
// permissionCodes CỐ ĐỊNH (ORG_*, phục vụ OrgUnitsTable/ActionDropdown) —
// không phản ứng với useAuthStore.setState(). <Can permission="EMP_STATUS">
// dùng trực tiếp usePermissionState/hasPermission từ module này, nên phải
// override lại ở đây để đọc quyền THẬT từ store (cùng pattern với
// OrgUnitsPage.test.tsx) — nếu không, evidence RBAC dưới đây sẽ luôn "pass"
// vì luôn bị deny, bất kể quyền test set.
vi.mock('@/modules/auth/utils/permission', () => ({
  useCan: vi.fn((code: string) => {
    const store = useAuthStore.getState();
    return store.isSuperAdmin || store.permissionCodes.includes(code);
  }),
  useHasPermission: vi.fn(() => (code: string) => {
    const store = useAuthStore.getState();
    return store.isSuperAdmin || store.permissionCodes.includes(code);
  }),
  usePermissionState: vi.fn(() => {
    const store = useAuthStore.getState();
    return {
      isSuperAdmin: store.isSuperAdmin,
      permissionCodes: store.permissionCodes,
      currentScopeType: null,
    };
  }),
  hasPermission: vi.fn(
    (
      code: string,
      state: { isSuperAdmin: boolean; permissionCodes: string[] },
    ) => state.isSuperAdmin || state.permissionCodes.includes(code),
  ),
}));

import { EmployeeStatusPage } from './EmployeeStatusPage';
import { useEmployeeStatusHistories } from '@/modules/employee-status/hooks/use-employee-status';
import { useEmployees } from '@/modules/employees/hooks/use-employees';

function withPermissions(codes: string[]) {
  useAuthStore.setState({
    permissionCodes: codes,
    isSuperAdmin: false,
    isProfileLoaded: true,
  });
}

const MOCK_EMPLOYEE = {
  id: 1,
  code: 'NV001',
  fullName: 'Nguyen Van A',
  employeeStatus: 2,
};

/**
 * RBAC evidence — Module Employee Assignment & Status Lifecycle:
 * user chỉ có EMP_VIEW phải xem được lịch sử trạng thái nhưng KHÔNG được
 * đổi trạng thái (nút "Đổi trạng thái" chỉ hiện khi có EMP_STATUS).
 * Xem thêm src/modules/employees/components/EmployeeStatusModal.test.tsx và
 * src/modules/employees/pages/EmployeesPage.test.tsx (nút "Điều chuyển").
 */
describe('EmployeeStatusPage - RBAC evidence (EMP_VIEW vs EMP_STATUS)', () => {
  beforeEach(() => {
    vi.mocked(useEmployees).mockReturnValue({
      data: [MOCK_EMPLOYEE],
    } as unknown as ReturnType<typeof useEmployees>);

    vi.mocked(useEmployeeStatusHistories).mockReturnValue({
      data: {
        data: [
          {
            id: 1,
            employee_id: 1,
            employee: MOCK_EMPLOYEE,
            old_status: 1,
            new_status: 2,
            effective_date: '2026-01-01',
            reason: 'Chuyển chính thức',
            changed_by: 1,
            created_at: '2026-01-01T00:00:00Z',
          },
        ],
        meta: { total: 1 },
      },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeStatusHistories>);
  });

  async function selectEmployee() {
    // Select nhân sự hiển thị label đang chọn ("Tất cả nhân sự" mặc định),
    // không phải placeholder — mở dropdown bằng cách bấm vào label đó.
    fireEvent.mouseDown(screen.getByText('Tất cả nhân sự'));
    const option = await screen.findByRole('option', {
      name: /nv001.*nguyen van a/i,
    });
    fireEvent.click(option);
  }

  it('user chi co EMP_VIEW: thay lich su trang thai nhung KHONG thay nut Doi trang thai', async () => {
    withPermissions(['EMP_VIEW']);
    renderWithProviders(<EmployeeStatusPage />);

    // Lịch sử trạng thái vẫn hiển thị (default deny chỉ áp dụng cho hành
    // động ghi, không chặn xem — user có EMP_VIEW).
    expect(await screen.findByText('Nguyen Van A')).toBeInTheDocument();

    await selectEmployee();

    expect(
      screen.queryByRole('button', { name: /đổi trạng thái/i }),
    ).not.toBeInTheDocument();
  });

  it('user co quyen EMP_STATUS: thay nut Doi trang thai sau khi chon nhan su', async () => {
    withPermissions(['EMP_VIEW', 'EMP_STATUS']);
    renderWithProviders(<EmployeeStatusPage />);

    expect(await screen.findByText('Nguyen Van A')).toBeInTheDocument();

    await selectEmployee();

    await waitFor(() => {
      expect(
        screen.getByRole('button', { name: /đổi trạng thái/i }),
      ).toBeInTheDocument();
    });
  });
});
