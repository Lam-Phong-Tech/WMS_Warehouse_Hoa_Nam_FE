import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
  },
}));

import { http } from "@/shared/api/http";
import { traceStockMovementSource } from "./inventoryService";

/**
 * WWHN-240 DEV240-P1-05 — FE phải consume ĐÚNG response mới của
 * `GET /stock-movements/{id}/trace-source`.
 *
 * BR-REV-11 + §13.10 RPT-MOV-01: trace hiển thị movement gốc, TOÀN BỘ reversal chain và
 * net effect. Trước WWHN-240, BE chỉ trả một `reversal_movement` duy nhất và FE không
 * map gì cả, nên màn TRACE-01 không thể hiện được lần đảo thứ hai.
 */
describe("WWHN-240 · trace-source correction chain + net effect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const chainResponse = {
    movement: { id: "mv-receipt" },
    correction_chain: {
      correction_chain_id: "chain-1",
      root_movement_id: "mv-receipt",
      node_count: 3,
      reversal_count: 2,
      max_depth: 1,
      truncated: false,
      nodes: [
        {
          id: "mv-receipt",
          movement_no: "MV-0001",
          movement_type: "RECEIPT",
          role: "ORIGINAL",
          depth: 0,
          is_subject: true,
          qty_delta: 10,
          actor: "thukho",
        },
        {
          id: "mv-rev-1",
          movement_no: "MV-0002",
          movement_type: "REVERSAL",
          role: "REVERSAL",
          depth: 1,
          is_subject: false,
          qty_delta: -3,
          reason_text: "Giao nhầm Item",
        },
        {
          id: "mv-rev-2",
          movement_no: "MV-0003",
          movement_type: "REVERSAL",
          role: "REVERSAL",
          depth: 1,
          is_subject: false,
          qty_delta: -2,
          reason_code: "CORRECTION",
        },
      ],
    },
    net_effect: {
      basis: "LEDGER",
      original_movement_id: "mv-receipt",
      original_movement_type: "RECEIPT",
      original_qty: 10,
      original_qty_delta: 10,
      reversed_qty: 5,
      remaining_reversible_qty: 5,
      net_qty_delta: 5,
      fully_reversed: false,
      reversal_count: 2,
    },
  };

  it("map đủ chain, root và cờ truncated", async () => {
    vi.mocked(http.get).mockResolvedValue(chainResponse);

    const result = await traceStockMovementSource("mv-receipt");

    expect(http.get).toHaveBeenCalledWith(
      "/stock-movements/mv-receipt/trace-source",
    );
    expect(result.rootMovementId).toBe("mv-receipt");
    expect(result.chainTruncated).toBe(false);
    // Không được rơi mất reversal thứ hai — đúng lỗi gốc của DEV240-P1-02B.
    expect(result.chain).toHaveLength(3);
    expect(result.chain[0].role).toBe("ORIGINAL");
    expect(
      result.chain.filter((node) => node.role === "REVERSAL"),
    ).toHaveLength(2);
  });

  it("map net effect theo ledger authoritative", async () => {
    vi.mocked(http.get).mockResolvedValue(chainResponse);

    const result = await traceStockMovementSource("mv-receipt");

    expect(result.netEffect).toEqual({
      basis: "LEDGER",
      originalMovementId: "mv-receipt",
      originalMovementType: "RECEIPT",
      originalQty: 10,
      reversedQty: 5,
      remainingReversibleQty: 5,
      netQtyDelta: 5,
      fullyReversed: false,
      reversalCount: 2,
    });
  });

  it("backend chưa phát hành chain thì FE vẫn chạy với giá trị rỗng", async () => {
    vi.mocked(http.get).mockResolvedValue({
      source: { source_type: "INBOUND", document_code: "IN-001" },
    });

    const result = await traceStockMovementSource("mv-legacy");

    expect(result.chain).toEqual([]);
    expect(result.rootMovementId).toBeNull();
    expect(result.netEffect).toBeNull();
  });
});
