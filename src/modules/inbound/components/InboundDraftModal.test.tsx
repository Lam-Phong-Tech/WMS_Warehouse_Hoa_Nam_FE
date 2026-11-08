import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import dayjs from "dayjs";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";
import { uploadDocumentAttachment } from "@/shared/api/documentAttachmentService";
import { useAuthStore } from "@/shared/store/auth.store";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

vi.mock("@/shared/api/documentAttachmentService", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/shared/api/documentAttachmentService")
  >()),
  uploadDocumentAttachment: vi.fn(),
}));
vi.mock("@/modules/inbound/hooks/use-inbound", () => ({
  useCreateInbound: vi.fn(),
  useInboundDetail: vi.fn(),
  useUpdateInbound: vi.fn(),
}));
vi.mock("@/shared/data/reference-queries", () => ({
  useActiveWarehouses: vi.fn(),
}));
vi.mock("@/modules/inbound/hooks/use-inbound-supplier-search", () => ({
  useInboundSupplierSearch: vi.fn(),
}));
vi.mock("@/shared/components/DocumentAttachmentsPanel", () => ({
  DocumentAttachmentsPanel: () => null,
}));

import {
  useCreateInbound,
  useInboundDetail,
  useUpdateInbound,
} from "@/modules/inbound/hooks/use-inbound";
import { useInboundSupplierSearch } from "@/modules/inbound/hooks/use-inbound-supplier-search";
import { useActiveWarehouses } from "@/shared/data/reference-queries";
import { InboundDraftModal } from "./InboundDraftModal";

const warehouses = [{ id: "WH-1", code: "HN", name: "Kho Hoa Nam" }];
const create = vi.fn();
const update = vi.fn();

const supplier = {
  id: "SUP-1",
  code: "NCC-001",
  name: "Honda",
  displayName: "NCC-001 - Honda",
  status: "ACTIVE" as const,
  version: 1,
};

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
        supplierId: supplier.id,
      },
      supplier,
    },
    isError: false,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof useInboundDetail>);
}

beforeEach(() => {
  vi.mocked(uploadDocumentAttachment)
    .mockReset()
    .mockResolvedValue({} as never);
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
  vi.mocked(useInboundSupplierSearch).mockReturnValue({
    options: [{ value: supplier.id, label: supplier.displayName }],
    loading: false,
    error: null,
    retry: vi.fn(),
    onSearch: vi.fn(),
  });
});

