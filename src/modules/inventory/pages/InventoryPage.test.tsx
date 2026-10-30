import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
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
  containerCode: "BOX-01",
  trayCode: "TRAY-01",
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
    balancesTotal?: number;
    movements?: unknown[];
    movementsError?: boolean;
    movementsTotal?: number;
  } = {},
) {
  const balanceRefetch = vi.fn();
  const movementRefetch = vi.fn();
  vi.mocked(useInventoryBalances).mockReturnValue({
    data: {
      rows: overrides.balances ?? [BALANCE_ROW],
      meta: {
        total:
          overrides.balancesTotal ??
          (overrides.balances ?? [BALANCE_ROW]).length,
      },
    },
    isLoading: overrides.balancesLoading ?? false,
    isFetching: false,
    isError: overrides.balancesError ?? false,
    error: overrides.balancesError ? new Error("boom") : null,
    refetch: balanceRefetch,
  } as never);
  vi.mocked(useStockMovements).mockReturnValue({
    data: {
      rows: overrides.movements ?? [MOVEMENT_ROW],
      meta: {
        total:
          overrides.movementsTotal ??
          (overrides.movements ?? [MOVEMENT_ROW]).length,
      },
    },
    isLoading: false,
    isFetching: false,
    isError: overrides.movementsError ?? false,
    error: overrides.movementsError ? new Error("boom") : null,
    refetch: movementRefetch,
  } as never);
  return { balanceRefetch, movementRefetch };
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

  it("đặt nút Làm mới và Truy vết mã cạnh tiêu đề, bỏ nhãn phụ và mô tả", () => {
    const { balanceRefetch } = mockQueries();
    useAuthStore.setState({
      isSuperAdmin: true,
      currentContext: {
        scope_type: "he_thong",
        org_unit_name: null,
        department_name: null,
        warehouse_name: null,
        role_name: "Super Admin",
      } as never,
    });
    renderWithProviders(<InventoryPage />, ["/inventory?screen=INV-01"]);

    const heading = screen.getByRole("heading", {
      name: "Tra cứu tồn & đối soát",
    });
    const header = heading.closest("section");
    expect(header).not.toBeNull();
    expect(header).toContainElement(
      screen.getByRole("button", { name: "Làm mới" }),
    );
    expect(header).toContainElement(
      screen.getByRole("button", { name: "Truy vết mã" }),
    );
    expect(header).not.toHaveTextContent("TỒN KHO & TRUY VẾT");
    expect(header).not.toHaveTextContent("Tra cứu tồn và đối soát.");
    expect(header).not.toHaveTextContent("Toàn hệ thống");
    expect(header).not.toHaveTextContent("Super Admin");

    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    expect(balanceRefetch).toHaveBeenCalledOnce();
  });

  it("hiển thị danh sách tồn kho hiện tại với SKU, đối soát và trạng thái", async () => {
    renderWithProviders(<InventoryPage />);

    expect(await screen.findByText("SKU-001")).toBeInTheDocument();
    expect(screen.getByText("Máy khoan KT-2000")).toBeInTheDocument();
    // i18n: reconcile MATCH render qua RECONCILE_STATUS_LABELS thành "Khớp";
    // so trong dòng dữ liệu để không đụng chú thích chân bảng.
    const cell = screen.getByText("SKU-001");
    const row = cell.closest('[role="row"]') ?? cell.closest("tr");
    expect(row).not.toBeNull();
    expect(within(row as HTMLElement).getByText("Khớp")).toBeInTheDocument();
  });

  // Cột checkbox "chọn nhiều" ở bảng tồn kho đã gỡ: lựa chọn không dẫn tới
  // hành động hàng loạt nào (không xuất, không đổi trạng thái theo lô), chỉ tô
  // xanh rồi thôi. Test này giữ lại đúng phần khẳng định đó.
  it("không còn cột checkbox chọn nhiều ở bảng tồn kho", async () => {
    renderWithProviders(<InventoryPage />);
    await screen.findByText("SKU-001");

    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
  });

  it("chuyển tab Lịch sử biến động hiển thị movement", async () => {
    renderWithProviders(<InventoryPage />);
    await screen.findByText("SKU-001");

    fireEvent.click(screen.getByRole("tab", { name: /Lịch sử biến động/ }));

    expect(await screen.findByText("SKU-MV-001")).toBeInTheDocument();
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

    fireEvent.click(screen.getByRole("tab", { name: /Lịch sử biến động/ }));
    await screen.findByText("SKU-MV-001");

    expect(screen.getByRole("button", { name: /^Truy vết$/ })).toBeDisabled();
    // Không có quyền trace thì cũng không hiện nút "Truy vết mã" toolbar.
    expect(screen.queryByText("Truy vết mã")).not.toBeInTheDocument();
  });

  it("có quyền inventory.trace: nút Trace khả dụng và mở TraceModal theo movementId", async () => {
    grant(["inventory.view", "inventory.trace"]);
    renderWithProviders(<InventoryPage />);
    await screen.findByText("SKU-001");

    fireEvent.click(screen.getByRole("tab", { name: /Lịch sử biến động/ }));
    await screen.findByText("SKU-MV-001");

    const traceButton = screen.getByRole("button", { name: /^Truy vết$/ });
    expect(traceButton).toBeEnabled();
    fireEvent.click(traceButton);

    expect(
      await screen.findByText("Truy vết chứng từ nguồn"),
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

    fireEvent.mouseDown(screen.getByLabelText("Lọc trạng thái tồn"));
    fireEvent.click(await screen.findByRole("option", { name: "Hàng lỗi" }));

    await waitFor(() => {
      expect(useInventoryBalances).toHaveBeenLastCalledWith(
        expect.objectContaining({ stock_status: "DEFECTIVE", page: 1 }),
      );
    });
  });

  it("lọc loại hàng gọi lại API với sku_type", async () => {
    renderWithProviders(<InventoryPage />);
    await screen.findByText("SKU-001");

    fireEvent.mouseDown(screen.getByLabelText("Lọc loại hàng"));
    fireEvent.click(await screen.findByRole("option", { name: "Linh kiện" }));

    await waitFor(() => {
      expect(useInventoryBalances).toHaveBeenLastCalledWith(
        expect.objectContaining({ sku_type: "COMPONENT", page: 1 }),
      );
    });
  });

  it("Làm mới chỉ tải lại tab đang xem và giữ nguyên bộ lọc", async () => {
    const { balanceRefetch, movementRefetch } = mockQueries();
    renderWithProviders(<InventoryPage />, ["/inventory?screen=INV-01"]);

    fireEvent.change(screen.getByRole("textbox", { name: "Tìm tồn kho" }), {
      target: { value: "SKU-001" },
    });
    await waitFor(() => {
      expect(useInventoryBalances).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: "SKU-001" }),
      );
    });
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    expect(balanceRefetch).toHaveBeenCalledTimes(1);
    expect(movementRefetch).not.toHaveBeenCalled();
    expect(screen.getByRole("textbox", { name: "Tìm tồn kho" })).toHaveValue(
      "SKU-001",
    );

    fireEvent.click(screen.getByRole("tab", { name: "Lịch sử biến động" }));
    fireEvent.change(
      await screen.findByRole("textbox", { name: "Tìm biến động tồn kho" }),
      { target: { value: "IN-001" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    expect(movementRefetch).toHaveBeenCalledTimes(1);
    expect(balanceRefetch).toHaveBeenCalledTimes(1);
    expect(useStockMovements).toHaveBeenLastCalledWith(
      expect.objectContaining({ search: "IN-001", keyword: "IN-001" }),
    );
    expect(
      screen.getByRole("textbox", { name: "Tìm biến động tồn kho" }),
    ).toHaveValue("IN-001");
  });

  it("Đặt lại đưa bộ lọc tab hiện tại về mặc định và trang 1, giữ riêng bộ lọc và phân trang của tab còn lại", async () => {
    mockQueries({ balancesTotal: 120, movementsTotal: 120 });
    renderWithProviders(<InventoryPage />);

    const choose = async (label: string, option: string) => {
      fireEvent.mouseDown(screen.getByRole("combobox", { name: label }));
      fireEvent.click(await screen.findByRole("option", { name: option }));
    };

    expect(screen.getByRole("button", { name: "Đặt lại" })).toBeDisabled();
    fireEvent.change(screen.getByRole("textbox", { name: "Tìm tồn kho" }), {
      target: { value: "  SKU-001  " },
    });
    await waitFor(() => {
      expect(useInventoryBalances).toHaveBeenLastCalledWith(
        expect.objectContaining({ keyword: "SKU-001" }),
      );
    });
    await choose("Lọc loại hàng", "Linh kiện");
    await choose("Lọc trạng thái tồn", "Hàng lỗi");
    await choose("Số dòng mỗi trang", "20");
    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    const balanceFilters = {
      keyword: "SKU-001",
      sku_type: "COMPONENT",
      stock_status: "DEFECTIVE",
      page: 2,
      per_page: 20,
    };
    expect(useInventoryBalances).toHaveBeenLastCalledWith(balanceFilters);

    fireEvent.click(screen.getByRole("tab", { name: "Lịch sử biến động" }));
    fireEvent.change(
      await screen.findByRole("textbox", { name: "Tìm biến động tồn kho" }),
      { target: { value: "IN-001" } },
    );
    await choose("Lọc loại biến động", "Xuất kho");
    await choose("Số dòng mỗi trang", "50");
    fireEvent.click(screen.getByRole("button", { name: "Go to page 2" }));
    const movementFilters = {
      search: "IN-001",
      keyword: "IN-001",
      movement_type: "ISSUE",
      page: 2,
      per_page: 50,
    };
    expect(useStockMovements).toHaveBeenLastCalledWith(movementFilters);

    fireEvent.click(screen.getByRole("tab", { name: "Tồn kho hiện tại" }));
    expect(
      await screen.findByRole("textbox", { name: "Tìm tồn kho" }),
    ).toHaveValue("  SKU-001  ");
    expect(
      screen.getByRole("combobox", { name: "Lọc loại hàng" }),
    ).toHaveTextContent("Linh kiện");
    expect(
      screen.getByRole("combobox", { name: "Lọc trạng thái tồn" }),
    ).toHaveTextContent("Hàng lỗi");
    expect(useInventoryBalances).toHaveBeenLastCalledWith(balanceFilters);
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    const defaultBalanceFilters = {
      keyword: undefined,
      sku_type: undefined,
      stock_status: undefined,
      page: 1,
      per_page: 20,
    };
    expect(useInventoryBalances).toHaveBeenLastCalledWith(
      defaultBalanceFilters,
    );
    expect(screen.getByRole("textbox", { name: "Tìm tồn kho" })).toHaveValue(
      "",
    );
    expect(screen.getByRole("button", { name: "Đặt lại" })).toBeDisabled();
    expect(useStockMovements).toHaveBeenLastCalledWith(movementFilters);

    fireEvent.click(screen.getByRole("tab", { name: "Lịch sử biến động" }));
    expect(
      await screen.findByRole("textbox", { name: "Tìm biến động tồn kho" }),
    ).toHaveValue("IN-001");
    expect(
      screen.getByRole("combobox", { name: "Lọc loại biến động" }),
    ).toHaveTextContent("Xuất kho");
    expect(
      screen.getByRole("combobox", { name: "Số dòng mỗi trang" }),
    ).toHaveTextContent("50");
    expect(useStockMovements).toHaveBeenLastCalledWith(movementFilters);
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại" }));
    expect(useStockMovements).toHaveBeenLastCalledWith({
      search: undefined,
      keyword: undefined,
      movement_type: undefined,
      page: 1,
      per_page: 50,
    });
    expect(
      screen.getByRole("textbox", { name: "Tìm biến động tồn kho" }),
    ).toHaveValue("");
    expect(screen.getByRole("button", { name: "Đặt lại" })).toBeDisabled();
    expect(useInventoryBalances).toHaveBeenLastCalledWith(
      defaultBalanceFilters,
    );
  });
  it("deep-link ?screen=TRACE-01&id=mv-9 mở TraceModal đúng movement", async () => {
    renderWithProviders(<InventoryPage />, [
      "/inventory?screen=TRACE-01&id=mv-9",
    ]);

    expect(
      await screen.findByText("Truy vết chứng từ nguồn"),
    ).toBeInTheDocument();
  });
});
