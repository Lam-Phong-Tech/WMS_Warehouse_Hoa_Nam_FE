import { describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/http", () => ({ http: { getPage: vi.fn(), downloadFile: vi.fn() } }));

import { http } from "@/shared/api/http";
import { downloadImportQualityExport, fetchImportQualityBatches, fetchImportQualityIssues } from "./import-quality-api";

describe("SKU import quality API", () => {
  it("loads every page of imports instead of silently stopping at 100", async () => {
    vi.mocked(http.getPage).mockImplementation(async (_path, options) => ({
      data: [{ import_report_id: `batch-${options?.params?.page}` }] as never,
      meta: { current_page: Number(options?.params?.page), last_page: 2, total: 2 },
    }));
    const rows = await fetchImportQualityBatches();
    expect(rows).toHaveLength(2);
    expect(rows.map((row) => row.import_report_id)).toEqual(["batch-1", "batch-2"]);
    expect(http.getPage).toHaveBeenCalledWith("/skus/import-reports", { params: { page: 2, per_page: 100 } });
  });

  it("reports an incomplete import history instead of showing a truncated total", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [] as never,
      meta: { current_page: 1, last_page: 101, total: 10100 },
    });
    await expect(fetchImportQualityBatches()).rejects.toThrow(/too many import report pages/i);
  });

  it("loads only stored error rows for the selected import and retains source position", async () => {
    vi.mocked(http.getPage).mockResolvedValueOnce({
      data: [{ row_no: 32, field: "sku_name", error_code: "REQUIRED", message: "Tên SKU là trường bắt buộc.", raw_value: "", severity: "ERROR", suggested_action: "Bổ sung tên trong tệp nguồn." }] as never,
      meta: { current_page: 1, last_page: 1, total: 1 },
    });
    const result = await fetchImportQualityIssues("batch-1", 1);
    expect(http.getPage).toHaveBeenCalledWith("/skus/import-reports/batch-1/rows", { params: { page: 1, per_page: 50 } });
    expect(result.rows[0]).toEqual({ rowNo: 32, field: "sku_name", code: "REQUIRED", message: "Tên SKU là trường bắt buộc.", rawValue: "", severity: "ERROR", suggestedAction: "Bổ sung tên trong tệp nguồn." });
    expect(result.total).toBe(1);
  });

  it("exports SKU imports with the visible filters through the dedicated endpoint", async () => {
    const createObjectURL = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:import-quality");
    const revokeObjectURL = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
    vi.mocked(http.downloadFile).mockResolvedValueOnce({ blob: new Blob(["xlsx"]), fileName: "doi-chieu.xlsx" });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    await downloadImportQualityExport({ from_date: "2026-10-01", to_date: "2026-10-30", issues_only: "1" });
    expect(http.downloadFile).toHaveBeenCalledWith("/skus/import-reports/export-excel", {
      params: { from_date: "2026-10-01", to_date: "2026-10-30", issues_only: "1" },
    });
    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:import-quality");
    click.mockRestore();
    createObjectURL.mockRestore();
    revokeObjectURL.mockRestore();
  });
});
