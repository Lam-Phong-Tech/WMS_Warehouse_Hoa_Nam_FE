import {
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import {
  AgencyMasterScreen,
  DefectMasterScreen,
  SkuMasterScreen,
} from "@/modules/master-data/pages/MvpMasterScreens";
import { useAuthStore } from "@/shared/store/auth.store";

const { mutation } = vi.hoisted(() => ({
  mutation: () => ({
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpSkus: () => ({
    data: {
      data: [
        {
          sku_id: "sku-1",
          sku_code: "DCH-DRILL-DJZ10A-220V-V1",
          sku_name: "Máy khoan Dongcheng DJZ10A 220V",
          sku_type: "PRODUCT",
          brand_id: "brand-1",
          category_id: "cat-1",
          unit: "cái",
          is_serial_tracked: true,
          status: "ACTIVE",
          min_stock: 2,
          max_stock: 10,
          published_to_app: false,
          version: 3,
        },
      ],
      meta: {},
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMvpAgencies: () => ({
    data: {
      data: [
        {
          agency_id: "agency-1",
          agency_code: "AG-HN-001",
          agency_name: "Đại lý Minh Anh",
          phone: "0901000001",
          address: "Hà Nội",
          status: "ACTIVE",
        },
      ],
      meta: {},
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMvpDefects: () => ({
    data: {
      data: [
        {
          defect_id: "defect-1",
          defect_code: "DF-MOTOR-01",
          defect_name: "Không chạy motor",
          description: "Motor không hoạt động",
          status: "ACTIVE",
        },
      ],
      meta: {},
    },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  }),
  useMvpProductCatalogs: () => ({
    data: {
      brands: [{ id: "brand-1", code: "DONGCHENG", name: "Dongcheng" }],
      categories: [{ id: "cat-1", code: "DRILL", name: "Máy khoan" }],
      models: [{ id: "model-1", code: "DJZ10A", name: "DJZ10A" }],
      // ERD bảng 16: MST-02 gắn cả power_source_id và package_variant_id.
      powerSources: [
        { id: "power-1", code: "MAINS_DIRECT", name: "Điện lưới trực tiếp" },
      ],
      packageVariants: [{ id: "package-1", code: "KIT", name: "Kit đầy đủ" }],
    },
    isLoading: false,
    error: null,
  }),
  useMvpSkuHasStock: () => ({ data: false, isLoading: false }),
  useCreateMvpSku: mutation,
  useUpdateMvpSku: mutation,
  useSetMvpSkuPublished: mutation,
  useCreateMvpAgency: mutation,
  useUpdateMvpAgency: mutation,
  useCreateMvpDefect: mutation,
  useUpdateMvpDefect: mutation,
}));

describe("API-backed MVP master screens", () => {
  beforeEach(() => {
    useAuthStore.setState({ isSuperAdmin: true, permissionCodes: [] });
    window.sessionStorage.removeItem("hn-sku-overview-open");
  });

  it("giữ tìm kiếm SKU khi mở bộ lọc nâng cao và thống kê", () => {
    render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );

    const overviewToggle = screen.getByRole("button", { name: "Thống kê SKU" });
    const filtersToggle = screen.getByRole("button", { name: "Bộ lọc" });
    const overview = document.getElementById(
      "hn-sku-overview-content",
    ) as HTMLElement;
    const search = document.getElementById(
      "sku-list-search",
    ) as HTMLInputElement;

    expect(screen.queryByRole("button", { name: "Áp dụng" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Đặt lại" })).toBeNull();
    expect(overviewToggle).toHaveAttribute("aria-expanded", "false");
    expect(filtersToggle).toHaveAttribute("aria-expanded", "false");
    expect(overview).not.toBeVisible();
    fireEvent.change(search, { target: { value: "Máy khoan" } });
    expect(
      screen.getByRole("button", { name: "Xóa bộ lọc: Máy khoan" }),
    ).toBeInTheDocument();
    fireEvent.click(overviewToggle);
    expect(overviewToggle).toHaveAttribute("aria-expanded", "true");
    expect(overview).toBeVisible();
    expect(search).toBeVisible();

    fireEvent.click(filtersToggle);
    expect(filtersToggle).toHaveAttribute("aria-expanded", "true");
    expect(search).toBeVisible();

    fireEvent.click(overviewToggle);
    fireEvent.click(filtersToggle);
    expect(overview).not.toBeVisible();
    expect(search).toBeVisible();
    expect(filtersToggle).toHaveAttribute("aria-expanded", "false");
    expect(search).toHaveValue("Máy khoan");
  });

  it("giữ trạng thái mở thống kê SKU khi quay lại trong cùng phiên", () => {
    const firstVisit = render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );
    const toggle = screen.getByRole("button", { name: "Thống kê SKU" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    firstVisit.unmount();

    const returnVisit = render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: "Thống kê SKU" }),
    ).toHaveAttribute("aria-expanded", "true");
    returnVisit.unmount();

    window.sessionStorage.removeItem("hn-sku-overview-open");
    render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("button", { name: "Thống kê SKU" }),
    ).toHaveAttribute("aria-expanded", "false");
  });

  it("can enable and clear the pending SKU filter from the search panel", () => {
    render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Bộ lọc" }));
    const pending = screen.getByRole("checkbox", {
      name: "SKU chờ điền thông tin",
    });
    expect(pending).not.toBeChecked();
    fireEvent.click(pending);
    expect(pending).toBeChecked();
    expect(
      screen.getByRole("button", {
        name: "Xóa bộ lọc: SKU chờ điền thông tin",
      }),
    ).toBeInTheDocument();
    fireEvent.click(pending);
    expect(pending).not.toBeChecked();
  });

  it("opens SKU create and edit forms in a right-side drawer", async () => {
    render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText("DCH-DRILL-DJZ10A-220V-V1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Thêm SKU/ }));
    let dialog = screen.getByRole("dialog", { name: "Thêm SKU" });
    expect(dialog.closest(".MuiDrawer-root")).not.toBeNull();
    expect(within(dialog).getByText("Thêm SKU")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    // Đợi drawer biến mất hẳn để bảng không còn aria-hidden.
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

    const row = screen.getByText("DCH-DRILL-DJZ10A-220V-V1").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(
      within(row as HTMLTableRowElement).getByRole("button", {
        name: /Xem chi tiết/,
      }),
    );
    const drawer = screen.getByRole("dialog", { name: "Chi tiết SKU" });
    fireEvent.click(within(drawer).getByRole("button", { name: "Chỉnh sửa" }));
    dialog = screen.getByRole("dialog", { name: "Sửa SKU" });
    expect(dialog.closest(".MuiDrawer-root")).not.toBeNull();
    expect(within(dialog).getByText("Sửa SKU")).toBeInTheDocument();
    // Form sửa nạp đúng dòng đang bấm (version 3 chỉ còn đi ngầm trong payload
    // If-Match, không hiển thị trên UI nữa).
    expect(
      within(dialog).getByDisplayValue("DCH-DRILL-DJZ10A-220V-V1"),
    ).toBeInTheDocument();
    expect(
      within(dialog).getByDisplayValue("Máy khoan Dongcheng DJZ10A 220V"),
    ).toBeInTheDocument();
  });

  it("shows a compact SKU table and opens operational fields in a side drawer", async () => {
    render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );

    const table = screen.getByRole("table");
    expect(
      Array.from(table.querySelectorAll("thead th"), (header) =>
        header.textContent?.trim(),
      ),
    ).toEqual(["STT", "SKU", "Loại", "Hãng / Nhóm", "Trạng thái", ""]);
    const row = within(table)
      .getByText("DCH-DRILL-DJZ10A-220V-V1")
      .closest("tr");
    expect(row).not.toBeNull();
    expect(
      within(row as HTMLTableRowElement).getByText("Dongcheng"),
    ).toBeVisible();
    expect(
      within(row as HTMLTableRowElement).getByText("Máy khoan"),
    ).toBeVisible();

    fireEvent.click(
      within(row as HTMLTableRowElement).getByRole("button", {
        name: /Xem chi tiết/,
      }),
    );
    const drawer = screen.getByRole("dialog", { name: "Chi tiết SKU" });
    expect(drawer.closest(".MuiDrawer-root")).not.toBeNull();
    expect(
      within(drawer).getByText("Định mức tối thiểu").parentElement,
    ).toHaveTextContent("2");
    expect(
      within(drawer).getByText("Định mức tối đa").parentElement,
    ).toHaveTextContent("10");
    expect(
      within(drawer).getByText("Ứng dụng phân vùng").parentElement,
    ).toHaveTextContent("Chưa hiển thị");
    fireEvent.click(
      within(drawer).getByRole("button", { name: "Đóng chi tiết" }),
    );
    await waitForElementToBeRemoved(() =>
      screen.queryByRole("dialog", { name: "Chi tiết SKU" }),
    );
  });

  it("updates the publication state shown in an open SKU drawer", async () => {
    render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );
    const row = screen.getByText("DCH-DRILL-DJZ10A-220V-V1").closest("tr");
    fireEvent.click(
      within(row as HTMLTableRowElement).getByRole("button", {
        name: "Xem chi tiết",
      }),
    );
    const drawer = screen.getByRole("dialog", { name: "Chi tiết SKU" });
    const footer = drawer.querySelector(".hn-sku-detail-footer");
    expect(footer).not.toBeNull();
    expect(
      within(footer as HTMLElement).getByRole("button", {
        name: "Đưa lên ứng dụng",
      }),
    ).toBeInTheDocument();
    fireEvent.click(
      within(drawer).getByRole("button", {
        name: "Đưa lên ứng dụng",
      }),
    );
    const confirm = screen.getByRole("dialog", {
      name: "Đưa SKU lên ứng dụng phân vùng?",
    });
    fireEvent.click(
      within(confirm).getByRole("button", { name: "Đưa lên ứng dụng" }),
    );
    await waitFor(() =>
      expect(
        within(drawer).getByText("Ứng dụng phân vùng").parentElement,
      ).toHaveTextContent("Đang hiển thị"),
    );
  });

  it("loads agency data and opens add/edit modal", () => {
    render(
      <MemoryRouter>
        <AgencyMasterScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText("Đại lý Minh Anh")).toBeInTheDocument();
    // REQ-001: màn master đổi nhãn "Đại lý" → "Nơi nhận".
    fireEvent.click(screen.getByRole("button", { name: /Thêm nơi nhận/ }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("thu gọn riêng thống kê và bộ lọc bệnh/lỗi, giữ từ khóa khi mở lại", () => {
    render(
      <MemoryRouter>
        <DefectMasterScreen />
      </MemoryRouter>,
    );

    const overviewToggle = screen.getByRole("button", {
      name: "Thống kê bệnh / lỗi",
    });
    const filtersToggle = screen.getByRole("button", {
      name: "Bộ lọc tìm kiếm",
    });
    const overview = screen.getByRole("region", {
      name: "Danh mục bệnh / lỗi",
    });
    const search = document.getElementById(
      "defect-list-search",
    ) as HTMLInputElement;

    fireEvent.change(search, { target: { value: "motor" } });
    fireEvent.click(overviewToggle);
    expect(overviewToggle).toHaveAttribute("aria-expanded", "false");
    expect(overview).not.toBeVisible();
    expect(search).toBeVisible();

    fireEvent.click(filtersToggle);
    expect(filtersToggle).toHaveAttribute("aria-expanded", "false");
    expect(search).not.toBeVisible();
    expect(screen.getByText("DF-MOTOR-01")).toBeVisible();

    fireEvent.click(overviewToggle);
    fireEvent.click(filtersToggle);
    expect(overview).toBeVisible();
    expect(search).toHaveValue("motor");
  });

  it("loads defect data and supports legacy add deep link", () => {
    render(
      <MemoryRouter>
        <DefectMasterScreen openCreateOnMount />
      </MemoryRouter>,
    );
    expect(screen.getByText("DF-MOTOR-01")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
