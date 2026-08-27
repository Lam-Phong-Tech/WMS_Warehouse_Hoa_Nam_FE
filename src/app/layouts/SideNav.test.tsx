import { afterEach, describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SideNav } from "@/app/layouts/SideNav";
import { getBreadcrumbTrail, matchesPath } from "@/app/layouts/nav-data";
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
      // "outbound.view" thay cho "outbound.create": mã cũ bị BE thu hồi 27/08 nên
      // fixture cấp nó sẽ không mở được mục menu nào nữa.
      "outbound.view",
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
    expect(
      screen.queryByText("Danh sách linh kiện chờ xếp khay"),
    ).not.toBeInTheDocument();
  });

  it("folds inbound and putaway operations into their owning list screens", () => {
    withPermissions([], true);

    renderSideNav(`${ROUTES.INBOUND}?screen=IN-03&id=receipt-1`);

    const inboundList = screen.getByRole("button", {
      name: "Danh sách phiếu nhập",
    });
    expect(inboundList).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByText("Danh sách linh kiện chờ xếp khay"),
    ).toBeInTheDocument();

    expect(
      screen.queryByText("Tạo / sửa phiếu nhập DRAFT"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Quét & Full Post Receipt"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText("Putaway linh kiện vào khay"),
    ).not.toBeInTheDocument();
  });

  it("lets Super Admin see all list entry points even with no permission codes", () => {
    withPermissions([], true);

    renderSideNav();

    expect(screen.getByText("Danh sách phiếu nhập")).toBeInTheDocument();
    expect(
      screen.getByText("Danh sách linh kiện chờ xếp khay"),
    ).toBeInTheDocument();
    expect(screen.getByText("Danh sách bảo hành")).toBeInTheDocument();
    expect(screen.getByText("Báo cáo vận hành")).toBeInTheDocument();
  });
});

describe("navigation metadata (nav-data — nguồn duy nhất, NAV-01)", () => {
  it("dùng một nguồn metadata cho active-path và breadcrumb", () => {
    // Path lồng vẫn nhận diện đúng route sở hữu (thay getSelectedKey cũ).
    expect(matchesPath(`${ROUTES.INBOUND}/draft/PO-001`, ROUTES.INBOUND)).toBe(
      true,
    );
    expect(matchesPath(ROUTES.OUTBOUND, ROUTES.INBOUND)).toBe(false);
    // Breadcrumb hợp nhất từ nav-data (thay getBreadcrumb của menu.tsx cũ).
    expect(getBreadcrumbTrail(ROUTES.PROFILE)).toEqual([
      { label: "Trang chủ", path: ROUTES.DASHBOARD },
      { label: "Hồ sơ cá nhân" },
    ]);
    expect(getBreadcrumbTrail(ROUTES.INBOUND).map((c) => c.label)).toEqual([
      "Trang chủ",
      "Nhập kho",
      "Danh sách phiếu nhập",
    ]);
  });
});
