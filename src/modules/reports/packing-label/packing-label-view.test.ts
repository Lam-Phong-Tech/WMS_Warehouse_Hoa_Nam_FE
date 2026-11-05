import { describe, expect, it } from "vitest";
import {
  labelRows,
  printGate,
  printMetrics,
  snapshotMissing,
} from "./packing-label-view";
import type {
  PackingLabelDimension,
  PackingLabelEvent,
} from "./packing-label-api";

const labels = new Map([
  ["a", { labelCode: "PL-A", status: "PRINTED" } as PackingLabelDimension],
  [
    "b",
    { labelCode: "PL-B", status: "READY_TO_PRINT" } as PackingLabelDimension,
  ],
]);
const events = [
  {
    eventId: "old",
    labelId: "a",
    result: "PRINT_FAILED",
    action: "PRINT",
    attemptedAt: "2026-11-01T08:00:00",
    attemptNo: 1,
  },
  {
    eventId: "new",
    labelId: "a",
    result: "PRINTED",
    action: "PRINT",
    attemptedAt: "2026-11-01T09:00:00",
    attemptNo: 2,
  },
] as PackingLabelEvent[];

describe("packing label projections and current print gates", () => {
  it("counts unique labels independently and includes labels with no attempts", () => {
    expect(labelRows(labels, events)).toEqual([
      expect.objectContaining({
        labelId: "a",
        latest: expect.objectContaining({ eventId: "new" }),
        total: 2,
      }),
      expect.objectContaining({ labelId: "b", latest: null, total: 0 }),
    ]);
    expect(printMetrics(labels, events)).toEqual({
      labels: 2,
      total: 2,
      printed: 1,
      failed: 1,
      pending: 0,
      reprinted: 0,
    });
  });
  it("does not paint failed or pending segments when the period is empty", () => {
    expect(printMetrics(new Map(), [])).toEqual({
      labels: 0,
      total: 0,
      printed: 0,
      failed: 0,
      pending: 0,
      reprinted: 0,
    });
  });
  it("requires reprint for a currently printed snapshot regardless of an old failed row", () => {
    expect(printGate("PRINTED", [])).toEqual({ action: "REPRINT", reason: "" });
    expect(printGate("PRINT_FAILED", [])).toEqual({
      action: "PRINT",
      reason: "",
    });
  });
  it("blocks pending attempts and incomplete immutable payloads", () => {
    expect(
      printGate("PRINTED", [{ result: "PENDING_PRINT" } as PackingLabelEvent])
        .action,
    ).toBeNull();
    expect(printGate("DRAFT", []).action).toBeNull();
    expect(printGate("READY_TO_PRINT", [], ["Nơi nhận"]).reason).toContain(
      "Nơi nhận",
    );
  });
  it("accepts canonical sku_summary array and rejects missing immutable product data", () => {
    expect(
      snapshotMissing({
        recipient_name: "Đại lý",
        outbound_no: "PX-1",
        sku_summary: [{ sku_code: "SKU-1", quantity: 2 }],
      }),
    ).toEqual([]);
  });
});
