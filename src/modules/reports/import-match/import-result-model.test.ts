import { describe, expect, it } from "vitest";
import { buildImportBatches } from "./import-match-model";

describe("import result row counts", () => {
  it("counts distinct data rows when multiple fields on the same row have errors", () => {
    const [batch] = buildImportBatches(
      [
        {
          total_rows: 3,
          valid_rows: 1,
          error_rows: 4,
          row_errors: [
            { row: 2, code: "DUPLICATE_CODE", field: "sku_code" },
            { row: 2, code: "DUPLICATE_IN_FILE", field: "sku_name" },
            { row: 3, code: "REQUIRED", field: "sku_name" },
            { row: 3, code: "INVALID_STATUS", field: "status" },
          ],
        },
      ],
      () => "",
    );
    expect([batch.total, batch.success, batch.duplicate, batch.failed]).toEqual(
      [3, 1, 1, 1],
    );
  });
});
