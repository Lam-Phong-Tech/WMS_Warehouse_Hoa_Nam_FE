import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
    postWithMeta: vi.fn(),
    patch: vi.fn(),
  },
}));
vi.mock("@/shared/api/wms-action-permission", () => ({
  assertWmsActionPermission: vi.fn(),
}));
vi.mock("@/modules/scan/services/scanService", () => ({
  classifyScanCodes: vi.fn(),
}));

import { http } from "@/shared/api/http";
import {
  createInboundDocument,
  fetchInboundDocuments,
  postInboundReceipt,
  scanInboundDocument,
  updateInboundDocument,
} from "./inboundService";

describe("inbound real API contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("delegates keyword, status and pagination to the server and preserves meta", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        {
          id: "IN-1",
          doc_no: "PN-001",
          source_name: "NCC A",
          doc_date: "2026-08-12",
          dst_warehouse_id: "WH-1",
          status: "DRAFT",
          version: 3,
          lines: [
            { id: "L-1", product_id: "SKU-1", qty_planned: 5, scanned_qty: 0 },
          ],
        },
      ],
      meta: {
        current_page: 2,
        per_page: 20,
        last_page: 4,
        total: 63,
        from: 21,
        to: 40,
      },
    });

    const result = await fetchInboundDocuments({
      search: " NCC A ",
      status: "DRAFT",
      page: 2,
      per_page: 20,
    });

    expect(http.getPage).toHaveBeenCalledWith("/inbound-documents", {
      params: {
        page: 2,
        per_page: 20,
        keyword: "NCC A",
        status: "DRAFT",
      },
    });
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      id: "IN-1",
      code: "PN-001",
      source: "NCC A",
      expected: 5,
      scanned: 0,
      status: "DRAFT",
      version: 3,
    });
    expect(result.meta).toMatchObject({
      current_page: 2,
      last_page: 4,
      total: 63,
    });
  });

  it("fails closed when BE returns a superseded inbound status", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [{ id: "IN-LEGACY", status: "APPROVED", lines: [] }],
      meta: { current_page: 1, last_page: 1, total: 1 },
    });

    await expect(fetchInboundDocuments()).rejects.toMatchObject({
      code: "WMS_FE_INVALID_INBOUND_STATUS",
    });
  });

  it("creates a DRAFT through the canonical inbound endpoint with an idempotency key", async () => {
    vi.mocked(http.post).mockResolvedValue({
      id: "DOC-1",
      doc_no: "PN-001",
      doc_date: "2026-08-12",
      dst_warehouse_id: "WH-1",
      source_name: "NCC A",
      status: "DRAFT",
      version: 1,
      lines: [
        { id: "L-1", product_id: "SKU-1", qty_planned: 2, scanned_qty: 0 },
      ],
    });

    const result = await createInboundDocument({
      doc_date: "2026-08-12",
      dst_warehouse_id: "WH-1",
      source_name: "NCC A",
      lines: [{ product_id: "SKU-1", qty_planned: 2 }],
    });

    expect(http.post).toHaveBeenCalledWith(
      "/inbound-documents",
      expect.objectContaining({
        dst_warehouse_id: "WH-1",
        lines: [{ product_id: "SKU-1", qty_planned: 2 }],
      }),
      expect.objectContaining({
        headers: {
          "Idempotency-Key": expect.stringContaining("fe:inbound-create:"),
        },
      }),
    );
    expect(result.status).toBe("DRAFT");
  });

  it("updates Expected with If-Match and preserves existing line id", async () => {
    vi.mocked(http.patch).mockResolvedValue({
      id: "DOC-1",
      doc_no: "PN-001",
      doc_date: "2026-08-12",
      dst_warehouse_id: "WH-1",
      source_name: "NCC A",
      status: "SCANNING",
      version: 5,
      lines: [
        { id: "L-1", product_id: "SKU-1", qty_planned: 3, scanned_qty: 2 },
      ],
    });

    await updateInboundDocument(
      "DOC-1",
      {
        lines: [{ id: "L-1", product_id: "SKU-1", qty_planned: 3 }],
      },
      4,
    );

    expect(http.patch).toHaveBeenCalledWith(
      "/inbound-documents/DOC-1",
      { lines: [{ id: "L-1", product_id: "SKU-1", qty_planned: 3 }] },
      { headers: { "If-Match": "4" } },
    );
  });

  it("scans through the canonical endpoint with If-Match and enforces stock-neutral response", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      doc_no: "PN-001",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 4,
      lines: [
        { id: "L-1", product_id: "SKU-1", qty_planned: 2, scanned_qty: 1 },
      ],
    });
    vi.mocked(http.post).mockResolvedValue({
      version: 5,
      stock_effect: "NONE",
      movement_created: false,
    });

    const result = await scanInboundDocument("DOC-1", ["BC-001"], {
      lineId: "L-1",
      ifMatch: 4,
      includeCodeValue: true,
      quantity: 1,
    });

    expect(http.post).toHaveBeenCalledWith(
      "/inbound-documents/DOC-1/scan",
      { line_id: "L-1", qty: 1, code_value: "BC-001" },
      { headers: { "If-Match": "4" } },
    );
    expect(result[0]).toMatchObject({
      status: "VALID",
      version: 5,
      line_id: "L-1",
    });
  });

  it("full-posts only fully scanned data and sends If-Match plus Idempotency-Key", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      doc_no: "PN-001",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 5,
      lines: [
        { id: "L-1", product_id: "SKU-1", qty_planned: 2, scanned_qty: 2 },
      ],
    });
    vi.mocked(http.postWithMeta).mockResolvedValue({
      data: {
        document_id: "DOC-1",
        status: "POSTED",
        movement_ids: ["MOV-1"],
        version: 6,
      },
      meta: { request_id: "REQ-1" },
    });

    const evidence = await postInboundReceipt({
      documentId: "DOC-1",
      idempotencyKey: "idem-post-1",
      ifMatch: 5,
    });

    expect(http.postWithMeta).toHaveBeenCalledWith(
      "/inbound-documents/DOC-1/post-receipt",
      undefined,
      { headers: { "If-Match": "5", "Idempotency-Key": "idem-post-1" } },
    );
    expect(evidence).toMatchObject({
      receiptId: "DOC-1",
      movementRef: "MOV-1",
      requestId: "REQ-1",
      version: 6,
    });
  });

  it("blocks Full Post on FE before calling BE when any line is not fully scanned", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      doc_no: "PN-001",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 5,
      lines: [
        { id: "L-1", product_id: "SKU-1", qty_planned: 2, scanned_qty: 1 },
      ],
    });

    await expect(
      postInboundReceipt({
        documentId: "DOC-1",
        idempotencyKey: "idem-post-1",
        ifMatch: 5,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_POST_REQUIRES_FULL_SCAN" });
    expect(http.postWithMeta).not.toHaveBeenCalled();
  });
});
