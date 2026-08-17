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
    postWithMeta: vi.fn(),
    patch: vi.fn(),
    downloadBlob: vi.fn(),
  },
}));

import { http } from "@/shared/api/http";
import {
  postInboundReceipt,
  scanInboundDocument,
} from "@/modules/receiving/services/receivingService";
import {
  postOutboundIssue,
  scanOutboundDocument,
} from "@/modules/shipping/services/shippingService";
import { classifyScanCodes } from "@/modules/scan/services/scanService";
import {
  WWHN_181_EXACT_REVIEW,
  WMS_FINAL_SIGNOFF,
  assertFinalSignoffAllowed,
} from "@/shared/api/wms-contract-signoff";
import {
  WMS_ACTION_PERMISSIONS,
  WMS_PERMISSION_CATALOG as P,
  canonicalizeWmsPermission,
  hasAnyWmsPermission,
} from "@/shared/constants/wms-permissions";

const WAREHOUSE_ID = "11111111-1111-4111-8111-111111111111";
const PRODUCT_ID = "44444444-4444-4444-8444-444444444444";

function grant(...permissionCodes: string[]) {
  authMocks.getState.mockReturnValue({
    isSuperAdmin: false,
    permissionCodes,
  });
}

function classification(
  rawCode: string,
  context: "INBOUND" | "OUTBOUND" | "INVENTORY" | "TRACE" | "WARRANTY_TEMP_ONLY",
) {
  return {
    raw_code: rawCode,
    context,
    classification: "SKU",
    item_id: null,
    sku_id: "33333333-3333-4333-8333-333333333333",
    product_id: PRODUCT_ID,
    stock_status: "AVAILABLE",
    object_status: "ACTIVE",
    resolved_source: "products.code",
    contract_version: "WWHN-150.1.1.0",
    stock_effect: "NONE",
    movement_created: false,
    posting_event_created: false,
    idempotency_cache_written: false,
    current_location: {
      warehouse_id: WAREHOUSE_ID,
      warehouse_code: "WH-01",
      warehouse_name: "Kho 01",
    },
  };
}

