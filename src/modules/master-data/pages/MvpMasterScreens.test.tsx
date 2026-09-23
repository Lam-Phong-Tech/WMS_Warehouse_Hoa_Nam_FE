import {
  fireEvent,
  render,
  screen,
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
          unit: "cái",
          is_serial_tracked: true,
          status: "ACTIVE",
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
  });

  it("keeps SKU create/edit inside the list modal", async () => {
    render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );
    expect(screen.getByText("DCH-DRILL-DJZ10A-220V-V1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Thêm SKU/ }));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Thêm SKU")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));
    // MUI Dialog gỡ aria-hidden trên phần còn lại của trang sau khi hiệu ứng
    // đóng hoàn tất — phải đợi dialog biến mất hẳn, nếu không các phần tử
    // trong bảng phía sau vẫn bị coi là ẩn với getByRole (aria-hidden kẹt lại).
    await waitForElementToBeRemoved(() => screen.queryByRole("dialog"));

    const row = screen.getByText("DCH-DRILL-DJZ10A-220V-V1").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(
      within(row as HTMLTableRowElement).getByRole("button", { name: "Sửa" }),
    );
    dialog = screen.getByRole("dialog");
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
