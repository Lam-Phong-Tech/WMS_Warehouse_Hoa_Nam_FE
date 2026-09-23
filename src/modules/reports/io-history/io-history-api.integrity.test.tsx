import { cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  docs: {} as Record<string, unknown>,
  ledger: {} as Record<string, unknown>,
  reversals: {} as Record<string, unknown>,
}));
vi.mock("@tanstack/react-query", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@tanstack/react-query")>()),
  useQuery: ({ queryKey }: { queryKey: unknown[] }) =>
    queryKey.includes("document-history") ? state.docs : state.ledger,
}));
vi.mock("@/modules/reports/operations/report-data", () => ({
  useReversalDocuments: () => state.reversals,
  useUserDirectory: () => ({
    departmentNameOfActor: () => "",
    nameOfUserId: () => "",
  }),
}));
import { useIoHistorySnapshot, type IoTypeFilter } from "./io-history-api";
const from = "2026-09-23",
  to = "2026-09-23";
const documentRow = {
  id: "api-in-1",
  document_no: "API-IN-1",
  doc_type: "INBOUND",
  status: "POSTED",
  posted_at: "2026-09-23T05:00:00Z",
  lines: [{ posted_qty: 7 }],
};
function run(type: IoTypeFilter = "") {
  return renderHook(() => useIoHistorySnapshot({ from, to, type }));
}
beforeEach(() => {
  const flags = {
    isLoading: false,
    isFetching: false,
    isPlaceholderData: false,
    error: null,
    refetch: vi.fn().mockResolvedValue({}),
  };
  state.docs = {
    ...flags,
    data: {
      data: { rows: [documentRow] },
      meta: { timestamp: "2026-09-23T06:00:00Z" },
    },
  };
  state.ledger = { ...flags, data: { rows: [] } };
  state.reversals = {
    ...flags,
    data: {
      data: [
        {
          id: "api-rev-1",
          reversal_code: "API-REV-1",
          status: "POSTED",
          reversed_at: "2026-09-23T05:00:00Z",
          reference_document_type: "INBOUND",
          total_qty: 2,
        },
      ],
    },
  };
});
afterEach(cleanup);
describe("history API snapshot integrity", () => {
  it("does not mix cached reversal rows into an inbound-only request", () => {
    const { result } = run("INBOUND");
    expect(result.current.snapshot.rows.map((r) => r.documentNo)).toEqual([
      "API-IN-1",
    ]);
  });
  it("does not mix disabled cached document rows into a reversal-only request", () => {
    const { result } = run("REVERSAL");
    expect(result.current.snapshot.rows.map((r) => r.documentNo)).toEqual([
      "API-REV-1",
    ]);
  });
  it("waits for all requested sources before publishing aggregate inputs", () => {
    state.ledger.data = undefined;
    state.ledger.isLoading = true;
    const { result } = run();
    expect(result.current.snapshot.rows).toEqual([]);
    expect(result.current.loading).toBe(true);
  });
  it("reports a required-source failure without presenting a partial dataset as complete", () => {
    state.ledger.data = undefined;
    state.ledger.error = new Error("ledger unavailable");
    const { result } = run();
    expect(result.current.snapshot.rows).toEqual([]);
    expect(result.current.error).toBe(state.ledger.error);
  });
  it("ignores an error belonging to an excluded source", () => {
    state.reversals.error = new Error("excluded source");
    state.reversals.isPlaceholderData = true;
    const { result } = run("INBOUND");
    expect(result.current.error).toBeNull();
    expect(result.current.snapshot.rows).toHaveLength(1);
  });
  it.each([403, 404, 503])(
    "preserves real documents and the explicit source error (%s)",
    (status) => {
      const error = { response: { status } };
      state.reversals.data = undefined;
      state.reversals.error = error;
      const { result } = run();
      expect(result.current.snapshot.rows.map((row) => row.documentNo)).toEqual(
        ["API-IN-1"],
      );
      expect(result.current.snapshot.rows[0].qty).toBe(7);
      expect(result.current.error).toBe(error);
      expect(result.current.snapshot.dataAsOf).toBe("");
    },
  );
  it("waits while the requested reversal source is still pending", () => {
    state.reversals.data = undefined;
    state.reversals.isLoading = true;
    const { result } = run();
    expect(result.current.snapshot.rows).toEqual([]);
    expect(result.current.loading).toBe(true);
  });
  it("preserves unknown line quantities rather than inventing zero", () => {
    state.docs.data = {
      data: { rows: [{ ...documentRow, lines: [{ posted_qty: null }] }] },
    };
    const { result } = run("INBOUND");
    expect(result.current.snapshot.rows[0].qty).toBeNull();
  });
  it("preserves unknown ledger quantities even if document lines contain a number", () => {
    state.ledger.data = {
      rows: [
        { source_id: "api-in-1", movement_no: "API-MOVE-1", qty_delta: null },
      ],
    };
    const { result } = run("INBOUND");
    expect(result.current.snapshot.rows[0].qty).toBeNull();
  });
  it("uses the exact signed ledger sum when it is available", () => {
    state.ledger.data = {
      rows: [
        { source_id: "api-in-1", movement_no: "API-MOVE-1", qty_delta: 3 },
        { source_id: "api-in-1", movement_no: "API-MOVE-2", qty_delta: "5" },
      ],
    };
    const { result } = run("INBOUND");
    expect(result.current.snapshot.rows[0].qty).toBe(8);
    expect(result.current.snapshot.rows[0].movementCount).toBe(2);
  });
  it("preserves unknown reversal quantities rather than negating null into zero", () => {
    state.reversals.data = {
      data: [
        {
          id: "api-rev-1",
          status: "POSTED",
          reversed_at: "2026-09-23T05:00:00Z",
          reference_document_type: "INBOUND",
          total_qty: null,
        },
      ],
    };
    const { result } = run("REVERSAL");
    expect(result.current.snapshot.rows[0].qty).toBeNull();
  });
});
