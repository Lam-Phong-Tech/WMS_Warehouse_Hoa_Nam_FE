import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SideNav } from "@/app/layouts/SideNav";
import { getBreadcrumb, getOpenKeys, getSelectedKey } from "@/app/layouts/menu";
import { ROUTES } from "@/shared/constants/routes";
import { useAuthStore } from "@/shared/store/auth.store";

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

function renderSideNav(initialPath = ROUTES.INBOUND) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <SideNav />
    </MemoryRouter>,
  );
}

describe("SideNav RBAC filtering", () => {
  afterEach(() => {
    resetAuthStore();
  });

  it("shows allowed WMS route items when the user has matching permissions", () => {
    withPermissions([
      "inbound.create",
      "outbound.create",
      "inventory.view",
      "report.view",
    ]);

    renderSideNav();

    expect(screen.getByText(/WMS/)).toBeInTheDocument();
    expect(screen.getByText("Nhập kho")).toBeInTheDocument();
    expect(screen.getByText("Xuất kho")).toBeInTheDocument();
    expect(screen.getByText("Tồn & truy vết")).toBeInTheDocument();
    expect(screen.getByText("Báo cáo")).toBeInTheDocument();
  });

  it("hides routes and groups that the user cannot access", () => {
    withPermissions(["inbound.create"]);

    renderSideNav();

    expect(screen.getByText(/WMS/)).toBeInTheDocument();
    expect(screen.getByText("Nhập kho")).toBeInTheDocument();
    expect(screen.queryByText("Bảo hành")).not.toBeInTheDocument();
    expect(screen.queryByText("Báo cáo")).not.toBeInTheDocument();
    expect(screen.queryByText("Hệ thống")).not.toBeInTheDocument();
  });

  it("lets Super Admin see all WMS/System menu items even with no permission codes", () => {
    withPermissions([], true);

    renderSideNav();

    expect(screen.getByText(/WMS/)).toBeInTheDocument();
    expect(screen.getByText("Bảo hành")).toBeInTheDocument();
    expect(screen.getByText("Báo cáo")).toBeInTheDocument();
    expect(screen.getByText("Hệ thống")).toBeInTheDocument();
    expect(screen.getByText("Nhật ký kiểm tra")).toBeInTheDocument();
  });
});

describe("navigation metadata", () => {
  it("uses one metadata source for selected key, open keys and breadcrumb", () => {
    expect(getSelectedKey(`${ROUTES.INBOUND}/draft/PO-001`)).toBe(
      ROUTES.INBOUND,
    );
    expect(getOpenKeys(`${ROUTES.INBOUND}/draft/PO-001`)).toEqual(["wms"]);
    expect(getBreadcrumb(ROUTES.PROFILE)).toEqual([
      { label: "Tài khoản" },
      { label: "Hồ sơ cá nhân", path: ROUTES.PROFILE },
    ]);
  });
});
