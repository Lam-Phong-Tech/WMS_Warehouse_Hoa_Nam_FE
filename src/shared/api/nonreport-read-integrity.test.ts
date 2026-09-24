import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("@/shared/api/http", () => ({
  http: { get: vi.fn(), getPage: vi.fn() },
}));
import { http } from "@/shared/api/http";
import { fetchDocumentAttachments } from "./documentAttachmentService";
import { traceStockMovementSource } from "@/modules/inventory/services/inventoryService";

// Only empty/malformed transport responses are used here; no runtime records or API writes.
describe("non-report read integrity", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
  });
  it("does not invent evidence status for missing metadata", async () => {
    vi.mocked(http.getPage).mockResolvedValue({ data: [], meta: {} });
    await expect(
      fetchDocumentAttachments("INBOUND", "scope"),
    ).rejects.toMatchObject({ code: "WMS_FE_INVALID_API_STATE" });
  });
  it("accepts an explicitly confirmed empty attachment list", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [],
      meta: { evidence_status: "NOT_REQUIRED", requires_evidence: false },
    });
    await expect(
      fetchDocumentAttachments("OUTBOUND", "scope"),
    ).resolves.toEqual({
      attachments: [],
      evidenceStatus: "NOT_REQUIRED",
      requiresEvidence: false,
    });
  });
  it.each([undefined, null, "false", "true", 0, 1])(
    "does not coerce a missing/invalid evidence flag: %s",
    async (flag) => {
      vi.mocked(http.getPage).mockResolvedValue({
        data: [],
        meta: { evidence_status: "PENDING", requires_evidence: flag },
      });
      await expect(
        fetchDocumentAttachments("REVERSAL", "scope"),
      ).rejects.toMatchObject({ code: "WMS_FE_MISSING_API_VALUE" });
    },
  );
  it.each([null, {}, { data: null }])(
    "does not disguise a malformed list as empty: %j",
    async (data) => {
      vi.mocked(http.getPage).mockResolvedValue({
        data,
        meta: { evidence_status: "PENDING", requires_evidence: true },
      });
      await expect(
        fetchDocumentAttachments("REVERSAL", "scope"),
      ).rejects.toMatchObject({ code: "WMS_FE_INVALID_API_ROWS" });
    },
  );
  it("keeps absent net-effect quantities and completion flag unknown", async () => {
    vi.mocked(http.get).mockResolvedValue({ net_effect: {} });
    const result = await traceStockMovementSource("scope");
    expect(result.netEffect).toMatchObject({
      basis: "",
      originalQty: null,
      reversedQty: null,
      remainingReversibleQty: null,
      netQtyDelta: null,
      reversalCount: null,
      fullyReversed: null,
    });
  });
  it("preserves explicit zero and negative API quantities", async () => {
    vi.mocked(http.get).mockResolvedValue({
      net_effect: {
        original_qty: "0",
        reversed_qty: "0",
        remaining_reversible_qty: "0",
        net_qty_delta: "-1.5",
        reversal_count: "0",
        fully_reversed: false,
      },
    });
    const result = await traceStockMovementSource("scope");
    expect(result.netEffect).toMatchObject({
      originalQty: 0,
      reversedQty: 0,
      remainingReversibleQty: 0,
      netQtyDelta: -1.5,
      reversalCount: 0,
      fullyReversed: false,
    });
  });
});
