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

import { ROUTE_PERMISSIONS } from "@/app/router/access";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { http } from "@/shared/api/http";
import {
  WMS_ACTION_PERMISSIONS,
  WMS_PERMISSION_CATALOG as P,
  canonicalizeWmsPermission,
  hasAnyWmsPermission,
  resolveWmsPermissionAlternatives,
} from "@/shared/constants/wms-permissions";
import { ROUTES } from "@/shared/constants/routes";
import { WmsContractError } from "@/shared/api/wms-contract";
import { reconcileRuntimePermissionCatalog } from "@/shared/api/wms-permission-catalog";
import {
  WMS_CONTRACT_BASELINE,
  WMS_EXTERNAL_GATE_LIST,
  WMS_FE_IMPLEMENTATION_READINESS,
  WMS_FINAL_SIGNOFF,
  WMS_REVIEW_GATES,
  assertFinalSignoffAllowed,
} from "@/shared/api/wms-contract-signoff";
import {
  classifyScanCodes,
  fetchPhysicalCodes,
} from "@/modules/scan/services/scanService";
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

const allCriticalPermissions = [
  P.SCAN_CLASSIFY,
  P.INBOUND_POST,
  P.OUTBOUND_POST,
  P.STOCKTAKE_ADJUST,
  P.REPORT_EXPORT,
  P.WARRANTY_TEMP_ONLY,
];

function grant(...permissionCodes: string[]) {
  authMocks.getState.mockReturnValue({
    isSuperAdmin: false,
    permissionCodes,
  });
}

