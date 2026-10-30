import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/inventory/hooks/use-inventory", () => ({
  useStockMovements: vi.fn(),
  useBalanceSubledger: vi.fn(),
  useBoxReadProjection: vi.fn(),
  useContainerRegisterDetail: vi.fn(),
}));

import {
  useBalanceSubledger,
  useBoxReadProjection,
  useContainerRegisterDetail,
  useStockMovements,
} from "@/modules/inventory/hooks/use-inventory";
import type { InventoryBalanceRow } from "@/modules/inventory/services/inventoryService";
import { BalanceDetailModal } from "./BalanceDetailModal";

const BALANCE: InventoryBalanceRow = {
  id: "bal-1",
  sku: "SKU-001",
  name: "Máy khoan KT-2000",
  type: "TOOL",
  warehouse: "Kho A",
  stockStatus: "AVAILABLE",
  uom: "cái",
  available: 10,
  onHand: 12,
  serialQty: 1,
  boxQty: 1,
  containerCode: "BOX-01",
  trayCode: "TRAY-01",
  location: "A-01-01",
  reconcile: "MATCH",
  reconcileNote: "",
  ledgerTotal: 12,
  variance: 0,
  reservedQty: 2,
  incidentId: null,
  incidentStatus: null,
  updatedAt: "2026-08-10T00:00:00Z",
  dataAsOf: "2026-08-10T00:00:00Z",
  lastMovementId: "mv-1",
};

function mockSubledger(
  overrides: {
    items?: Record<string, unknown>[];
    containers?: Record<string, unknown>[];
    isError?: boolean;
    isLoading?: boolean;
  } = {},
) {
  vi.mocked(useBalanceSubledger).mockReturnValue({
    data: {
      balance_id: "bal-1",
      product_id: "p-1",
      warehouse_id: "w-1",
      items: overrides.items ?? [
        {
          id: "item-1",
          item_code: "ITM-001",
          serial_number: "SN-001",
          status: "IN_STOCK",
          physical_code: "QR-001",
        },
      ],
      containers: overrides.containers ?? [
        {
          id: "cont-1",
          container_code: "BOX-001",
          container_type: "BOX",
          quantity: 5,
        },
      ],
      item_count: (overrides.items ?? [{}]).length,
      container_count: (overrides.containers ?? [{}]).length,
    },
    isLoading: overrides.isLoading ?? false,
    isError: overrides.isError ?? false,
    error: overrides.isError ? new Error("boom") : null,
    refetch: vi.fn(),
  } as never);
}

