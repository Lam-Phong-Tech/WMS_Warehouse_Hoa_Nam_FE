import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ContextSwitcher } from '@/modules/auth/components/ContextSwitcher';
import { useAuthStore } from '@/shared/store/auth.store';
import { authService } from '@/modules/auth/services/auth.service';
import { renderWithProviders } from '@/test/test-utils';
import type { AuthContext } from '@/modules/auth/types/auth.types';

const CTX_A: AuthContext = {
  role_id: 1,
  role_name: 'Nhân viên',
  scope_type: 'chi_nhanh',
  org_unit_id: 2,
  org_unit_name: 'Chi nhánh A',
  department_id: null,
  department_name: null,
  warehouse_id: null,
  warehouse_name: null,
};

const CTX_B: AuthContext = {
  ...CTX_A,
  role_id: 2,
  role_name: 'Quản lý kho',
  scope_type: 'kho',
  org_unit_id: null,
  org_unit_name: null,
  warehouse_id: 5,
  warehouse_name: 'Kho Tổng',
};

describe('ContextSwitcher', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    vi.restoreAllMocks();
  });

  it('chỉ có 1 context → hiển thị tĩnh, không có dropdown', () => {
    useAuthStore.setState({ contexts: [CTX_A], currentContext: CTX_A });
    renderWithProviders(<ContextSwitcher />);
    expect(screen.getByText('Nhân viên')).toBeInTheDocument();
    expect(screen.queryByRole('menu')).not.toBeInTheDocument();
  });

  it('nhiều context → chọn context khác gọi POST /auth/switch-context và lưu token mới', async () => {
    const switchContextSpy = vi
      .spyOn(authService, 'switchContext')
      .mockResolvedValue({
        access_token: 'new-jwt',
        token_type: 'bearer',
        expires_in: 3600,
      });
    const user = userEvent.setup();
    useAuthStore.setState({
      token: 'old-jwt',
      contexts: [CTX_A, CTX_B],
      currentContext: CTX_A,
    });
    renderWithProviders(<ContextSwitcher />);

    await user.click(screen.getByText('Nhân viên'));
    await user.click(await screen.findByText('Quản lý kho'));

    await waitFor(() => {
      expect(switchContextSpy).toHaveBeenCalledWith({
        role_id: CTX_B.role_id,
        org_unit_id: CTX_B.org_unit_id,
        department_id: CTX_B.department_id,
        warehouse_id: CTX_B.warehouse_id,
      });
    });
    await waitFor(() => {
      expect(useAuthStore.getState().token).toBe('new-jwt');
    });
  });

  it('không có currentContext → không render gì', () => {
    useAuthStore.setState({ contexts: [], currentContext: null });
    renderWithProviders(<ContextSwitcher />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(
      screen.queryByText(/nhân viên|quản lý kho/i),
    ).not.toBeInTheDocument();
  });
});
