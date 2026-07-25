import { screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { useAuthStore } from '@/shared/store/auth.store';

// setup.ts mock '@/modules/auth/utils/permission' với 1 danh sách permission
// CỐ ĐỊNH (ORG_*) không phản ứng với useAuthStore.setState() — override lại
// để đọc quyền THẬT từ store, cùng pattern với EmployeeStatusPage.test.tsx.
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

// Mocks phải đăng ký trước khi import component under test
vi.mock(
  '@/modules/employee-assignments/hooks/use-employee-assignments',
  () => ({
    useEmployeeAssignments: vi.fn(),
    useSoftDeleteAssignment: () => ({ mutate: vi.fn(), isPending: false }),
    useEmployeeAssignment: () => ({ data: null, isLoading: false }),
  }),
);

vi.mock('@/modules/employees/hooks/use-employees', () => ({
  useEmployees: () => ({ data: [] }),
}));

vi.mock('@/modules/org-units/hooks/use-org-units', () => ({
  useOrgUnits: () => ({ data: [] }),
}));

vi.mock('@/modules/departments/hooks/use-departments', () => ({
  useDepartments: () => ({ data: [] }),
}));

vi.mock('@/modules/positions/hooks/use-positions', () => ({
  usePositions: () => ({ data: [] }),
}));

// TransferFormModal đã có test riêng (TransferFormModal.test.tsx) — mock stub
// ở đây để test này chỉ tập trung vào RBAC của chính EmployeeAssignmentsPage.
vi.mock('@/modules/employee-assignments/components/TransferFormModal', () => ({
  TransferFormModal: ({ open }: { open: boolean }) =>
    open ? <div data-testid="transfer-form-modal" /> : null,
}));

vi.mock(
  '@/modules/employee-assignments/components/AssignmentDetailDrawer',
  () => ({
    AssignmentDetailDrawer: () => null,
  }),
);

import { EmployeeAssignmentsPage } from './EmployeeAssignmentsPage';
import { useEmployeeAssignments } from '@/modules/employee-assignments/hooks/use-employee-assignments';
import type { EmployeeAssignment } from '@/modules/employee-assignments/hooks/use-employee-assignments';

function withPermissions(codes: string[]) {
  useAuthStore.setState({
    permissionCodes: codes,
    isSuperAdmin: false,
    isProfileLoaded: true,
  });
}

const MOCK_ASSIGNMENT: EmployeeAssignment = {
  id: 1,
  employee_id: 1,
  org_unit_id: 1,
  department_id: 1,
  position_id: 1,
  is_primary: true,
  start_date: '2026-01-01',
  end_date: null,
  status: true,
};

/**
 * RBAC evidence — Module Employee Assignment & Status Lifecycle:
 * nút "Điều chuyển" (tạo mới) chỉ hiện khi có EMP_ASSIGNMENT_CREATE, action
 * "Sửa"/"Xóa" trong bảng theo đúng EMP_ASSIGNMENT_EDIT/EMP_ASSIGNMENT_DELETE.
 * Test 3 role: HR đủ quyền, user chỉ xem (thiếu create/edit/delete), user
 * thiếu đúng EMP_ASSIGNMENT_CREATE.
 */
describe('EmployeeAssignmentsPage - RBAC evidence', () => {
  beforeEach(() => {
    vi.mocked(useEmployeeAssignments).mockReturnValue({
      data: { data: [MOCK_ASSIGNMENT], meta: { total: 1 } },
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useEmployeeAssignments>);
  });

  it('role HR du quyen: hien nut Dieu chuyen va action Sua/Xoa', async () => {
    withPermissions([
      'EMP_ASSIGNMENT_VIEW',
      'EMP_ASSIGNMENT_CREATE',
      'EMP_ASSIGNMENT_EDIT',
      'EMP_ASSIGNMENT_DELETE',
    ]);
    renderWithProviders(<EmployeeAssignmentsPage />);

    expect(await screen.findByText('Điều chuyển')).toBeInTheDocument();

    const actionTrigger = await screen.findByTitle('Thao tác');
    fireEvent.click(actionTrigger);
    expect(
      screen.getByRole('menuitem', { name: /sửa/i, hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /xóa/i, hidden: true }),
    ).toBeInTheDocument();
  });

  it('role chi xem (thieu EMP_ASSIGNMENT_CREATE/EDIT/DELETE): an nut Dieu chuyen va khong con action nao', async () => {
    withPermissions(['EMP_ASSIGNMENT_VIEW']);
    renderWithProviders(<EmployeeAssignmentsPage />);

    await screen.findByRole('table');
    expect(screen.queryByText('Điều chuyển')).not.toBeInTheDocument();
    // Không còn action nào được phép -> ActionDropdown trả về null.
    expect(screen.queryByTitle('Thao tác')).not.toBeInTheDocument();
  });

  it('role thieu dung EMP_ASSIGNMENT_CREATE: an nut Dieu chuyen nhung van con Sua/Xoa', async () => {
    withPermissions([
      'EMP_ASSIGNMENT_VIEW',
      'EMP_ASSIGNMENT_EDIT',
      'EMP_ASSIGNMENT_DELETE',
    ]);
    renderWithProviders(<EmployeeAssignmentsPage />);

    expect(await screen.findByRole('table')).toBeInTheDocument();
    expect(screen.queryByText('Điều chuyển')).not.toBeInTheDocument();

    const actionTrigger = await screen.findByTitle('Thao tác');
    fireEvent.click(actionTrigger);
    expect(
      screen.getByRole('menuitem', { name: /sửa/i, hidden: true }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menuitem', { name: /xóa/i, hidden: true }),
    ).toBeInTheDocument();
  });

  it('bam nut Dieu chuyen mo modal tao moi khi co quyen', async () => {
    withPermissions(['EMP_ASSIGNMENT_VIEW', 'EMP_ASSIGNMENT_CREATE']);
    renderWithProviders(<EmployeeAssignmentsPage />);

    fireEvent.click(await screen.findByText('Điều chuyển'));
    await waitFor(() => {
      expect(screen.getByTestId('transfer-form-modal')).toBeInTheDocument();
    });
  });
});
