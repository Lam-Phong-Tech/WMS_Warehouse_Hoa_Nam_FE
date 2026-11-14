import {
  fireEvent,
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
  within,
} from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter, Link, useLocation } from "react-router-dom";
import {
  AgencyMasterScreen,
  DefectMasterScreen,
  SkuMasterScreen,
} from "@/modules/master-data/pages/MvpMasterScreens";
import { toast } from "sonner";
import { ApiEnvelopeError } from "@/shared/api/api-error";
import { useAuthStore } from "@/shared/store/auth.store";
import { PinnedSidebarContext } from "@/shared/ui/layout/pinned-sidebar-context";
import {
  useMvpSkus,
  useSetMvpSkuPublished,
  useUpdateMvpAgency,
  useUpdateMvpDefect,
} from "@/modules/master-data/hooks/use-mvp-master";

const { mutation } = vi.hoisted(() => ({
  mutation: () => ({
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({}),
  }),
}));

vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpSkus: vi.fn(() => ({
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
  })),
  useMvpAgencies: () => ({
    data: {
      data: [
        {
          agency_id: "agency-1",
          agency_code: "AG-HN-001",
          agency_name: "Đại lý Minh Anh",
          recipient_type: "AGENCY",
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
  useSetMvpSkuPublished: vi.fn(mutation),
  useCreateMvpAgency: mutation,
  useUpdateMvpAgency: vi.fn(mutation),
  useCreateMvpDefect: mutation,
  useUpdateMvpDefect: vi.fn(mutation),
}));

function CurrentSkuLocation() {
  return <output data-testid="sku-location">{useLocation().search}</output>;
}

const DEFAULT_SKU_ROW = {
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
};

function defaultSkusResult() {
  return {
    data: { data: [DEFAULT_SKU_ROW], meta: {} },
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  };
}

describe("API-backed MVP master screens", () => {
  beforeEach(() => {
    useAuthStore.setState({ isSuperAdmin: true, permissionCodes: [] });
    window.sessionStorage.removeItem("hn-sku-overview-open");
  });

  afterEach(() => {
    vi.mocked(useMvpSkus).mockImplementation(
      () => defaultSkusResult() as never,
    );
    vi.mocked(useSetMvpSkuPublished).mockImplementation(
      (() => mutation()) as never,
    );
    vi.mocked(useUpdateMvpAgency).mockImplementation(
      (() => mutation()) as never,
    );
    vi.mocked(useUpdateMvpDefect).mockImplementation(
      (() => mutation()) as never,
    );
  });

  it("opens the agency editor from anywhere on an editable row", async () => {
    render(
      <MemoryRouter>
        <AgencyMasterScreen />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByText("Đại lý Minh Anh"));
    expect(await screen.findByRole("dialog")).toBeInTheDocument();
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
    expect(screen.getByRole("button", { name: "Xóa lọc" })).toBeInTheDocument();
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

  it("moves the information filter into extra filters when pinned and preserves its value", () => {
    const content = (pinned: boolean) => (
      <MemoryRouter>
        <PinnedSidebarContext.Provider value={pinned}>
          <SkuMasterScreen />
        </PinnedSidebarContext.Provider>
      </MemoryRouter>
    );
    const { rerender } = render(content(false));
    const information = screen.getByRole("combobox", {
      name: "Lọc mức độ hoàn thiện thông tin",
    });
    fireEvent.mouseDown(information);
    fireEvent.click(
      screen.getByRole("option", { name: "Thông tin: Chờ hoàn thiện" }),
    );

    rerender(content(true));
    expect(
      screen.queryByRole("combobox", {
        name: "Lọc mức độ hoàn thiện thông tin",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Bộ lọc" }));
    const panel = document.getElementById("hn-sku-filters-content")!;
    expect(
      within(panel).getByRole("combobox", {
        name: "Lọc mức độ hoàn thiện thông tin",
      }),
    ).toHaveTextContent("Thông tin: Chờ hoàn thiện");

    rerender(content(false));
    const restored = screen.getByRole("combobox", {
      name: "Lọc mức độ hoàn thiện thông tin",
    });
    expect(restored).toHaveTextContent("Thông tin: Chờ hoàn thiện");
    expect(restored.closest(".hn-sku-search-bar")).not.toBeNull();
    expect(
      within(panel).queryByRole("combobox", {
        name: "Lọc mức độ hoàn thiện thông tin",
      }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    expect(restored).toHaveTextContent("Thông tin: Tất cả");
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

  it("combines usage and information filters and clears both", () => {
    render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );
    const usage = screen.getByRole("combobox", { name: "Lọc theo trạng thái" });
    const information = screen.getByRole("combobox", {
      name: "Lọc mức độ hoàn thiện thông tin",
    });
    fireEvent.mouseDown(usage);
    fireEvent.click(
      screen.getByRole("option", { name: "Trạng thái: Đang sử dụng" }),
    );
    fireEvent.mouseDown(information);
    fireEvent.click(
      screen.getByRole("option", { name: "Thông tin: Chờ hoàn thiện" }),
    );
    expect(usage).toHaveTextContent("Trạng thái: Đang sử dụng");
    expect(information).toHaveTextContent("Thông tin: Chờ hoàn thiện");
    fireEvent.mouseDown(usage);
    expect(screen.queryByRole("option", { name: /Chờ hoàn thiện/ })).toBeNull();
    fireEvent.click(
      screen.getByRole("option", { name: "Trạng thái: Ngừng sử dụng" }),
    );
    expect(information).toHaveTextContent("Thông tin: Chờ hoàn thiện");
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    expect(usage).toHaveTextContent("Trạng thái: Tất cả");
    expect(information).toHaveTextContent("Thông tin: Tất cả");
  });

  it("shows missing model separately from the active usage badge", () => {
    render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );
    const row = screen.getByText("DCH-DRILL-DJZ10A-220V-V1").closest("tr")!;
    expect(within(row).getByText("Đang sử dụng")).toBeVisible();
    expect(within(row).getByText("Chờ hoàn thiện")).toBeVisible();
    expect(within(row).getByText("Thiếu: Model")).toBeVisible();
  });

  it("opens dashboard pending link with active usage and pending information", () => {
    render(
      <MemoryRouter
        initialEntries={["/master-data/skus?filter=pending_info&keep=1"]}
      >
        <PinnedSidebarContext.Provider value={true}>
          <SkuMasterScreen />
        </PinnedSidebarContext.Provider>
        <CurrentSkuLocation />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    ).toHaveTextContent("Trạng thái: Đang sử dụng");
    expect(
      screen.getByRole("combobox", { name: "Lọc mức độ hoàn thiện thông tin" }),
    ).toHaveTextContent("Thông tin: Chờ hoàn thiện");
    expect(screen.getByRole("button", { name: "Bộ lọc" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      vi.mocked(useMvpSkus).mock.calls
        .filter(([params]) => params?.per_page === 10).at(-1)?.[0],
    ).toEqual(expect.objectContaining({
      status: "ACTIVE", information_status: "PENDING", page: 1,
    }));
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    expect(screen.getByTestId("sku-location")).toHaveTextContent("?keep=1");
    expect(screen.getByTestId("sku-location")).not.toHaveTextContent("pending_info");
  });

  it("applies dashboard filters when navigating to the same mounted SKU screen", () => {
    render(
      <MemoryRouter initialEntries={["/master-data/skus"]}>
        <Link to="/master-data/skus?filter=pending_info">
          Dashboard pending SKUs
        </Link>
        <SkuMasterScreen />
        <CurrentSkuLocation />
      </MemoryRouter>,
    );
    fireEvent.click(
      screen.getByRole("link", { name: "Dashboard pending SKUs" }),
    );
    expect(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    ).toHaveTextContent("Trạng thái: Đang sử dụng");
    expect(
      screen.getByRole("combobox", { name: "Lọc mức độ hoàn thiện thông tin" }),
    ).toHaveTextContent("Thông tin: Chờ hoàn thiện");
    const usage = screen.getByRole("combobox", { name: "Lọc theo trạng thái" });
    fireEvent.mouseDown(usage);
    fireEvent.click(screen.getByRole("option", {
      name: "Trạng thái: Ngừng sử dụng",
    }));
    fireEvent.click(screen.getByRole("link", { name: "Dashboard pending SKUs" }));
    expect(usage).toHaveTextContent("Trạng thái: Đang sử dụng");
    const information = screen.getByRole("combobox", {
      name: "Lọc mức độ hoàn thiện thông tin",
    });
    fireEvent.mouseDown(information);
    fireEvent.click(screen.getByRole("option", { name: "Thông tin: Đầy đủ" }));
    expect(screen.getByTestId("sku-location")).not.toHaveTextContent("pending_info");
    fireEvent.click(screen.getByRole("link", { name: "Dashboard pending SKUs" }));
    expect(information).toHaveTextContent("Thông tin: Chờ hoàn thiện");
    expect(
      vi.mocked(useMvpSkus).mock.calls
        .filter(([params]) => params?.per_page === 10).at(-1)?.[0],
    ).toEqual(expect.objectContaining({
      status: "ACTIVE", information_status: "PENDING", page: 1,
    }));
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    expect(
      screen.getByRole("combobox", { name: "Lọc theo trạng thái" }),
    ).toHaveTextContent("Trạng thái: Tất cả");
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
    ).toEqual(["#", "SKU", "Loại", "Đơn vị", "Hãng / Nhóm", "Trạng thái", ""]);
    const row = within(table)
      .getByText("DCH-DRILL-DJZ10A-220V-V1")
      .closest("tr");
    expect(row).not.toBeNull();
    expect((row as HTMLTableRowElement).cells[3]).toHaveTextContent("cái");
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

  it.each([false, true])("hiện toast và tải lại SKU khi đổi trạng thái ứng dụng gặp 412 (published=%s)", async (published) => {
    const toastError = vi.spyOn(toast, "error");
    const row = { ...DEFAULT_SKU_ROW, published_to_app: published };
    const refetch = vi.fn().mockResolvedValue({
      data: { data: [{ ...row, version: 4 }], meta: {} },
      isError: false,
    });
    vi.mocked(useMvpSkus).mockReturnValue({
      data: { data: [row], meta: {} },
      isLoading: false,
      error: null,
      refetch,
    } as never);
    vi.mocked(useSetMvpSkuPublished).mockReturnValue({
      isPending: false,
      mutateAsync: vi.fn().mockRejectedValue({
        isAxiosError: true,
        response: {
          status: 412,
          data: {
            error_code: "STALE_VERSION",
            message: "Hồ sơ App PV đã được cập nhật bởi phiên khác.",
          },
        },
      }),
    } as never);

    render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );

    const tableRow = screen.getByText(row.sku_code).closest("tr");
    fireEvent.click(
      within(tableRow as HTMLTableRowElement).getByRole("button", {
        name: "Xem chi tiết",
      }),
    );
    const drawer = screen.getByRole("dialog", { name: "Chi tiết SKU" });
    const actionLabel = published ? "Gỡ khỏi ứng dụng" : "Đưa lên ứng dụng";
    fireEvent.click(within(drawer).getByRole("button", { name: actionLabel }));
    const confirm = screen.getByRole("dialog", {
      name: published ? "Gỡ SKU khỏi ứng dụng phân vùng?" : "Đưa SKU lên ứng dụng phân vùng?",
    });
    fireEvent.click(within(confirm).getByRole("button", { name: actionLabel }));

    const staleCopy =
      "Hồ sơ sản phẩm đã được cập nhật ở phiên khác. Danh sách vừa được tải lại; hãy kiểm tra rồi thao tác lại.";
    await waitFor(() => expect(refetch).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(toastError).toHaveBeenCalledWith(staleCopy));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(toastError).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(staleCopy)).not.toBeInTheDocument();
    expect(await screen.findByRole("dialog", { name: "Chi tiết SKU" })).toBeInTheDocument();
    toastError.mockRestore();
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

  it("chặn mã nơi nhận trùng ngay trên form trước khi gọi API", async () => {
    render(
      <MemoryRouter>
        <AgencyMasterScreen />
      </MemoryRouter>,
    );
    fireEvent.click(
      await screen.findByRole("button", { name: /Thêm nơi nhận/ }),
    );
    fireEvent.change(screen.getByLabelText(/^Mã nơi nhận/), {
      // Khác hoa/thường vẫn là cùng một mã nghiệp vụ.
      target: { value: "ag-hn-001" },
    });
    fireEvent.change(screen.getByLabelText(/^Tên nơi nhận/), {
      target: { value: "Đại lý trùng mã" },
    });
    fireEvent.mouseDown(
      screen.getByRole("combobox", { name: "Loại nơi nhận" }),
    );
    fireEvent.click(screen.getByRole("option", { name: "Đại lý" }));
    fireEvent.click(screen.getByRole("button", { name: "Lưu nơi nhận" }));

    expect(
      await screen.findByText(
        "Mã nơi nhận này đã tồn tại. Vui lòng dùng mã khác.",
      ),
    ).toBeInTheDocument();
    // Vẫn ở lại form để người dùng sửa mã, không đóng dialog.
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("hiện lỗi server tại ô nhập và không bắn thêm toast trùng", async () => {
    const toastError = vi.spyOn(toast, "error");
    const mutateAsync = vi.fn().mockRejectedValue(
      new ApiEnvelopeError({
        status: "error",
        message: "Dữ liệu không hợp lệ.",
        errors: { agency_code: ["Mã nơi nhận đã tồn tại."] },
      }),
    );
    vi.mocked(useUpdateMvpAgency).mockReturnValue({
      isPending: false,
      mutateAsync,
    } as never);

    render(
      <MemoryRouter>
        <AgencyMasterScreen />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByText("Đại lý Minh Anh"));
    await screen.findByRole("dialog");
    fireEvent.click(screen.getByRole("button", { name: "Lưu nơi nhận" }));

    expect(
      await screen.findByText("Mã nơi nhận đã tồn tại."),
    ).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledTimes(1);
    expect(toastError).not.toHaveBeenCalled();
    toastError.mockRestore();
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

  it("lỗi lưu bệnh/lỗi chỉ hiện một khối có nút đóng, không toast trùng", async () => {
    const toastError = vi.spyOn(toast, "error");
    const message =
      "Chưa có phiên bản bản ghi hợp lệ từ máy chủ. Vui lòng tải lại trước khi thao tác.";
    const mutateAsync = vi.fn().mockRejectedValue(
      new ApiEnvelopeError({
        status: "error",
        message,
      }),
    );
    vi.mocked(useUpdateMvpDefect).mockReturnValue({
      isPending: false,
      mutateAsync,
    } as never);

    render(
      <MemoryRouter>
        <DefectMasterScreen />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByText("Không chạy motor"));
    await screen.findByRole("dialog");
    fireEvent.click(
      screen.getByRole("button", { name: "Lưu danh mục lỗi" }),
    );

    expect(await screen.findByText(message)).toBeInTheDocument();
    // Chỉ khối DefectMutationNotice, không thêm banner formError thứ hai.
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getAllByText(message)).toHaveLength(1);
    expect(toastError).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    await waitFor(() =>
      expect(screen.queryByText(message)).not.toBeInTheDocument(),
    );
    toastError.mockRestore();
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
