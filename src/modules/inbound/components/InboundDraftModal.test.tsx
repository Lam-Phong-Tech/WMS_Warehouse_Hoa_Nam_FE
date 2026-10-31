import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import dayjs from "dayjs";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { useAuthStore } from "@/shared/store/auth.store";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

vi.mock("@/modules/inbound/hooks/use-inbound", () => ({
  useCreateInbound: vi.fn(),
  useInboundDetail: vi.fn(),
  useUpdateInbound: vi.fn(),
}));
vi.mock("@/shared/data/reference-queries", () => ({
  useActiveWarehouses: vi.fn(),
}));
vi.mock("@/shared/components/DocumentAttachmentsPanel", () => ({
  DocumentAttachmentsPanel: () => null,
}));

import {
  useCreateInbound,
  useInboundDetail,
  useUpdateInbound,
} from "@/modules/inbound/hooks/use-inbound";
import { useActiveWarehouses } from "@/shared/data/reference-queries";
import { InboundDraftModal } from "./InboundDraftModal";

const warehouses = [{ id: "WH-1", code: "HN", name: "Kho Hoa Nam" }];
const create = vi.fn();
const update = vi.fn();

function mockDetail(date: string, status = "DRAFT") {
  vi.mocked(useInboundDetail).mockReturnValue({
    data: {
      document: {
        id: "IN-1",
        date,
        warehouseId: "WH-1",
        source: "Nguồn A",
        note: "Ghi chú A",
        status,
        version: 7,
      },
    },
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useInboundDetail>);
}

beforeEach(() => {
  useAuthStore.setState({
    isSuperAdmin: false,
    permissionCodes: [P.INBOUND_CREATE],
  });
  create.mockResolvedValue({ id: "IN-NEW" });
  update.mockResolvedValue({ id: "IN-1" });
  vi.mocked(useCreateInbound).mockReturnValue({
    isPending: false,
    mutateAsync: create,
  } as unknown as ReturnType<typeof useCreateInbound>);
  vi.mocked(useUpdateInbound).mockReturnValue({
    isPending: false,
    mutateAsync: update,
  } as unknown as ReturnType<typeof useUpdateInbound>);
  vi.mocked(useInboundDetail).mockReturnValue({
    data: undefined,
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useInboundDetail>);
  vi.mocked(useActiveWarehouses).mockReturnValue({
    data: warehouses,
    isLoading: false,
  } as unknown as ReturnType<typeof useActiveWarehouses>);
});

afterEach(() => {
  cleanupTestState();
  vi.clearAllMocks();
});

describe("IN-01 · ngày chứng từ trong hộp tạo/sửa", () => {
  it("hiện trạng thái tải trước khi nhận chi tiết, không mô tả phiếu nháp là đã kết thúc", async () => {
    vi.mocked(useInboundDetail).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useInboundDetail>);
    const modal = (
      <InboundDraftModal
        documentId="IN-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );
    const { rerender } = renderWithProviders(modal);

    expect(screen.getByRole("status")).toHaveTextContent("Đang tải dữ liệu…");
    expect(screen.queryByText("Phiếu đã kết thúc và chỉ được xem")).toBeNull();
    expect(document.getElementById("inbound-doc-date")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Lưu thông tin" })).toBeNull();

    mockDetail(dayjs().format("YYYY-MM-DD"));
    rerender(
      <InboundDraftModal
        documentId="IN-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await waitFor(() => {
      expect(screen.queryByRole("status")).toBeNull();
      expect(
        screen.getByRole("button", { name: "Ngày chứng từ" }),
      ).toBeEnabled();
      expect(
        screen.getByRole("button", { name: "Lưu thông tin" }),
      ).toBeEnabled();
    });
    expect(
      screen
        .getByRole("button", { name: "Lưu thông tin" })
        .closest(".MuiDialogTitle-root"),
    ).not.toBeNull();
    expect(
      screen.getByRole("dialog").querySelector(".MuiDialogActions-root"),
    ).toBeNull();
    expect(screen.queryByText("Phiếu đã kết thúc và chỉ được xem")).toBeNull();
    expect(
      screen.getByRole("textbox", { name: "Nguồn / tham chiếu" }),
    ).toHaveValue("Nguồn A");
    expect(update).not.toHaveBeenCalled();
  });

  it("lỗi tải chi tiết không bị mô tả thành phiếu đã kết thúc", async () => {
    vi.mocked(useInboundDetail).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      error: new Error("Không tải được phiếu nhập."),
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useInboundDetail>);
    renderWithProviders(
      <InboundDraftModal
        documentId="IN-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Không tải được phiếu nhập.",
    );
    expect(screen.queryByRole("status")).toBeNull();
    expect(screen.queryByText("Phiếu đã kết thúc và chỉ được xem")).toBeNull();
    expect(screen.queryByRole("button", { name: "Lưu thông tin" })).toBeNull();
    expect(
      screen.getByRole("button", { name: "Ngày chứng từ" }),
    ).toBeDisabled();
    expect(update).not.toHaveBeenCalled();
  });

  it("chọn ngày bằng lịch vẫn gửi ISO và tiếp tục vào luồng quét", async () => {
    const onSaved = vi.fn();
    renderWithProviders(
      <InboundDraftModal
        documentId={null}
        onClose={vi.fn()}
        onSaved={onSaved}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Ngày chứng từ" }));
    const yesterday = dayjs().subtract(1, "day");
    fireEvent.click(
      screen.getByRole("button", { name: yesterday.format("DD/MM/YYYY") }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Tạo phiếu & quét hàng" }),
    );

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        doc_date: yesterday.format("YYYY-MM-DD"),
        dst_warehouse_id: "WH-1",
        source_reference: null,
        note: null,
      });
      expect(onSaved).toHaveBeenCalledWith("IN-NEW");
    });
  });

  it("giữ thao tác xóa ngày và chặn lưu khi thiếu ngày", async () => {
    renderWithProviders(
      <InboundDraftModal
        documentId={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: /: Ngày chứng từ$/ }));
    fireEvent.click(
      screen.getByRole("button", { name: "Tạo phiếu & quét hàng" }),
    );

    expect(await screen.findByText("Chọn ngày chứng từ.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    expect(
      screen.getByRole("group", { name: "Ngày chứng từ" }),
    ).toHaveAttribute("aria-invalid", "true");
  });

  it("lịch không cho chọn ngày tương lai", async () => {
    renderWithProviders(
      <InboundDraftModal
        documentId={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    fireEvent.click(await screen.findByRole("button", { name: "Ngày chứng từ" }));
    expect(
      screen.getByRole("button", {
        name: dayjs().add(1, "day").format("DD/MM/YYYY"),
      }),
    ).toBeDisabled();
  });

  it.each(["2026-22-01", "1999-12-31", "9999-12-31"])(
    "không làm mất kiểm tra ngày từ API không hợp lệ (%s)",
    async (date) => {
      mockDetail(date);
      renderWithProviders(
        <InboundDraftModal
          documentId="IN-1"
          onClose={vi.fn()}
          onSaved={vi.fn()}
        />,
      );
      fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
      await waitFor(() => {
        expect(
          screen.getByRole("group", { name: "Ngày chứng từ" }),
        ).toHaveAttribute("aria-invalid", "true");
      });
      expect(update).not.toHaveBeenCalled();
    },
  );

  it("sửa ngày vẫn giữ phiên bản và payload cập nhật, không đổi kho", async () => {
    const date = dayjs().subtract(1, "day").format("YYYY-MM-DD");
    mockDetail(date, "SCANNING");
    renderWithProviders(
      <InboundDraftModal
        documentId="IN-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(await screen.findByRole("combobox", { name: /Kho nhận/ })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({
        id: "IN-1",
        ifMatch: 7,
        payload: {
          doc_date: date,
          source_reference: "Nguồn A",
          note: "Ghi chú A",
        },
      });
    });
  });

  it("phiếu kết thúc vẫn chỉ xem và không có thao tác xóa hoặc lưu", async () => {
    mockDetail(dayjs().format("YYYY-MM-DD"), "COMPLETED");
    renderWithProviders(
      <InboundDraftModal
        documentId="IN-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("button", { name: "Ngày chứng từ" }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", { name: /: Ngày chứng từ$/ }),
    ).toBeNull();
    expect(screen.queryByRole("button", { name: "Lưu thông tin" })).toBeNull();
  });
});
