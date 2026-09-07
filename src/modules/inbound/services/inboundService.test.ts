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
  completeInboundCartonScan,
  completeInboundLineSku,
  createInboundDocument,
  fetchInboundDetail,
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

  it("mang cờ chờ bổ sung thông tin SKU của BE ra danh sách, không tự suy ra ở FE", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        {
          id: "IN-MINI",
          doc_no: "PN-MINI-001",
          status: "SCANNING",
          pending_product_info: true,
          pending_product_info_count: 2,
          lines: [],
        },
        { id: "IN-OK", doc_no: "PN-OK-001", status: "SCANNING", lines: [] },
      ],
      meta: { current_page: 1, last_page: 1, total: 2 },
    });

    const result = await fetchInboundDocuments({ pendingProductInfo: true });

    expect(http.getPage).toHaveBeenCalledWith("/inbound-documents", {
      params: {
        page: 1,
        per_page: 20,
        keyword: undefined,
        status: undefined,
        pending_product_info: true,
      },
    });
    expect(result.data[0]).toMatchObject({
      pendingProductInfo: true,
      pendingProductInfoCount: 2,
    });
    // BE cũ không trả cờ: coi như đủ thông tin, không gắn nhãn đỏ oan cho phiếu.
    expect(result.data[1]).toMatchObject({
      pendingProductInfo: false,
      pendingProductInfoCount: 0,
    });
  });

  it("không gửi tham số lọc thông tin SKU khi người dùng chưa chọn", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [],
      meta: { current_page: 1, last_page: 1, total: 0 },
    });

    await fetchInboundDocuments({ status: "SCANNING" });

    expect(http.getPage).toHaveBeenCalledWith("/inbound-documents", {
      params: {
        page: 1,
        per_page: 20,
        keyword: undefined,
        status: "SCANNING",
        pending_product_info: undefined,
      },
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
    // Change Pack QR/SKU (DEC-QR-001): FE gửi RAW payload thẳng vào endpoint
    // scan — KHÔNG preflight classify (classify 404 với new item candidate),
    // KHÔNG resolve line phía client; line/identity lấy từ response BE.
    vi.mocked(http.post).mockResolvedValue({
      version: 5,
      line_id: "L-1",
      sku_code: "SKU-CODE-1",
      item_unique: "SN-0001",
      payload_format: "COMPOSITE_V1",
      resolution_status: "NEW_ITEM_CANDIDATE",
      stock_effect: "NONE",
      movement_created: false,
    });

    const result = await scanInboundDocument(
      "DOC-1",
      ["HN1|SKU=SKU-CODE-1|ITEM=SN-0001"],
      {
        ifMatch: 4,
        includeCodeValue: true,
        quantity: 1,
      },
    );

    expect(classifyScanCodes).not.toHaveBeenCalled();
    // WWHN-187 (DEV187-P1-07): mọi lần quét đều mang Idempotency-Key. Không có key
    // thì BE không phân biệt được "gửi lại" với "quét lần nữa" (DEC-SCAN-IDEMP-001).
    expect(http.post).toHaveBeenCalledWith(
      "/inbound-documents/DOC-1/scans",
      { qty: 1, code_value: "HN1|SKU=SKU-CODE-1|ITEM=SN-0001" },
      {
        headers: {
          "If-Match": "4",
          "Idempotency-Key": expect.stringMatching(/^fe:inbound-scan:.+:0$/),
        },
      },
    );
    expect(result[0]).toMatchObject({
      status: "VALID",
      version: 5,
      line_id: "L-1",
      sku: "SKU-CODE-1",
      item_unique: "SN-0001",
      resolution_status: "NEW_ITEM_CANDIDATE",
    });
  });

  it("gửi kèm line_id khi người dùng chọn dòng tường minh để BE cross-check WRONG_SKU", async () => {
    vi.mocked(http.post).mockResolvedValue({
      version: 5,
      line_id: "L-1",
      stock_effect: "NONE",
      movement_created: false,
    });

    await scanInboundDocument("DOC-1", ["BC-001"], {
      lineId: "L-1",
      ifMatch: 4,
      includeCodeValue: true,
      quantity: 1,
    });

    expect(http.post).toHaveBeenCalledWith(
      "/inbound-documents/DOC-1/scans",
      { qty: 1, code_value: "BC-001", line_id: "L-1" },
      expect.objectContaining({
        headers: expect.objectContaining({ "If-Match": "4" }),
      }),
    );
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

  it("cho phép cancel khi actor chỉ có inbound.create (route BE nhận inbound.cancel|inbound.create)", () => {
    // WAREHOUSE_STAFF được seed inbound.create chứ không phải inbound.cancel; route BE
    // POST /inbound-documents/{id}/cancel nhận `inbound.cancel|inbound.create` nên FE
    // không được chỉ nhận inbound.cancel, nếu không staff bị chặn nhầm dù BE cho phép
    // (DEV184-P1-01R).
    expect(
      hasAnyWmsPermission(
        ["inbound.create"],
        WMS_ACTION_PERMISSIONS.CANCEL_INBOUND,
      ),
    ).toBe(true);
    expect(
      hasAnyWmsPermission(
        ["inbound.cancel"],
        WMS_ACTION_PERMISSIONS.CANCEL_INBOUND,
      ),
    ).toBe(true);
    expect(
      hasAnyWmsPermission(
        ["inbound.view"],
        WMS_ACTION_PERMISSIONS.CANCEL_INBOUND,
      ),
    ).toBe(false);
  });

  it("nổi nguyên lỗi WRONG_SKU của BE khi QR composite lệch dòng đã chọn (BE là resolver authoritative)", async () => {
    // Change Pack QR/SKU (guide §12 mục 18): FE không tự phán SKU mismatch nữa —
    // BE parse payload và trả 422 WRONG_SKU; FE hiển thị, không cho override tay.
    const wrongSku = {
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          error_code: "WRONG_SKU",
          message: "SKU embedded trong QR không khớp SKU của dòng chứng từ.",
        },
      },
    };
    vi.mocked(http.post).mockRejectedValue(wrongSku);

    await expect(
      scanInboundDocument("DOC-1", ["HN1|SKU=SKU-OTHER|ITEM=SN-9"], {
        lineId: "L-1",
        ifMatch: 4,
        includeCodeValue: true,
        quantity: 1,
      }),
    ).rejects.toBe(wrongSku);
    expect(classifyScanCodes).not.toHaveBeenCalled();
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
      {
        headers: {
          "If-Match": "2",
          "Idempotency-Key": expect.stringMatching(/^fe:inbound-scan:.+:0$/),
        },
      },
    );
  });

  /**
   * WWHN-187 · DEV187-P1-07 — nhánh COMPONENT quantity-mode là chỗ duy nhất mất an
   * toàn: không có `item_id` nên `DUPLICATE_ITEM_IN_DOCUMENT` không bám vào đâu, và
   * `If-Match` chỉ bắt được version cũ. Bộ test này canh đúng ba điều kiện để BE
   * (DEC-SCAN-IDEMP-001) replay được thay vì cộng đôi `scanned_qty`.
   */
  it("gửi lại đúng hành động quét bằng key cũ và không cộng đôi khi BE trả replayed", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 2,
      lines: [
        { id: "L-1", product_id: "SKU-COMP", qty_planned: 4, scanned_qty: 2 },
      ],
    });
    // Response của lần gửi lại: BE nhận ra đúng hành động cũ, trả nguyên snapshot
    // (version giữ nguyên 2, replayed=true) chứ không bump lên 3.
    vi.mocked(http.post).mockResolvedValue({
      version: 2,
      replayed: true,
      stock_effect: "NONE",
      movement_created: false,
    });

    const result = await scanInboundDocument("DOC-1", ["BOX-001"], {
      lineId: "L-1",
      ifMatch: 2,
      includeCodeValue: false,
      quantity: 2,
      containerId: "CT-1",
      idempotencyKey: "fe:inbound-scan:attempt-cu",
    });

    expect(http.post).toHaveBeenCalledWith(
      "/inbound-documents/DOC-1/scans",
      { line_id: "L-1", qty: 2, container_id: "CT-1" },
      {
        headers: {
          "If-Match": "2",
          "Idempotency-Key": "fe:inbound-scan:attempt-cu:0",
        },
      },
    );
    expect(result[0]).toMatchObject({
      replayed: true,
      version: 2,
      idempotency_key: "fe:inbound-scan:attempt-cu:0",
    });
  });

  it("tách key theo từng mã trong một lần gọi để mã thứ hai không bị 409 IDEMPOTENCY_CONFLICT", async () => {
    // Cùng một key cho hai mã khác nhau là cùng key + khác fingerprint — đúng định
    // nghĩa 409 IDEMPOTENCY_CONFLICT của SRS §8.2. Suffix theo chỉ số tránh điều đó.
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 1,
      lines: [
        { id: "L-1", product_id: "SKU-COMP", qty_planned: 4, scanned_qty: 0 },
      ],
    });
    vi.mocked(http.post)
      .mockResolvedValueOnce({
        version: 2,
        stock_effect: "NONE",
        movement_created: false,
      })
      .mockResolvedValueOnce({
        version: 3,
        stock_effect: "NONE",
        movement_created: false,
      });

    const result = await scanInboundDocument("DOC-1", ["BOX-A", "BOX-B"], {
      lineId: "L-1",
      ifMatch: 1,
      includeCodeValue: false,
      quantity: 1,
      containerId: "CT-1",
      idempotencyKey: "fe:inbound-scan:lo-hai-ma",
    });

    expect(result[0]?.idempotency_key).toBe("fe:inbound-scan:lo-hai-ma:0");
    expect(result[1]?.idempotency_key).toBe("fe:inbound-scan:lo-hai-ma:1");
  });

  it("phân loại 409 CONCURRENCY_CONFLICT của bước quét thành reload-rồi-thử-lại (giữ nguyên key)", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 2,
      lines: [
        { id: "L-1", product_id: "SKU-COMP", qty_planned: 4, scanned_qty: 0 },
      ],
    });
    vi.mocked(http.post).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error_code: "CONCURRENCY_CONFLICT" } },
    });

    await expect(
      scanInboundDocument("DOC-1", ["BOX-001"], {
        lineId: "L-1",
        ifMatch: 2,
        includeCodeValue: false,
        quantity: 2,
        containerId: "CT-1",
      }),
    ).rejects.toMatchObject({
      code: "CONCURRENCY_CONFLICT",
      outcome: { action: "RELOAD_THEN_RETRY", reuseIdempotencyKey: true },
    });
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

  it("completes a carton scan through the audit-only endpoint (Inbound Carton Scan v1.0)", async () => {
    vi.mocked(http.post).mockResolvedValue({
      document_id: "DOC-1",
      container_id: "CT-1",
      carton_code: "CTN-001",
      actual_item_qty: 5,
      completed_at: "2026-08-21T09:00:00+07:00",
      stock_effect: "NONE",
      movement_created: false,
    });

    const result = await completeInboundCartonScan("DOC-1", "CT-1");

    // §3.3: audit-only nên không có If-Match/Idempotency-Key và không có body.
    expect(http.post).toHaveBeenCalledWith(
      "/inbound-documents/DOC-1/cartons/CT-1/complete-scan",
    );
    expect(result).toEqual({
      documentId: "DOC-1",
      containerId: "CT-1",
      cartonCode: "CTN-001",
      actualItemQty: 5,
      completedAt: "2026-08-21T09:00:00+07:00",
    });
  });

  it("fails closed if the carton complete response claims a stock effect", async () => {
    vi.mocked(http.post).mockResolvedValue({
      document_id: "DOC-1",
      container_id: "CT-1",
      carton_code: "CTN-001",
      actual_item_qty: 5,
      stock_effect: "INCREASE",
    });

    await expect(
      completeInboundCartonScan("DOC-1", "CT-1"),
    ).rejects.toMatchObject({ code: "WMS_FE_INVALID_SCAN_RESPONSE" });
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

  it("uu tien document_no/movement_no doc duoc tu BE thay vi UUID tho", async () => {
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
        document_no: "PN-20260830153015-A1B2",
        status: "POSTED",
        movement_ids: ["MOV-1"],
        movements: [{ id: "MOV-1", movement_no: "MV-20260830-A1B2C3D4" }],
        version: 6,
      },
      meta: { request_id: "REQ-1" },
    });

    const evidence = await postInboundReceipt({
      documentId: "DOC-1",
      idempotencyKey: "idem-post-1",
      ifMatch: 5,
    });

    expect(evidence).toMatchObject({
      receiptId: "DOC-1",
      receiptCode: "PN-20260830153015-A1B2",
      movementRef: "MOV-1",
      movements: [{ id: "MOV-1", code: "MV-20260830-A1B2C3D4" }],
      requestId: "REQ-1",
      version: 6,
    });
  });

  // GĐ1 scan-driven: Post chỉ cần >= 1 đơn vị đã quét (assertHasScannedQuantity);
  // thiếu/thừa so với chứng từ tham chiếu vẫn Post được, nhưng tổng scanned = 0
  // thì FE chặn trước khi gọi BE.
  it("blocks Post on FE before calling BE when nothing has been scanned", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      doc_no: "PN-001",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 5,
      lines: [
        { id: "L-1", product_id: "SKU-1", qty_planned: 2, scanned_qty: 0 },
      ],
    });

    await expect(
      postInboundReceipt({
        documentId: "DOC-1",
        idempotencyKey: "idem-post-1",
        ifMatch: 5,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_POST_REQUIRES_SCANNED" });
    expect(http.postWithMeta).not.toHaveBeenCalled();
  });

  it("allows Post with a partial scan (scan-driven receipt, no full-scan gate)", async () => {
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
    vi.mocked(http.postWithMeta).mockResolvedValue({
      data: {
        document_id: "DOC-1",
        status: "POSTED",
        movement_ids: ["MOV-1"],
        version: 6,
      },
      meta: { request_id: "REQ-1" },
    });

    await expect(
      postInboundReceipt({
        documentId: "DOC-1",
        idempotencyKey: "idem-post-1",
        ifMatch: 5,
      }),
    ).resolves.toMatchObject({ receiptId: "DOC-1", version: 6 });
    expect(http.postWithMeta).toHaveBeenCalled();
  });

  it("phân loại 412 STALE_VERSION của post-receipt thành reload-rồi-thử-lại (giữ nguyên key)", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 5,
      lines: [
        { id: "L-1", product_id: "SKU-1", qty_planned: 2, scanned_qty: 2 },
      ],
    });
    vi.mocked(http.postWithMeta).mockRejectedValue({
      isAxiosError: true,
      response: { status: 412, data: { error_code: "STALE_VERSION" } },
    });

    await expect(
      postInboundReceipt({
        documentId: "DOC-1",
        idempotencyKey: "idem-post-1",
        ifMatch: 5,
      }),
    ).rejects.toMatchObject({
      code: "STALE_VERSION",
      outcome: { action: "RELOAD_THEN_RETRY", reuseIdempotencyKey: true },
    });
  });

  it("phân loại 409 CONCURRENCY_CONFLICT của post-receipt thành reload-rồi-thử-lại", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 5,
      lines: [
        { id: "L-1", product_id: "SKU-1", qty_planned: 2, scanned_qty: 2 },
      ],
    });
    vi.mocked(http.postWithMeta).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error_code: "CONCURRENCY_CONFLICT" } },
    });

    await expect(
      postInboundReceipt({
        documentId: "DOC-1",
        idempotencyKey: "idem-post-1",
        ifMatch: 5,
      }),
    ).rejects.toMatchObject({
      code: "CONCURRENCY_CONFLICT",
      outcome: { action: "RELOAD_THEN_RETRY", reuseIdempotencyKey: true },
    });
  });

  it("phân loại 409 IDEMPOTENCY_CONFLICT của post-receipt thành bắt buộc key mới", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 5,
      lines: [
        { id: "L-1", product_id: "SKU-1", qty_planned: 2, scanned_qty: 2 },
      ],
    });
    vi.mocked(http.postWithMeta).mockRejectedValue({
      isAxiosError: true,
      response: { status: 409, data: { error_code: "IDEMPOTENCY_CONFLICT" } },
    });

    await expect(
      postInboundReceipt({
        documentId: "DOC-1",
        idempotencyKey: "idem-post-1",
        ifMatch: 5,
      }),
    ).rejects.toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
      outcome: { action: "NEW_KEY_REQUIRED", reuseIdempotencyKey: false },
    });
  });

  it("phân loại 428 PRECONDITION_REQUIRED của post-receipt thành dừng lại", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 5,
      lines: [
        { id: "L-1", product_id: "SKU-1", qty_planned: 2, scanned_qty: 2 },
      ],
    });
    vi.mocked(http.postWithMeta).mockRejectedValue({
      isAxiosError: true,
      response: { status: 428, data: { error_code: "PRECONDITION_REQUIRED" } },
    });

    await expect(
      postInboundReceipt({
        documentId: "DOC-1",
        idempotencyKey: "idem-post-1",
        ifMatch: 5,
      }),
    ).rejects.toMatchObject({
      code: "PRECONDITION_REQUIRED",
      outcome: { action: "STOP", reuseIdempotencyKey: false },
    });
  });

  it("giữ nguyên lỗi gốc (không bọc WmsConcurrencyError) khi post-receipt trả 422 FULL_POST_REQUIRED — ngoài phạm vi §8.2 theo thiết kế của classifyConcurrencyError", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      dst_warehouse_id: "WH-1",
      status: "SCANNING",
      version: 5,
      lines: [
        { id: "L-1", product_id: "SKU-1", qty_planned: 2, scanned_qty: 2 },
      ],
    });
    const originalError = {
      isAxiosError: true,
      response: {
        status: 422,
        data: {
          error_code: "FULL_POST_REQUIRED",
          message: "Còn dòng chưa quét đủ số lượng yêu cầu.",
        },
      },
    };
    vi.mocked(http.postWithMeta).mockRejectedValue(originalError);

    await expect(
      postInboundReceipt({
        documentId: "DOC-1",
        idempotencyKey: "idem-post-1",
        ifMatch: 5,
      }),
    ).rejects.toBe(originalError);
  });
});