function mockMovements(rows: Record<string, unknown>[] = []) {
  vi.mocked(useStockMovements).mockReturnValue({
    data: { rows, meta: { total: rows.length } },
    isLoading: false,
    isFetching: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as never);
}

describe("BalanceDetailModal", () => {
  beforeEach(() => {
    vi.mocked(useBalanceSubledger).mockReset();
    vi.mocked(useStockMovements).mockReset();
    mockSubledger();
    vi.mocked(useBoxReadProjection).mockReturnValue({
      data: {
        container_id: "cont-1", container_code: "BOX-001", container_type: "BOX",
        status: "OPEN", sku: { id: "p-1", code: "SKU-001", name: "Máy khoan", unit: "cái" },
        contained_qty: 5, quantity_status: "RECORDED_CONTAINER_CONTENTS",
        available_qty: null, reserved_qty: null, parent_container_id: null, location_hint: "A-01",
      },
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as never);
    vi.mocked(useContainerRegisterDetail).mockReturnValue({
      data: { container_id: "tray-1", container_code: "KH-001", container_type: "TRAY", status: "OPEN", parent_container_id: null, location_hint: "A-01", items: [] },
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as never);
    mockMovements([
      {
        id: "mv-1",
        movementId: "MV-0001",
        time: "2026-08-10T00:00:00Z",
        type: "RECEIPT",
        source: "IN-001",
        sourceType: "INBOUND",
        qty: 10,
      },
    ]);
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("hiển thị chi tiết tồn kho: SKU, đối soát, item subledger, container subledger, movement liên quan", async () => {
    renderWithProviders(
      <BalanceDetailModal balance={BALANCE} onClose={() => {}} />,
    );

    expect(
      await screen.findByText(/Chi tiết tồn kho — SKU-001/),
    ).toBeInTheDocument();
    // i18n: reconcile MATCH render qua RECONCILE_STATUS_LABELS thành "Khớp".
    expect(screen.getByText("Khớp")).toBeInTheDocument();
    expect(screen.getByText("ITM-001")).toBeInTheDocument();
    expect(screen.getByText("BOX-001")).toBeInTheDocument();
    expect(screen.getByText("MV-0001")).toBeInTheDocument();
  });

  it("cột Mã NFC: hiện mã chip của hiện vật đã dán, không lẫn với Mã vật lý", async () => {
    mockSubledger({
      items: [
        {
          id: "item-1",
          item_code: "ITM-001",
          serial_number: "SN-001",
          status: "IN_STOCK",
          physical_code: "QR-001",
          nfc_code: "NFC-04A2B3C4D5",
          nfc_hardware_uid: "04A2B3C4D5",
          nfc_status: "ASSIGNED",
        },
      ],
    });

    renderWithProviders(
      <BalanceDetailModal balance={BALANCE} onClose={() => {}} />,
    );

    expect(await screen.findByText("Mã NFC")).toBeInTheDocument();
    expect(screen.getByText("NFC-04A2B3C4D5")).toBeInTheDocument();
    // Mã in vẫn đứng riêng ở cột Mã vật lý — hai ô không được nuốt nhau.
    expect(screen.getByText("QR-001")).toBeInTheDocument();
  });

  it("cột Mã NFC: hiện vật chưa dán chip hiển thị rõ trạng thái, không để trống", async () => {
    // Chip dán lúc xuất kho nên hàng đang trong kho thường chưa có — ô phải nói
    // rõ "chưa dán chip" chứ không phải dấu gạch hay khoảng trắng.
    renderWithProviders(
      <BalanceDetailModal balance={BALANCE} onClose={() => {}} />,
    );

    expect(await screen.findByText("Chưa dán chip")).toBeInTheDocument();
  });

  it("gọi useBalanceSubledger và useStockMovements đúng tham số (subledger theo balance.id, movement theo SKU)", () => {
    renderWithProviders(
      <BalanceDetailModal balance={BALANCE} onClose={() => {}} />,
    );

    expect(useBalanceSubledger).toHaveBeenCalledWith("bal-1");
    expect(useStockMovements).toHaveBeenCalledWith(
      expect.objectContaining({ search: "SKU-001", per_page: 10 }),
    );
  });

  it("empty state: không có item/container/movement liên quan", async () => {
    mockSubledger({ items: [], containers: [] });
    mockMovements([]);

    renderWithProviders(
      <BalanceDetailModal balance={BALANCE} onClose={() => {}} />,
    );

    expect(
      await screen.findByText("Không có sản phẩm cụ thể"),
    ).toBeInTheDocument();
    expect(screen.getByText("Không có vật chứa")).toBeInTheDocument();
    expect(
      screen.getByText("Không có biến động liên quan"),
    ).toBeInTheDocument();
  });

  it("hiển thị ApiErrorAlert kèm nút thử lại khi tải subledger lỗi", async () => {
    mockSubledger({ isError: true, items: [], containers: [] });

    renderWithProviders(
      <BalanceDetailModal balance={BALANCE} onClose={() => {}} />,
    );

    expect(
      await screen.findByText("Không tải được chi tiết tồn kho"),
    ).toBeInTheDocument();
  });

  it("bấm Trace trên movement liên quan gọi onTraceMovement với đúng movementId", async () => {
    const onTraceMovement = vi.fn();
    renderWithProviders(
      <BalanceDetailModal
        balance={BALANCE}
        onClose={() => {}}
        onTraceMovement={onTraceMovement}
      />,
    );

    fireEvent.click(await screen.findByRole("button", { name: /Truy vết/ }));

    expect(onTraceMovement).toHaveBeenCalledWith("mv-1");
  });

  it("không hiện nút Trace khi thiếu quyền inventory.trace (onTraceMovement=undefined, DEV211-P1-04)", async () => {
    renderWithProviders(
      <BalanceDetailModal balance={BALANCE} onClose={() => {}} />,
    );

    await screen.findByText("MV-0001");
    expect(
      screen.queryByRole("button", { name: /Truy vết/ }),
    ).not.toBeInTheDocument();
  });

  it("opens the recorded BOX projection and does not turn unknown reserve into zero", async () => {
    renderWithProviders(<BalanceDetailModal balance={BALANCE} onClose={() => {}} />);

    fireEvent.click(await screen.findByRole("button", { name: "Xem BOX BOX-001" }));
    const boxDialog = await screen.findByRole("dialog", { name: /Chi tiết BOX-001/ });
    expect(useBoxReadProjection).toHaveBeenCalledWith("cont-1", "w-1");
    expect(within(boxDialog).getByText("5")).toBeInTheDocument();
    expect(within(boxDialog).getByText(/chưa có dữ liệu lượng giữ và khả dụng/)).toBeInTheDocument();
    expect(within(boxDialog).queryByText(/Đã giữ.*0/)).not.toBeInTheDocument();
  });

  it("follows a recorded BOX parent to its tray register without claiming physical placement", async () => {
    vi.mocked(useBoxReadProjection).mockReturnValue({
      data: {
        container_id: "cont-1", container_code: "BOX-001", container_type: "BOX",
        status: "OPEN", sku: null, contained_qty: 5,
        quantity_status: "RECORDED_CONTAINER_CONTENTS", available_qty: null,
        reserved_qty: null, parent_container_id: "tray-1", location_hint: "A-01",
      },
      isLoading: false, isError: false, error: null, refetch: vi.fn(),
    } as never);
    renderWithProviders(<BalanceDetailModal balance={BALANCE} onClose={() => {}} />);
    fireEvent.click(await screen.findByRole("button", { name: "Xem BOX BOX-001" }));
    fireEvent.click(await screen.findByRole("button", { name: /Xem khay liên kết/ }));
    expect(useContainerRegisterDetail).toHaveBeenCalledWith("tray-1");
    expect(await screen.findByText("KH-001")).toBeInTheDocument();
    expect(screen.getByText(/chưa xác nhận vị trí vật lý/)).toBeInTheDocument();
  });
});
