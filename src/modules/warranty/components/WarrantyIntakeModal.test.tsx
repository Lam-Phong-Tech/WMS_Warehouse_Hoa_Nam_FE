import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { toast } from "sonner";
import { renderWithProviders } from "@/test/test-utils";
import { createMockAxiosError } from "@/shared/api/api-error";
import { WarrantyIntakeModal } from "./WarrantyIntakeModal";

const mocks = vi.hoisted(() => ({
  create: vi.fn(),
  refetch: vi.fn(),
  warehouses: vi.fn(),
}));

vi.mock("@/shared/data/reference-queries", () => ({
  useActiveWarehouses: mocks.warehouses,
}));
vi.mock("@/modules/warranty/hooks/use-warranty", () => ({
  useCreateWarrantyCase: () => ({
    mutateAsync: mocks.create,
    isPending: false,
  }),
  useUploadWarrantyAttachment: () => ({
    mutateAsync: vi.fn(),
    isPending: false,
  }),
}));
vi.mock("@/modules/master-data/hooks/use-mvp-master", () => ({
  useMvpDefects: () => ({ data: { data: [] } }),
  useCreateMvpDefect: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

const WAREHOUSE_A = "11111111-1111-4111-8111-111111111111";
const WAREHOUSE_B = "22222222-2222-4222-8222-222222222222";
const rows = [
  { id: WAREHOUSE_A, code: "KHO-TONG-HN", name: "Kho tổng", status: "ACTIVE" },
  { id: WAREHOUSE_B, code: "KHO-B", name: "Kho B", status: "ACTIVE" },
];

async function renderIntake() {
  const onCreated = vi.fn();
  renderWithProviders(
    <WarrantyIntakeModal open onClose={vi.fn()} onCreated={onCreated} />,
  );
  await screen.findByRole("button", { name: /Xác nhận kho/ });
  return { onCreated };
}

async function selectWarehouse(name = /KHO-TONG-HN · Kho tổng/) {
  fireEvent.mouseDown(
    screen.getByRole("combobox", { name: /Kho tiếp nhận bảo hành/ }),
  );
  fireEvent.click(await screen.findByRole("option", { name }));
}

function confirmWarehouse() {
  fireEvent.click(screen.getByRole("button", { name: /Xác nhận kho/ }));
}

function fillCommonFields() {
  fireEvent.change(screen.getByLabelText(/Tên khách gửi/), {
    target: { value: "Nguyễn Văn A" },
  });
  fireEvent.change(screen.getByLabelText(/Số điện thoại/), {
    target: { value: "0901234567" },
  });
  fireEvent.change(screen.getByLabelText(/Bệnh \/ lỗi khách phản ánh/), {
    target: { value: "Không lên nguồn" },
  });
}

function fillIdentified() {
  fireEvent.change(screen.getByPlaceholderText(/Quét QR tổng hợp/), {
    target: { value: "SER-001" },
  });
}

function fillTempOnly() {
  fireEvent.click(screen.getByRole("radio", { name: "Mất mã" }));
  fireEvent.change(screen.getByLabelText(/Lý do mất\/không có mã/), {
    target: { value: "Mất tem máy" },
  });
  fireEvent.change(screen.getByLabelText(/Mô tả nhận diện máy/), {
    target: { value: "Máy khoan màu xanh" },
  });
}

function save() {
  fireEvent.click(screen.getByRole("button", { name: /Lưu tiếp nhận/ }));
}

// Exercise the full dialog, including coordinated loading, on slower Windows runners.
describe(
  "WarrantyIntakeModal warehouse confirmation",
  { timeout: 60_000 },
  () => {
    beforeEach(() => {
      mocks.create.mockReset();
      mocks.create.mockResolvedValue({
        id: "case-1",
        case_code: "WC-1",
        identification_type: "IDENTIFIED",
      });
      mocks.refetch.mockReset();
      mocks.warehouses.mockReturnValue({
        data: rows,
        isPending: false,
        isError: false,
        isFetching: false,
        refetch: mocks.refetch,
      });
    });

    it.each(["IDENTIFIED", "TEMP_ONLY"])(
      "%s yêu cầu chọn rồi xác nhận kho trước khi lưu",
      async (type) => {
        const { onCreated } = await renderIntake();
        fillCommonFields();
        if (type === "IDENTIFIED") fillIdentified();
        else fillTempOnly();
        save();
        expect(mocks.create).not.toHaveBeenCalled();
        expect(
          screen.getAllByText(/Bạn chưa xác nhận kho tiếp nhận bảo hành/)
            .length,
        ).toBeGreaterThan(0);
        await selectWarehouse();
        save();
        expect(mocks.create).not.toHaveBeenCalled();
        confirmWarehouse();
        expect(
          screen.getByText(/Đã xác nhận kho tiếp nhận: KHO-TONG-HN/),
        ).toBeInTheDocument();
        save();
        await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1));
        expect(mocks.create).toHaveBeenCalledWith(
          expect.objectContaining({
            warehouse_id: WAREHOUSE_A,
            identification_type: type,
          }),
        );
      },
    );

    it("đổi kho hủy xác nhận cũ và dùng kho mới khi lưu", async () => {
      await renderIntake();
      fillCommonFields();
      fillIdentified();
      await selectWarehouse();
      confirmWarehouse();
      await selectWarehouse(/KHO-B · Kho B/);
      expect(
        screen.queryByText(/Đã xác nhận kho tiếp nhận/),
      ).not.toBeInTheDocument();
      save();
      expect(mocks.create).not.toHaveBeenCalled();
      confirmWarehouse();
      save();
      await waitFor(() =>
        expect(mocks.create).toHaveBeenCalledWith(
          expect.objectContaining({ warehouse_id: WAREHOUSE_B }),
        ),
      );
    });

    it("đổi loại tiếp nhận xóa banner, lỗi ô mã và thông báo nổi cũ", async () => {
      const dismiss = vi.spyOn(toast, "dismiss");
      mocks.create.mockRejectedValue(
        createMockAxiosError({
          status: 409,
          data: {
            error_code: "WAREHOUSE_CONTEXT_REQUIRED",
            message: "Gửi warehouse_id đã được xác nhận.",
          },
        }),
      );
      await renderIntake();
      fillCommonFields();
      fillIdentified();
      await selectWarehouse();
      confirmWarehouse();
      save();
      await screen.findByText(/Bạn chưa xác nhận kho tiếp nhận bảo hành/);
      expect(screen.queryByText(/Gửi warehouse_id/)).not.toBeInTheDocument();
      expect(
        screen.queryByText(/Đã xác nhận kho tiếp nhận/),
      ).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("radio", { name: "Mất mã" }));
      expect(
        screen.queryByText(/Bạn chưa xác nhận kho tiếp nhận bảo hành/),
      ).not.toBeInTheDocument();
      expect(dismiss).toHaveBeenCalledWith("warranty-intake-error");
    });

    it.each([
      ["WARRANTY_ITEM_NOT_FOUND", /Không tìm thấy máy theo mã đã nhập/],
      ["WARRANTY_ITEM_NOT_ELIGIBLE", /Máy chưa ở trạng thái đã xuất/],
      ["ACTIVE_WARRANTY_EXISTS", /Máy đang có hồ sơ bảo hành/],
    ])("giữ chặn nghiệp vụ và giải thích rõ lỗi %s", async (code, message) => {
      mocks.create.mockRejectedValue(
        createMockAxiosError({
          status: 422,
          data: { error: { code }, message: "Technical item error" },
        }),
      );
      const { onCreated } = await renderIntake();
      fillCommonFields();
      fillIdentified();
      await selectWarehouse();
      confirmWarehouse();
      save();
      await screen.findByText(message);
      expect(onCreated).not.toHaveBeenCalled();
      expect(screen.getByRole("radio", { name: "Có mã máy" })).toBeChecked();
      fireEvent.click(screen.getByRole("radio", { name: "Mất mã" }));
      expect(screen.queryByText(message)).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole("radio", { name: "Có mã máy" }));
      expect(screen.getByPlaceholderText(/Quét QR tổng hợp/)).toHaveValue(
        "SER-001",
      );
    });

    it("không xác nhận hoặc gửi khi danh sách kho tải lỗi và có nút thử lại", async () => {
      mocks.warehouses.mockReturnValue({
        data: undefined,
        isPending: false,
        isError: true,
        isFetching: false,
        refetch: mocks.refetch,
      });
      await renderIntake();
      expect(
        screen.getByRole("button", { name: /Xác nhận kho/ }),
      ).toBeDisabled();
      expect(
        screen.getByText(/Không tải được danh sách kho tiếp nhận/),
      ).toBeInTheDocument();
      fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
      expect(mocks.refetch).toHaveBeenCalledTimes(1);
      save();
      expect(mocks.create).not.toHaveBeenCalled();
    });
  },
);
