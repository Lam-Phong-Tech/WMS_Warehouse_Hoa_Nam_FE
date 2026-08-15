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
  fetchScanBatches,
  fetchScanEvents,
  fetchSafeStockAlerts,
  fetchSafeStockConfigs,
  fetchStockMovement,
  fetchStockMovements,
  traceByPhysicalCode,
  traceStockMovementSource,
} from "./inventoryService";

describe("inventoryService — 6 endpoint tồn kho/trace", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchInventoryBalances gọi GET /inventory/balances và normalize field theo contract chính (snake_case đầy đủ)", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        {
          id: "bal-1",
          sku_code: "SKU-001",
          product_name: "Máy khoan",
          product_type: "TOOL",
          warehouse_name: "Kho A",
          lot_no: "LOT-01",
          uom: "cái",
          available_qty: 10,
          on_hand_qty: 12,
          reserved_qty: 2,
          in_transit_qty: 0,
          blocked_qty: 0,
          item_subledger_count: 3,
          container_subledger_count: 1,
          reconciliation_status: "MATCH",
          updated_at: "2026-08-10T00:00:00Z",
          data_as_of: "2026-08-10T00:00:00Z",
        },
      ],
      meta: { total: 1, page: 1, per_page: 20 },
    });

    const result = await fetchInventoryBalances({ status: "normal", page: 1 });

    expect(http.getPage).toHaveBeenCalledWith("/inventory/balances", {
      params: { per_page: 20, status: "normal", page: 1 },
    });
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({
      id: "bal-1",
      sku: "SKU-001",
      name: "Máy khoan",
      warehouse: "Kho A",
      available: 10,
      onHand: 12,
      reserved: 2,
      serialQty: 3,
      boxQty: 1,
      reconcile: "MATCH",
    });
    expect(result.meta).toEqual({ total: 1, page: 1, per_page: 20 });
  });

  it("fetchInventoryBalances normalize được payload dùng tên field thay thế (fallback chain)", async () => {
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

  it("fetchStockMovements gọi GET /stock-movements với filter và normalize dấu +/- số lượng", async () => {
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

    const result = await fetchStockMovements({ movement_type: "RECEIPT", page: 1 });

    expect(http.getPage).toHaveBeenCalledWith("/stock-movements", {
      params: { per_page: 20, movement_type: "RECEIPT", page: 1 },
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

  it("fetchStockMovement gọi GET /stock-movements/:id với id thay thế đúng vị trí", async () => {
    vi.mocked(http.get).mockResolvedValue({ id: "mv-1", movement_no: "MV-0001" });

    const result = await fetchStockMovement("mv-1");

    expect(http.get).toHaveBeenCalledWith("/stock-movements/mv-1");
    expect(result).toMatchObject({ id: "mv-1" });
  });

  it("traceStockMovementSource gọi GET /stock-movements/:id/trace-source và normalize timeline/lines", async () => {
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

    expect(http.get).toHaveBeenCalledWith("/inventory/balances/bal-1/subledger");
    expect(result.item_count).toBe(1);
    expect(result.items).toHaveLength(1);
  });

  it("traceByPhysicalCode gọi GET /stock-movements/trace-by-code với query param code", async () => {
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

  it("phân biệt được trace theo item/container/SKU thay vì chỉ SKU approximation (DEV211-P1-01)", async () => {
    vi.mocked(http.get).mockResolvedValueOnce({
      physical_code: { code_value: "RFID-BOX-1" },
      resolved_type: "CONTAINER",
      resolved_id: "box-1",
      resolved_object: { container_code: "BOX-001", container_type: "BOX" },
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

describe("inventoryService — Safe-stock/Scan (dead code, chưa dùng trong UI, xem WWHN-211.md mục Safe-stock/Scan)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetchSafeStockAlerts/fetchSafeStockConfigs/fetchScanBatches/fetchScanEvents vẫn đúng contract endpoint dù chưa có UI dùng", async () => {
    vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: {} });

    await fetchSafeStockAlerts();
    expect(http.getPage).toHaveBeenCalledWith("/safe-stock-alerts", { params: {} });

    await fetchSafeStockConfigs();
    expect(http.getPage).toHaveBeenCalledWith("/safe-stock-configs", { params: {} });

    await fetchScanBatches();
    expect(http.getPage).toHaveBeenCalledWith("/scan/batches", { params: {} });

    await fetchScanEvents();
    expect(http.getPage).toHaveBeenCalledWith("/scan/events", { params: {} });
  });
});
