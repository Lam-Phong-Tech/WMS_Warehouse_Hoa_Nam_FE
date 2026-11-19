import { expect, it } from "vitest";
import {
  buildImportBatches,
  buildMatchBatches,
  filterBatches,
  totalsOf,
  trendByDay,
} from "./import-match-model";

it("filters import mode independently from validation result and preserves totals and trend", () => {
  const batches = buildImportBatches(
    [
      {
        import_report_id: "dry",
        mode: "DRY_RUN",
        status: "VALID",
        created_at: "2026-11-19T10:00:00+07:00",
        total_rows: 3,
        valid_rows: 3,
        error_rows: 0,
      },
      {
        import_report_id: "written",
        mode: "COMMIT",
        status: "COMMITTED",
        created_at: "2026-11-19T11:00:00+07:00",
        total_rows: 2,
        valid_rows: 2,
        error_rows: 0,
      },
      {
        import_report_id: "rejected",
        mode: "COMMIT",
        status: "REJECTED",
        created_at: "2026-11-19T12:00:00+07:00",
        total_rows: 1,
        valid_rows: 0,
        error_rows: 1,
        row_errors: [{ row: 2, code: "REQUIRED" }],
      },
    ],
    () => "",
  );
  const filters = {
    from: "",
    to: "",
    result: "" as const,
    status: "",
    actor: "",
    keyword: "",
    sku: "",
    kind: "all" as const,
  };
  const commit = filterBatches(
    batches,
    { ...filters, mode: "COMMIT" },
    () => undefined,
  );
  expect(commit.map((row) => row.id)).toEqual(["written", "rejected"]);
  expect(totalsOf(commit)).toMatchObject({ total: 3, success: 2, failed: 1 });
  expect(trendByDay(commit)).toEqual([
    { day: "2026-11-19", success: 2, failed: 1, duplicate: 0 },
  ]);
  expect(
    filterBatches(
      batches,
      { ...filters, mode: "DRY_RUN" },
      () => undefined,
    ).map((row) => row.id),
  ).toEqual(["dry"]);
  expect(
    filterBatches(batches, { ...filters, mode: "" }, () => undefined),
  ).toHaveLength(3);
});

it("finds a reconciliation by a source request on any line", () => {
  const batches = buildMatchBatches({
    batches: [{ import_no: "MATCH-01" }],
    rows: [
      {
        import_no: "MATCH-01",
        sku_code: "SKU-01",
        source_request_no: "REQUEST-42",
        validation_status: "VALID",
      },
    ],
  });
  const filters = {
    from: "",
    to: "",
    result: "" as const,
    status: "",
    actor: "",
    keyword: "request-42",
    sku: "",
    kind: "all" as const,
  };
  expect(filterBatches(batches, filters, () => undefined)).toHaveLength(1);
  expect(
    filterBatches(
      batches,
      { ...filters, keyword: "unrelated" },
      () => undefined,
    ),
  ).toHaveLength(0);
});
