import { beforeEach, describe, expect, it, vi } from "vitest";
import { ROUTES } from "@/shared/constants/routes";
import { ROUTE_PERMISSIONS } from "@/app/router/access";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import { classifyScanCodes } from "@/modules/scan/services/scanService";
import { postInboundReceipt } from "@/modules/receiving/services/receivingService";
import { postOutboundIssue } from "@/modules/shipping/services/shippingService";
import { applyStocktakeAdjustment } from "@/modules/stocktake/services/stocktakeService";
import {
  downloadXntReportExcel,
  fetchReportsHub,
  fetchXntReport,
} from "@/modules/reports/services/reportsService";

vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    post: vi.fn(),
    downloadBlob: vi.fn(),
  },
}));

describe("WMS conditional sign-off contract guards", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.post).mockReset();
    vi.mocked(http.downloadBlob).mockReset();
  });

  it("keeps final FE sign-off blocked by documenting P0/P1 gates in code-facing constants", () => {
    expect(API_ENDPOINTS.SCAN_BATCHES_CLASSIFY).toBe("/scan-batches/classify");
    expect(API_ENDPOINTS.INBOUND_POST_RECEIPT).toBe(
      "/inbound-documents/:id/post-receipt",
    );
    expect(API_ENDPOINTS.OUTBOUND_POST_ISSUE).toBe(
      "/outbound-documents/:id/post-issue",
    );
    expect(API_ENDPOINTS.STOCKTAKE_APPLY_ADJUSTMENT).toBe(
      "/stocktake/sessions/:sessionId/apply-adjustment",
    );
  });

  it("classifies scans through the current conditional endpoint without inventing the disputed /api/v1/scan/classify path", async () => {
    vi.mocked(http.post).mockResolvedValue({
      batch_id: "B1",
      total_codes: 1,
      items: [],
    });

    await classifyScanCodes({
      codes: ["QR-001"],
      warehouse_id: 12,
      scan_source: "manual",
    });

    expect(http.post).toHaveBeenCalledWith("/scan-batches/classify", {
      codes: ["QR-001"],
      warehouse_id: 12,
      scan_source: "manual",
    });
    expect(http.post).not.toHaveBeenCalledWith(
      "/api/v1/scan/classify",
      expect.anything(),
      expect.anything(),
    );
  });

  it("requires idempotency and optimistic lock evidence on receipt, issue, and apply-adjustment service calls", async () => {
    vi.mocked(http.post).mockResolvedValue({});

    await postInboundReceipt({
      documentId: "IN-1",
      lines: [{ lineId: "L1", quantity: 2 }],
      idempotencyKey: "idem-inbound-1",
      ifMatch: 7,
    });
    await postOutboundIssue({
      documentId: "OUT-1",
      lines: [{ lineId: "L2", quantity: 1 }],
      idempotencyKey: "idem-outbound-1",
      ifMatch: 8,
    });
    await applyStocktakeAdjustment({
      session_id: "ST-1",
      lines: [{ sku: "SKU-001", actual_qty: 3, reason: "COUNT" }],
      idempotency_key: "idem-stocktake-1",
      version: "9",
    });

    expect(http.post).toHaveBeenNthCalledWith(
      1,
      "/inbound-documents/IN-1/post-receipt",
      { lines: [{ lineId: "L1", quantity: 2 }] },
      {
        headers: {
          "Idempotency-Key": "idem-inbound-1",
          "If-Match": "7",
        },
      },
    );
    expect(http.post).toHaveBeenNthCalledWith(
      2,
      "/outbound-documents/OUT-1/post-issue",
      { lines: [{ lineId: "L2", quantity: 1 }] },
      {
        headers: {
          "Idempotency-Key": "idem-outbound-1",
          "If-Match": "8",
        },
      },
    );
    expect(http.post).toHaveBeenNthCalledWith(
      3,
      "/stocktake/sessions/ST-1/apply-adjustment",
      { lines: [{ sku: "SKU-001", actual_qty: 3, reason: "COUNT" }] },
      {
        headers: {
          "Idempotency-Key": "idem-stocktake-1",
          "If-Match": "9",
        },
      },
    );
  });

  it("keeps WMS ROUTE_PERMISSIONS explicit until BE/BA approves the backend permission catalog", () => {
    expect(ROUTE_PERMISSIONS[ROUTES.SCAN]).toEqual([
      "inventory.trace",
      "scan.classify",
    ]);
    expect(ROUTE_PERMISSIONS[ROUTES.INBOUND]).toEqual([
      "inbound.create",
      "inbound.post",
    ]);
    expect(ROUTE_PERMISSIONS[ROUTES.OUTBOUND]).toEqual([
      "outbound.create",
      "outbound.post",
    ]);
    expect(ROUTE_PERMISSIONS[ROUTES.STOCKTAKE]).toEqual(["stocktake.count"]);
    expect(ROUTE_PERMISSIONS[ROUTES.WARRANTY]).toEqual(["warranty.manage"]);
    expect(ROUTE_PERMISSIONS[ROUTES.REPORTS]).toEqual(["report.view"]);
  });

  it("documents Dashboard/Reports as conditional by exercising only the current FE constants", async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    vi.mocked(http.downloadBlob).mockResolvedValue(new Blob(["xlsx"]));

    await fetchReportsHub();
    await fetchXntReport({ from: "2026-08-01", to: "2026-08-01" });
    await downloadXntReportExcel({ from: "2026-08-01", to: "2026-08-01" });

    expect(http.get).toHaveBeenNthCalledWith(1, "/reports/hub");
    expect(http.get).toHaveBeenNthCalledWith(2, "/reports/inventory-xnt", {
      params: { from: "2026-08-01", to: "2026-08-01" },
    });
    expect(http.downloadBlob).toHaveBeenCalledWith(
      "/reports/inventory-xnt/export-excel",
      { params: { from: "2026-08-01", to: "2026-08-01" } },
    );
  });
});
