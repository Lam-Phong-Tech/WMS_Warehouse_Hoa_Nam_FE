import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

/**
 * Tra mục RPT-01 theo `data-nav-path` chứ KHÔNG theo nhãn.
 *
 * Đợt tách menu Báo cáo 06/09 đổi nhãn RPT-01 thành "Nhập kho" — trùng đúng tên
 * NHÓM menu "Nhập kho", nên `getByText("Nhập kho")` khớp hai phần tử khác nhau và
 * assert theo nhãn vừa mơ hồ vừa vỡ mỗi lần đổi tên hiển thị.
 */
function reportsInventoryFlowItem(): HTMLElement | null {
  return document.querySelector<HTMLElement>(
    `[data-nav-path="${ROUTES.REPORTS_INVENTORY_FLOW}"]`,
  );
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
      // BA 07/09/2026: `report.view` là quyền ĐỌC dữ liệu, tự nó KHÔNG còn mở màn báo
      // cáo nào. Cửa vào RPT-01 là `report.inventory_flow.view` — fixture cấp cả hai,
      // đúng như BE seed cho một vai được xem báo cáo.
      "report.view",
      "report.inventory_flow.view",
    ]);

    renderSideNav();

    expect(screen.getByText(/Hoa Nam WMS/)).toBeInTheDocument();
    expect(screen.getByText("Danh sách phiếu nhập")).toBeInTheDocument();
    expect(screen.getByText("Danh sách phiếu xuất")).toBeInTheDocument();
    expect(screen.getByText("Tra cứu tồn & đối soát")).toBeInTheDocument();
    expect(reportsInventoryFlowItem()).not.toBeNull();
  });

  it("report.view một mình KHÔNG mở màn báo cáo nào (BA 07/09/2026)", () => {
    // Hàng rào của đợt tách quyền: trước đây fixture này đủ để thấy cả 9 màn.
    withPermissions(["inventory.view", "report.view"]);

    renderSideNav();

    expect(reportsInventoryFlowItem()).toBeNull();
  });

  it("hides routes and groups that the user cannot access", () => {
    withPermissions(["inbound.create"]);

    renderSideNav();

    expect(screen.getByText("Danh sách phiếu nhập")).toBeInTheDocument();
    expect(screen.queryByText("Danh sách bảo hành")).not.toBeInTheDocument();
    expect(reportsInventoryFlowItem()).toBeNull();
    expect(
      screen.queryByText("Danh sách linh kiện chờ xếp khay"),
    ).not.toBeInTheDocument();
  });

  it("folds inbound and putaway operations into their owning list screens", async () => {
    withPermissions([], true);

    renderSideNav(`${ROUTES.INBOUND}?screen=IN-03&id=receipt-1`);

    // Mọi nhóm mặc định đóng (yêu cầu người dùng 2026-08-28) — bấm mở nhóm sở
    // hữu route deep-link trước khi truy vấn item bên trong bằng role.
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Nhập kho" }));

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

  it("mặc định mọi nhóm đóng — bấm tiêu đề nhóm mới sổ ra trang con", async () => {
    withPermissions([], true);

    renderSideNav(ROUTES.DASHBOARD);

    const inboundGroup = screen.getByRole("button", { name: "Nhập kho" });
    expect(inboundGroup).toHaveAttribute("aria-expanded", "false");
    expect(
      screen.queryByRole("button", { name: "Danh sách phiếu nhập" }),
    ).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(inboundGroup);

    expect(inboundGroup).toHaveAttribute("aria-expanded", "true");
    expect(
      screen.getByRole("button", { name: "Danh sách phiếu nhập" }),
    ).toBeInTheDocument();
  });

  it("accordion flush — sổ nhóm khác thì nhóm đang mở tự đóng lại", async () => {
    withPermissions([], true);

    renderSideNav(ROUTES.DASHBOARD);

    const inboundGroup = screen.getByRole("button", { name: "Nhập kho" });
    const user = userEvent.setup();
    await user.click(inboundGroup);
    expect(inboundGroup).toHaveAttribute("aria-expanded", "true");

    const outboundGroup = screen.getByRole("button", { name: "Xuất kho" });
    await user.click(outboundGroup);

    expect(outboundGroup).toHaveAttribute("aria-expanded", "true");
    expect(inboundGroup).toHaveAttribute("aria-expanded", "false");
  });

  it("lets Super Admin see all list entry points even with no permission codes", () => {
    withPermissions([], true);

    renderSideNav();

    expect(screen.getByText("Danh sách phiếu nhập")).toBeInTheDocument();
    expect(
      screen.getByText("Danh sách linh kiện chờ xếp khay"),
    ).toBeInTheDocument();
    expect(screen.getByText("Danh sách bảo hành")).toBeInTheDocument();
    expect(reportsInventoryFlowItem()).not.toBeNull();
  });
});

