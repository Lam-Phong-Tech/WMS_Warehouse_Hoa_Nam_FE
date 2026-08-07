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
import { applyStocktakeAdjustment } from "@/modules/stocktake/services/stocktakeService";
import { classifyScanCodes } from "@/modules/scan/services/scanService";
import {
  WWHN_181_EXACT_REVIEW,
  WMS_FINAL_SIGNOFF,
  assertFinalSignoffAllowed,
} from "@/shared/api/wms-contract-signoff";
import {
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
  context: "INBOUND" | "OUTBOUND" | "STOCKTAKE" | "WARRANTY_TEMP_ONLY",
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
      classification("RAW-01", "STOCKTAKE"),
    );

    await expect(
      classifyScanCodes({
        raw_code: " RAW-01 ",
        context: "STOCKTAKE",
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
      ...classification("RAW-02", "STOCKTAKE"),
      movement_created: true,
    });
    await expect(
      classifyScanCodes({
        raw_code: "RAW-02",
        context: "STOCKTAKE",
        warehouse_id: WAREHOUSE_ID,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_INVALID_SCAN_RESPONSE" });
  });

  it("blocks stock-changing actions before HTTP without action permission", async () => {
    await expect(
      postInboundReceipt({
        documentId: "IN-1",
        idempotencyKey: "idem-inbound-1",
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_PERMISSION_REQUIRED" });
    await expect(
      postOutboundIssue({
        documentId: "OUT-1",
        idempotencyKey: "idem-outbound-1",
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
    expect(http.postWithMeta).not.toHaveBeenCalled();
  });

  it("resolves inbound raw code to canonical line_id + qty", async () => {
    grant(P.SCAN_INBOUND, P.SCAN_CLASSIFY);
    vi.mocked(http.get).mockResolvedValue({
      id: "IN-1",
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
      });

    await scanInboundDocument("IN-1", ["RAW-IN"]);

    expect(http.post).toHaveBeenNthCalledWith(1, "/scan/classify", {
      raw_code: "RAW-IN",
      context: "INBOUND",
      warehouse_id: WAREHOUSE_ID,
    });
    expect(http.post).toHaveBeenNthCalledWith(
      2,
      "/inbound-documents/IN-1/scan",
      { line_id: "LINE-IN-1", qty: 1 },
    );
  });

  it("resolves outbound raw codes and never sends the obsolete codes[] payload", async () => {
    grant(P.SCAN_OUTBOUND, P.SCAN_CLASSIFY);
    vi.mocked(http.get).mockResolvedValue({
      id: "OUT-1",
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
      });

    await scanOutboundDocument("OUT-1", ["RAW-OUT"]);

    expect(http.post).toHaveBeenNthCalledWith(
      2,
      "/outbound-documents/OUT-1/scan",
      { line_id: "LINE-OUT-1", qty: 1 },
    );
    expect(JSON.stringify(vi.mocked(http.post).mock.calls)).not.toContain(
      '"codes"',
    );
  });

  it("posts inbound atomically with Idempotency-Key only", async () => {
    grant(P.INBOUND_POST);
    vi.mocked(http.get).mockResolvedValue({
      id: "IN-1",
      status: "approved",
      lines: [{ id: "L1", qty_planned: 1, scanned_qty: 1 }],
    });
    vi.mocked(http.postWithMeta).mockResolvedValue({
      data: {
        id: "IN-1",
        status: "received",
        movements: [{ id: "MOV-IN-1" }],
      },
      meta: { request_id: "REQ-IN-1" },
    });

    await expect(
      postInboundReceipt({
        documentId: "IN-1",
        lines: [{ lineId: "L1", quantity: 1 }],
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
      { headers: { "Idempotency-Key": "idem-inbound-1" } },
    );
  });

  it("posts outbound atomically and preserves meta.request_id", async () => {
    grant(P.OUTBOUND_POST);
    vi.mocked(http.get).mockResolvedValue({
      id: "OUT-1",
      status: "approved",
      lines: [{ id: "L1", qty_planned: 1, scanned_qty: 1 }],
    });
    vi.mocked(http.postWithMeta).mockResolvedValue({
      data: {
        id: "OUT-1",
        status: "issued",
        movements: [{ movement_id: "MOV-OUT-1" }],
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
      { headers: { "Idempotency-Key": "idem-outbound-1" } },
    );
  });

  it("blocks atomic posting until every planned line is fully scanned", async () => {
    grant(P.INBOUND_POST);
    vi.mocked(http.get).mockResolvedValue({
      id: "IN-1",
      lines: [{ id: "L1", qty_planned: 2, scanned_qty: 1 }],
    });

    await expect(
      postInboundReceipt({
        documentId: "IN-1",
        idempotencyKey: "idem-inbound-1",
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_POST_REQUIRES_FULL_SCAN" });
    expect(http.postWithMeta).not.toHaveBeenCalled();
  });

  it("applies the complete APPROVED variance set", async () => {
    grant(P.STOCKTAKE_ADJUST);
    vi.mocked(http.get).mockResolvedValue([
      {
        variance_id: "11111111-1111-4111-8111-111111111111",
        status: "APPROVED",
        grain_key: "SKU-001",
        expected_at_count: 5,
        actual_qty: 4,
        variance_qty: -1,
      },
      {
        variance_id: "22222222-2222-4222-8222-222222222222",
        status: "APPROVED",
        grain_key: "SKU-002",
        expected_at_count: 3,
        actual_qty: 5,
        variance_qty: 2,
      },
    ]);
    vi.mocked(http.postWithMeta).mockResolvedValue({
      data: {
        session_id: "ST-1",
        status: "APPLIED",
        session_version: 10,
        variance_count: 2,
        movement_ids: ["MOV-ADJ-1"],
        request_hash: "hash-1",
      },
      meta: { request_id: "REQ-ADJ-1" },
    });

    await expect(
      applyStocktakeAdjustment({
        session_id: "ST-1",
        lines: [{ sku: "SKU-001", actual_qty: 4, reason: "COUNT" }],
        idempotency_key: "idem-stocktake-1",
        version: "9",
      }),
    ).resolves.toMatchObject({
      session_id: "ST-1",
      status: "APPLIED",
      adjusted_lines: 2,
      request_id: "REQ-ADJ-1",
    });
    expect(http.postWithMeta).toHaveBeenCalledWith(
      "/stocktake-sessions/ST-1/apply-adjustment",
      {
        session_version: 9,
        variance_ids: [
          "11111111-1111-4111-8111-111111111111",
          "22222222-2222-4222-8222-222222222222",
        ],
        reason: "COUNT",
      },
      { headers: { "Idempotency-Key": "idem-stocktake-1" } },
    );
  });

  it("keeps permission aliases explicit and non-escalating", () => {
    expect(canonicalizeWmsPermission("stocktake.apply")).toBe(
      "stocktake.adjust",
    );
    expect(hasAnyWmsPermission(["REPORT_EXPORT"], ["report.export"])).toBe(
      true,
    );
    expect(
      hasAnyWmsPermission(["stocktake.manage"], ["stocktake.adjust"]),
    ).toBe(false);
  });

  it("keeps final sign-off fail-closed", () => {
    expect(WMS_FINAL_SIGNOFF.finalAllowed).toBe(false);
    expect(WMS_FINAL_SIGNOFF.status).toBe("BLOCKED_FAIL_CLOSED");
    expect(WMS_FINAL_SIGNOFF.evaluator).toContain("wwhn-181:final");
    expect(assertFinalSignoffAllowed).toThrow(/FE-FINAL-SIGNOFF/);
  });
});
