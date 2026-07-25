import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '@/shared/store/auth.store';
import { SideNav } from '@/app/layouts/SideNav';

// Suite này render SideNav THẬT (không chỉ test helper filterMenu như
// menu.test.tsx) để khoá lại hành vi thực tế người dùng thấy trên màn hình:
// menu M1/M2/M3 có xuất hiện đúng khi auth store có đủ quyền hay không.
// menu.test.tsx test riêng filterMenu() là hàm thuần, không phát hiện được
// lỗi nếu SideNav quên truyền `can` hoặc dùng sai state.
vi.unmock('@/modules/auth/utils/permission');

function withPermissions(codes: string[], isSuperAdmin = false) {
  useAuthStore.setState({
    permissionCodes: codes,
    isSuperAdmin,
    isProfileLoaded: true,
  });
}

function resetAuthStore() {
  useAuthStore.setState({
    permissionCodes: [],
    isSuperAdmin: false,
    isProfileLoaded: true,
    user: null,
    currentContext: null,
  });
}

function renderSideNav(initialPath = '/org-units') {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SideNav />
    </MemoryRouter>,
  );
}

const M1_M2_M3_PERMISSIONS = [
  'ORG_VIEW',
  'WAREHOUSE_VIEW',
  'STOCK_RECEIPT_VIEW',
  'BUSINESS_VIEW',
  'PRODUCT_VIEW',
];

describe('SideNav — render thực tế với permission mock', () => {
  afterEach(() => {
    resetAuthStore();
  });

  it('hiện đủ Module 1/2/3 khi có quyền *_VIEW tương ứng', () => {
    withPermissions(M1_M2_M3_PERMISSIONS);
    renderSideNav();

    expect(screen.getByText('Module 1 · Tổ chức')).toBeInTheDocument();
    expect(screen.getByText('Module 2 · Kho')).toBeInTheDocument();
    expect(screen.getByText('Module 3 · Kinh doanh')).toBeInTheDocument();
  });

  it('ẩn Module 2 và 3 khi chỉ có quyền M1', () => {
    withPermissions(['ORG_VIEW']);
    renderSideNav();

    expect(screen.getByText('Module 1 · Tổ chức')).toBeInTheDocument();
    expect(screen.queryByText('Module 2 · Kho')).not.toBeInTheDocument();
    expect(screen.queryByText('Module 3 · Kinh doanh')).not.toBeInTheDocument();
  });

  it('Super Admin thấy đủ M1/M2/M3 dù permissionCodes rỗng', () => {
    withPermissions([], true);
    renderSideNav();

    expect(screen.getByText('Module 1 · Tổ chức')).toBeInTheDocument();
    expect(screen.getByText('Module 2 · Kho')).toBeInTheDocument();
    expect(screen.getByText('Module 3 · Kinh doanh')).toBeInTheDocument();
  });
});
