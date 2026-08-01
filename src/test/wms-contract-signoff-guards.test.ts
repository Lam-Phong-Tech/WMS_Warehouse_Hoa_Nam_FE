import { beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("@/app/router/access");

import { ROUTES } from "@/shared/constants/routes";
import { ROUTE_PERMISSIONS } from "@/app/router/access";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import { http } from "@/shared/api/http";
import { classifyScanCodes } from "@/modules/scan/services/scanService";
import { WmsContractError } from "@/shared/api/wms-contract";
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

  it("blocks invalid scan classify payloads before network calls", async () => {
    await expect(
      classifyScanCodes({ codes: ["QR-001", " QR-001 "] }),
    ).rejects.toMatchObject({
      code: "WMS_SCAN_DUPLICATE",
    });
    await expect(
      classifyScanCodes({ codes: ["QR-002"], warehouse_id: 0 }),
    ).rejects.toBeInstanceOf(WmsContractError);

    expect(http.post).not.toHaveBeenCalled();
  });

  it("requires idempotency and optimistic lock evidence on receipt, issue, and apply-adjustment service calls", async () => {
    vi.mocked(http.post)
      .mockResolvedValueOnce({
        receipt_id: "REC-1",
        movement_ref: "MOV-IN-1",
        request_id: "REQ-IN-1",
      })
      .mockResolvedValueOnce({
        issue_id: "ISS-1",
        movement_ref: "MOV-OUT-1",
        request_id: "REQ-OUT-1",
      })
      .mockResolvedValueOnce({});

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

  it("rejects receipt/issue/stocktake mutation payloads missing idempotency or evidence", async () => {
    await expect(
      postInboundReceipt({
        documentId: "IN-1",
        lines: [{ lineId: "L1", quantity: 2 }],
        idempotencyKey: "",
        ifMatch: 7,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_IDEMPOTENCY_KEY_REQUIRED" });

    await expect(
      postOutboundIssue({
        documentId: "OUT-1",
        lines: [{ lineId: "L1", quantity: 0 }],
        idempotencyKey: "idem",
        ifMatch: 7,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_INVALID_PAYLOAD" });

    await expect(
      applyStocktakeAdjustment({
        session_id: "ST-1",
        lines: [{ sku: "SKU-001", actual_qty: 1 }],
        idempotency_key: "idem",
        version: "",
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_IF_MATCH_REQUIRED" });

    vi.mocked(http.post).mockResolvedValueOnce({ receipt_id: "REC-1" });
    await expect(
      postInboundReceipt({
        documentId: "IN-1",
        lines: [{ lineId: "L1", quantity: 1 }],
        idempotencyKey: "idem",
        ifMatch: 1,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_MISSING_RECEIPT_EVIDENCE" });
  });

  it("keeps WMS ROUTE_PERMISSIONS explicit until BE/BA approves the backend permission catalog", () => {
    expect(ROUTE_PERMISSIONS[ROUTES.SCAN]).toEqual([
      P.INVENTORY_TRACE,
      P.SCAN_CLASSIFY,
    ]);
    expect(ROUTE_PERMISSIONS[ROUTES.INBOUND]).toEqual([
      P.INBOUND_CREATE,
      P.INBOUND_POST,
    ]);
    expect(ROUTE_PERMISSIONS[ROUTES.OUTBOUND]).toEqual([
      P.OUTBOUND_CREATE,
      P.OUTBOUND_POST,
    ]);
    expect(ROUTE_PERMISSIONS[ROUTES.STOCKTAKE]).toEqual([
      P.STOCKTAKE_COUNT,
      P.STOCKTAKE_ADJUST,
    ]);
    expect(ROUTE_PERMISSIONS[ROUTES.WARRANTY]).toEqual([P.WARRANTY_MANAGE]);
    expect(ROUTE_PERMISSIONS[ROUTES.REPORTS]).toEqual([
      P.REPORT_VIEW,
      P.REPORT_EXPORT,
    ]);
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
