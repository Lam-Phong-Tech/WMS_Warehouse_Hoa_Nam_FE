import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/inventory/hooks/use-inventory", () => ({
  useStockMovement: vi.fn(),
  useStockMovementTrace: vi.fn(),
  usePhysicalCodeTrace: vi.fn(),
}));

import {
  usePhysicalCodeTrace,
  useStockMovement,
  useStockMovementTrace,
} from "@/modules/inventory/hooks/use-inventory";
import { TraceModal } from "./TraceModal";
import { SEMANTIC_LIGHT } from "@/shared/ui";

function emptyQuery(overrides: Record<string, unknown> = {}) {
  return {
    data: undefined,
    isLoading: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

function mockSource(overrides: Record<string, unknown> = {}) {
  vi.mocked(useStockMovementTrace).mockReturnValue(
    emptyQuery({
      data: {
        movementId: "mv-1",
        sourceType: "OUTBOUND",
        sourceCode: "OUT-001",
        status: "POSTED",
        postedAt: "2026-08-10T00:00:00Z",
        actor: "Nguyễn Thủ Kho",
        requestId: "technical-request-id",
        summary: {},
        lines: [],
        timeline: [],
        chain: [],
        chainTruncated: false,
        netEffect: null,
        ...overrides,
      },
    }) as never,
  );
}

async function chooseTab(name: string) {
  fireEvent.click(await screen.findByRole("tab", { name }));
}

describe("TraceModal (TRACE-01)", () => {
  beforeEach(() => {
    vi.mocked(useStockMovement).mockReset();
    vi.mocked(useStockMovementTrace).mockReset();
    vi.mocked(usePhysicalCodeTrace).mockReset();
    vi.mocked(useStockMovement).mockReturnValue(emptyQuery() as never);
    vi.mocked(useStockMovementTrace).mockReturnValue(emptyQuery() as never);
    vi.mocked(usePhysicalCodeTrace).mockReturnValue(emptyQuery() as never);
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("chưa chọn movement và chưa tra cứu mã: hiện hướng dẫn ban đầu", () => {
    renderWithProviders(<TraceModal movementId={null} onClose={() => {}} />);

    expect(
      screen.getByText(/Chọn một biến động tồn kho từ danh sách/),
    ).toBeInTheDocument();
  });

  it("mở từ báo cáo với mã vật lý có sẵn thì truy vết mã ngay", async () => {
    renderWithProviders(
      <TraceModal
        movementId={null}
        initialCode="RFID-BOX-1"
        onClose={() => {}}
      />,
    );

    expect(screen.getByLabelText("Tra cứu mã vật lý")).toHaveValue(
      "RFID-BOX-1",
    );
    expect(usePhysicalCodeTrace).toHaveBeenCalledWith("RFID-BOX-1");
  });

  it("truy vết theo movementId: hiển thị chi tiết movement + chứng từ nguồn + timeline (DEV211-P1-01)", async () => {
    vi.mocked(useStockMovement).mockReturnValue(
      emptyQuery({
        data: {
          movement_no: "MV-0001",
          occurred_at: "2026-08-10T00:00:00Z",
          movement_type: "RECEIPT",
          sku: "SKU-001",
          warehouse_name: "Kho A",
          qty_change: 10,
        },
      }) as never,
    );
    vi.mocked(useStockMovementTrace).mockReturnValue(
      emptyQuery({
        data: {
          movementId: "mv-1",
          sourceType: "INBOUND",
          sourceCode: "IN-001",
          status: "POSTED",
          postedAt: "2026-08-10T00:00:00Z",
          actor: "thukho",
          requestId: "req-1",
          summary: {},
          lines: [{ sku: "SKU-001", quantity: 5, status: "OK" }],
          timeline: [{ from_status: "DRAFT", to_status: "POSTED" }],
        },
      }) as never,
    );

    renderWithProviders(<TraceModal movementId="mv-1" onClose={() => {}} />);

    expect(await screen.findByText("MV-0001")).toBeInTheDocument();
    expect(screen.getByText("IN-001")).toBeInTheDocument();
    expect(screen.getByText("Phiếu nhập")).toBeInTheDocument();
    // request_id là mã đối chiếu log, không phải thông tin nghiệp vụ — không
    // hiện ra màn (phản ánh 10/09/2026).
    expect(screen.queryByText("req-1")).not.toBeInTheDocument();
    expect(screen.queryByText("Mã yêu cầu kỹ thuật")).not.toBeInTheDocument();
    // i18n: status POSTED render qua statusLabel thành "Đã nhập kho".
    expect(screen.getByText("Đã nhập kho")).toBeInTheDocument();
    expect(screen.queryByText(/Nháp → Đã nhập kho/)).not.toBeInTheDocument();
    await chooseTab("Lịch sử & điều chỉnh");
    expect(await screen.findByText(/Nháp → Đã nhập kho/)).toBeInTheDocument();
  });

  it("truy vết theo mã vật lý loại ITEM: hiển thị SKU/serial, không phải chỉ SKU approximation (DEV211-P1-01)", async () => {
    vi.mocked(usePhysicalCodeTrace).mockReturnValue(
      emptyQuery({
        data: {
          physical_code: {
            code_value: "SN-ITEM-1",
            carrier_type: "QR",
            status: "ACTIVE",
          },
          resolved_type: "ITEM",
          resolved_id: "item-1",
          resolved_object: {
            sku_code: "SKU-001",
            sku_name: "Máy khoan",
            status: "IN_STOCK",
          },
          movements: [],
          container_items: [],
        },
      }) as never,
    );

    renderWithProviders(<TraceModal movementId={null} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Tra cứu mã vật lý"), {
      target: { value: "SN-ITEM-1" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /Tra cứu/ }));

    // i18n: resolved_type ITEM render qua SCAN_CLASSIFICATION_LABELS.
    expect(await screen.findByText("Sản phẩm cụ thể")).toBeInTheDocument();
    expect(screen.getByText("SKU-001")).toBeInTheDocument();
  });

  it("truy vết theo mã vật lý loại CONTAINER: hiển thị container_items khác với item/SKU", async () => {
    vi.mocked(usePhysicalCodeTrace).mockReturnValue(
      emptyQuery({
        data: {
          physical_code: {
            code_value: "RFID-BOX-1",
            carrier_type: "RFID",
            status: "ACTIVE",
          },
          resolved_type: "CONTAINER",
          resolved_id: "box-1",
          resolved_object: { container_code: "BOX-001", container_type: "BOX" },
          movements: [],
          container_items: [
            {
              container_code: "BOX-001",
              container_type: "BOX",
              quantity: 3,
              status: "SEALED",
            },
          ],
        },
      }) as never,
    );

    renderWithProviders(<TraceModal movementId={null} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Tra cứu mã vật lý"), {
      target: { value: "RFID-BOX-1" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /Tra cứu/ }));

    // i18n: nhánh CONTAINER hiện mô tả "Mã vật chứa" + bảng sản phẩm trong vật chứa.
    expect(await screen.findByText("Mã vật chứa")).toBeInTheDocument();
    expect(
      screen.queryByText(/Sản phẩm trong vật chứa \(1\)/),
    ).not.toBeInTheDocument();
    await chooseTab("Dữ liệu liên quan");
    expect(
      await screen.findByText(/Sản phẩm trong vật chứa \(1\)/),
    ).toBeInTheDocument();
  });

  it("hiển thị ApiErrorAlert khi tra cứu mã vật lý không tìm thấy", async () => {
    vi.mocked(usePhysicalCodeTrace).mockReturnValue(
      emptyQuery({ isError: true, error: new Error("not found") }) as never,
    );

    renderWithProviders(<TraceModal movementId={null} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Tra cứu mã vật lý"), {
      target: { value: "UNKNOWN-CODE" },
    });
    fireEvent.click(await screen.findByRole("button", { name: /Tra cứu/ }));

    expect(
      await screen.findByText("Không tìm thấy mã vật lý"),
    ).toBeInTheDocument();
  });

  it("hiển thị ApiErrorAlert khi không truy vết được nguồn movement", async () => {
    vi.mocked(useStockMovement).mockReturnValue(
      emptyQuery({ data: { id: "mv-1" } }) as never,
    );
    vi.mocked(useStockMovementTrace).mockReturnValue(
      emptyQuery({ isError: true, error: new Error("boom") }) as never,
    );

    renderWithProviders(<TraceModal movementId="mv-1" onClose={() => {}} />);

    expect(
      await screen.findByText("Không thể truy vết chứng từ nguồn"),
    ).toBeInTheDocument();
  });

  it("timeline rỗng: hiện ghi chú backend chưa trả timeline/chain thay vì trống trơn", async () => {
    vi.mocked(useStockMovementTrace).mockReturnValue(
      emptyQuery({
        data: {
          movementId: "mv-1",
          sourceType: "INBOUND",
          sourceCode: "IN-001",
          status: "POSTED",
          postedAt: "",
          actor: "-",
          requestId: "",
          summary: {},
          lines: [],
          timeline: [],
        },
      }) as never,
    );

    renderWithProviders(<TraceModal movementId="mv-1" onClose={() => {}} />);

    await chooseTab("Lịch sử & điều chỉnh");
    expect(
      await screen.findByText("Chưa có dữ liệu diễn biến để hiển thị."),
    ).toBeInTheDocument();
  });

  it("nút Tra cứu bị disable khi ô nhập trống", async () => {
    renderWithProviders(<TraceModal movementId={null} onClose={() => {}} />);

    expect(
      await screen.findByRole("button", { name: /Tra cứu/ }),
    ).toBeDisabled();
  });

  it("Enter trong ô tra cứu kích hoạt lookup giống bấm nút", async () => {
    vi.mocked(usePhysicalCodeTrace).mockReturnValue(
      emptyQuery({
        data: {
          physical_code: { code_value: "SKU-CODE-1" },
          resolved_type: "SKU",
          resolved_id: "sku-1",
          resolved_object: { sku_code: "SKU-001", sku_name: "Máy khoan" },
          movements: [],
          container_items: [],
        },
      }) as never,
    );

    renderWithProviders(<TraceModal movementId={null} onClose={() => {}} />);

    const input = screen.getByLabelText("Tra cứu mã vật lý");
    fireEvent.change(input, { target: { value: "SKU-CODE-1" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(await screen.findByText("SKU")).toBeInTheDocument();
  });

  it("uses a named right drawer, focuses within it and closes through its close action", async () => {
    const onClose = vi.fn();
    renderWithProviders(<TraceModal movementId={null} onClose={onClose} />);
    const drawer = await screen.findByRole("dialog", { name: /Truy vết/ });
    expect(drawer.closest(".MuiDrawer-root")).toHaveClass(
      "MuiDrawer-anchorRight",
    );
    await waitFor(() =>
      expect(drawer.contains(document.activeElement)).toBe(true),
    );
    fireEvent.click(within(drawer).getByRole("button", { name: "Đóng" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("labels posted outbound source and timeline as issued stock", async () => {
    mockSource({ timeline: [{ from_status: "DRAFT", to_status: "POSTED" }] });
    renderWithProviders(<TraceModal movementId="mv-1" onClose={() => {}} />);
    expect(
      await screen.findByRole("tab", { name: "Tổng quan" }),
    ).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("Đã xuất kho")).toBeInTheDocument();
    expect(screen.getByText("Phiếu xuất")).toBeInTheDocument();
    expect(screen.queryByText("Đã nhập kho")).not.toBeInTheDocument();
    expect(screen.queryByText(/Nháp → Đã xuất kho/)).not.toBeInTheDocument();
    await chooseTab("Lịch sử & điều chỉnh");
    expect(await screen.findByText(/Nháp → Đã xuất kho/)).toBeInTheDocument();
    expect(screen.queryByText(/Nháp → Đã nhập kho/)).not.toBeInTheDocument();
  });

  it.each([
    ["CANCELLED", "Đã hủy", SEMANTIC_LIGHT.errorText],
    ["DRAFT", "Nháp", SEMANTIC_LIGHT.secondaryDark],
  ])(
    "keeps the semantic source status color for %s",
    async (status, label, color) => {
      mockSource({ status });
      renderWithProviders(<TraceModal movementId="mv-1" onClose={() => {}} />);
      const badge = (await screen.findByText(label)).closest(".MuiChip-root");
      expect(badge).not.toBeNull();
      expect(badge).toHaveStyle({ color });
    },
  );

  it("keeps unknown net-effect values distinct from zero", async () => {
    mockSource({
      netEffect: {
        originalMovementType: "ISSUE",
        originalQty: null,
        reversedQty: null,
        remainingReversibleQty: null,
        netQtyDelta: null,
        fullyReversed: null,
        reversalCount: null,
      },
    });
    renderWithProviders(<TraceModal movementId="mv-1" onClose={() => {}} />);
    await screen.findByText("Tác động tồn kho sau điều chỉnh");
    for (const label of [
      "Số lượng gốc",
      "Đã điều chỉnh",
      "Còn điều chỉnh được",
      "Tác động ròng",
    ]) {
      const field = screen.getByText(label).parentElement!;
      expect(within(field).getByText("Chưa có")).toBeInTheDocument();
      expect(within(field).queryByText("0")).not.toBeInTheDocument();
    }
    expect(screen.getByText("Chưa xác định")).toBeInTheDocument();
  });

  it("paginates related document records without losing their secondary fields or null quantities", async () => {
    mockSource({
      lines: Array.from({ length: 11 }, (_, index) => ({
        sku: `SKU-TRACE-${index + 1}`,
        product_name: `Sản phẩm ${index + 1}`,
        quantity: index === 10 ? null : index + 1,
        status: "POSTED",
      })),
    });
    renderWithProviders(<TraceModal movementId="mv-1" onClose={() => {}} />);
    expect(screen.queryByText("SKU-TRACE-1")).not.toBeInTheDocument();
    await chooseTab("Dữ liệu liên quan");
    expect(await screen.findByText("SKU-TRACE-1")).toBeInTheDocument();
    expect(screen.queryByText("SKU-TRACE-11")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    const record = (await screen.findByText("SKU-TRACE-11")).closest("li")!;
    fireEvent.click(within(record).getByText("Thông tin chi tiết"));
    expect(within(record).getByText("Sản phẩm 11")).toBeVisible();
    expect(within(record).getByText("Đã xuất kho")).toBeInTheDocument();
    expect(within(record).getByText(/Chưa có/)).toBeInTheDocument();
    expect(within(record).queryByText("0")).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it("keeps correction movement identity, quantity, actor and reason available in history", async () => {
    mockSource({
      chain: [
        {
          id: "reversal-movement-1",
          movement_no: "MOV-REVERSAL-001",
          role: "REVERSAL",
          movement_type: "REVERSAL",
          qty_delta: -2,
          actor: "Nguyễn Kiểm Kho",
          reason_text: "Điều chỉnh nhầm máy",
        },
      ],
      chainTruncated: true,
    });
    renderWithProviders(<TraceModal movementId="mv-1" onClose={() => {}} />);
    expect(screen.queryByText("MOV-REVERSAL-001")).not.toBeInTheDocument();
    await chooseTab("Lịch sử & điều chỉnh");
    const record = (await screen.findByText("MOV-REVERSAL-001")).closest("li")!;
    expect(within(record).getByText("-2")).toBeVisible();
    fireEvent.click(within(record).getByText("Thông tin chi tiết"));
    expect(within(record).getByText("Nguyễn Kiểm Kho")).toBeVisible();
    expect(within(record).getByText("Điều chỉnh nhầm máy")).toBeVisible();
    expect(screen.getByText(/chuỗi quá dài, đã rút gọn/)).toBeInTheDocument();
  });

  it("keeps source errors and retry available after changing tabs", async () => {
    const refetch = vi.fn();
    vi.mocked(useStockMovement).mockReturnValue(
      emptyQuery({ data: { movement_no: "MV-0001" } }) as never,
    );
    vi.mocked(useStockMovementTrace).mockReturnValue(
      emptyQuery({
        isError: true,
        error: new Error("source unavailable"),
        refetch,
      }) as never,
    );
    renderWithProviders(<TraceModal movementId="mv-1" onClose={() => {}} />);
    await chooseTab("Lịch sử & điều chỉnh");
    const alert = (
      await screen.findByText("Không thể truy vết chứng từ nguồn")
    ).closest<HTMLElement>('[role="alert"]')!;
    fireEvent.click(within(alert).getByRole("button", { name: "Thử lại" }));
    expect(refetch).toHaveBeenCalledTimes(1);
    expect(useStockMovement).toHaveBeenCalledWith("mv-1");
    expect(useStockMovementTrace).toHaveBeenCalledWith("mv-1");
  });

  it("submits trimmed lookup codes and keeps the lookup available from history", async () => {
    mockSource();
    renderWithProviders(<TraceModal movementId="mv-1" onClose={() => {}} />);
    await chooseTab("Lịch sử & điều chỉnh");
    const input = screen.getByLabelText("Tra cứu mã vật lý");
    fireEvent.change(input, { target: { value: "  QR-LOOKUP-1  " } });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(usePhysicalCodeTrace).toHaveBeenLastCalledWith("QR-LOOKUP-1"),
    );
  });
});