describe("WWHN-153 contract and FE sign-off guards", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.post).mockReset();
    vi.mocked(http.patch).mockReset();
    vi.mocked(http.downloadBlob).mockReset();
    authMocks.getState.mockReset();
    grant();
  });

  it("uses canonical Scan runtime URL and validates the exact response code set", async () => {
    grant(P.SCAN_CLASSIFY);
    expect(WMS_CONTRACT_BASELINE.apiBasePath).toBe("/api/v1");
    expect(API_ENDPOINTS.SCAN_BATCHES_CLASSIFY).toBe("/scan/classify");
    expect(WMS_CONTRACT_BASELINE.scanClassify.runtimePath).toBe(
      "/api/v1/scan/classify",
    );

    vi.mocked(http.post).mockResolvedValue({
      batch_id: "B1",
      request_id: "REQ-SCAN-1",
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
      request_id: "REQ-SCAN-1",
      items: [{ code_value: "QR-001", status: "VALID" }],
    });

    expect(http.post).toHaveBeenCalledWith("/scan/classify", {
      codes: ["QR-001"],
      warehouse_id: 12,
      scan_source: "manual",
    });

    vi.mocked(http.post).mockResolvedValue({
      batch_id: "B2",
      items: [
        {
          code_value: "QR-WRONG",
          code_type: "QR",
          status: "VALID",
          scan_source: "manual",
        },
      ],
    });
    await expect(
      classifyScanCodes({ codes: ["QR-002"] }),
    ).rejects.toMatchObject({ code: "WMS_FE_INVALID_SCAN_RESPONSE" });
  });

  it("rejects invalid Scan payload and response before polluted state reaches UI", async () => {
    grant(P.SCAN_CLASSIFY);
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

  it("blocks sensitive service calls without action permission", async () => {
    await expect(
      classifyScanCodes({ codes: ["QR-001"] }),
    ).rejects.toMatchObject({ code: "WMS_FE_PERMISSION_REQUIRED" });
    await expect(
      postInboundReceipt({
        documentId: "IN-1",
        lines: [{ lineId: "L1", quantity: 1 }],
        idempotencyKey: "idem-inbound-1",
        ifMatch: 1,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_PERMISSION_REQUIRED" });
    await expect(
      postOutboundIssue({
        documentId: "OUT-1",
        lines: [{ lineId: "L1", quantity: 1 }],
        idempotencyKey: "idem-outbound-1",
        ifMatch: 1,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_PERMISSION_REQUIRED" });
    await expect(
      applyStocktakeAdjustment({
        session_id: "ST-1",
        lines: [{ sku: "SKU-1", actual_qty: 1 }],
        idempotency_key: "idem-stocktake-1",
        version: "1",
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_PERMISSION_REQUIRED" });
    await expect(
      downloadXntReportExcel({ from: "2026-08-01", to: "2026-08-02" }),
    ).rejects.toMatchObject({ code: "WMS_FE_PERMISSION_REQUIRED" });
    expect(http.post).not.toHaveBeenCalled();
    expect(http.downloadBlob).not.toHaveBeenCalled();
  });

  it("rejects duplicate receipt and issue lines before HTTP", async () => {
    grant(P.INBOUND_POST, P.OUTBOUND_POST);
    await expect(
      postInboundReceipt({
        documentId: "IN-1",
        lines: [
          { lineId: "L1", quantity: 1 },
          { lineId: "L1", quantity: 2 },
        ],
        idempotencyKey: "idem-inbound-1",
        ifMatch: 1,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_DUPLICATE_LINE" });
    await expect(
      postOutboundIssue({
        documentId: "OUT-1",
        lines: [
          { lineId: "L2", quantity: 1 },
          { lineId: "L2", quantity: 2 },
        ],
        idempotencyKey: "idem-outbound-1",
        ifMatch: 1,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_DUPLICATE_LINE" });
    expect(http.post).not.toHaveBeenCalled();
  });

  it("requires idempotency, optimistic locking and complete success evidence", async () => {
    grant(...allCriticalPermissions);
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
      .mockResolvedValueOnce({
        session_id: "ST-1",
        status: "ADJUSTED",
        adjusted_lines: 1,
        total_variance: -1,
        movement_ref: "MOV-ADJ-1",
        request_id: "REQ-ADJ-1",
      });

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
    await expect(
      applyStocktakeAdjustment({
        session_id: "ST-1",
        lines: [{ sku: "SKU-001", actual_qty: 3, reason: "COUNT" }],
        idempotency_key: "idem-stocktake-1",
        version: "9",
      }),
    ).resolves.toMatchObject({
      session_id: "ST-1",
      movement_ref: "MOV-ADJ-1",
      request_id: "REQ-ADJ-1",
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

  it("rejects incomplete adjustment success evidence", async () => {
    grant(P.STOCKTAKE_ADJUST);
    vi.mocked(http.post).mockResolvedValue({
      session_id: "ST-1",
      status: "ADJUSTED",
      adjusted_lines: 1,
      total_variance: 1,
    });
    await expect(
      applyStocktakeAdjustment({
        session_id: "ST-1",
        lines: [{ sku: "SKU-1", actual_qty: 2 }],
        idempotency_key: "idem-stocktake-1",
        version: "1",
      }),
    ).rejects.toMatchObject({
      code: "WMS_FE_MISSING_ADJUSTMENT_EVIDENCE",
    });
  });

  it("reconciles runtime permission catalog and explicit aliases", () => {
    const result = reconcileRuntimePermissionCatalog({
      data: [
        { permission_code: "stocktake.apply" },
        { code: "REPORT_EXPORT" },
        "inbound.post",
      ],
    });
    expect(result.canonicalRuntimeCodes).toEqual(
      expect.arrayContaining([
        "stocktake.adjust",
        "report.export",
        "inbound.post",
      ]),
    );
    expect(result.aliasesObserved).toEqual(
      expect.arrayContaining([
        { runtime: "stocktake.apply", canonical: "stocktake.adjust" },
        { runtime: "REPORT_EXPORT", canonical: "report.export" },
      ]),
    );
    expect(result.missingCanonicalCodes).toContain("outbound.post");
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
    grant(P.REPORT_EXPORT);
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
    expect(hasAnyWmsPermission(["REPORT_EXPORT"], ["report.export"])).toBe(
      true,
    );
    expect(
      hasAnyWmsPermission(["stocktake.manage"], ["stocktake.adjust"]),
    ).toBe(false);
    expect(
      resolveWmsPermissionAlternatives(["stocktake.apply", "stocktake.manage"]),
    ).toEqual(["stocktake.adjust"]);
    expect(
      resolveWmsPermissionAlternatives(["report.view", "legacy.report"]),
    ).toEqual(["report.view", "legacy.report"]);
  });

  it("separates page-entry RBAC from sensitive action permissions", () => {
    expect(ROUTE_PERMISSIONS[ROUTES.SCAN]).toEqual([
      P.INVENTORY_TRACE,
      P.SCAN_CLASSIFY,
    ]);
    expect(ROUTE_PERMISSIONS[ROUTES.STOCKTAKE]).toEqual([P.STOCKTAKE_COUNT]);
    expect(ROUTE_PERMISSIONS[ROUTES.REPORTS]).toEqual([P.REPORT_VIEW]);
    expect(ROUTE_PERMISSIONS[ROUTES.WARRANTY]).toEqual([P.WARRANTY_MANAGE]);

    expect(WMS_ACTION_PERMISSIONS).toMatchObject({
      POST_RECEIPT: [P.INBOUND_POST],
      POST_ISSUE: [P.OUTBOUND_POST],
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

    grant(P.WARRANTY_TEMP_ONLY);
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

  it("keeps final sign-off blocked until all independent gates pass", () => {
    expect(WMS_FE_IMPLEMENTATION_READINESS.status).toBe(
      "FE_OWNED_REMEDIATIONS_COMPLETE_PENDING_INDEPENDENT_GATES",
    );
    expect(WMS_REVIEW_GATES).toHaveLength(9);
    expect(WMS_EXTERNAL_GATE_LIST.map((gate) => gate.id)).toEqual([
      "WWHN-31",
      "WWHN-150",
      "WWHN-151",
      "WWHN-152",
      "WWHN-180",
      "WWHN-182",
      "WWHN-183",
    ]);
    expect(WMS_FINAL_SIGNOFF.finalAllowed).toBe(false);
    expect(WMS_FINAL_SIGNOFF.status).toBe("CONDITIONAL_PASS_NOT_FINAL");
    expect(assertFinalSignoffAllowed).toThrow(/FE-FINAL-SIGNOFF/);
  });
});
