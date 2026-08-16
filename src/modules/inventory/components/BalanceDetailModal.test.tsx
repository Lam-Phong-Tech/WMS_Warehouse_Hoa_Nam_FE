import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/inventory/hooks/use-inventory", () => ({
  useStockMovements: vi.fn(),
  useBalanceSubledger: vi.fn(),
}));

import {
  useBalanceSubledger,
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
  lotNo: "LOT-01",
  uom: "cái",
  available: 10,
  onHand: 12,
  reserved: 2,
  inTransit: 0,
  blocked: 0,
  serialQty: 1,
  boxQty: 1,
  location: "A-01-01",
  reconcile: "MATCH",
  reconcileNote: "",
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
    expect(screen.getByText("MATCH")).toBeInTheDocument();
    expect(screen.getByText("ITM-001")).toBeInTheDocument();
    expect(screen.getByText("BOX-001")).toBeInTheDocument();
    expect(screen.getByText("MV-0001")).toBeInTheDocument();
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
      await screen.findByText("Không có item instance"),
    ).toBeInTheDocument();
    expect(screen.getByText("Không có container")).toBeInTheDocument();
    expect(screen.getByText("Không có movement liên quan")).toBeInTheDocument();
  });

  it("hiển thị ApiErrorAlert kèm nút thử lại khi tải subledger lỗi", async () => {
    mockSubledger({ isError: true, items: [], containers: [] });

    renderWithProviders(
      <BalanceDetailModal balance={BALANCE} onClose={() => {}} />,
    );

    expect(
      await screen.findByText("Không tải được subledger"),
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

    await screen.findByText("MV-0001");
    fireEvent.click(screen.getByRole("button", { name: /Trace/ }));

    expect(onTraceMovement).toHaveBeenCalledWith("mv-1");
  });

  it("không hiện nút Trace khi thiếu quyền inventory.trace (onTraceMovement=undefined, DEV211-P1-04)", async () => {
    renderWithProviders(
      <BalanceDetailModal balance={BALANCE} onClose={() => {}} />,
    );

    await screen.findByText("MV-0001");
    expect(
      screen.queryByRole("button", { name: /Trace/ }),
    ).not.toBeInTheDocument();
  });
});
