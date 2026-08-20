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

import { http } from "@/shared/api/http";
import { scanOutboundItem } from "./mvpOutboundService";

/**
 * Change Pack QR/SKU 20/08/2026 (DEC-QR-001, guide §12): outbound scan gửi RAW
 * composite payload; line_id là tùy chọn (server tự match theo SKU embedded) và
 * response mang identity đã parse để UI hiển thị dòng/SKU được match.
 */
describe("scanOutboundItem — composite PRODUCT QR contract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("không gửi line_id khi người dùng không chọn dòng — server tự match theo SKU embedded", async () => {
    vi.mocked(http.post).mockResolvedValue({
      document_id: "DOC-1",
      line_id: "L-AUTO",
      item_id: "ITEM-1",
      sku_code: "DCH-DRILL",
      item_unique: "SN-0001",
      payload_format: "COMPOSITE_V1",
      resolution_status: "EXISTING_ITEM",
      quantity: 1,
      required_quantity: 2,
      scanned_quantity: 1,
      version: 5,
      label_status: "NOT_CREATED",
      scan_source: "CAMERA",
      scan_source_origin: "EXPLICIT",
    });

    const result = await scanOutboundItem({
      documentId: "DOC-1",
      codeValue: "HN1|SKU=DCH-DRILL|ITEM=SN-0001",
      scanSource: "CAMERA",
      ifMatch: 4,
    });

    expect(http.post).toHaveBeenCalledWith(
      "/outbound-documents/DOC-1/scans",
      {
        quantity: 1,
        code_value: "HN1|SKU=DCH-DRILL|ITEM=SN-0001",
        scan_source: "CAMERA",
      },
      { headers: { "If-Match": "4" } },
    );
    expect(result).toMatchObject({
      lineId: "L-AUTO",
      itemId: "ITEM-1",
      skuCode: "DCH-DRILL",
      itemUnique: "SN-0001",
      payloadFormat: "COMPOSITE_V1",
      resolutionStatus: "EXISTING_ITEM",
    });
  });

  it("vẫn gửi line_id khi người dùng chọn dòng tường minh (BE cross-check WRONG_SKU)", async () => {
    vi.mocked(http.post).mockResolvedValue({
      document_id: "DOC-1",
      line_id: "L-1",
      quantity: 1,
      required_quantity: 2,
      scanned_quantity: 1,
      version: 6,
    });

    await scanOutboundItem({
      documentId: "DOC-1",
      lineId: "L-1",
      codeValue: "SN-LEGACY-01",
      ifMatch: 5,
    });

    expect(http.post).toHaveBeenCalledWith(
      "/outbound-documents/DOC-1/scans",
      { line_id: "L-1", quantity: 1, code_value: "SN-LEGACY-01" },
      { headers: { "If-Match": "5" } },
    );
  });
});
