import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getState: vi.fn(),
}));

vi.unmock("@/app/router/access");
vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: {
    getState: authMocks.getState,
  },
}));
vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    downloadBlob: vi.fn(),
  },
}));

import { ROUTES } from "@/shared/constants/routes";
import { ROUTE_PERMISSIONS } from "@/app/router/access";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import {
  WMS_ACTION_PERMISSIONS,
  WMS_PERMISSION_CATALOG as P,
  canonicalizeWmsPermission,
  hasAnyWmsPermission,
} from "@/shared/constants/wms-permissions";
import { http } from "@/shared/api/http";
import {
  classifyScanCodes,
  fetchPhysicalCodes,
} from "@/modules/scan/services/scanService";
import { WmsContractError } from "@/shared/api/wms-contract";
import {
  WMS_CONTRACT_BASELINE,
  WMS_EXTERNAL_GATES,
  WMS_FE_IMPLEMENTATION_READINESS,
  WMS_FINAL_SIGNOFF,
  assertFinalSignoffAllowed,
} from "@/shared/api/wms-contract-signoff";
import { postInboundReceipt } from "@/modules/receiving/services/receivingService";
import { postOutboundIssue } from "@/modules/shipping/services/shippingService";
import { applyStocktakeAdjustment } from "@/modules/stocktake/services/stocktakeService";
import {
  downloadXntReportExcel,
  fetchReportsHub,
  fetchWarrantyDefectsReport,
  fetchXntReport,
} from "@/modules/reports/services/reportsService";
import { createWarrantyCase } from "@/modules/warranty/services/warrantyService";

