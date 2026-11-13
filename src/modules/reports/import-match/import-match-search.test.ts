import { expect, it } from "vitest";
import { buildMatchBatches, filterBatches } from "./import-match-model";

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
