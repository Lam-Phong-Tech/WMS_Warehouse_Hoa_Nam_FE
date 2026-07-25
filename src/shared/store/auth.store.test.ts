import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from '@/shared/store/auth.store';
import { queryClient } from '@/app/providers/query-client';
import type { AuthContext } from '@/modules/auth/types/auth.types';

const mockUser = {
  id: 1,
  name: 'Lam Phong',
  email: 'lp@example.com',
  code: 'ADMIN01',
};

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

describe('useAuthStore', () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    queryClient.clear();
  });

  it('khởi tạo ở trạng thái chưa đăng nhập', () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('setAuth lưu token + user và bật isAuthenticated', () => {
    useAuthStore.getState().setAuth({ token: 'abc', user: mockUser });
    const state = useAuthStore.getState();
    expect(state.token).toBe('abc');
    expect(state.user).toEqual(mockUser);
    expect(state.isAuthenticated).toBe(true);
  });

  it('setAuth chọn currentContext mặc định là context đầu tiên trong available_contexts', () => {
    useAuthStore
      .getState()
      .setAuth({ token: 'abc', user: mockUser, contexts: [CTX_A, CTX_B] });
    const state = useAuthStore.getState();
    expect(state.contexts).toEqual([CTX_A, CTX_B]);
    expect(state.currentContext).toEqual(CTX_A);
  });

  it('setToken cập nhật token (dùng sau POST /auth/switch-context)', () => {
    useAuthStore.getState().setAuth({ token: 'abc', user: mockUser });
    useAuthStore.getState().setToken('new-jwt');
    expect(useAuthStore.getState().token).toBe('new-jwt');
  });

  it('setProfile nạp permissionCodes/currentContext/isSuperAdmin từ active_context của GET /auth/me', () => {
    useAuthStore.getState().setProfile({
      id: 1,
      name: 'Test',
      email: 't@erb.vn',
      code: 'T1',
      company: null,
      branch: null,
      department: null,
      position: null,
      role: { id: 1, name: 'Nhân viên', permissions: [] },
      active_context: { ...CTX_A, permission_codes: ['EMP_VIEW', 'ORG_VIEW'] },
      available_contexts: [
        { ...CTX_A, permission_codes: ['EMP_VIEW', 'ORG_VIEW'] },
        { ...CTX_B, permission_codes: ['WAREHOUSE_VIEW'] },
      ],
    });

    const state = useAuthStore.getState();
    expect(state.permissionCodes).toEqual(['EMP_VIEW', 'ORG_VIEW']);
    expect(state.currentContext).toMatchObject(CTX_A);
    expect(state.isSuperAdmin).toBe(false);
    expect(state.isProfileLoaded).toBe(true);
  });

  it('setProfile: active_context null + available_contexts rỗng → isSuperAdmin true', () => {
    useAuthStore.getState().setProfile({
      id: 1,
      name: 'Super Admin',
      email: 'qa-admin@example.com',
      code: 'ADMIN01',
      company: null,
      branch: null,
      department: null,
      position: null,
      role: { id: 1, name: 'Super Admin', permissions: [] },
      active_context: null,
      available_contexts: [],
    });

    const state = useAuthStore.getState();
    expect(state.isSuperAdmin).toBe(true);
    expect(state.permissionCodes).toEqual([]);
    expect(state.currentContext).toBeNull();
  });

  it('logout xoá sạch phiên đăng nhập', () => {
    useAuthStore.getState().setAuth({ token: 'abc', user: mockUser });
    useAuthStore.getState().logout();
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('logout xoá sạch permission/context và clear React Query cache (P1.3)', () => {
    useAuthStore
      .getState()
      .setAuth({ token: 'abc', user: mockUser, contexts: [CTX_A] });
    useAuthStore.setState({
      permissionCodes: ['EMP_VIEW'],
      isProfileLoaded: true,
    });
    queryClient.setQueryData(['auth', 'me'], { fake: 'data' });
    const clearSpy = vi.spyOn(queryClient, 'clear');

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.currentContext).toBeNull();
    expect(state.permissionCodes).toEqual([]);
    expect(state.isProfileLoaded).toBe(false);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
