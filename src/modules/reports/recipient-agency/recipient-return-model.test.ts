import { describe, expect, it } from "vitest";
import { buildRecipientReturnReconciliation } from "./recipient-return-model";

const events = [
  { event_type: "ISSUE_POSTED" as const, outbound_document_id: "out-1", outbound_no: "PX-001", occurred_at: "2026-10-24", quantity: 2 },
  { event_type: "ISSUE_POSTED" as const, outbound_document_id: "out-1", outbound_no: "PX-001", occurred_at: "2026-10-24", quantity: 3 },
  { event_type: "ISSUE_POSTED" as const, outbound_document_id: "out-2", outbound_no: "PX-002", occurred_at: "2026-10-27", quantity: 4 },
  { event_type: "ISSUE_REVERSED" as const, outbound_document_id: "out-1", outbound_no: "PX-001", occurred_at: "2026-10-28", quantity: 2 },
];

describe("buildRecipientReturnReconciliation", () => {
  it("links posted reversals to their actual outbound document and keeps each document once", () => {
    const result = buildRecipientReturnReconciliation(events, [
      { id: "rv-1", reversal_code: "RV-001", reference_document_id: "out-1", reference_document_code: "PX-001", status: "POSTED", total_qty: 2, posted_at: "2026-10-28" },
      { id: "rv-2", reversal_code: "RV-002", reference_document_code: "PX-002", status: "POSTED", total_qty: 1, posted_at: "2026-10-29" },
      { id: "rv-3", reversal_code: "RV-003", reference_document_code: "PX-999", status: "POSTED", total_qty: 8 },
      { id: "rv-4", reversal_code: "RV-004", reference_document_code: "PX-001", status: "DRAFT", total_qty: 6 },
    ]);

    expect(result.reversals.map((row) => row.code)).toEqual(["RV-001", "RV-002"]);
    expect(result.sources).toEqual([
      expect.objectContaining({ code: "PX-001", gross: 5, reversed: 2, net: 3 }),
      expect.objectContaining({ code: "PX-002", gross: 4, reversed: 1, net: 3 }),
    ]);
    expect(result.totals).toEqual({ gross: 9, reversed: 3, net: 6 });
  });

  it("does not invent a reversal document from an allocated ledger event", () => {
    const result = buildRecipientReturnReconciliation(events, []);
    expect(result.reversals).toEqual([]);
    expect(result.totals).toEqual({ gross: 9, reversed: 0, net: 9 });
  });
});