describe("WWHN-181 contract and FE sign-off guards", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.post).mockReset();
    vi.mocked(http.patch).mockReset();
    vi.mocked(http.downloadBlob).mockReset();
    authMocks.getState.mockReset();
    authMocks.getState.mockReturnValue({
      isSuperAdmin: false,
      permissionCodes: [],
    });
  });

  it("uses the canonical Scan runtime URL without duplicating /api/v1", async () => {
    expect(WMS_CONTRACT_BASELINE.apiBasePath).toBe("/api/v1");
    expect(API_ENDPOINTS.SCAN_BATCHES_CLASSIFY).toBe("/scan/classify");
    expect(WMS_CONTRACT_BASELINE.scanClassify.runtimePath).toBe(
      "/api/v1/scan/classify",
    );
    expect(API_ENDPOINTS.SCAN_BATCHES_CLASSIFY).not.toContain("/api/v1");

    vi.mocked(http.post).mockResolvedValue({
      batch_id: "B1",
      items: [
        {
          code_value: "QR-001",
          code_type: "QR",
          status: "VALID",
          scan_source: "manual",
        },
      ],
    });

    await expect(
      classifyScanCodes({
        codes: ["QR-001"],
        warehouse_id: 12,
        scan_source: "manual",
      }),
    ).resolves.toMatchObject({
      batch_id: "B1",
      items: [{ code_value: "QR-001", status: "VALID" }],
    });

    expect(http.post).toHaveBeenCalledWith("/scan/classify", {
      codes: ["QR-001"],
      warehouse_id: 12,
      scan_source: "manual",
    });
  });

  it("rejects invalid Scan payload and response before polluted state reaches UI", async () => {
    await expect(
      classifyScanCodes({ codes: ["QR-001", " QR-001 "] }),
    ).rejects.toMatchObject({ code: "WMS_SCAN_DUPLICATE" });
    await expect(
      classifyScanCodes({ codes: ["QR-002"], warehouse_id: 0 }),
    ).rejects.toBeInstanceOf(WmsContractError);
    expect(http.post).not.toHaveBeenCalled();

    vi.mocked(http.post).mockResolvedValue({
      batch_id: "B2",
      items: [{ code_value: "QR-002", status: "UNSUPPORTED" }],
    });
    await expect(
      classifyScanCodes({ codes: ["QR-002"] }),
    ).rejects.toMatchObject({ code: "WMS_FE_INVALID_SCAN_RESPONSE" });
  });

  it("keeps unapproved physical-code and report proposals fail-closed", async () => {
    await expect(fetchPhysicalCodes({ page: 1 })).rejects.toMatchObject({
      code: "WMS_FE_CONTRACT_NOT_APPROVED",
    });
    await expect(fetchReportsHub()).rejects.toMatchObject({
      code: "WMS_FE_CONTRACT_NOT_APPROVED",
    });
    await expect(fetchWarrantyDefectsReport()).rejects.toMatchObject({
      code: "WMS_FE_CONTRACT_NOT_APPROVED",
    });

    expect(http.get).not.toHaveBeenCalled();
    expect(http.getPage).not.toHaveBeenCalled();
  });

  it("keeps canonical XNT report and export mappings active", async () => {
    vi.mocked(http.get).mockResolvedValue([]);
    vi.mocked(http.downloadBlob).mockResolvedValue(new Blob(["xlsx"]));

    await fetchXntReport({ from: "2026-08-01", to: "2026-08-01" });
    await downloadXntReportExcel({
      from: "2026-08-01",
      to: "2026-08-01",
    });

    expect(http.get).toHaveBeenCalledWith("/reports/inventory-xnt", {
      params: { from: "2026-08-01", to: "2026-08-01" },
    });
    expect(http.downloadBlob).toHaveBeenCalledWith(
      "/reports/inventory-xnt/export-excel",
      { params: { from: "2026-08-01", to: "2026-08-01" } },
    );
  });

  it("normalizes only explicit legacy permission aliases", () => {
    expect(canonicalizeWmsPermission("stocktake.apply")).toBe(
      "stocktake.adjust",
    );
    expect(canonicalizeWmsPermission("REPORT_EXPORT")).toBe("report.export");
    expect(canonicalizeWmsPermission("stocktake.manage")).toBe(
      "stocktake.manage",
    );
    expect(
      hasAnyWmsPermission(["REPORT_EXPORT"], ["report.export"]),
    ).toBe(true);
    expect(
      hasAnyWmsPermission(["stocktake.manage"], ["stocktake.adjust"]),
    ).toBe(false);
  });

  it("separates page-entry RBAC from sensitive action permissions", () => {
    expect(ROUTE_PERMISSIONS[ROUTES.SCAN]).toEqual([
      P.INVENTORY_TRACE,
      P.SCAN_CLASSIFY,
    ]);
    expect(ROUTE_PERMISSIONS[ROUTES.STOCKTAKE]).toEqual([
      P.STOCKTAKE_COUNT,
    ]);
    expect(ROUTE_PERMISSIONS[ROUTES.REPORTS]).toEqual([P.REPORT_VIEW]);
    expect(ROUTE_PERMISSIONS[ROUTES.WARRANTY]).toEqual([P.WARRANTY_MANAGE]);

    expect(WMS_ACTION_PERMISSIONS).toMatchObject({
      SCAN_INBOUND: [P.SCAN_INBOUND],
      SCAN_OUTBOUND: [P.SCAN_OUTBOUND],
      SCAN_WARRANTY: [P.SCAN_WARRANTY],
      APPLY_STOCKTAKE_ADJUSTMENT: [P.STOCKTAKE_ADJUST],
      WARRANTY_TEMP_ONLY: [P.WARRANTY_TEMP_ONLY],
      EXPORT_REPORT: [P.REPORT_EXPORT],
    });
  });

  it("requires warranty.temp_only before any TEMP_ONLY request is sent", async () => {
    const payload = {
      identification_type: "TEMP_ONLY" as const,
      customer_name: "Khach hang",
      customer_phone: "0900000000",
      defect_code: "POWER",
      defect_description: "Khong len nguon",
      missing_code_reason: "Mat tem",
      manual_product_description: "May khoan mau do",
    };

    await expect(createWarrantyCase(payload)).rejects.toMatchObject({
      code: "WMS_FE_PERMISSION_REQUIRED",
    });
    expect(http.post).not.toHaveBeenCalled();

    authMocks.getState.mockReturnValue({
      isSuperAdmin: false,
      permissionCodes: ["WARRANTY_TEMP_ONLY"],
    });
    vi.mocked(http.post).mockResolvedValue({
      id: "WAR-1",
      case_code: "BH-001",
      identification_type: "TEMP_ONLY",
      temporary_item_code: "TEMP-001",
      status: "RECEIVED",
      priority: "MEDIUM",
    });

    await createWarrantyCase(payload);
    expect(http.post).toHaveBeenCalledWith("/warranty/cases", payload);
  });

  it("requires idempotency and optimistic locking for stock-changing flows", async () => {
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

  it("keeps final sign-off blocked until independent BE, QA2, and BA gates pass", () => {
    expect(WMS_FE_IMPLEMENTATION_READINESS.status).toBe(
      "FE_IMPLEMENTED_PENDING_INDEPENDENT_GATES",
    );
    expect(Object.values(WMS_EXTERNAL_GATES).map((gate) => gate.id)).toEqual([
      "WWHN-180",
      "WWHN-182",
      "WWHN-183",
    ]);
    expect(WMS_FINAL_SIGNOFF.finalAllowed).toBe(false);
    expect(WMS_FINAL_SIGNOFF.status).toBe("CONDITIONAL_PASS_NOT_FINAL");
    expect(assertFinalSignoffAllowed).toThrow(/FE-FINAL-SIGNOFF/);
  });
});
