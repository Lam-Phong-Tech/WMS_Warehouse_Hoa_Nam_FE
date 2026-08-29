import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { SkuMasterScreen } from "@/modules/master-data/pages/MvpMasterScreens";
import { useAuthStore } from "@/shared/store/auth.store";

/**
 * Định mức tồn theo SKU (phục vụ báo cáo định mức tồn) — rule phải khớp BE
 * (ValidatesSkuStockThresholds + CHECK chk_skus_stock_thresholds):
 *   min ≥ 0 (0 là định mức THẬT, không phải "chưa đặt"), max ≥ 1, max > min.
 */
const { updateSku, createSku } = vi.hoisted(() => ({
  updateSku: vi.fn().mockResolvedValue({}),
  createSku: vi.fn().mockResolvedValue({}),
}));

vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpSkus: () => ({
    data: {
      data: [
        {
          sku_id: "sku-1",
          sku_code: "SKU-CO-DINH-MUC",
          sku_name: "SKU đã đặt định mức",
          sku_type: "PRODUCT",
          unit: "cái",
          is_serial_tracked: true,
          status: "ACTIVE",
          version: 3,
          brand_id: "brand-1",
          category_id: "cat-1",
          model_id: "model-1",
          power_source_id: "power-1",
          package_variant_id: "package-1",
          version_code: "V1",
          min_stock: 0,
          max_stock: 1200,
        },
        {
          sku_id: "sku-2",
          sku_code: "SKU-CHUA-DAT",
          sku_name: "SKU chưa đặt định mức",
          sku_type: "PRODUCT",
          unit: "cái",
          is_serial_tracked: false,
          status: "ACTIVE",
          version: 1,
          min_stock: null,
          max_stock: null,
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
      powerSources: [
        { id: "power-1", code: "MAINS_DIRECT", name: "Điện lưới trực tiếp" },
      ],
      packageVariants: [{ id: "package-1", code: "KIT", name: "Kit đầy đủ" }],
    },
    isLoading: false,
    error: null,
  }),
  useMvpSkuHasStock: () => ({ data: false, isLoading: false }),
  useCreateMvpSku: () => ({ isPending: false, mutateAsync: createSku }),
  useUpdateMvpSku: () => ({ isPending: false, mutateAsync: updateSku }),
  useSetMvpSkuPublished: () => ({
    isPending: false,
    mutateAsync: vi.fn().mockResolvedValue({}),
  }),
}));

function openEditDialog(skuCode: string) {
  const row = screen.getByText(skuCode).closest("tr");
  expect(row).not.toBeNull();
  fireEvent.click(
    within(row as HTMLTableRowElement).getByRole("button", { name: "Sửa" }),
  );
  return screen.getByRole("dialog");
}

function setThresholds(dialog: HTMLElement, min: string, max: string) {
  fireEvent.change(within(dialog).getByLabelText(/Định mức tồn tối thiểu/), {
    target: { value: min },
  });
  fireEvent.change(within(dialog).getByLabelText(/Định mức tồn tối đa/), {
    target: { value: max },
  });
}

/** Submit "hợp lệ" đi tiếp vào mutation async — phải act() để React flush xong. */
async function submitForm(dialog: HTMLElement) {
  await act(async () => {
    fireEvent.submit(
      dialog.querySelector("#sku-master-form") as HTMLFormElement,
    );
  });
}

describe("MST-01 · định mức tồn theo SKU", () => {
  beforeEach(() => {
    useAuthStore.setState({ isSuperAdmin: true, permissionCodes: [] });
    updateSku.mockClear();
    createSku.mockClear();
    render(
      <MemoryRouter>
        <SkuMasterScreen />
      </MemoryRouter>,
    );
  });

  it("hiện 2 cột định mức trong danh sách, phân biệt 0 với chưa đặt", () => {
    const configured = screen.getByText("SKU-CO-DINH-MUC").closest("tr");
    const cells = within(configured as HTMLTableRowElement).getAllByRole(
      "cell",
    );
    // Thứ tự cột: select, STT, SKU, Loại, Hãng, Nhóm hàng, min, max, ...
    expect(cells[6]).toHaveTextContent("0");
    expect(cells[7]).toHaveTextContent("1.200");

    const unset = screen.getByText("SKU-CHUA-DAT").closest("tr");
    const unsetCells = within(unset as HTMLTableRowElement).getAllByRole(
      "cell",
    );
    expect(unsetCells[6]).toHaveTextContent("—");
    expect(unsetCells[7]).toHaveTextContent("—");
  });

  it("chặn định mức tối đa < 1", () => {
    const dialog = openEditDialog("SKU-CO-DINH-MUC");
    setThresholds(dialog, "0", "0");
    fireEvent.submit(
      dialog.querySelector("#sku-master-form") as HTMLFormElement,
    );

    expect(
      within(dialog).getByText("Định mức tối đa phải là số ≥ 1."),
    ).toBeInTheDocument();
    expect(updateSku).not.toHaveBeenCalled();
  });

  it("chặn định mức tối thiểu âm", () => {
    const dialog = openEditDialog("SKU-CO-DINH-MUC");
    setThresholds(dialog, "-1", "10");
    fireEvent.submit(
      dialog.querySelector("#sku-master-form") as HTMLFormElement,
    );

    expect(
      within(dialog).getByText("Định mức tối thiểu phải là số ≥ 0."),
    ).toBeInTheDocument();
    expect(updateSku).not.toHaveBeenCalled();
  });

  it("chặn định mức tối đa BẰNG định mức tối thiểu (phải lớn hơn hẳn)", () => {
    const dialog = openEditDialog("SKU-CO-DINH-MUC");
    setThresholds(dialog, "10", "10");
    fireEvent.submit(
      dialog.querySelector("#sku-master-form") as HTMLFormElement,
    );

    expect(
      within(dialog).getByText(
        "Định mức tối đa phải lớn hơn định mức tối thiểu.",
      ),
    ).toBeInTheDocument();
    expect(updateSku).not.toHaveBeenCalled();
  });

  it("gửi min_stock = 0 xuống BE thay vì hiểu nhầm thành chưa đặt", async () => {
    const dialog = openEditDialog("SKU-CO-DINH-MUC");
    setThresholds(dialog, "0", "1");
    await submitForm(dialog);

    expect(updateSku).toHaveBeenCalledTimes(1);
    expect(updateSku.mock.calls[0][0].payload).toMatchObject({
      min_stock: 0,
      max_stock: 1,
    });
  });

  it("để trống hai ô thì gửi null = chưa đặt định mức", async () => {
    const dialog = openEditDialog("SKU-CO-DINH-MUC");
    setThresholds(dialog, "", "");
    await submitForm(dialog);

    expect(updateSku).toHaveBeenCalledTimes(1);
    expect(updateSku.mock.calls[0][0].payload).toMatchObject({
      min_stock: null,
      max_stock: null,
    });
  });
});
