import { screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { useAuthStore } from '@/shared/store/auth.store';
import { RolePermissionMatrixPanel } from './RolePermissionMatrixPanel';
import type { Role } from '../types/roles.types';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const BASE_ROLE: Role = {
  id: 1,
  code: 'SALES_STAFF',
  name: 'Nhân viên kinh doanh',
  description: null,
  type: 'co_dinh',
  status: 1,
  is_super_admin: false,
  created_at: '',
  updated_at: '',
  permissions: [],
};

const PERMISSION_GROUPS = [
  {
    object: 'Đơn vị/tổ chức',
    permissions: [
      {
        id: 1,
        code: 'ORG_VIEW',
        name: 'Xem',
        object: 'Đơn vị/tổ chức',
        action: 'xem',
        description: null,
      },
    ],
  },
];

const mockUseRolePermissionMatrix = vi.hoisted(() => vi.fn());
vi.mock('../hooks/use-role-permission-matrix', () => ({
  useRolePermissionMatrix: mockUseRolePermissionMatrix,
}));

function baseHookReturn(overrides: Record<string, unknown> = {}) {
  return {
    selectedRoleDetail: BASE_ROLE,
    selectedPermissionIds: new Set<number>([1]),
    permissionGroups: PERMISSION_GROUPS,
    canConfigMatrix: false,
    syncPermsMutation: { isPending: false },
    selectedRoleTotal: 1,
    selectedRoleChecked: 1,
    matrixDirty: false,
    handlePermissionToggle: vi.fn(),
    isGroupAllChecked: () => true,
    isGroupIndeterminate: () => false,
    handleGroupAllChange: vi.fn(),
    handleResetMatrix: vi.fn(),
    handleSaveMatrix: vi.fn(),
    ...overrides,
  };
}

describe('RolePermissionMatrixPanel readonly khi thiếu PERM_CONFIG', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissionCodes: [], isSuperAdmin: false });
  });

  it('P2: ẩn nút Lưu ma trận và hiển thị cảnh báo readonly khi canConfigMatrix=false', () => {
    mockUseRolePermissionMatrix.mockReturnValue(
      baseHookReturn({ canConfigMatrix: false }),
    );

    renderWithProviders(<RolePermissionMatrixPanel selectedRoleId={1} />);

    expect(
      screen.queryByRole('button', { name: /lưu ma trận/i }),
    ).not.toBeInTheDocument();
    expect(screen.getByText(/thiếu quyền/i)).toBeInTheDocument();
    expect(screen.getByText('PERM_CONFIG')).toBeInTheDocument();
  });

  it('P2: checkbox quyền bị disabled khi canConfigMatrix=false', () => {
    mockUseRolePermissionMatrix.mockReturnValue(
      baseHookReturn({ canConfigMatrix: false }),
    );

    renderWithProviders(<RolePermissionMatrixPanel selectedRoleId={1} />);

    const checkboxes = screen
      .getAllByRole('checkbox')
      .filter((el) => (el as HTMLInputElement).disabled);
    expect(checkboxes.length).toBeGreaterThan(0);
  });

  it('hiển thị nút Lưu ma trận khi canConfigMatrix=true', () => {
    useAuthStore.setState({ permissionCodes: ['PERM_CONFIG'] });
    mockUseRolePermissionMatrix.mockReturnValue(
      baseHookReturn({ canConfigMatrix: true }),
    );

    renderWithProviders(<RolePermissionMatrixPanel selectedRoleId={1} />);

    expect(
      screen.getAllByRole('button', { name: /lưu ma trận/i }).length,
    ).toBeGreaterThan(0);
  });
});
