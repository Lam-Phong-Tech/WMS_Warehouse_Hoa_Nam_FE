import { describe, expect, it } from "vitest";

import { API_ENDPOINTS } from "@/shared/api/endpoints";

describe("WWHN-224 SKU import FE handoff", () => {
  it("uses the explicit BE SKU import route family instead of generic import-batches", () => {
    expect(API_ENDPOINTS.SKU_IMPORT_TEMPLATE).toBe("/skus/import-template");
    expect(API_ENDPOINTS.SKU_IMPORT_EXCEL).toBe("/skus/import-excel");
    expect(API_ENDPOINTS.SKU_IMPORT_REPORTS).toBe("/skus/import-reports");
    expect(API_ENDPOINTS.SKU_IMPORT_REPORT).toBe("/skus/import-reports/:id");
    expect(API_ENDPOINTS.SKU_IMPORT_EXCEL).not.toBe("/import-batches");
  });
});
