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
    getPage: vi.fn(),
    post: vi.fn(),
  },
}));

import { http } from "@/shared/api/http";
import {
  cancelComponentIssue,
  createComponentIssue,
  fetchComponentIssueDocument,
  fetchComponentIssueDocuments,
  postComponentIssue,
  scanComponentIssue,
} from "./componentIssueService";

describe("componentIssueService (COMP-01)", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.post).mockReset();
    authMocks.getState.mockReturnValue({
      isSuperAdmin: false,
      permissionCodes: ["warranty.component_issue"],
    });
  });

  it("fetchComponentIssueDocuments lọc theo warranty_case_id", async () => {
    vi.mocked(http.getPage).mockResolvedValue({
      data: [
        {
          document: { id: "ci-1", status: "DRAFT", version: 1 },
          lines: [],
        },
      ],
      meta: { total: 1 },
    });

    const page = await fetchComponentIssueDocuments({
      warranty_case_id: "wc-1",
    });

    expect(http.getPage).toHaveBeenCalledWith("/warranty-component-issues", {
      params: expect.objectContaining({ warranty_case_id: "wc-1" }),
    });
    expect(page.data[0]).toMatchObject({ id: "ci-1", status: "DRAFT" });
  });

  it("fetchComponentIssueDocument gọi GET detail (WAR-P0-01) và chuẩn hóa document + lines", async () => {
    vi.mocked(http.get).mockResolvedValue({
      document: {
        id: "ci-2",
        component_issue_no: "CI-0002",
        warehouse_id: "wh-1",
        warranty_case_id: "wc-2",
        status: "SCANNING",
        version: 2,
      },
      lines: [
        {
          id: "line-1",
          sku_id: "sku-1",
          sku_code: "LK-PIN-20V",
          sku_name: "Pin 20V",
          required_qty: "2",
          scanned_qty: "1",
          items: [{ id: "item-1", quantity: 1, status: "ACTIVE" }],
        },
      ],
      stock_effect: "NONE",
      movement_created: false,
    });

    const document = await fetchComponentIssueDocument("ci-2");

    expect(http.get).toHaveBeenCalledWith("/warranty-component-issues/ci-2");
    expect(document).toMatchObject({
      id: "ci-2",
      component_issue_no: "CI-0002",
      warranty_case_id: "wc-2",
      status: "SCANNING",
      version: 2,
    });
    expect(document.lines[0]).toMatchObject({
      sku_code: "LK-PIN-20V",
      required_qty: 2,
      scanned_qty: 1,
    });
    expect(document.lines[0].items).toHaveLength(1);
  });

  it("fail-closed khi thiếu warranty.component_issue: không gọi HTTP", async () => {
    authMocks.getState.mockReturnValue({
      isSuperAdmin: false,
      permissionCodes: ["warranty.manage"],
    });
    await expect(fetchComponentIssueDocument("ci-x")).rejects.toMatchObject({
      code: "WMS_FE_PERMISSION_REQUIRED",
    });
    expect(http.get).not.toHaveBeenCalled();
  });

  describe("createComponentIssue", () => {
    it("luôn gửi purpose=WARRANTY và giữ stock-neutral trước Post", async () => {
      vi.mocked(http.post).mockResolvedValue({
        document: { id: "ci-3", status: "DRAFT", version: 1 },
        lines: [],
        stock_effect: "NONE",
        movement_created: false,
      });

      await createComponentIssue({
        warehouse_id: "wh-1",
        warranty_case_id: "wc-3",
        document_date: "2026-08-13",
        lines: [{ sku_id: "sku-1", required_qty: 2 }],
      });

      const [url, body] = vi.mocked(http.post).mock.calls[0];
      expect(url).toBe("/warranty-component-issues");
      expect(body).toMatchObject({
        purpose: "WARRANTY",
        warranty_case_id: "wc-3",
        lines: [{ sku_id: "sku-1", required_qty: 2 }],
      });
    });

    it("chặn tạo phiếu không có line", async () => {
      await expect(
        createComponentIssue({
          warehouse_id: "wh-1",
          warranty_case_id: "wc-3",
          document_date: "2026-08-13",
          lines: [],
        }),
      ).rejects.toMatchObject({ code: "WMS_FE_COMPONENT_LINES_REQUIRED" });
      expect(http.post).not.toHaveBeenCalled();
    });

    it("từ chối response tạo phiếu mà đã trừ tồn", async () => {
      vi.mocked(http.post).mockResolvedValue({
        document: { id: "ci-4" },
        stock_effect: "DECREASE",
      });
      await expect(
        createComponentIssue({
          warehouse_id: "wh-1",
          warranty_case_id: "wc-4",
          document_date: "2026-08-13",
          lines: [{ sku_id: "sku-1", required_qty: 1 }],
        }),
      ).rejects.toMatchObject({
        code: "WMS_FE_INVALID_COMPONENT_ISSUE_RESPONSE",
      });
    });
  });

  describe("scanComponentIssue", () => {
    it("gửi If-Match + payload scan, scan không được tạo movement", async () => {
      vi.mocked(http.post).mockResolvedValue({
        version: 3,
        scanned_qty: 2,
        status: "SCANNING",
        stock_effect: "NONE",
        movement_created: false,
      });

      const result = await scanComponentIssue({
        documentId: "ci-5",
        lineId: "line-1",
        codeValue: "SER-LK-01",
        quantity: 1,
        ifMatch: 2,
      });

      const [url, body, config] = vi.mocked(http.post).mock.calls[0];
      expect(url).toBe("/warranty-component-issues/ci-5/scans");
      expect(body).toEqual({
        line_id: "line-1",
        code_value: "SER-LK-01",
        quantity: 1,
      });
      expect(
        (config as { headers: Record<string, string> }).headers["If-Match"],
      ).toBe("2");
      expect(result).toEqual({
        version: 3,
        scanned_qty: 2,
        status: "SCANNING",
      });
    });

    it("từ chối response scan đã tạo movement", async () => {
      vi.mocked(http.post).mockResolvedValue({
        version: 3,
        movement_created: true,
      });
      await expect(
        scanComponentIssue({
          documentId: "ci-5",
          lineId: "line-1",
          codeValue: "SER-LK-01",
          quantity: 1,
          ifMatch: 2,
        }),
      ).rejects.toMatchObject({
        code: "WMS_FE_INVALID_COMPONENT_ISSUE_RESPONSE",
      });
    });
  });

  describe("postComponentIssue", () => {
    it("bắt buộc Idempotency-Key và movement_ids khi Post thành công", async () => {
      vi.mocked(http.post).mockResolvedValue({
        version: 4,
        status: "POSTED",
        stock_effect: "DECREASE",
        movement_ids: ["mv-1"],
      });

      const result = await postComponentIssue({
        documentId: "ci-6",
        ifMatch: 3,
        idempotencyKey: "fe:component-post:abc",
      });

      const [url, , config] = vi.mocked(http.post).mock.calls[0];
      expect(url).toBe("/warranty-component-issues/ci-6/post");
      const headers = (config as { headers: Record<string, string> }).headers;
      expect(headers["If-Match"]).toBe("3");
      expect(headers["Idempotency-Key"]).toBe("fe:component-post:abc");
      expect(result).toEqual({
        version: 4,
        status: "POSTED",
        movement_ids: ["mv-1"],
      });
    });

    it("từ chối Post không trả movement_ids", async () => {
      vi.mocked(http.post).mockResolvedValue({
        version: 4,
        status: "POSTED",
        stock_effect: "DECREASE",
        movement_ids: [],
      });
      await expect(
        postComponentIssue({
          documentId: "ci-6",
          ifMatch: 3,
          idempotencyKey: "fe:component-post:abc",
        }),
      ).rejects.toMatchObject({ code: "WMS_FE_MISSING_COMPONENT_MOVEMENT" });
    });

    it("từ chối Post không trừ tồn (stock_effect != DECREASE)", async () => {
      vi.mocked(http.post).mockResolvedValue({
        version: 4,
        status: "POSTED",
        stock_effect: "NONE",
        movement_ids: ["mv-1"],
      });
      await expect(
        postComponentIssue({
          documentId: "ci-6",
          ifMatch: 3,
          idempotencyKey: "fe:component-post:abc",
        }),
      ).rejects.toMatchObject({
        code: "WMS_FE_INVALID_COMPONENT_POST_RESPONSE",
      });
    });
  });

  it("cancelComponentIssue bắt buộc lý do hủy", async () => {
    await expect(
      cancelComponentIssue({ documentId: "ci-7", reason: "  ", ifMatch: 2 }),
    ).rejects.toMatchObject({ code: "WMS_FE_INVALID_PAYLOAD" });
    expect(http.post).not.toHaveBeenCalled();

    vi.mocked(http.post).mockResolvedValue({
      version: 3,
      status: "CANCELLED",
      stock_effect: "NONE",
    });
    const result = await cancelComponentIssue({
      documentId: "ci-7",
      reason: "Nhập nhầm kho",
      ifMatch: 2,
    });
    expect(http.post).toHaveBeenCalledWith(
      "/warranty-component-issues/ci-7/cancel",
      { reason: "Nhập nhầm kho" },
      { headers: { "If-Match": "2" } },
    );
    expect(result).toEqual({ version: 3, status: "CANCELLED" });
  });
});
