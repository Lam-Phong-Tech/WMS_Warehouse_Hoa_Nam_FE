import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { cleanupTestState } from "@/test/setup";

vi.mock("@/modules/inventory/hooks/use-inventory", () => ({
  useInventoryBalances: vi.fn(),
  useStockMovements: vi.fn(),
  useStockMovement: vi.fn(() => ({
    data: undefined,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  })),
  useStockMovementTrace: vi.fn(() => ({
    data: undefined,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  })),
  useBalanceSubledger: vi.fn(() => ({
    data: undefined,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  })),
  usePhysicalCodeTrace: vi.fn(() => ({
    data: undefined,
    isError: false,
    isLoading: false,
    refetch: vi.fn(),
  })),
}));

import {
  useInventoryBalances,
  useStockMovements,
} from "@/modules/inventory/hooks/use-inventory";
import { useAuthStore } from "@/shared/store/auth.store";
import InventoryPage from "./InventoryPage";

const BALANCE_ROW = {
  id: "bal-1",
  sku: "SKU-001",
  name: "Máy khoan KT-2000",
  type: "TOOL",
  warehouse: "Kho A",
  stockStatus: "AVAILABLE",
  uom: "cái",
  available: 10,
  onHand: 12,
  serialQty: 3,
  boxQty: 1,
  containerCode: "TRAY-01",
  location: "A-01-01",
  reconcile: "MATCH",
  reconcileNote: "",
  updatedAt: "2026-08-10T00:00:00Z",
  dataAsOf: "2026-08-10T00:00:00Z",
  lastMovementId: "mv-1",
};

const MOVEMENT_ROW = {
  id: "mv-1",
  movementId: "MV-0001",
  time: "2026-08-10T00:00:00Z",
  type: "RECEIPT",
  sku: "SKU-MV-001",
  warehouse: "Kho A",
  lotNo: "LOT-01",
  qty: 10,
  beforeQty: 0,
  afterQty: 10,
  source: "IN-001",
  sourceType: "INBOUND",
  actor: "thukho",
  chain: "Original",
  status: "POSTED",
};

function grant(permissionCodes: string[]) {
  useAuthStore.setState({ isSuperAdmin: false, permissionCodes });
}

function mockQueries(
  overrides: {
    balances?: unknown[];
    balancesError?: boolean;
    balancesLoading?: boolean;
    movements?: unknown[];
    movementsError?: boolean;
  } = {},
) {
  vi.mocked(useInventoryBalances).mockReturnValue({
    data: {
      rows: overrides.balances ?? [BALANCE_ROW],
      meta: { total: (overrides.balances ?? [BALANCE_ROW]).length },
    },
    isLoading: overrides.balancesLoading ?? false,
    isFetching: false,
    isError: overrides.balancesError ?? false,
    error: overrides.balancesError ? new Error("boom") : null,
    refetch: vi.fn(),
  } as never);
  vi.mocked(useStockMovements).mockReturnValue({
    data: {
      rows: overrides.movements ?? [MOVEMENT_ROW],
      meta: { total: (overrides.movements ?? [MOVEMENT_ROW]).length },
    },
    isLoading: false,
    isFetching: false,
    isError: overrides.movementsError ?? false,
    error: overrides.movementsError ? new Error("boom") : null,
    refetch: vi.fn(),
  } as never);
}

