import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { http } from "@/shared/api/http";
import { scanOutboundItem } from "@/modules/outbound/services/mvpOutboundService";

vi.mock("@/shared/api/http", () => ({
  http: { get: vi.fn(), post: vi.fn(), patch: vi.fn(), put: vi.fn() },
}));

function read(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

/**
 * WWHN-195 — DEV195-P1-01R2 và DEV195-P1-05R2 ở phía FE.
 *
 * Hai điều bộ test này khoá lại:
 *
 * 1. Chỉ FE mới biết mã đến từ camera hay bàn phím. Server có `code_value` thì
 *    luôn suy ra HARDWARE, nên nếu FE không khai `scan_source` thì mọi lần quét
 *    camera bị ghi sai vào audit — ERD bảng 25 có sẵn giá trị CAMERA nhưng không
 *    đường nào tới được.
 * 2. FE không được giữ hàm gọi endpoint không tồn tại. `PATCH /outbound-documents/{id}`
 *    đã bị §8.1 loại bỏ, giữ lại hàm gọi nó chỉ tạo ra lỗi 404 lúc chạy thật.
 */
describe("WWHN-195 — chế độ quét khai tường minh ở FE", () => {
  beforeEach(() => {
    vi.mocked(http.post).mockReset();
  });

  it("gửi scan_source lên API khi được chỉ định", async () => {
    vi.mocked(http.post).mockResolvedValueOnce({
      document_id: "OUT-1",
      line_id: "LINE-1",
      item_id: "ITEM-1",
      quantity: 1,
      required_quantity: 1,
      scanned_quantity: 1,
      version: 2,
      scan_source: "CAMERA",
      scan_source_origin: "EXPLICIT",
      label_status: "DRAFT",
    });

    const result = await scanOutboundItem({
      documentId: "OUT-1",
      lineId: "LINE-1",
      codeValue: "QR-ABC",
      ifMatch: 1,
      scanSource: "CAMERA",
    });

    expect(http.post).toHaveBeenCalledWith(
      "/outbound-documents/OUT-1/scans",
      expect.objectContaining({
        line_id: "LINE-1",
        quantity: 1,
        code_value: "QR-ABC",
        scan_source: "CAMERA",
      }),
      expect.objectContaining({
        headers: expect.objectContaining({ "If-Match": "1" }),
      }),
    );
    expect(result.scanSource).toBe("CAMERA");
    expect(result.scanSourceOrigin).toBe("EXPLICIT");
  });

  it("không gửi scan_source khi caller không khai (server tự suy luận)", async () => {
    vi.mocked(http.post).mockResolvedValueOnce({
      document_id: "OUT-1",
      line_id: "LINE-1",
      version: 2,
      scan_source: "HARDWARE",
      scan_source_origin: "INFERRED",
    });

    const result = await scanOutboundItem({
      documentId: "OUT-1",
      lineId: "LINE-1",
      codeValue: "QR-ABC",
      ifMatch: 1,
    });

    const body = vi.mocked(http.post).mock.calls[0][1] as Record<
      string,
      unknown
    >;
    expect(body).not.toHaveProperty("scan_source");
    expect(result.scanSourceOrigin).toBe("INFERRED");
  });

  it("màn hình xuất kho khai đúng nguồn cho từng đường quét", () => {
    const modal = read(
      "src/modules/outbound/components/AlignedOutboundDetailModal.tsx",
    );
    // Camera modal decode ra mã -> CAMERA; ô nhập tay / Enter -> MANUAL.
    expect(modal).toContain('scanSource: "CAMERA"');
    expect(modal).toContain('scanSource: "MANUAL"');
    // AC-SRS-005 + NFR-SRS-021: không được khoá mode theo phiếu.
    expect(modal).not.toContain("lockedScanSource");
    expect(modal).not.toContain("scanModeLocked");
  });

  it("không còn hàm FE gọi endpoint đã bị §8.1 loại bỏ", () => {
    const service = read("src/modules/outbound/services/mvpOutboundService.ts");
    expect(service).not.toContain(
      "export async function updateOutboundDocument",
    );
    expect(service).not.toContain(
      "export async function createOutboundDocument",
    );

    const aligned = read(
      "src/modules/outbound/services/alignedOutboundService.ts",
    );
    expect(aligned).not.toContain("updateOutboundDocument");
  });
});