describe("WWHN-181 exact BE v1.7 guards", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.post).mockReset();
    vi.mocked(http.postWithMeta).mockReset();
    vi.mocked(http.patch).mockReset();
    vi.mocked(http.downloadBlob).mockReset();
    authMocks.getState.mockReset();
    grant();
  });

  it("pins exact contract identity and records BE handoff drift", () => {
    expect(WWHN_181_EXACT_REVIEW.contractVersion).toBe("1.7.0");
    expect(WWHN_181_EXACT_REVIEW.exactBeSha).toBe(
      "fc534ed8c00dadd91ce60e7bac5a8660dda74d08",
    );
    expect(WWHN_181_EXACT_REVIEW.backendReleaseManifestSha256).toBe(
      "ba8bc5841b5865095e51d21064ead90ad4c37129ee28142a3f507b497ddcc776",
    );
    expect(WWHN_181_EXACT_REVIEW.reviewResult).toBe(
      "CHANGES_REQUIRED_BE_HANDOFF_DRIFT",
    );
    expect(WWHN_181_EXACT_REVIEW.independentSourceFindings).toHaveLength(2);
  });

  it("keeps scan classify read-only and rejects side effects", async () => {
    grant(P.SCAN_CLASSIFY);
    vi.mocked(http.post).mockResolvedValue(
      classification("RAW-01", "TRACE"),
    );

    await expect(
      classifyScanCodes({
        raw_code: " RAW-01 ",
        context: "TRACE",
        warehouse_id: WAREHOUSE_ID,
      }),
    ).resolves.toMatchObject({
      raw_code: "RAW-01",
      stock_effect: "NONE",
      movement_created: false,
      posting_event_created: false,
      idempotency_cache_written: false,
    });

    vi.mocked(http.post).mockResolvedValue({
      ...classification("RAW-02", "TRACE"),
      movement_created: true,
    });
    await expect(
      classifyScanCodes({
        raw_code: "RAW-02",
        context: "TRACE",
        warehouse_id: WAREHOUSE_ID,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_INVALID_SCAN_RESPONSE" });
  });

  it("blocks stock-changing actions before HTTP without action permission", async () => {
    await expect(
      postInboundReceipt({
        documentId: "IN-1",
        idempotencyKey: "idem-inbound-1",
        ifMatch: 1,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_PERMISSION_REQUIRED" });
    await expect(
      postOutboundIssue({
        documentId: "OUT-1",
        idempotencyKey: "idem-outbound-1",
        ifMatch: 1,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_PERMISSION_REQUIRED" });
    expect(http.postWithMeta).not.toHaveBeenCalled();
  });

  it("resolves inbound raw code to canonical line_id + qty with If-Match", async () => {
    grant(P.INBOUND_SCAN, P.SCAN_CLASSIFY);
    vi.mocked(http.get).mockResolvedValue({
      id: "IN-1",
      version: 1,
      dst_warehouse_id: WAREHOUSE_ID,
      lines: [
        {
          id: "LINE-IN-1",
          product_id: PRODUCT_ID,
          product_code: "SKU-001",
          qty_planned: 2,
          scanned_qty: 0,
        },
      ],
    });
    vi.mocked(http.post)
      .mockResolvedValueOnce(classification("RAW-IN", "INBOUND"))
      .mockResolvedValueOnce({
        line_id: "LINE-IN-1",
        stock_effect: "NONE",
        movement_created: false,
        version: 2,
      });

    await scanInboundDocument("IN-1", ["RAW-IN"]);

    expect(http.post).toHaveBeenNthCalledWith(1, "/scan/classify", {
      raw_code: "RAW-IN",
      context: "INBOUND",
      warehouse_id: WAREHOUSE_ID,
    });
    // Path chuẩn của Annex C scanInboundDocument là /scans (số nhiều).
    expect(http.post).toHaveBeenNthCalledWith(
      2,
      "/inbound-documents/IN-1/scans",
      { line_id: "LINE-IN-1", qty: 1, code_value: "RAW-IN" },
      { headers: { "If-Match": "1" } },
    );
  });

  it("resolves outbound raw codes and sends item-level canonical scan with If-Match", async () => {
    grant(P.SCAN_OUTBOUND, P.SCAN_CLASSIFY);
    vi.mocked(http.get).mockResolvedValue({
      id: "OUT-1",
      version: 1,
      src_warehouse_id: WAREHOUSE_ID,
      lines: [
        {
          id: "LINE-OUT-1",
          product_id: PRODUCT_ID,
          product_code: "SKU-001",
          qty_planned: 1,
          scanned_qty: 0,
        },
      ],
    });
    vi.mocked(http.post)
      .mockResolvedValueOnce(classification("RAW-OUT", "OUTBOUND"))
      .mockResolvedValueOnce({
        line_id: "LINE-OUT-1",
        stock_effect: "NONE",
        movement_created: false,
        version: 2,
      });

    await scanOutboundDocument("OUT-1", ["RAW-OUT"]);

    // Annex C scanOutboundDocument: POST /outbound-documents/{id}/scans + If-Match.
    expect(http.post).toHaveBeenNthCalledWith(
      2,
      "/outbound-documents/OUT-1/scans",
      { line_id: "LINE-OUT-1", quantity: 1, code_value: "RAW-OUT" },
      { headers: { "If-Match": "1" } },
    );
    expect(JSON.stringify(vi.mocked(http.post).mock.calls)).not.toContain(
      '"codes"',
    );
  });

  it("posts inbound atomically with If-Match + Idempotency-Key", async () => {
    grant(P.INBOUND_POST);
    vi.mocked(http.get).mockResolvedValue({
      id: "IN-1",
      version: 99,
      status: "SCANNING",
      lines: [{ id: "L1", qty_planned: 1, scanned_qty: 1 }],
    });
    vi.mocked(http.postWithMeta).mockResolvedValue({
      data: {
        document_id: "IN-1",
        status: "POSTED",
        movement_ids: ["MOV-IN-1"],
        version: 100,
      },
      meta: { request_id: "REQ-IN-1" },
    });

    await expect(
      postInboundReceipt({
        documentId: "IN-1",
        idempotencyKey: "idem-inbound-1",
        ifMatch: 99,
      }),
    ).resolves.toMatchObject({
      receiptId: "IN-1",
      movementRef: "MOV-IN-1",
      requestId: "REQ-IN-1",
    });
    expect(http.postWithMeta).toHaveBeenCalledWith(
      "/inbound-documents/IN-1/post-receipt",
      undefined,
      {
        headers: {
          "If-Match": "99",
          "Idempotency-Key": "idem-inbound-1",
        },
      },
    );
  });

  it("posts outbound atomically with If-Match + Idempotency-Key", async () => {
    grant(P.OUTBOUND_POST);
    vi.mocked(http.get).mockResolvedValue({
      id: "OUT-1",
      version: 7,
      status: "SCANNING",
      lines: [{ id: "L1", qty_planned: 1, scanned_qty: 1 }],
    });
    vi.mocked(http.postWithMeta).mockResolvedValue({
      data: {
        document_id: "OUT-1",
        status: "POSTED",
        movement_ids: ["MOV-OUT-1"],
        version: 8,
      },
      meta: { request_id: "REQ-OUT-1" },
    });

    await expect(
      postOutboundIssue({
        documentId: "OUT-1",
        idempotencyKey: "idem-outbound-1",
        ifMatch: 7,
      }),
    ).resolves.toMatchObject({
      issueId: "OUT-1",
      movementRef: "MOV-OUT-1",
      requestId: "REQ-OUT-1",
    });
    expect(http.postWithMeta).toHaveBeenCalledWith(
      "/outbound-documents/OUT-1/post-issue",
      undefined,
      {
        headers: {
          "If-Match": "7",
          "Idempotency-Key": "idem-outbound-1",
        },
      },
    );
  });

  it("blocks atomic posting until every planned line is fully scanned", async () => {
    grant(P.INBOUND_POST);
    vi.mocked(http.get).mockResolvedValue({
      id: "IN-1",
      version: 1,
      status: "SCANNING",
      lines: [{ id: "L1", qty_planned: 2, scanned_qty: 1 }],
    });

    await expect(
      postInboundReceipt({
        documentId: "IN-1",
        idempotencyKey: "idem-inbound-1",
        ifMatch: 1,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_POST_REQUIRES_FULL_SCAN" });
    expect(http.postWithMeta).not.toHaveBeenCalled();
  });

  // REQ-SRS-037 / DEC-NO-STOCKTAKE-001: "apply variance/adjustment" đã bị gỡ khỏi
  // baseline MVP nên không còn hành vi nào để test; thay bằng guard chống hồi quy.
  it("keeps every stocktake capability out of the FE permission surface", () => {
    const codes: string[] = [
      ...Object.keys(P),
      ...Object.values(P),
      ...Object.keys(WMS_ACTION_PERMISSIONS),
    ];
    expect(
      codes.filter((code) => code.toLowerCase().includes("stocktake")),
    ).toEqual([]);
  });

  it("keeps permission aliases explicit and non-escalating", () => {
    expect(hasAnyWmsPermission(["REPORT_EXPORT"], ["report.export"])).toBe(
      true,
    );
    expect(canonicalizeWmsPermission("scan.outbound")).toBe("outbound.scan");
    // putaway.manage không được ngầm nâng thành container.manage.
    expect(
      hasAnyWmsPermission(["putaway.manage"], ["container.manage"]),
    ).toBe(false);
  });

  it("keeps final sign-off fail-closed", () => {
    expect(WMS_FINAL_SIGNOFF.finalAllowed).toBe(false);
    expect(WMS_FINAL_SIGNOFF.status).toBe("BLOCKED_FAIL_CLOSED");
    expect(WMS_FINAL_SIGNOFF.evaluator).toContain("wwhn-181:final");
    expect(assertFinalSignoffAllowed).toThrow(/FE-FINAL-SIGNOFF/);
  });
});