describe("InventoryPage (INV-01 hub)", () => {
  beforeEach(() => {
    vi.mocked(useInventoryBalances).mockReset();
    vi.mocked(useStockMovements).mockReset();
    mockQueries();
    grant(["inventory.view", "inventory.trace"]);
  });

  afterEach(() => {
    cleanupTestState();
  });

  it("hiển thị danh sách tồn kho hiện tại với SKU, đối soát và trạng thái", async () => {
    renderWithProviders(<InventoryPage />);

    expect(await screen.findByText("SKU-001")).toBeInTheDocument();
    expect(screen.getByText("Máy khoan KT-2000")).toBeInTheDocument();
    expect(screen.getByText("MATCH")).toBeInTheDocument();
  });

  it("chuyển tab Lịch sử dịch chuyển hiển thị movement", async () => {
    renderWithProviders(<InventoryPage />);
    await screen.findByText("SKU-001");

    fireEvent.click(screen.getByText("Lịch sử dịch chuyển"));

    expect(await screen.findByText("MV-0001")).toBeInTheDocument();
  });

  it("bấm Mở mở BalanceDetailModal chi tiết đúng dòng", async () => {
    renderWithProviders(<InventoryPage />);
    await screen.findByText("SKU-001");

    fireEvent.click(screen.getByRole("button", { name: /Mở/ }));

    expect(
      await screen.findByText(/Chi tiết tồn kho — SKU-001/),
    ).toBeInTheDocument();
  });

  it("nút Trace bị disable khi thiếu quyền inventory.trace (RBAC)", async () => {
    grant(["inventory.view"]);
    renderWithProviders(<InventoryPage />);
    await screen.findByText("SKU-001");

    fireEvent.click(screen.getByText("Lịch sử dịch chuyển"));
    await screen.findByText("MV-0001");

    expect(screen.getByRole("button", { name: /Trace/ })).toBeDisabled();
    // Không có quyền trace thì cũng không hiện nút "Truy vết mã" toolbar.
    expect(screen.queryByText("Truy vết mã")).not.toBeInTheDocument();
  });

  it("có quyền inventory.trace: nút Trace khả dụng và mở TraceModal theo movementId", async () => {
    grant(["inventory.view", "inventory.trace"]);
    renderWithProviders(<InventoryPage />);
    await screen.findByText("SKU-001");

    fireEvent.click(screen.getByText("Lịch sử dịch chuyển"));
    await screen.findByText("MV-0001");

    const traceButton = screen.getByRole("button", { name: /Trace/ });
    expect(traceButton).toBeEnabled();
    fireEvent.click(traceButton);

    expect(
      await screen.findByText("Truy vết chứng từ nguồn (TRACE-01)"),
    ).toBeInTheDocument();
  });

  it("hiển thị ApiErrorAlert kèm nút thử lại khi tải tồn kho lỗi", async () => {
    mockQueries({ balancesError: true, balances: [] });
    renderWithProviders(<InventoryPage />);

    expect(
      await screen.findByText("Không thể tải tồn kho hiện tại"),
    ).toBeInTheDocument();
  });

  it("empty state hiển thị đúng thông báo khi không có dữ liệu tồn kho theo bộ lọc", async () => {
    mockQueries({ balances: [] });
    renderWithProviders(<InventoryPage />);

    expect(
      await screen.findByText("Không có tồn kho theo bộ lọc hiện tại"),
    ).toBeInTheDocument();
  });

  // Annex D SCR-INV-01 "Filter SKU/type/status": status là stock_status theo ERD bảng 29
  // (AVAILABLE/NON_SELLABLE/DEFECTIVE/QUARANTINE), không phải định mức tồn an toàn.
  it("lọc trạng thái tồn gọi lại API với stock_status theo ERD bảng 29", async () => {
    renderWithProviders(<InventoryPage />);
    await screen.findByText("SKU-001");

    fireEvent.change(screen.getByLabelText("Lọc trạng thái tồn"), {
      target: { value: "DEFECTIVE" },
    });

    await waitFor(() => {
      expect(useInventoryBalances).toHaveBeenLastCalledWith(
        expect.objectContaining({ stock_status: "DEFECTIVE", page: 1 }),
      );
    });
  });

  it("lọc loại hàng gọi lại API với sku_type", async () => {
    renderWithProviders(<InventoryPage />);
    await screen.findByText("SKU-001");

    fireEvent.change(screen.getByLabelText("Lọc loại hàng"), {
      target: { value: "COMPONENT" },
    });

    await waitFor(() => {
      expect(useInventoryBalances).toHaveBeenLastCalledWith(
        expect.objectContaining({ sku_type: "COMPONENT", page: 1 }),
      );
    });
  });

  it("deep-link ?screen=TRACE-01&id=mv-9 mở TraceModal đúng movement", async () => {
    renderWithProviders(<InventoryPage />, [
      "/inventory?screen=TRACE-01&id=mv-9",
    ]);

    expect(
      await screen.findByText("Truy vết chứng từ nguồn (TRACE-01)"),
    ).toBeInTheDocument();
  });
});
