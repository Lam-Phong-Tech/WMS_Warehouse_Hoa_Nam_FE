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
import { fetchOutboundDetail } from "./mvpOutboundService";

describe("fetchOutboundDetail created timestamp", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps doc_date as document date and maps created_at to createdAt", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "DOC-1",
      doc_no: "PX-20261109085929-43E7TD",
      doc_date: "2026-11-09",
      created_at: "2026-11-09 08:59:29",
      created_by_name: "Người tạo phiếu xuất",
      scanned_by_names: ["An quét", "Bình quét", "  ", null],
      posted_by_name: null,
      posted_by: "user-uuid",
      cancelled_by_name: "Người hủy phiếu xuất",
      src_warehouse_id: "WH-1",
      recipient_name: "Khách test",
      status: "DRAFT",
      version: 1,
      lines: [],
    });

    const detail = await fetchOutboundDetail("DOC-1");

    expect(detail.document.date).toBe("2026-11-09");
    expect(detail.document.createdAt).toBe("2026-11-09 08:59:29");
    expect(detail.document.createdBy).toBe("Người tạo phiếu xuất");
    expect(detail.document.scannedByNames).toEqual(["An quét", "Bình quét"]);
    expect(detail.document.postedBy).toBeUndefined();
    expect(detail.document.cancelledBy).toBe("Người hủy phiếu xuất");
  });
});
