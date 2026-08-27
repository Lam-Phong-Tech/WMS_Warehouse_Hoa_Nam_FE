/**
 * Integration tests for PermissionGuard & ActionButton.
 *
 * Tests cover:
 * 1. Permission check (có/không có permission code)
 * 2. Scope check (scope thấp vẫn bị chặn dù có permission)
 * 3. Super admin bypass
 * 4. hide vs disable mode
 * 5. Row-level scope cho Departments/OrgUnits
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useAuthStore } from "@/shared/store/auth.store";
import { PermissionGuard } from "@/shared/components/permission/PermissionGuard";
import { ActionButton } from "@/shared/components/actions";
import type { AuthContext } from "@/modules/auth/types/auth.types";

// Bỏ global mock để test permission thật
vi.unmock("@/modules/auth/utils/permission");

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function makeContext(overrides: Partial<AuthContext> = {}): AuthContext {
  return {
    role_id: 1,
    role_name: "Admin",
    scope_type: "co_so",
    org_unit_id: 1,
    org_unit_name: "Cơ sở Hà Nội",
    department_id: 5,
    department_name: "Phòng Kỹ thuật",
    warehouse_id: null,
    warehouse_name: null,
    ...overrides,
  };
}

function setAuthState(overrides: Record<string, unknown> = {}) {
  useAuthStore.setState({
    permissionCodes: ["ORG_VIEW", "DEPT_CREATE", "EMP_EDIT"],
    isSuperAdmin: false,
    isProfileLoaded: true,
    currentContext: makeContext({
      scope_type: "phong_ban",
      org_unit_id: 1,
      department_id: 5,
    }),
    ...overrides,
  });
}

beforeEach(() => {
  useAuthStore.setState({
    permissionCodes: [],
    isSuperAdmin: false,
    isProfileLoaded: true,
    currentContext: null,
  });
});

describe("PermissionGuard — Component Integration", () => {
  describe("1. Permission check", () => {
    it("render children khi có đúng permission + scope OK", () => {
      setAuthState({
        permissionCodes: ["ORG_CREATE"],
        currentContext: makeContext({ scope_type: "co_so" }),
      });
      renderWithProviders(
        <PermissionGuard module="org_units" action="create">
          <button>Thêm đơn vị</button>
        </PermissionGuard>,
      );
      expect(screen.getByText("Thêm đơn vị")).toBeDefined();
    });

    it("ẩn children khi thiếu permission code", () => {
      setAuthState({ permissionCodes: ["ORG_VIEW"] });
      renderWithProviders(
        <PermissionGuard module="org_units" action="create">
          <button>Thêm đơn vị</button>
        </PermissionGuard>,
      );
      expect(screen.queryByText("Thêm đơn vị")).toBeNull();
    });
  });

  describe("2. Scope check — có permission nhưng scope thấp vẫn bị chặn", () => {
    it("chặn create org_unit khi scope=phong_ban (cần co_so)", () => {
      setAuthState({
        permissionCodes: ["ORG_CREATE"],
        currentContext: makeContext({ scope_type: "phong_ban" }),
      });
      renderWithProviders(
        <PermissionGuard module="org_units" action="create">
          <button>Thêm đơn vị</button>
        </PermissionGuard>,
      );
      expect(screen.queryByText("Thêm đơn vị")).toBeNull();
    });

    it("chặn delete department khi scope=phong_ban (cần co_so)", () => {
      setAuthState({
        permissionCodes: ["DEPT_INACTIVE"],
        currentContext: makeContext({ scope_type: "phong_ban" }),
      });
      renderWithProviders(
        <PermissionGuard module="departments" action="delete">
          <button>Vô hiệu phòng ban</button>
        </PermissionGuard>,
      );
      expect(screen.queryByText("Vô hiệu phòng ban")).toBeNull();
    });

    it("cho phép edit department khi scope=phong_ban (chỉ cần phong_ban)", () => {
      setAuthState({
        permissionCodes: ["DEPT_EDIT"],
        currentContext: makeContext({ scope_type: "phong_ban" }),
      });
      renderWithProviders(
        <PermissionGuard module="departments" action="edit">
          <button>Sửa phòng ban</button>
        </PermissionGuard>,
      );
      expect(screen.getByText("Sửa phòng ban")).toBeDefined();
    });
  });

  describe("3. Super admin bypass", () => {
    it("super admin bypass cả permission và scope — render children", () => {
      setAuthState({
        permissionCodes: [],
        isSuperAdmin: true,
        currentContext: null,
      });
      renderWithProviders(
        <PermissionGuard module="org_units" action="create">
          <button>Thêm đơn vị</button>
        </PermissionGuard>,
      );
      expect(screen.getByText("Thêm đơn vị")).toBeDefined();
    });

    it("super admin không cần permission code — ActionButton", () => {
      setAuthState({
        permissionCodes: [],
        isSuperAdmin: true,
        currentContext: null,
      });
      renderWithProviders(
        <ActionButton kind="create" module="org_units" action="create">
          Thêm đơn vị
        </ActionButton>,
      );
      expect(screen.getByText("Thêm đơn vị")).toBeDefined();
    });
  });

  describe("4. hide vs disable mode", () => {
    it("hide mode — ẩn hoàn toàn khi thiếu quyền", () => {
      setAuthState({ permissionCodes: ["ORG_VIEW"] });
      renderWithProviders(
        <PermissionGuard module="org_units" action="create" mode="hide">
          <button>Thêm đơn vị</button>
        </PermissionGuard>,
      );
      expect(screen.queryByText("Thêm đơn vị")).toBeNull();
    });

    it("disable mode — render nhưng disabled khi thiếu quyền", () => {
      setAuthState({ permissionCodes: ["ORG_VIEW"] });
      renderWithProviders(
        <PermissionGuard module="org_units" action="create" mode="disable">
          <button>Thêm đơn vị</button>
        </PermissionGuard>,
      );
      const btn = screen.getByText("Thêm đơn vị");
      expect(btn).toBeDefined();
      expect(btn.getAttribute("disabled")).not.toBeNull();
    });
  });
});

describe("ActionButton — Component Integration", () => {
  it("render enabled khi có permission + scope đủ", () => {
    setAuthState({
      permissionCodes: ["ORG_CREATE"],
      currentContext: makeContext({ scope_type: "co_so" }),
    });
    renderWithProviders(
      <ActionButton kind="create" module="org_units" action="create">
        Thêm đơn vị
      </ActionButton>,
    );
    const btn = screen.getByText("Thêm đơn vị");
    expect(btn).toBeDefined();
    expect(btn.getAttribute("disabled")).toBeNull();
  });

  it("render disabled khi có permission nhưng scope thấp", () => {
    setAuthState({
      permissionCodes: ["ORG_CREATE"],
      currentContext: makeContext({ scope_type: "phong_ban" }),
    });
    renderWithProviders(
      <ActionButton kind="create" module="org_units" action="create">
        Thêm đơn vị
      </ActionButton>,
    );
    const btn = screen.getByText("Thêm đơn vị");
    expect(btn).toBeDefined();
    expect(btn.getAttribute("disabled")).not.toBeNull();
  });

  it("không render (hidden) khi thiếu permission", () => {
    setAuthState({ permissionCodes: ["ORG_VIEW"] });
    renderWithProviders(
      <ActionButton kind="create" module="org_units" action="create">
        Thêm đơn vị
      </ActionButton>,
    );
    expect(screen.queryByText("Thêm đơn vị")).toBeNull();
  });
});

describe("Row-level scope — Departments/OrgUnits context", () => {
  it("cho phép action khi record thuộc phòng ban của user (phong_ban scope)", () => {
    setAuthState({
      permissionCodes: ["DEPT_EDIT"],
      currentContext: makeContext({
        scope_type: "phong_ban",
        org_unit_id: 1,
        department_id: 5,
      }),
    });
    renderWithProviders(
      <PermissionGuard module="departments" action="edit">
        <button>Sửa phòng ban</button>
      </PermissionGuard>,
    );
    expect(screen.getByText("Sửa phòng ban")).toBeDefined();
  });

  it("chặn create org_unit với scope phong_ban (cần co_so)", () => {
    setAuthState({
      permissionCodes: ["ORG_CREATE"],
      currentContext: makeContext({ scope_type: "phong_ban", org_unit_id: 1 }),
    });
    renderWithProviders(
      <PermissionGuard module="org_units" action="create">
        <button>Thêm org unit</button>
      </PermissionGuard>,
    );
    expect(screen.queryByText("Thêm org unit")).toBeNull();
  });
});
