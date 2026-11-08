import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { toast } from "sonner";
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
    within(row as HTMLTableRowElement).getByRole("button", {
      name: "Xem chi tiết",
    }),
  );
  const detail = screen.getByRole("dialog", { name: "Chi tiết SKU" });
  fireEvent.click(within(detail).getByRole("button", { name: "Chỉnh sửa" }));
  return screen.getByRole("dialog", { name: "Sửa SKU" });
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

  it.each([
    {
      status: 409,
      data: {
        error: {
          code: "SKU_CODE_DUPLICATE",
          message: "sku_code đã tồn tại.",
          details: { sku_code: "SKU-CO-DINH-MUC" },
        },
      },
    },
    {
      status: 422,
      data: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu gửi lên không hợp lệ.",
        errors: {
          sku_code: [
            "Mã SKU này đã tồn tại trong hệ thống. Vui lòng dùng mã khác.",
          ],
        },
      },
    },
    {
      status: 422,
      data: {
        code: "VALIDATION_ERROR",
        message: "Dữ liệu gửi lên không hợp lệ.",
        errors: {
          sku_code: ["Mã SKU đã tồn tại trong hệ thống"],
          model_id: ["Model không còn khả dụng."],
        },
      },
    },
  ])(
    "hiện một lỗi tại Mã SKU khi tạo trùng ($status), cho sửa mã rồi lưu lại",
    async ({ status, data }) => {
      const errorToast = vi
        .spyOn(toast, "error")
        .mockReturnValue("error-toast");
      const successToast = vi
        .spyOn(toast, "success")
        .mockReturnValue("success-toast");
      createSku.mockRejectedValueOnce({
        isAxiosError: true,
        response: { status, data },
      });
      fireEvent.click(screen.getByRole("button", { name: /Thêm SKU/ }));
      const dialog = screen.getByRole("dialog", { name: "Thêm SKU" });
      const code = within(dialog).getByLabelText(/^Mã SKU/);
      fireEvent.change(code, { target: { value: "SKU-CO-DINH-MUC" } });
      fireEvent.change(within(dialog).getByLabelText(/^Tên SKU/), {
        target: { value: "SKU kiểm tra trùng" },
      });
      for (const [id, label] of [
        ["sku-brand", /DONGCHENG/],
        ["sku-category", /DRILL/],
        ["sku-model", /DJZ10A/],
        ["sku-power-source", /MAINS_DIRECT/],
      ] as const) {
        const input = within(dialog).getByTestId(id);
        fireEvent.keyDown(input, { key: "ArrowDown" });
        fireEvent.click(await screen.findByRole("option", { name: label }));
      }
      await submitForm(dialog);
      expect(createSku).toHaveBeenCalledTimes(1);
      expect(updateSku).not.toHaveBeenCalled();
      expect(code).toHaveAttribute("aria-invalid", "true");
      expect(
        screen.getAllByText("Mã SKU đã tồn tại trong hệ thống"),
      ).toHaveLength(1);
      expect(code).toHaveAccessibleDescription(
        "Mã SKU đã tồn tại trong hệ thống",
      );
      if ("errors" in data && data.errors && "model_id" in data.errors) {
        expect(
          within(dialog).getByTestId("sku-model"),
        ).toHaveAccessibleDescription("Model không còn khả dụng.");
      }
      expect(document.querySelector(".hn-sku-mutation-notice")).toBeNull();
      expect(errorToast).not.toHaveBeenCalled();
      expect(successToast).not.toHaveBeenCalled();
      expect(dialog).toBeInTheDocument();
      fireEvent.change(code, { target: { value: "SKU-NEW-RETRY" } });
      expect(
        screen.queryByText("Mã SKU đã tồn tại trong hệ thống"),
      ).not.toBeInTheDocument();
      await submitForm(dialog);
      expect(createSku).toHaveBeenCalledTimes(2);
      expect(createSku.mock.calls[1][0]).toMatchObject({
        code: "SKU-NEW-RETRY",
      });
      await waitFor(() =>
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
      );
      expect(successToast).toHaveBeenCalledTimes(1);
      errorToast.mockRestore();
      successToast.mockRestore();
    },
  );

  it.each([
    ["SKU-CO-DINH-MUC", "0", "1200"],
    ["SKU-CHUA-DAT", "", ""],
  ])("giữ đúng định mức khi sửa %s", (skuCode, min, max) => {
    const dialog = openEditDialog(skuCode);
    expect(within(dialog).getByLabelText(/Định mức tồn tối thiểu/)).toHaveValue(
      min,
    );
    const maxInput = within(dialog).getByLabelText(
      /Định mức tồn tối đa/,
    ) as HTMLInputElement;
    expect(maxInput.value.replace(/\D/g, "")).toBe(max);
  });

  it("chỉ hiện lỗi trùng mã tại field khi đổi mã của SKU đang sửa", async () => {
    const errorToast = vi.spyOn(toast, "error").mockReturnValue("error-toast");
    updateSku.mockRejectedValueOnce({
      isAxiosError: true,
      response: {
        status: 409,
        data: {
          error: {
            code: "SKU_CODE_DUPLICATE",
            message: "sku_code đã tồn tại.",
            details: { sku_code: "SKU-CHUA-DAT" },
          },
        },
      },
    });
    const dialog = openEditDialog("SKU-CO-DINH-MUC");
    const code = within(dialog).getByLabelText(/^Mã SKU/);
    fireEvent.change(code, { target: { value: "SKU-CHUA-DAT" } });
    await submitForm(dialog);
    expect(updateSku).toHaveBeenCalledTimes(1);
    expect(createSku).not.toHaveBeenCalled();
    expect(code).toHaveAccessibleDescription(
      "Mã SKU đã tồn tại trong hệ thống",
    );
    expect(
      screen.getAllByText("Mã SKU đã tồn tại trong hệ thống"),
    ).toHaveLength(1);
    expect(errorToast).not.toHaveBeenCalled();
    errorToast.mockRestore();
  });

  it("STT đi theo dòng khi bấm sắp xếp, không đứng yên thành thang 1..n", () => {
    const sttOf = (code: string) => {
      const row = screen.getByText(code).closest("tr") as HTMLTableRowElement;
      return within(row).getAllByRole("cell")[0].textContent;
    };

    expect(sttOf("SKU-CO-DINH-MUC")).toBe("1");
    expect(sttOf("SKU-CHUA-DAT")).toBe("2");

    // Sắp xếp mã SKU A → Z: "SKU-CHUA-DAT" lên trước, nhưng số thứ tự của mỗi
    // dòng phải đi theo dòng đó chứ không phải luôn là 1, 2 từ trên xuống.
    fireEvent.click(screen.getByRole("button", { name: /sắp xếp theo SKU/ }));

    const rows = screen.getAllByRole("row").slice(1);
    expect(rows[0]).toHaveTextContent("SKU-CHUA-DAT");
    expect(sttOf("SKU-CHUA-DAT")).toBe("2");
    expect(sttOf("SKU-CO-DINH-MUC")).toBe("1");
  });

  it("không còn cột checkbox chọn nhiều trong danh sách SKU", () => {
    // Lựa chọn trước đây không dẫn tới hành động hàng loạt nào nên đã gỡ.
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("tên SKU dài bị cắt bằng CSS, chữ đầy đủ nằm ở tooltip title", () => {
    const name = screen.getByTitle("SKU đã đặt định mức");
    expect(name).toHaveClass("hn-truncate");
    // Cắt bằng CSS: chữ vẫn nguyên trong DOM (Ctrl+F/đọc màn hình vẫn thấy).
    expect(name).toHaveTextContent("SKU đã đặt định mức");
  });

  it("chặn định mức tối đa < 1", () => {
    const dialog = openEditDialog("SKU-CO-DINH-MUC");
    setThresholds(dialog, "0", "0");
    fireEvent.submit(
      dialog.querySelector("#sku-master-form") as HTMLFormElement,
    );

    expect(
      within(dialog).getByText("Giá trị không được nhỏ hơn 1"),
    ).toBeInTheDocument();
    expect(updateSku).not.toHaveBeenCalled();
  });

  it("ô định mức tối thiểu lọc dấu âm ngay khi gõ (sàn 0)", () => {
    const dialog = openEditDialog("SKU-CO-DINH-MUC");
    setThresholds(dialog, "-1", "10");

    // UiNumberField lọc "-" theo luật stockMin (min 0) nên ô không bao giờ
    // chứa số âm — không cần chờ tới lúc submit mới báo.
    expect(within(dialog).getByLabelText(/Định mức tồn tối thiểu/)).toHaveValue(
      "1",
    );
    expect(updateSku).not.toHaveBeenCalled();
  });

  it("chặn định mức vượt trần chung (10000000000000)", () => {
    const dialog = openEditDialog("SKU-CO-DINH-MUC");
    setThresholds(dialog, "0", "10000000000000");
    fireEvent.submit(
      dialog.querySelector("#sku-master-form") as HTMLFormElement,
    );

    expect(
      within(dialog).getByText("Giá trị không được vượt quá 1.000.000"),
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