/**
 * Hợp đồng UI/UX với demo Vuexy đã chốt (1.WMS_Hoa_Nam_Sidebar_Demo.html):
 * mục Tổng quan là DÒNG PHẲNG, rail thu gọn chỉ còn icon, và bấm logo ở rail
 * là cách bung lại thanh điều hướng.
 */
describe("SideNav — hình dạng theo demo Vuexy", () => {
  afterEach(() => {
    resetAuthStore();
  });

  it("Tổng quan là dòng phẳng: không có nút sổ nhóm, bấm là đi thẳng", () => {
    withPermissions([], true);
    renderSideNav(ROUTES.DASHBOARD);

    // Không tồn tại tiêu đề nhóm "Tổng quan" (nó được vẽ phẳng)…
    expect(
      screen.queryByRole("button", { name: "Tổng quan" }),
    ).not.toBeInTheDocument();
    // …mà là chính mục trang, và đang là trang hiện tại.
    const direct = screen.getByRole("button", { name: "Tổng quan vận hành" });
    expect(direct).toHaveAttribute("aria-current", "page");
    expect(direct).not.toHaveAttribute("aria-expanded");
  });

  it("bấm dòng phẳng thì mọi nhóm đang sổ đều đóng lại", async () => {
    withPermissions([], true);
    renderSideNav(ROUTES.DASHBOARD);

    const user = userEvent.setup();
    const inboundGroup = screen.getByRole("button", { name: "Nhập kho" });
    await user.click(inboundGroup);
    expect(inboundGroup).toHaveAttribute("aria-expanded", "true");

    await user.click(
      screen.getByRole("button", { name: "Tổng quan vận hành" }),
    );
    expect(inboundGroup).toHaveAttribute("aria-expanded", "false");
  });

  it("rail thu gọn: mất nhãn + mất nút thu gọn, logo thành nút bung lại", async () => {
    withPermissions([], true);
    const onExpand = vi.fn();
    render(
      <MemoryRouter initialEntries={[ROUTES.DASHBOARD]}>
        <SideNav collapsed onExpand={onExpand} onToggle={() => {}} />
      </MemoryRouter>,
    );

    /*
     * Nhãn nhóm không được render ở rail. Không dùng "Nhập kho" làm mồi:
     * menu Báo cáo có MỤC CON trùng tên "Nhập kho" nằm trong submenu
     * display:none — vẫn thuộc DOM nên not.toBeInTheDocument sai đề; các
     * bản đó chỉ cần "không nhìn thấy".
     */
    expect(screen.queryByText("Danh mục")).not.toBeInTheDocument();
    for (const label of screen.queryAllByText("Nhập kho")) {
      expect(label).not.toBeVisible();
    }
    expect(
      screen.queryByRole("button", { name: "Thu gọn thanh điều hướng" }),
    ).not.toBeInTheDocument();

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: "Mở rộng thanh điều hướng" }),
    );
    expect(onExpand).toHaveBeenCalledTimes(1);
  });

  it("bấm icon nhóm ở rail: vừa bung thanh bên vừa sổ đúng nhóm đó", async () => {
    withPermissions([], true);
    const onExpand = vi.fn();
    const { rerender } = render(
      <MemoryRouter initialEntries={[ROUTES.DASHBOARD]}>
        <SideNav collapsed onExpand={onExpand} />
      </MemoryRouter>,
    );

    const user = userEvent.setup();
    // Ở rail nhãn bị ẩn nên nút nhóm được nhận diện qua aria-label của section.
    const railGroups = screen.getAllByRole("button", { expanded: false });
    await user.click(railGroups[0]);
    expect(onExpand).toHaveBeenCalled();

    rerender(
      <MemoryRouter initialEntries={[ROUTES.DASHBOARD]}>
        <SideNav collapsed={false} onExpand={onExpand} />
      </MemoryRouter>,
    );
    expect(screen.getByRole("button", { name: "Danh mục" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
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
    // `i18nKey` là khoá tra bản dịch của chặng (screen-id / tên icon nhóm);
    // route ngoài cây menu như /profile chưa có khoá nên chỉ còn nhãn gốc.
    expect(getBreadcrumbTrail(ROUTES.PROFILE)).toEqual([
      { label: "Trang chủ", path: ROUTES.DASHBOARD, i18nKey: "home" },
      { label: "Hồ sơ cá nhân" },
    ]);
    expect(getBreadcrumbTrail(ROUTES.INBOUND).map((c) => c.label)).toEqual([
      "Trang chủ",
      "Nhập kho",
      "Danh sách phiếu nhập",
    ]);
  });
});
