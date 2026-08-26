import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
  },
}));

import { http } from "@/shared/api/http";
import {
  fetchBalanceSubledger,
  fetchInventoryBalances,
  fetchStockMovement,
  fetchStockMovements,
  traceByPhysicalCode,
  traceStockMovementSource,
} from "./inventoryService";

describe("inventoryService — WWHN-211 exact six endpoint contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchInventoryBalances gọi GET /inventory/balances và normalize field theo contract", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        {
          id: "bal-1",
          sku_code: "SKU-001",
          product_name: "Máy khoan",
          product_type: "TOOL",
          warehouse_name: "Kho A",
          stock_status: "AVAILABLE",
          uom: "cái",
          available_qty: 10,
          on_hand_qty: 12,
          item_subledger_count: 3,
          container_subledger_count: 1,
          container_code: "TRAY-01",
          location_hint: "Khay T-01",
          reconciliation_status: "MATCH",
          updated_at: "2026-08-10T00:00:00Z",
          data_as_of: "2026-08-10T00:00:00Z",
        },
      ],
      meta: { total: 1, page: 1, per_page: 20 },
    });

    const result = await fetchInventoryBalances({
      stock_status: "AVAILABLE",
      page: 1,
    });

    expect(http.getPage).toHaveBeenCalledWith("/inventory/balances", {
      params: { per_page: 10, stock_status: "AVAILABLE", page: 1 },
    });
    expect(result.rows[0]).toMatchObject({
      id: "bal-1",
      sku: "SKU-001",
      name: "Máy khoan",
      warehouse: "Kho A",
      stockStatus: "AVAILABLE",
      available: 10,
      onHand: 12,
      serialQty: 3,
      boxQty: 1,
      containerCode: "TRAY-01",
      location: "Khay T-01",
      reconcile: "MATCH",
    });
    expect(result.meta).toEqual({ total: 1, page: 1, per_page: 20 });
  });

  it("fetchInventoryBalances giữ fallback normalization để tương thích payload hiện hành", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        {
          warehouse_id: 5,
          product_id: 99,
          product_code: "ALT-CODE",
          sku_name: "Tên thay thế",
          qty_available: 4,
          qty_on_hand: 4,
          qty_reserved: 0,
          reconcile_status: "MISMATCH",
          reconcile_note: "Lệch do chưa đối soát",
        },
      ],
      meta: {},
    });

    const result = await fetchInventoryBalances();

    expect(result.rows[0]).toMatchObject({
      id: "5-99",
      sku: "ALT-CODE",
      name: "Tên thay thế",
      available: 4,
      onHand: 4,
      reconcile: "MISMATCH",
      reconcileNote: "Lệch do chưa đối soát",
    });
  });

  it("fetchBalanceSubledger gọi GET /inventory/balances/:id/subledger", async () => {
    vi.mocked(http.get).mockResolvedValue({
      balance_id: "bal-1",
      product_id: "p-1",
      warehouse_id: "w-1",
      items: [{ id: "item-1" }],
      containers: [],
      item_count: 1,
      container_count: 0,
    });

    const result = await fetchBalanceSubledger("bal-1");

    expect(http.get).toHaveBeenCalledWith(
      "/inventory/balances/bal-1/subledger",
    );
    expect(result.item_count).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it("fetchStockMovements gọi GET /stock-movements với filter và normalize movement", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        {
          id: "mv-1",
          movement_no: "MV-0001",
          occurred_at: "2026-08-10T00:00:00Z",
          movement_type: "RECEIPT",
          sku_code: "SKU-001",
          warehouse_name: "Kho A",
          qty_change: 10,
          document_code: "IN-001",
          document_type: "INBOUND",
          status: "POSTED",
        },
      ],
      meta: { total: 1 },
    });

    const result = await fetchStockMovements({
      movement_type: "RECEIPT",
      page: 1,
    });

    expect(http.getPage).toHaveBeenCalledWith("/stock-movements", {
      params: { per_page: 10, movement_type: "RECEIPT", page: 1 },
    });
    expect(result.rows[0]).toMatchObject({
      id: "mv-1",
      movementId: "MV-0001",
      type: "RECEIPT",
      sku: "SKU-001",
      qty: 10,
      source: "IN-001",
      sourceType: "INBOUND",
      status: "POSTED",
    });
  });

  it("fetchStockMovement gọi GET /stock-movements/:id", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "mv-1",
      movement_no: "MV-0001",
    });

    const result = await fetchStockMovement("mv-1");

    expect(http.get).toHaveBeenCalledWith("/stock-movements/mv-1");
    expect(result).toMatchObject({ id: "mv-1" });
  });

  it("traceStockMovementSource gọi GET /stock-movements/:id/trace-source", async () => {
    vi.mocked(http.get).mockResolvedValue({
      source: {
        source_type: "INBOUND",
        document_code: "IN-001",
        status: "POSTED",
        posted_at: "2026-08-10T00:00:00Z",
        actor_name: "thukho",
        lines: [{ sku: "SKU-001", quantity: 5 }],
      },
      timeline: [{ from_status: "DRAFT", to_status: "POSTED" }],
      request_id: "req-1",
    });

    const result = await traceStockMovementSource("mv-1");

    expect(http.get).toHaveBeenCalledWith("/stock-movements/mv-1/trace-source");
    expect(result).toMatchObject({
      movementId: "mv-1",
      sourceType: "INBOUND",
      sourceCode: "IN-001",
      status: "POSTED",
      actor: "thukho",
      requestId: "req-1",
    });
    expect(result.lines).toHaveLength(1);
    expect(result.timeline).toHaveLength(1);
  });

  it("traceByPhysicalCode gọi GET /stock-movements/trace-by-code với query code", async () => {
    vi.mocked(http.get).mockResolvedValue({
      physical_code: { code_value: "QR-001", carrier_type: "QR" },
      resolved_type: "ITEM",
      resolved_id: "item-1",
      resolved_object: { sku_code: "SKU-001" },
      movements: [],
      container_items: [],
    });

    const result = await traceByPhysicalCode("QR-001");

    expect(http.get).toHaveBeenCalledWith("/stock-movements/trace-by-code", {
      params: { code: "QR-001" },
    });
    expect(result.resolved_type).toBe("ITEM");
  });

  it("trace vật lý phân biệt ITEM và CONTAINER, không dùng SKU approximation", async () => {
    vi.mocked(http.get).mockResolvedValueOnce({
      physical_code: { code_value: "RFID-BOX-1" },
      resolved_type: "CONTAINER",
      resolved_id: "box-1",
      resolved_object: {
        container_code: "BOX-001",
        container_type: "BOX",
      },
      movements: [],
      container_items: [{ container_code: "BOX-001" }],
    });
    const containerResult = await traceByPhysicalCode("RFID-BOX-1");
    expect(containerResult.resolved_type).toBe("CONTAINER");
    expect(containerResult.container_items).toHaveLength(1);

    vi.mocked(http.get).mockResolvedValueOnce({
      physical_code: { code_value: "SN-ITEM-1" },
      resolved_type: "ITEM",
      resolved_id: "item-1",
      resolved_object: { sku_code: "SKU-001" },
      movements: [{ id: "mv-1" }],
      container_items: [],
    });
    const itemResult = await traceByPhysicalCode("SN-ITEM-1");
    expect(itemResult.resolved_type).toBe("ITEM");
    expect(itemResult.movements).toHaveLength(1);
  });
});

