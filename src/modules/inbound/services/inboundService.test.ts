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
import { classifyScanCodes } from "@/modules/scan/services/scanService";
import {
  hasAnyWmsPermission,
  WMS_ACTION_PERMISSIONS,
} from "@/shared/constants/wms-permissions";
import {
  createInboundDocument,
  fetchInboundDocuments,
  fetchInboundScanEntries,
  postInboundReceipt,
  scanInboundDocument,
  unscanInboundEntry,
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
      // Annex A / Annex D SCR-IN-01 đặt tên field là `source_reference`.
      source_reference: "NCC A",
      lines: [{ product_id: "SKU-1", qty_planned: 2 }],
    });

    expect(http.post).toHaveBeenCalledWith(
      "/inbound-documents",
      expect.objectContaining({
        dst_warehouse_id: "WH-1",
        source_reference: "NCC A",
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

  it("scans through the canonical Annex C endpoint with If-Match and enforces stock-neutral response", async () => {
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
    // Annex D SCR-IN-01 map scan_input -> /scan-batches/classify.codes[].
    vi.mocked(classifyScanCodes).mockResolvedValue({
      product_id: "SKU-1",
      item_id: "ITEM-1",
    } as never);
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

    expect(classifyScanCodes).toHaveBeenCalledWith({
      raw_code: "BC-001",
      context: "INBOUND",
      warehouse_id: "WH-1",
    });
    expect(http.post).toHaveBeenCalledWith(
      "/inbound-documents/DOC-1/scans",
      { line_id: "L-1", qty: 1, code_value: "BC-001", item_id: "ITEM-1" },
      { headers: { "If-Match": "4" } },
    );
    expect(result[0]).toMatchObject({
      status: "VALID",
      version: 5,
      line_id: "L-1",
    });
  });

  it("cho phép classify khi actor chỉ có scan.execute (alias Annex C của scan.classify)", async () => {
    // WAREHOUSE_STAFF được seed scan.execute chứ không phải scan.classify; route BE
    // nhận `scan.execute|scan.classify` nên FE không được chỉ nhận scan.classify.
    expect(
      hasAnyWmsPermission(
        ["scan.execute", "inbound.scan"],
        WMS_ACTION_PERMISSIONS.SCAN_CLASSIFY_GENERIC,
      ),
    ).toBe(true);
    expect(
      hasAnyWmsPermission(
        ["scan.classify"],
        WMS_ACTION_PERMISSIONS.SCAN_CLASSIFY_GENERIC,
      ),
    ).toBe(true);
    expect(
      hasAnyWmsPermission(
        ["inbound.view"],
        WMS_ACTION_PERMISSIONS.SCAN_CLASSIFY_GENERIC,
      ),
    ).toBe(false);
  });

  it("blocks a code that classifies to a different SKU than the selected line", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 4,
      lines: [
        { id: "L-1", product_id: "SKU-1", qty_planned: 2, scanned_qty: 0 },
      ],
    });
    vi.mocked(classifyScanCodes).mockResolvedValue({
      product_id: "SKU-OTHER",
      item_id: "ITEM-9",
    } as never);

    await expect(
      scanInboundDocument("DOC-1", ["BC-WRONG"], {
        lineId: "L-1",
        ifMatch: 4,
        includeCodeValue: true,
        quantity: 1,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_SCAN_SKU_MISMATCH" });
    expect(http.post).not.toHaveBeenCalled();
  });

  it("skips classify for COMPONENT quantity mode because the code is a BOX code", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 2,
      lines: [
        { id: "L-1", product_id: "SKU-COMP", qty_planned: 10, scanned_qty: 0 },
      ],
    });
    vi.mocked(http.post).mockResolvedValue({
      version: 3,
      stock_effect: "NONE",
      movement_created: false,
    });

    await scanInboundDocument("DOC-1", ["BOX-001"], {
      lineId: "L-1",
      ifMatch: 2,
      includeCodeValue: false,
      quantity: 5,
      containerId: "CT-1",
    });

    expect(classifyScanCodes).not.toHaveBeenCalled();
    expect(http.post).toHaveBeenCalledWith(
      "/inbound-documents/DOC-1/scans",
      { line_id: "L-1", qty: 5, container_id: "CT-1" },
      { headers: { "If-Match": "2" } },
    );
  });

  it("removes a scan entry before Post through the ERD unscan endpoint", async () => {
    vi.mocked(http.post).mockResolvedValue({
      document_id: "DOC-1",
      line_id: "L-1",
      inbound_scan_entry_id: "E-1",
      item_id: "ITEM-1",
      status: "REMOVED",
      required_quantity: 2,
      scanned_quantity: 1,
      stock_effect: "NONE",
      movement_created: false,
      version: 7,
    });

    const result = await unscanInboundEntry("DOC-1", "E-1", 6, "Quét sai");

    expect(http.post).toHaveBeenCalledWith(
      "/inbound-documents/DOC-1/unscan",
      { inbound_scan_entry_id: "E-1", reason: "Quét sai" },
      { headers: { "If-Match": "6" } },
    );
    expect(result).toMatchObject({
      entryId: "E-1",
      status: "REMOVED",
      scannedQuantity: 1,
      version: 7,
    });
  });

  it("fails closed if the unscan response claims a stock effect", async () => {
    vi.mocked(http.post).mockResolvedValue({
      inbound_scan_entry_id: "E-1",
      stock_effect: "INCREASE",
      version: 7,
    });

    await expect(unscanInboundEntry("DOC-1", "E-1", 6)).rejects.toMatchObject({
      code: "WMS_FE_INVALID_SCAN_RESPONSE",
    });
  });

  it("reads the document scan evidence table so it survives a page reload", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        {
          id: "E-1",
          inbound_line_id: "L-1",
          item_id: "ITEM-1",
          item_code: "ITEM-BC-000008",
          quantity: 1,
          scan_source: "CAMERA_OR_MANUAL_CODE",
          status: "ACTIVE",
          sku_code: "DCH-DRILL-DJZ10A-220V-V1",
          sku_name: "Máy khoan DJZ10A",
        },
        {
          id: "E-2",
          inbound_line_id: "L-1",
          item_id: "ITEM-2",
          quantity: 1,
          scan_source: "MANUAL",
          status: "REMOVED",
          sku_code: "DCH-DRILL-DJZ10A-220V-V1",
          sku_name: "Máy khoan DJZ10A",
        },
      ],
      meta: { current_page: 1, last_page: 1, total: 2 },
    });

    const entries = await fetchInboundScanEntries("DOC-1", "ALL");

    expect(http.getPage).toHaveBeenCalledWith(
      "/inbound-documents/DOC-1/scan-entries",
      { params: { status: "ALL", per_page: 200 } },
    );
    expect(entries).toHaveLength(2);
    expect(entries[0]).toMatchObject({
      id: "E-1",
      itemCode: "ITEM-BC-000008",
      scanSource: "CAMERA_OR_MANUAL_CODE",
      status: "ACTIVE",
    });
    expect(entries[1].status).toBe("REMOVED");
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
