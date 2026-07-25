import { screen } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { useAuthStore } from '@/shared/store/auth.store';
import { DepartmentDetailDrawer } from './DepartmentDetailDrawer';
import type { Department } from '../types/departments.types';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const BASE_DEPARTMENT: Department = {
  id: 1,
  code: 'PB1',
  name: 'Phòng Kinh doanh',
  departmentType: 'phong_ban',
  orgUnitId: 10,
  orgUnitName: 'Công ty A',
  parentId: null,
  managerId: null,
  active: true,
  employeeCount: 0,
};

function renderDrawer(
  department: Department,
  overrides: Partial<Parameters<typeof DepartmentDetailDrawer>[0]> = {},
) {
  return renderWithProviders(
    <DepartmentDetailDrawer
      open
      department={department}
      members={[]}
      onClose={() => {}}
      onEdit={() => {}}
      onDeactivate={() => {}}
      onActivate={() => {}}
      onSoftDelete={() => {}}
      onRestore={() => {}}
      onCreateSubgroup={() => {}}
      {...overrides}
    />,
  );
}

describe('DepartmentDetailDrawer actions', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissionCodes: [], isSuperAdmin: true });
  });

  it('P1: status active hiển thị đủ Sửa, Tạo nhóm/tổ con, Ngừng hoạt động, Xóa', () => {
    renderDrawer(BASE_DEPARTMENT);

    expect(screen.getByRole('button', { name: /sửa/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /tạo nhóm\/tổ con/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /ngừng hoạt động/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^xóa$/i })).toBeInTheDocument();
  });

  it('P1: status active không hiện "Tạo nhóm/tổ con" khi departmentType là nhom_to', () => {
    renderDrawer({
      ...BASE_DEPARTMENT,
      departmentType: 'nhom_to',
      parentId: 5,
    });

    expect(
      screen.queryByRole('button', { name: /tạo nhóm\/tổ con/i }),
    ).not.toBeInTheDocument();
  });

  it('status inactive hiển thị Kích hoạt lại + Xóa, không hiện Sửa/Ngừng hoạt động', () => {
    renderDrawer({ ...BASE_DEPARTMENT, active: false });

    expect(
      screen.getByRole('button', { name: /kích hoạt lại/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^xóa$/i })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^sửa$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /ngừng hoạt động/i }),
    ).not.toBeInTheDocument();
  });

  it('status soft_deleted chỉ hiển thị Khôi phục', () => {
    renderDrawer({
      ...BASE_DEPARTMENT,
      active: false,
      deletedAt: '2026-07-01T00:00:00Z',
    });

    expect(
      screen.getByRole('button', { name: /khôi phục/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^xóa$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /kích hoạt lại/i }),
    ).not.toBeInTheDocument();
  });

  it('không hiển thị nút nào khi thiếu quyền DEPT_EDIT/DEPT_INACTIVE/DEPT_CREATE', () => {
    useAuthStore.setState({ permissionCodes: [], isSuperAdmin: false });
    renderDrawer(BASE_DEPARTMENT);

    expect(
      screen.queryByRole('button', { name: /sửa/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /ngừng hoạt động/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^xóa$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /tạo nhóm\/tổ con/i }),
    ).not.toBeInTheDocument();
  });

  it('P2: header hiển thị đúng trạng thái soft_deleted (không chỉ active/inactive)', () => {
    renderDrawer({
      ...BASE_DEPARTMENT,
      active: false,
      deletedAt: '2026-07-01T00:00:00Z',
    });

    expect(screen.getByText('Đã xóa chờ khôi phục')).toBeInTheDocument();
  });
});
