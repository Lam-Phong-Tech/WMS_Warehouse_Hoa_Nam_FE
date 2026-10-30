import Cookies from "js-cookie";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { refreshMock } = vi.hoisted(() => ({ refreshMock: vi.fn() }));
vi.mock("@/modules/auth/services/auth.service", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("@/modules/auth/services/auth.service")
    >();
  return {
    ...actual,
    authService: { ...actual.authService, refresh: refreshMock },
  };
});

import { bootstrapAuth } from "@/app/bootstrap-auth";
import { queryClient } from "@/app/providers/query-client";
import { useAuthStore } from "@/shared/store/auth.store";

const serverUser = {
  id: "restored-user",
  email: "restored@example.test",
  name: "Restored operator",
  code: "RESTORED",
  roles: [
    {
      role_id: "viewer",
      role_code: "VIEWER",
      role_name: "Viewer",
      scope_ref: null,
    },
  ],
  permissions: ["inventory.view"],
  warehouse_scope_ids: [],
  company: null,
  branch: null,
  department: null,
  position: null,
  role: null,
};

describe("bootstrapAuth restores identity from the authenticated refresh profile", () => {
  let originalPath: string;
  beforeEach(() => {
    originalPath = window.location.pathname;
    (window.location as { pathname: string }).pathname = "/dashboard";
    useAuthStore.getState().logout();
    useAuthStore.setState({ isBootstrapped: false });
    Cookies.remove("erp-auth", { path: "/" });
    refreshMock.mockReset();
    refreshMock.mockResolvedValue({
      access_token: "restored-access",
      user: serverUser,
    });
  });
  afterEach(() => {
    useAuthStore.getState().logout();
    (window.location as { pathname: string }).pathname = originalPath;
  });

  it.each([
    undefined,
    "invalid-json",
    JSON.stringify({ state: { user: null, contexts: [] }, version: 0 }),
  ])(
    "restores a complete session when the persisted hint is %s",
    async (hint) => {
      if (hint !== undefined) Cookies.set("erp-auth", hint, { path: "/" });
      await bootstrapAuth();
      const state = useAuthStore.getState();
      expect(state.user).toMatchObject({
        id: serverUser.id,
        email: serverUser.email,
      });
      expect(state.isAuthenticated).toBe(true);
      expect(state.isProfileLoaded).toBe(true);
      expect(state.isBootstrapped).toBe(true);
      expect(state.permissionCodes).toEqual(serverUser.permissions);
      expect(state.isSuperAdmin).toBe(false);
      expect(
        queryClient.getQueryData(["auth", "me", "restored-access"]),
      ).toMatchObject({ id: serverUser.id });
    },
  );

  it("replaces another account's persisted identity with the refreshed identity", async () => {
    Cookies.set(
      "erp-auth",
      JSON.stringify({
        state: {
          user: {
            id: "old-admin",
            email: "old@example.test",
            name: "Old",
            code: "OLD",
            roles: [
              {
                role_id: "admin",
                role_code: "SUPER_ADMIN",
                role_name: "Admin",
              },
            ],
          },
          contexts: [],
        },
        version: 0,
      }),
      { path: "/" },
    );
    await bootstrapAuth();
    expect(useAuthStore.getState().user?.id).toBe(serverUser.id);
    expect(useAuthStore.getState().isSuperAdmin).toBe(false);
    expect(useAuthStore.getState().permissionCodes).toEqual(["inventory.view"]);
  });

  it("does not fabricate a user from an incomplete refresh profile", async () => {
    refreshMock.mockResolvedValue({
      access_token: "access-only",
      user: { id: "incomplete" },
    });
    await bootstrapAuth();
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isProfileLoaded).toBe(false);
    expect(useAuthStore.getState().permissionCodes).toEqual([]);
    expect(
      queryClient.getQueryData(["auth", "me", "access-only"]),
    ).toBeUndefined();
  });

  it.each([401, 403, 422])(
    "clears the hint when refresh rejects the session with %i",
    async (status) => {
      refreshMock.mockRejectedValue({ response: { status } });
      await bootstrapAuth();
      expect(useAuthStore.getState().isAuthenticated).toBe(false);
      expect(useAuthStore.getState().user).toBeNull();
      const hint = Cookies.get("erp-auth");
      if (hint)
        expect(JSON.parse(hint).state).toEqual({ user: null, contexts: [] });
    },
  );
});
