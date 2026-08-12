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

function renderSideNav(initialPath: string = ROUTES.INBOUND) {
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

  it("shows list entry points when the user has matching WMS permissions", () => {
    withPermissions([
      "inbound.create",
      "outbound.create",
      "inventory.view",
      "report.view",
    ]);

    renderSideNav();

    expect(screen.getByText(/Hoa Nam WMS/)).toBeInTheDocument();
    expect(screen.getByText("Danh sách phiếu nhập")).toBeInTheDocument();
    expect(screen.getByText("Danh sách phiếu xuất")).toBeInTheDocument();
    expect(screen.getByText("Tra cứu tồn & đối soát")).toBeInTheDocument();
    expect(screen.getByText("Báo cáo vận hành")).toBeInTheDocument();
  });

  it("hides routes and groups that the user cannot access", () => {
    withPermissions(["inbound.create"]);

    renderSideNav();

    expect(screen.getByText("Danh sách phiếu nhập")).toBeInTheDocument();
    expect(screen.queryByText("Danh sách bảo hành")).not.toBeInTheDocument();
    expect(screen.queryByText("Báo cáo vận hành")).not.toBeInTheDocument();
    expect(screen.queryByText("Danh sách linh kiện chờ xếp khay")).not.toBeInTheDocument();
  });

  it("folds inbound and putaway operations into their owning list screens", () => {
    withPermissions([], true);

    renderSideNav(`${ROUTES.INBOUND}?screen=IN-03&id=receipt-1`);

    const inboundList = screen.getByRole("button", { name: "Danh sách phiếu nhập" });
    expect(inboundList).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Danh sách linh kiện chờ xếp khay")).toBeInTheDocument();

    expect(screen.queryByText("Tạo / sửa phiếu nhập DRAFT")).not.toBeInTheDocument();
    expect(screen.queryByText("Quét & Full Post Receipt")).not.toBeInTheDocument();
    expect(screen.queryByText("Putaway linh kiện vào khay")).not.toBeInTheDocument();
  });

  it("lets Super Admin see all list entry points even with no permission codes", () => {
    withPermissions([], true);

    renderSideNav();

    expect(screen.getByText("Danh sách phiếu nhập")).toBeInTheDocument();
    expect(screen.getByText("Danh sách linh kiện chờ xếp khay")).toBeInTheDocument();
    expect(screen.getByText("Danh sách bảo hành")).toBeInTheDocument();
    expect(screen.getByText("Báo cáo vận hành")).toBeInTheDocument();
  });
});

describe("navigation metadata", () => {
  it("uses one metadata source for selected key, open keys and breadcrumb", () => {
    expect(getSelectedKey(`${ROUTES.INBOUND}/draft/PO-001`)).toBe(
      ROUTES.INBOUND,
    );
    expect(getOpenKeys(`${ROUTES.INBOUND}/draft/PO-001`)).toEqual([
      "inbound-group",
    ]);
    expect(getBreadcrumb(ROUTES.PROFILE)).toEqual([
      { label: "Tài khoản" },
      { label: "Hồ sơ cá nhân", path: ROUTES.PROFILE },
    ]);
  });
});
