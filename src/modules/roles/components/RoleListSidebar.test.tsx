import { screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderWithProviders } from '@/test/test-utils';
import { useAuthStore } from '@/shared/store/auth.store';
import { RoleListSidebar } from './RoleListSidebar';
import type { Role } from '../types/roles.types';

globalThis.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

function makeRole(overrides: Partial<Role> = {}): Role {
  return {
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
    ...overrides,
  };
}

function renderSidebar(roles: Role[]) {
  return renderWithProviders(
    <RoleListSidebar
      roles={roles}
      rolesTotal={roles.length}
      isLoading={false}
      searchQuery=""
      onSearchChange={() => {}}
      page={1}
      perPage={10}
      onPageChange={() => {}}
      selectedRoleId={null}
      onSelectRole={() => {}}
      getUserCount={() => 0}
      onCreate={() => {}}
      onEdit={() => {}}
      onDelete={() => {}}
    />,
  );
}

describe('RoleListSidebar - Super Admin delete disabled', () => {
  beforeEach(() => {
    useAuthStore.setState({ permissionCodes: [], isSuperAdmin: true });
  });

  it('P2: role is_super_admin=true -> nút Sửa và Vô hiệu hóa đều bị disabled', () => {
    renderSidebar([makeRole({ is_super_admin: true, name: 'Super Admin' })]);

    const editButton = screen.getByRole('button', {
      name: /sửa vai trò "super admin"/i,
    });
    const deleteButton = screen.getByRole('button', {
      name: /vô hiệu hóa vai trò "super admin"/i,
    });

    expect(editButton).toBeDisabled();
    expect(deleteButton).toBeDisabled();
  });

  it('role thường (is_super_admin=false) -> nút Sửa và Vô hiệu hóa không bị disabled', () => {
    renderSidebar([makeRole({ is_super_admin: false })]);

    const editButton = screen.getByRole('button', {
      name: /sửa vai trò "nhân viên kinh doanh"/i,
    });
    const deleteButton = screen.getByRole('button', {
      name: /vô hiệu hóa vai trò "nhân viên kinh doanh"/i,
    });

    expect(editButton).not.toBeDisabled();
    expect(deleteButton).not.toBeDisabled();
  });

  it('click vào nút Vô hiệu hóa đã disabled không gọi onDelete', () => {
    const onDelete = vi.fn();
    renderWithProviders(
      <RoleListSidebar
        roles={[makeRole({ is_super_admin: true, name: 'Super Admin' })]}
        rolesTotal={1}
        isLoading={false}
        searchQuery=""
        onSearchChange={() => {}}
        page={1}
        perPage={10}
        onPageChange={() => {}}
        selectedRoleId={null}
        onSelectRole={() => {}}
        getUserCount={() => 0}
        onCreate={() => {}}
        onEdit={() => {}}
        onDelete={onDelete}
      />,
    );

    const deleteButton = screen.getByRole('button', {
      name: /vô hiệu hóa vai trò "super admin"/i,
    });
    deleteButton.click();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
