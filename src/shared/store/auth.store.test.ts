import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAuthStore } from "@/shared/store/auth.store";
import { queryClient } from "@/app/providers/query-client";
import type { AuthContext } from "@/modules/auth/types/auth.types";

const mockUser = {
  id: 1,
  name: "Lam Phong",
  email: "lp@example.com",
  code: "ADMIN01",
};

const CTX_A: AuthContext = {
  role_id: "role-a",
  role_name: "Nhân viên",
  scope_type: "kho",
  org_unit_id: null,
  org_unit_name: null,
  department_id: null,
  department_name: null,
  warehouse_id: null,
  warehouse_name: "WH-A",
  context_type: "WAREHOUSE",
  context_id: "WH-A",
  scope_ref: "WH-A",
};

const CTX_B: AuthContext = {
  ...CTX_A,
  role_id: "role-b",
  role_name: "Quản lý kho",
  warehouse_name: "WH-B",
  context_id: "WH-B",
  scope_ref: "WH-B",
};

const baseMe = {
  id: 1,
  name: "Test",
  email: "t@erp.vn",
  code: "T1",
  roles: [
    {
      role_id: "role-a",
      role_code: "WAREHOUSE_STAFF",
      role_name: "Nhân viên",
      scope_ref: "WH-A",
    },
  ],
  permissions: ["EMP_VIEW", "ORG_VIEW"],
  warehouse_scope_ids: ["WH-A"],
  company: null,
  branch: null,
  department: null,
  position: null,
  role: { id: 1, name: "Nhân viên", permissions: [] },
};

describe("useAuthStore WWHN-165", () => {
  beforeEach(() => {
    useAuthStore.getState().logout();
    queryClient.clear();
  });

  it("khởi tạo ở trạng thái chưa đăng nhập", () => {
    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it("setAuth commit context hiển thị nhưng chưa cấp permission trước /auth/me", () => {
    useAuthStore
      .getState()
      .setAuth({ token: "abc", user: mockUser, contexts: [CTX_A, CTX_B] });
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.contexts).toEqual([CTX_A, CTX_B]);
    expect(state.currentContext).toEqual(CTX_A);
    expect(state.permissionCodes).toEqual([]);
    expect(state.isProfileLoaded).toBe(false);
  });

  it("setToken thu hồi profile/quyền cũ nhưng giữ warehouse context đã chọn", () => {
    useAuthStore
      .getState()
      .setAuth({ token: "abc", user: mockUser, contexts: [CTX_A] });
    useAuthStore.setState({
      currentContext: CTX_A,
      permissionCodes: ["inventory.view"],
      isProfileLoaded: true,
      isSuperAdmin: true,
    });

    useAuthStore.getState().setToken("new-jwt");
    const state = useAuthStore.getState();
    expect(state.token).toBe("new-jwt");
    expect(state.currentContext).toEqual(CTX_A);
    expect(state.permissionCodes).toEqual([]);
    expect(state.isProfileLoaded).toBe(false);
    expect(state.isSuperAdmin).toBe(false);
  });

  it("setProfile lấy permission top-level theo contract /auth/me BE m1", () => {
    useAuthStore.getState().setProfile({
      ...baseMe,
      active_context: { ...CTX_A, permission_codes: ["LEGACY_CONTEXT_ONLY"] },
      available_contexts: [
        { ...CTX_A, permission_codes: baseMe.permissions },
        { ...CTX_B, permission_codes: baseMe.permissions },
      ],
    });

    const state = useAuthStore.getState();
    expect(state.permissionCodes).toEqual(["EMP_VIEW", "ORG_VIEW"]);
    expect(state.currentContext).toMatchObject(CTX_A);
    expect(state.isSuperAdmin).toBe(false);
    expect(state.isProfileLoaded).toBe(true);
  });

  it("restores user from /auth/me when token exists but the persisted user is missing", () => {
    useAuthStore.getState().setToken("restored-access");
    useAuthStore
      .getState()
      .setProfile({ ...baseMe, active_context: null, available_contexts: [] });
    expect(useAuthStore.getState().user).toMatchObject({
      id: baseMe.id,
      email: baseMe.email,
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
    expect(useAuthStore.getState().permissionCodes).toEqual(baseMe.permissions);
  });

  it("replaces a stale identity and discards its contexts when the authenticated profile belongs to another user", () => {
    useAuthStore
      .getState()
      .setAuth({ token: "old-access", user: mockUser, contexts: [CTX_A] });
    useAuthStore.getState().setProfile({
      ...baseMe,
      id: "different-user",
      active_context: null,
      available_contexts: [],
    });
    expect(useAuthStore.getState().user?.id).toBe("different-user");
    expect(useAuthStore.getState().currentContext).toBeNull();
    expect(useAuthStore.getState().contexts).toEqual([]);
  });

  it("preserves the selected warehouse when refreshing the same authenticated user", () => {
    useAuthStore.getState().setAuth({
      token: "old-access",
      user: mockUser,
      contexts: [CTX_A, CTX_B],
    });
    useAuthStore.getState().setCurrentContext(CTX_B);
    useAuthStore.getState().setToken("new-access");
    useAuthStore
      .getState()
      .setProfile({ ...baseMe, active_context: null, available_contexts: [] });
    expect(useAuthStore.getState().currentContext).toEqual(CTX_B);
    expect(useAuthStore.getState().contexts).toEqual([CTX_A, CTX_B]);
  });

  it("is_super_admin explicit được ưu tiên", () => {
    useAuthStore.getState().setProfile({
      ...baseMe,
      name: "Super Admin",
      email: "qa-admin@example.com",
      roles: [
        {
          role_id: "super-admin",
          role_code: "SUPER_ADMIN",
          role_name: "Super Admin",
          scope_ref: null,
        },
      ],
      permissions: [],
      warehouse_scope_ids: [],
      active_context: null,
      available_contexts: [],
      is_super_admin: true,
    });
    expect(useAuthStore.getState().isSuperAdmin).toBe(true);
  });

  it("logout xoá phiên, scope, quyền và cache", () => {
    useAuthStore
      .getState()
      .setAuth({ token: "abc", user: mockUser, contexts: [CTX_A] });
    useAuthStore.setState({
      permissionCodes: ["EMP_VIEW"],
      isProfileLoaded: true,
    });
    queryClient.setQueryData(["auth", "me", "abc"], { fake: "data" });
    const clearSpy = vi.spyOn(queryClient, "clear");

    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBeNull();
    expect(state.currentContext).toBeNull();
    expect(state.permissionCodes).toEqual([]);
    expect(state.isProfileLoaded).toBe(false);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