describe("inventoryService — WWHN-198 / DEC-INV-RESERVED-001 reserved_qty", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("khả dụng đọc available_qty, KHÔNG suy ra từ on_hand - reserved_qty", async () => {
    // Backend ghim reserved_qty = 0 (compatibility field). Nếu FE tự tính
    // khả dụng = onHand - reservedQty thì ngày nào đó backend đổi cách ghi field
    // này, UI sẽ lệch số một cách im lặng. Test khoá chiều đọc đúng.
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        {
          id: "bal-resv",
          sku_code: "SKU-RESV",
          warehouse_name: "Kho A",
          stock_status: "AVAILABLE",
          available_qty: 7,
          on_hand_qty: 7,
          reserved_qty: 0,
          updated_at: "2026-08-19T00:00:00Z",
        },
      ],
      meta: { total: 1, page: 1, per_page: 20 },
    });

    const result = await fetchInventoryBalances({ page: 1 });

    expect(result.rows[0].available).toBe(7);
    expect(result.rows[0].onHand).toBe(7);
    expect(result.rows[0].reservedQty).toBe(0);
  });

  it("reserved_qty chỉ là pass-through: giá trị lạ không được ảnh hưởng cột khả dụng", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        {
          id: "bal-resv-2",
          sku_code: "SKU-RESV-2",
          warehouse_name: "Kho A",
          stock_status: "AVAILABLE",
          available_qty: 5,
          on_hand_qty: 9,
          // Giá trị này vi phạm DEC-INV-RESERVED-001 nếu backend gửi thật, nhưng FE
          // vẫn không được dùng nó để tính lại khả dụng.
          reserved_qty: 4,
          updated_at: "2026-08-19T00:00:00Z",
        },
      ],
      meta: { total: 1, page: 1, per_page: 20 },
    });

    const result = await fetchInventoryBalances({ page: 1 });

    expect(result.rows[0].available).toBe(5);
    expect(result.rows[0].onHand).toBe(9);
    expect(result.rows[0].reservedQty).toBe(4);
  });
});
