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
import { fetchInboundDocuments } from "./inboundService";

describe("inbound list contract", () => {
  beforeEach(() => {
    vi.mocked(http.getPage).mockReset();
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
          lines: [{ id: "L-1", product_id: "SKU-1", qty_planned: 5, scanned_qty: 0 }],
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
    expect(result.meta).toMatchObject({ current_page: 2, last_page: 4, total: 63 });
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
});