/**
 * Cờ "SKU đủ thông tin" do BE tính (SkuInboundInfoRule) — FE chỉ đọc lại. Hai ca
 * dưới khoá đúng chỗ dễ trôi: tên trường trên payload, và mặc định khi BE cũ
 * không trả cờ (phải là ĐỦ, nếu không mọi phiếu đều bị khoá nút Ghi nhận).
 */
describe("inbound · cờ thông tin SKU trên từng dòng phiếu", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("đọc cờ thiếu thông tin và đơn vị tính hiện tại từ dòng phiếu", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "IN-1",
      doc_no: "PN-001",
      status: "SCANNING",
      version: 4,
      lines: [
        {
          id: "L-1",
          product_id: "SKU-NEW",
          product_code: "HN-NEW-0001",
          product_name: "HN-NEW-0001",
          product_unit: "",
          product_info_complete: false,
          product_missing_info: ["sku_name", "unit"],
          qty_planned: 0,
          scanned_qty: 1,
        },
      ],
    });

    const detail = await fetchInboundDetail("IN-1");

    expect(detail.lines[0].infoComplete).toBe(false);
    expect(detail.lines[0].missingInfo).toEqual(["sku_name", "unit"]);
    expect(detail.lines[0].productUnit).toBe("");
  });

  it("coi là đủ thông tin khi server không trả cờ", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "IN-1",
      status: "SCANNING",
      version: 1,
      lines: [{ id: "L-1", product_id: "SKU-1", scanned_qty: 1 }],
    });

    const detail = await fetchInboundDetail("IN-1");

    expect(detail.lines[0].infoComplete).toBe(true);
    expect(detail.lines[0].missingInfo).toEqual([]);
  });

  it("gửi tên + đơn vị tính lên đúng dòng phiếu và bỏ qua danh mục không chọn", async () => {
    vi.mocked(http.patch).mockResolvedValue({
      document_id: "IN-1",
      line_id: "L-2",
      sku_id: "SKU-NEW",
      sku_code: "HN-NEW-0001",
      sku_name: "Máy khoan mới",
      unit: "Cái",
      info_complete: true,
      missing_info: [],
    });

    const result = await completeInboundLineSku("IN-1", "L-2", {
      skuName: "  Máy khoan mới  ",
      unit: " Cái ",
      brandId: "BRAND-1",
    });

    expect(http.patch).toHaveBeenCalledWith(
      "/inbound-documents/IN-1/lines/L-2/sku",
      { sku_name: "Máy khoan mới", unit: "Cái", brand_id: "BRAND-1" },
    );
    expect(result.infoComplete).toBe(true);
  });

  it("đòi quyền quét nhập kho trước khi gọi server", async () => {
    expect(
      hasAnyWmsPermission(
        ["inbound.scan"],
        WMS_ACTION_PERMISSIONS.SCAN_INBOUND,
        false,
      ),
    ).toBe(true);
  });
});
