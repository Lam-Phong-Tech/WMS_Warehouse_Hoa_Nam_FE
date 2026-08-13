import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AgencyMasterScreen,
  DefectMasterScreen,
  SkuMasterScreen,
} from "@/modules/master-data/pages/MvpMasterScreens";
import { useAuthStore } from "@/shared/store/auth.store";

const { mutation } = vi.hoisted(() => ({
  mutation: () => ({ isPending: false, mutateAsync: vi.fn().mockResolvedValue({}) }),
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

  it("keeps SKU create/edit inside the list modal", () => {
    render(<SkuMasterScreen />);
    expect(screen.getByText("DCH-DRILL-DJZ10A-220V-V1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "+ Thêm SKU" }));
    let dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Thêm SKU")).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Hủy" }));

    const row = screen.getByText("DCH-DRILL-DJZ10A-220V-V1").closest("tr");
    expect(row).not.toBeNull();
    fireEvent.click(within(row as HTMLTableRowElement).getByRole("button", { name: "Sửa" }));
    dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Sửa SKU")).toBeInTheDocument();
    expect(within(dialog).getByText("3")).toBeInTheDocument();
  });

  it("loads agency data and opens add/edit modal", () => {
    render(<AgencyMasterScreen />);
    expect(screen.getByText("Đại lý Minh Anh")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "+ Thêm đại lý" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("loads defect data and supports legacy add deep link", () => {
    render(<DefectMasterScreen openCreateOnMount />);
    expect(screen.getByText("Không chạy motor")).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
