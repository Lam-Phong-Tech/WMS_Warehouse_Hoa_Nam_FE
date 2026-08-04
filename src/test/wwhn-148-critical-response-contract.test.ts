import { beforeEach, describe, expect, it, vi } from "vitest";

const authMocks = vi.hoisted(() => ({
  getState: vi.fn(),
}));

vi.mock("@/shared/store/auth.store", () => ({
  useAuthStore: {
    getState: authMocks.getState,
  },
}));

vi.mock("@/shared/api/http", () => ({
  http: {
    post: vi.fn(),
  },
}));

import { http } from "@/shared/api/http";
import { postInboundReceipt } from "@/modules/receiving/services/receivingService";
import { postOutboundIssue } from "@/modules/shipping/services/shippingService";
import { applyStocktakeAdjustment } from "@/modules/stocktake/services/stocktakeService";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

describe("WWHN-148 critical response normalization boundary", () => {
  beforeEach(() => {
    vi.mocked(http.post).mockReset();
    authMocks.getState.mockReturnValue({
      isSuperAdmin: false,
      permissionCodes: [P.INBOUND_POST, P.OUTBOUND_POST, P.STOCKTAKE_ADJUST],
    });
  });

  it("accepts canonical snake_case success evidence", async () => {
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
        total_variance: 0,
        movement_ref: "MOV-ADJ-1",
        request_id: "REQ-ADJ-1",
      });

    await expect(
      postInboundReceipt({
        documentId: "IN-1",
        lines: [{ lineId: "IN-L1", quantity: 1 }],
        idempotencyKey: "IDEM-IN-1",
        ifMatch: 1,
      }),
    ).resolves.toMatchObject({
      receiptId: "REC-1",
      movementRef: "MOV-IN-1",
      requestId: "REQ-IN-1",
    });

    await expect(
      postOutboundIssue({
        documentId: "OUT-1",
        lines: [{ lineId: "OUT-L1", quantity: 1 }],
        idempotencyKey: "IDEM-OUT-1",
        ifMatch: 1,
      }),
    ).resolves.toMatchObject({
      issueId: "ISS-1",
      movementRef: "MOV-OUT-1",
      requestId: "REQ-OUT-1",
    });

    await expect(
      applyStocktakeAdjustment({
        session_id: "ST-1",
        lines: [{ sku: "SKU-1", actual_qty: 1 }],
        idempotency_key: "IDEM-ADJ-1",
        version: "1",
      }),
    ).resolves.toMatchObject({
      session_id: "ST-1",
      movement_ref: "MOV-ADJ-1",
      request_id: "REQ-ADJ-1",
    });
  });

  it("accepts only the documented temporary alias whitelist", async () => {
    vi.mocked(http.post)
      .mockResolvedValueOnce({
        receiptId: "REC-ALIAS",
        movementRef: "MOV-IN-ALIAS",
        requestId: "REQ-IN-ALIAS",
      })
      .mockResolvedValueOnce({
        issueId: "ISS-ALIAS",
        movementRef: "MOV-OUT-ALIAS",
        requestId: "REQ-OUT-ALIAS",
      })
      .mockResolvedValueOnce({
        sessionId: "ST-ALIAS",
        status: "ADJUSTED",
        adjustedLines: 1,
        totalVariance: 0,
        movementRef: "MOV-ADJ-ALIAS",
        requestId: "REQ-ADJ-ALIAS",
      });

    await expect(
      postInboundReceipt({
        documentId: "IN-ALIAS",
        lines: [{ lineId: "IN-L1", quantity: 1 }],
        idempotencyKey: "IDEM-IN-ALIAS",
        ifMatch: 1,
      }),
    ).resolves.toMatchObject({ receiptId: "REC-ALIAS" });

    await expect(
      postOutboundIssue({
        documentId: "OUT-ALIAS",
        lines: [{ lineId: "OUT-L1", quantity: 1 }],
        idempotencyKey: "IDEM-OUT-ALIAS",
        ifMatch: 1,
      }),
    ).resolves.toMatchObject({ issueId: "ISS-ALIAS" });

    await expect(
      applyStocktakeAdjustment({
        session_id: "ST-ALIAS",
        lines: [{ sku: "SKU-1", actual_qty: 1 }],
        idempotency_key: "IDEM-ADJ-ALIAS",
        version: "1",
      }),
    ).resolves.toMatchObject({ session_id: "ST-ALIAS" });
  });

  it("rejects undocumented receipt aliases", async () => {
    vi.mocked(http.post).mockResolvedValue({
      receiptNumber: "REC-UNKNOWN",
      movement: "MOV-UNKNOWN",
      request: "REQ-UNKNOWN",
    });

    await expect(
      postInboundReceipt({
        documentId: "IN-UNKNOWN",
        lines: [{ lineId: "IN-L1", quantity: 1 }],
        idempotencyKey: "IDEM-IN-UNKNOWN",
        ifMatch: 1,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_MISSING_RECEIPT_EVIDENCE" });
  });

  it("rejects undocumented issue aliases", async () => {
    vi.mocked(http.post).mockResolvedValue({
      issueNumber: "ISS-UNKNOWN",
      movement: "MOV-UNKNOWN",
      request: "REQ-UNKNOWN",
    });

    await expect(
      postOutboundIssue({
        documentId: "OUT-UNKNOWN",
        lines: [{ lineId: "OUT-L1", quantity: 1 }],
        idempotencyKey: "IDEM-OUT-UNKNOWN",
        ifMatch: 1,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_MISSING_ISSUE_EVIDENCE" });
  });

  it("rejects undocumented adjustment aliases", async () => {
    vi.mocked(http.post).mockResolvedValue({
      session: "ST-UNKNOWN",
      status: "ADJUSTED",
      movement: "MOV-UNKNOWN",
      request: "REQ-UNKNOWN",
    });

    await expect(
      applyStocktakeAdjustment({
        session_id: "ST-UNKNOWN",
        lines: [{ sku: "SKU-1", actual_qty: 1 }],
        idempotency_key: "IDEM-ADJ-UNKNOWN",
        version: "1",
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_INVALID_ADJUSTMENT_RESPONSE" });
  });
});