async function selectSupplier() {
  fireEvent.mouseDown(
    await screen.findByRole("combobox", { name: /Nhà cung cấp/ }),
  );
  fireEvent.click(
    await screen.findByRole("option", { name: "NCC-001 - Honda" }),
  );
}

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
        .closest(".hn-inbound-draft__header"),
    ).not.toBeNull();
    expect(
      screen.getByRole("dialog").querySelector(".MuiDialogActions-root"),
    ).toBeNull();
    expect(screen.queryByText("Phiếu đã kết thúc và chỉ được xem")).toBeNull();
    expect(
      screen.getByRole("textbox", { name: "Mã chứng từ bên ngoài" }),
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
    const reference = await screen.findByRole("textbox", {
      name: "Mã chứng từ bên ngoài",
    });
    expect(reference).not.toBeRequired();
    expect(reference).toHaveValue("");
    fireEvent.click(
      await screen.findByRole("button", { name: "Ngày chứng từ" }),
    );
    const yesterday = dayjs().subtract(1, "day");
    fireEvent.click(
      screen.getByRole("button", { name: yesterday.format("DD/MM/YYYY") }),
    );
    await selectSupplier();
    fireEvent.click(
      screen.getByRole("button", { name: "Tạo phiếu & quét hàng" }),
    );

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        doc_date: yesterday.format("YYYY-MM-DD"),
        dst_warehouse_id: "WH-1",
        source_reference: null,
        supplier_id: "SUP-1",
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
    fireEvent.click(
      await screen.findByRole("button", { name: /: Ngày chứng từ$/ }),
    );
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
    fireEvent.click(
      await screen.findByRole("button", { name: "Ngày chứng từ" }),
    );
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
    expect(
      await screen.findByRole("combobox", { name: /Kho nhận/ }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() => {
      expect(update).toHaveBeenCalledWith({
        id: "IN-1",
        ifMatch: 7,
        payload: {
          doc_date: date,
          source_reference: "Nguồn A",
          supplier_id: "SUP-1",
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

describe("IN-01 · nhà cung cấp", () => {
  it("bắt buộc chọn nhà cung cấp trước khi tạo phiếu", async () => {
    renderWithProviders(
      <InboundDraftModal
        documentId={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Tạo phiếu & quét hàng" }),
    );

    expect(await screen.findByText("Chọn nhà cung cấp.")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it("hiện nhà cung cấp đã chọn khi sửa phiếu", async () => {
    mockDetail(dayjs().subtract(1, "day").format("YYYY-MM-DD"));
    renderWithProviders(
      <InboundDraftModal
        documentId="IN-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(
      await screen.findByRole("combobox", { name: /Nhà cung cấp/ }),
    ).toHaveValue("NCC-001 - Honda");
    fireEvent.click(screen.getByRole("button", { name: "Lưu thông tin" }));
    await waitFor(() =>
      expect(update).toHaveBeenCalledWith({
        id: "IN-1",
        ifMatch: 7,
        payload: {
          doc_date: dayjs().subtract(1, "day").format("YYYY-MM-DD"),
          source_reference: "Nguồn A",
          supplier_id: "SUP-1",
          note: "Ghi chú A",
        },
      }),
    );
  });

  it("chặn lưu phiếu cũ chưa có nhà cung cấp cho đến khi chọn", async () => {
    const date = dayjs().subtract(1, "day").format("YYYY-MM-DD");
    vi.mocked(useInboundDetail).mockReturnValue({
      data: {
        document: {
          id: "IN-1",
          date,
          warehouseId: "WH-1",
          source: "Nguồn A",
          note: "",
          status: "DRAFT",
          version: 7,
        },
        supplier: null,
      },
      isError: false,
      refetch: vi.fn(),
    } as unknown as ReturnType<typeof useInboundDetail>);
    renderWithProviders(
      <InboundDraftModal
        documentId="IN-1"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    fireEvent.click(
      await screen.findByRole("button", { name: "Lưu thông tin" }),
    );

    expect(await screen.findByText("Chọn nhà cung cấp.")).toBeInTheDocument();
    expect(update).not.toHaveBeenCalled();
  });

  it("giữ nhà cung cấp đã chọn khi kết quả tìm kiếm thay đổi", async () => {
    const { rerender } = renderWithProviders(
      <InboundDraftModal
        documentId={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );
    await selectSupplier();
    expect(
      screen.getByRole("combobox", { name: /Nhà cung cấp/ }),
    ).toHaveValue("NCC-001 - Honda");

    vi.mocked(useInboundSupplierSearch).mockReturnValue({
      options: [{ value: "SUP-2", label: "NCC-002 - Yanmar" }],
      loading: false,
      error: null,
      retry: vi.fn(),
      onSearch: vi.fn(),
    });
    rerender(
      <InboundDraftModal
        documentId={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("combobox", { name: /Nhà cung cấp/ }),
    ).toHaveValue("NCC-001 - Honda");
  });

  it("hiện lỗi quyền tải nhà cung cấp và cho thử lại", async () => {
    const retry = vi.fn();
    const forbidden = Object.assign(new Error("Forbidden"), {
      isAxiosError: true,
      response: {
        status: 403,
        data: {
          success: false,
          message: "Bạn không có quyền xem nhà cung cấp.",
          error_code: "ACCESS_DENIED",
        },
      },
    });
    vi.mocked(useInboundSupplierSearch).mockReturnValue({
      options: [],
      loading: false,
      error: forbidden,
      retry,
      onSearch: vi.fn(),
    });
    renderWithProviders(
      <InboundDraftModal
        documentId={null}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />,
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Bạn không có quyền xem nhà cung cấp.",
    );
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(retry).toHaveBeenCalledOnce();
  });
});

describe("IN-01 · attachments during creation", () => {
  async function setup(files: File[]) {
    const onSaved = vi.fn();
    const onClose = vi.fn();
    const onBusyChange = vi.fn();
    renderWithProviders(
      <InboundDraftModal
        documentId={null}
        onSaved={onSaved}
        onClose={onClose}
        onBusyChange={onBusyChange}
      />,
    );
    await selectSupplier();
    const input = await screen.findByLabelText("Chọn chứng từ đính kèm");
    fireEvent.change(input, { target: { files } });
    return { onSaved, onClose, onBusyChange };
  }

  it("keeps selected files local and discards them when closed before creation", async () => {
    const { onClose } = await setup([
      new File(["image"], "delivery.png", { type: "image/png" }),
    ]);
    expect(screen.getByText("delivery.png")).toBeInTheDocument();
    expect(screen.getByText("Đã chọn · Chưa tải lên")).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    expect(uploadDocumentAttachment).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  });

  it("uploads only after create resolves and locks duplicate submissions while uploading", async () => {
    const file = new File(["image"], "delivery.png", { type: "image/png" });
    let finishCreate!: (value: { id: string; code: string }) => void;
    let finishUpload!: () => void;
    create.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishCreate = resolve;
        }),
    );
    vi.mocked(uploadDocumentAttachment).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishUpload = () => resolve({} as never);
        }),
    );
    const { onSaved, onBusyChange } = await setup([file]);
    const submit = screen.getByRole("button", {
      name: "Tạo phiếu & quét hàng",
    });
    fireEvent.click(submit);
    fireEvent.click(submit);
    expect(uploadDocumentAttachment).not.toHaveBeenCalled();
    finishCreate({ id: "IN-NEW", code: "PN-20261107-0001" });
    await waitFor(() =>
      expect(uploadDocumentAttachment).toHaveBeenCalledWith({
        documentType: "INBOUND",
        documentId: "IN-NEW",
        file,
      }),
    );
    expect(create).toHaveBeenCalledOnce();
    expect(onBusyChange).toHaveBeenLastCalledWith(true);
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Đóng" })).toBeDisabled();
    finishUpload();
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("IN-NEW"));
    expect(onBusyChange).toHaveBeenLastCalledWith(false);
  });

  it("retries failed files on the same receipt without uploading successful files again", async () => {
    const first = new File(["one"], "one.png", { type: "image/png" });
    const second = new File(["two"], "two.pdf", { type: "application/pdf" });
    vi.mocked(uploadDocumentAttachment)
      .mockResolvedValueOnce({} as never)
      .mockRejectedValueOnce(new Error("Upload failed"))
      .mockResolvedValueOnce({} as never);
    const { onSaved } = await setup([first, second]);
    fireEvent.click(
      screen.getByRole("button", { name: "Tạo phiếu & quét hàng" }),
    );
    const retry = await screen.findByRole("button", {
      name: "Thử tải lại & quét hàng",
    });
    expect(onSaved).not.toHaveBeenCalled();
    await waitFor(() => expect(retry).toBeEnabled());
    fireEvent.click(retry);
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("IN-NEW"));
    expect(create).toHaveBeenCalledOnce();
    expect(
      vi
        .mocked(uploadDocumentAttachment)
        .mock.calls.map(([input]) => input.file.name),
    ).toEqual(["one.png", "two.pdf", "two.pdf"]);
  });

  it("does not upload files when receipt creation fails", async () => {
    create.mockRejectedValueOnce(new Error("Create failed"));
    const { onSaved } = await setup([
      new File(["one"], "one.png", { type: "image/png" }),
    ]);
    fireEvent.click(
      screen.getByRole("button", { name: "Tạo phiếu & quét hàng" }),
    );
    await waitFor(() => expect(create).toHaveBeenCalledOnce());
    expect(uploadDocumentAttachment).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
    expect(screen.getByText("one.png")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Tạo phiếu & quét hàng" }),
      ).toBeEnabled(),
    );
  });

  it("rejects invalid types and oversized files before creating a receipt", async () => {
    const oversized = new File(["image"], "large.png", { type: "image/png" });
    Object.defineProperty(oversized, "size", { value: 16 * 1024 * 1024 });
    await setup([new File(["script"], "bad.exe"), oversized]);
    expect(screen.queryByText("bad.exe")).not.toBeInTheDocument();
    expect(screen.queryByText("large.png")).not.toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
    expect(uploadDocumentAttachment).not.toHaveBeenCalled();
  });

  it("allows removing a local file before creating the receipt", async () => {
    const { onSaved } = await setup([
      new File(["image"], "remove.png", { type: "image/png" }),
    ]);
    fireEvent.click(
      await screen.findByRole("button", { name: "Bỏ tệp remove.png" }),
    );
    expect(screen.queryByText("remove.png")).not.toBeInTheDocument();
    fireEvent.click(
      screen.getByRole("button", { name: "Tạo phiếu & quét hàng" }),
    );
    await waitFor(() => expect(onSaved).toHaveBeenCalledWith("IN-NEW"));
    expect(uploadDocumentAttachment).not.toHaveBeenCalled();
  });
});
