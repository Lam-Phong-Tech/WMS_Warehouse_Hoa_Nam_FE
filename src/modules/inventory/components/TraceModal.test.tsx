import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
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
      screen.getByText(/Chọn một movement từ danh sách tồn kho/),
    ).toBeInTheDocument();
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
    expect(screen.getByText("POSTED")).toBeInTheDocument();
    expect(screen.getByText(/DRAFT → POSTED/)).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /Tra cứu/ }));

    expect(await screen.findByText("ITEM")).toBeInTheDocument();
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
    fireEvent.click(screen.getByRole("button", { name: /Tra cứu/ }));

    expect(await screen.findByText("CONTAINER")).toBeInTheDocument();
    expect(screen.getByText(/Container Items \(1\)/)).toBeInTheDocument();
  });

  it("hiển thị ApiErrorAlert khi tra cứu mã vật lý không tìm thấy", async () => {
    vi.mocked(usePhysicalCodeTrace).mockReturnValue(
      emptyQuery({ isError: true, error: new Error("not found") }) as never,
    );

    renderWithProviders(<TraceModal movementId={null} onClose={() => {}} />);

    fireEvent.change(screen.getByLabelText("Tra cứu mã vật lý"), {
      target: { value: "UNKNOWN-CODE" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Tra cứu/ }));

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
      await screen.findByText("Không thể truy vết nguồn movement"),
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

    expect(
      await screen.findByText("Backend chưa trả timeline/chain."),
    ).toBeInTheDocument();
  });

  it("nút Tra cứu bị disable khi ô nhập trống", () => {
    renderWithProviders(<TraceModal movementId={null} onClose={() => {}} />);

    expect(screen.getByRole("button", { name: /Tra cứu/ })).toBeDisabled();
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
});
