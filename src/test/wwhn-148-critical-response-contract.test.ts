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
    get: vi.fn(),
    post: vi.fn(),
    postWithMeta: vi.fn(),
  },
}));

import { http } from "@/shared/api/http";
import { postInboundReceipt } from "@/modules/receiving/services/receivingService";
import { postOutboundIssue } from "@/modules/shipping/services/shippingService";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";

const fullyScannedDocument = (lineId: string, version = 1) => ({
  version,
  status: "SCANNING",
  lines: [
    {
      id: lineId,
      product_id: "SKU-1",
      qty_planned: 1,
      scanned_qty: 1,
    },
  ],
});

function mockMutationPreReads(): void {
  vi.mocked(http.get)
    .mockResolvedValueOnce(fullyScannedDocument("IN-L1"))
    .mockResolvedValueOnce(fullyScannedDocument("OUT-L1"));
}

describe("WWHN-148 critical response normalization boundary", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.post).mockReset();
    vi.mocked(http.postWithMeta).mockReset();
    authMocks.getState.mockReturnValue({
      isSuperAdmin: false,
      permissionCodes: [P.INBOUND_POST, P.OUTBOUND_POST, P.REVERSAL_POST],
    });
  });

  it("accepts canonical snake_case success evidence", async () => {
    mockMutationPreReads();
    vi.mocked(http.postWithMeta)
      .mockResolvedValueOnce({
        data: {
          document_id: "REC-1",
          movement_ids: ["MOV-IN-1"],
          version: 2,
        },
        meta: { request_id: "REQ-IN-1" },
      })
      .mockResolvedValueOnce({
        data: {
          document_id: "ISS-1",
          movement_ids: ["MOV-OUT-1"],
          version: 2,
        },
        meta: { request_id: "REQ-OUT-1" },
      })
      .mockResolvedValueOnce({
        data: {
          session_id: "ST-1",
          status: "APPLIED",
          variance_count: 1,
          session_version: 2,
          movement_ids: ["MOV-ADJ-1"],
        },
        meta: { request_id: "REQ-ADJ-1" },
      });

    await expect(
      postInboundReceipt({
        documentId: "IN-1",
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
        idempotencyKey: "IDEM-OUT-1",
        ifMatch: 1,
      }),
    ).resolves.toMatchObject({
      issueId: "ISS-1",
      movementRef: "MOV-OUT-1",
      requestId: "REQ-OUT-1",
    });
  });

  it("accepts only the documented temporary alias whitelist", async () => {
    mockMutationPreReads();
    vi.mocked(http.postWithMeta)
      .mockResolvedValueOnce({
        data: {
          id: "REC-ALIAS",
          movements: [{ movement_id: "MOV-IN-ALIAS" }],
          request_id: "REQ-IN-ALIAS",
        },
        meta: {},
      })
      .mockResolvedValueOnce({
        data: {
          id: "ISS-ALIAS",
          movements: [{ movement_id: "MOV-OUT-ALIAS" }],
          request_id: "REQ-OUT-ALIAS",
        },
        meta: {},
      })
      .mockResolvedValueOnce({
        data: {
          sessionId: "ST-ALIAS",
          status: "APPLIED",
          variance_count: 1,
          session_version: 2,
          movement_ids: ["MOV-ADJ-ALIAS"],
          requestId: "REQ-ADJ-ALIAS",
        },
        meta: {},
      });

    await expect(
      postInboundReceipt({
        documentId: "IN-ALIAS",
        idempotencyKey: "IDEM-IN-ALIAS",
        ifMatch: 1,
      }),
    ).resolves.toMatchObject({ receiptId: "REC-ALIAS" });

    await expect(
      postOutboundIssue({
        documentId: "OUT-ALIAS",
        idempotencyKey: "IDEM-OUT-ALIAS",
        ifMatch: 1,
      }),
    ).resolves.toMatchObject({ issueId: "ISS-ALIAS" });
  });

  it("rejects undocumented receipt aliases", async () => {
    vi.mocked(http.get).mockResolvedValueOnce(fullyScannedDocument("IN-L1"));
    vi.mocked(http.postWithMeta).mockResolvedValueOnce({
      data: {
        receiptNumber: "REC-UNKNOWN",
        movement: "MOV-UNKNOWN",
        request: "REQ-UNKNOWN",
      },
      meta: {},
    });

    await expect(
      postInboundReceipt({
        documentId: "IN-UNKNOWN",
        idempotencyKey: "IDEM-IN-UNKNOWN",
        ifMatch: 1,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_MISSING_RECEIPT_EVIDENCE" });
  });

  it("rejects undocumented issue aliases", async () => {
    vi.mocked(http.get).mockResolvedValueOnce(fullyScannedDocument("OUT-L1"));
    vi.mocked(http.postWithMeta).mockResolvedValueOnce({
      data: {
        issueNumber: "ISS-UNKNOWN",
        movement: "MOV-UNKNOWN",
        request: "REQ-UNKNOWN",
      },
      meta: {},
    });

    await expect(
      postOutboundIssue({
        documentId: "OUT-UNKNOWN",
        idempotencyKey: "IDEM-OUT-UNKNOWN",
        ifMatch: 1,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_MISSING_ISSUE_EVIDENCE" });
  });

  // REQ-SRS-037 (Must; nhãn `DEC-NO-STOCKTAKE-001` CHƯA có formal approval — xem
  // ghi chú thẩm quyền ở src/shared/constants/routes.ts): không còn adjustment surface
  // để chuẩn hoá response; sửa sai sau Post đi qua Reversal (xem reverse-service.test.ts).
});
