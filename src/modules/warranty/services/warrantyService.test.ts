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
    patch: vi.fn(),
    delete: vi.fn(),
    downloadBlob: vi.fn(),
  },
}));

import { http } from "@/shared/api/http";
import {
  createWarrantyCase,
  deleteWarrantyAttachment,
  fetchWarrantyAttachments,
  fetchWarrantyCase,
  fetchWarrantyCases,
  updateWarrantyCase,
  uploadWarrantyAttachment,
} from "./warrantyService";

function grantWarrantyManage() {
  authMocks.getState.mockReturnValue({
    isSuperAdmin: false,
    permissionCodes: ["warranty.manage"],
  });
}

describe("warrantyService", () => {
  beforeEach(() => {
    vi.mocked(http.get).mockReset();
    vi.mocked(http.getPage).mockReset();
    vi.mocked(http.post).mockReset();
    vi.mocked(http.patch).mockReset();
    vi.mocked(http.delete).mockReset();
    grantWarrantyManage();
  });

  describe("fetchWarrantyCases (WAR-01)", () => {
    it("chuẩn hóa row legacy: warranty_case_id, temp code, status alias OPEN", async () => {
      vi.mocked(http.getPage).mockResolvedValue({
        data: [
          {
            warranty_case_id: "wc-1",
            warranty_case_code: "BH-0001",
            temporary_item_code: "TEMP-01",
            missing_code_reason: "Mất tem mã",
            status: "OPEN",
            customer_name: "Nguyễn Văn A",
            version: 3,
          },
        ],
        meta: { total: 1 },
      });

      const page = await fetchWarrantyCases({ status: "OPEN", search: "BH" });

      expect(http.getPage).toHaveBeenCalledWith("/warranty-cases", {
        params: expect.objectContaining({
          status: "RECEIVED",
          keyword: "BH",
          per_page: 10,
        }),
      });
      expect(page.data).toHaveLength(1);
      expect(page.data[0]).toMatchObject({
        id: "wc-1",
        case_code: "BH-0001",
        identification_type: "TEMP_ONLY",
        temporary_item_code: "TEMP-01",
        status: "RECEIVED",
        version: 3,
      });
      expect(page.meta).toEqual({ total: 1 });
    });

    it("fail-closed khi thiếu warranty.manage: không gọi HTTP", async () => {
      authMocks.getState.mockReturnValue({
        isSuperAdmin: false,
        permissionCodes: ["scan.warranty"],
      });
      await expect(fetchWarrantyCases()).rejects.toMatchObject({
        code: "WMS_FE_PERMISSION_REQUIRED",
      });
      expect(http.getPage).not.toHaveBeenCalled();
    });
  });

  describe("createWarrantyCase (WAR-02)", () => {
    it("IDENTIFIED: bắt buộc item_code và gửi Idempotency-Key", async () => {
      vi.mocked(http.post).mockResolvedValue({
        id: "wc-2",
        case_code: "BH-0002",
        status: "RECEIVED",
        stock_effect: "NONE",
        movement_created: false,
      });

      const created = await createWarrantyCase({
        identification_type: "IDENTIFIED",
        item_code: "SER-001",
        customer_name: "Trần B",
        customer_phone: "0900000001",
        defect_description: "Không lên nguồn",
        accessories_received: "Pin, sạc",
        received_condition: "Trầy nhẹ",
      });

      expect(created.id).toBe("wc-2");
      const [url, body, config] = vi.mocked(http.post).mock.calls[0];
      expect(url).toBe("/warranty-cases");
      expect(body).toMatchObject({
        item_code: "SER-001",
        accessories_received: "Pin, sạc",
        received_condition: "Trầy nhẹ",
      });
      expect(body).not.toHaveProperty("missing_code_reason");
      expect(
        (config as { headers: Record<string, string> }).headers[
          "Idempotency-Key"
        ],
      ).toMatch(/^fe:warranty-create:/);
    });

    it("IDENTIFIED thiếu item_code: chặn trước khi gọi HTTP", async () => {
      await expect(
        createWarrantyCase({
          identification_type: "IDENTIFIED",
          customer_name: "Trần B",
          customer_phone: "0900000001",
          defect_description: "Không lên nguồn",
        }),
      ).rejects.toMatchObject({ code: "WMS_FE_INVALID_PAYLOAD" });
      expect(http.post).not.toHaveBeenCalled();
    });

    it("TEMP_ONLY: bắt buộc missing_code_reason + manual_product_description", async () => {
      await expect(
        createWarrantyCase({
          identification_type: "TEMP_ONLY",
          customer_name: "Trần B",
          customer_phone: "0900000001",
          defect_description: "Không lên nguồn",
          missing_code_reason: "Mất tem",
        }),
      ).rejects.toMatchObject({ code: "WMS_FE_INVALID_PAYLOAD" });
      expect(http.post).not.toHaveBeenCalled();
    });

    it("từ chối response làm thay đổi tồn kho (stock_effect != NONE)", async () => {
      vi.mocked(http.post).mockResolvedValue({
        id: "wc-3",
        stock_effect: "DECREASE",
      });
      await expect(
        createWarrantyCase({
          identification_type: "IDENTIFIED",
          item_code: "SER-002",
          customer_name: "Trần B",
          customer_phone: "0900000001",
          defect_description: "Kẹt motor",
        }),
      ).rejects.toMatchObject({ code: "WMS_FE_INVALID_WARRANTY_RESPONSE" });
    });
  });

  describe("updateWarrantyCase (WAR-03, WAR-P1-02)", () => {
    // Annex C transitionWarrantyStatus: POST /warranty-cases/{id}/status.
    it("gửi đủ field chẩn đoán/hủy và header If-Match qua operation chuẩn", async () => {
      vi.mocked(http.post).mockResolvedValue({
        id: "wc-4",
        status: "CANCELLED",
        cancel_reason: "Khách từ chối sửa",
        stock_effect: "NONE",
        version: 3,
      });

      const updated = await updateWarrantyCase("wc-4", {
        status: "CANCELLED",
        confirmed_defect: "Chết mạch nguồn",
        received_condition: "Trầy xước thân máy",
        accessories_received: "Pin 20V",
        cancel_reason: "Khách từ chối sửa",
        ifMatch: 2,
      });

      expect(updated.status).toBe("CANCELLED");
      expect(http.patch).not.toHaveBeenCalled();
      const [url, body, config] = vi.mocked(http.post).mock.calls[0];
      expect(url).toBe("/warranty-cases/wc-4/status");
      expect(body).toMatchObject({
        status: "CANCELLED",
        confirmed_defect: "Chết mạch nguồn",
        received_condition: "Trầy xước thân máy",
        accessories_received: "Pin 20V",
        cancel_reason: "Khách từ chối sửa",
      });
      const headers = (config as { headers: Record<string, string> }).headers;
      expect(headers["If-Match"]).toBe("2");
      expect(headers["Idempotency-Key"]).toMatch(/^fe:warranty-update-wc-4:/);
    });

    // Annex D SCR-WAR-01: defect + PII + purchase_date sửa được sau tiếp nhận.
    it("gửi được defect_id/PII/purchase_date khi hiệu chỉnh dữ liệu tiếp nhận", async () => {
      vi.mocked(http.post).mockResolvedValue({
        id: "wc-9",
        status: "CHECKING",
        stock_effect: "NONE",
        version: 4,
      });

      await updateWarrantyCase("wc-9", {
        defect_id: "def-1",
        customer_name: "Nguyễn Văn A",
        customer_phone: "0901234567",
        customer_address: "1 Nguyễn Trãi",
        purchase_date: "2026-01-15",
        ifMatch: 3,
      });

      const [, body] = vi.mocked(http.post).mock.calls[0];
      expect(body).toMatchObject({
        defect_id: "def-1",
        customer_name: "Nguyễn Văn A",
        customer_phone: "0901234567",
        customer_address: "1 Nguyễn Trãi",
        purchase_date: "2026-01-15",
      });
    });

    it("tự đọc version hiện tại khi caller không truyền ifMatch", async () => {
      vi.mocked(http.get).mockResolvedValue({ id: "wc-5", version: 7 });
      vi.mocked(http.post).mockResolvedValue({
        id: "wc-5",
        status: "CHECKING",
        version: 8,
      });

      await updateWarrantyCase("wc-5", { status: "CHECKING" });

      expect(http.get).toHaveBeenCalledWith("/warranty-cases/wc-5");
      const [, , config] = vi.mocked(http.post).mock.calls[0];
      expect(
        (config as { headers: Record<string, string> }).headers["If-Match"],
      ).toBe("7");
    });
  });

  describe("attachments (WAR-P1-01)", () => {
    it("fetchWarrantyAttachments chuẩn hóa metadata file", async () => {
      vi.mocked(http.getPage).mockResolvedValue({
        data: [
          {
            id: "att-1",
            warranty_case_id: "wc-6",
            file_name: "mat-truoc.jpg",
            mime_type: "image/jpeg",
            file_size: 1234,
            attachment_type: "INTAKE",
            status: "ACTIVE",
          },
        ],
      } as never);

      const attachments = await fetchWarrantyAttachments("wc-6");

      expect(http.getPage).toHaveBeenCalledWith(
        "/warranty-cases/wc-6/attachments",
        { params: { per_page: 100 } },
      );
      expect(attachments[0]).toMatchObject({
        id: "att-1",
        content_type: "image/jpeg",
        file_size_bytes: 1234,
        attachment_type: "INTAKE",
      });
    });

    it("uploadWarrantyAttachment gửi FormData có file + attachment_type", async () => {
      vi.mocked(http.post).mockResolvedValue({
        id: "att-2",
        warranty_case_id: "wc-6",
        file_name: "hoa-don.pdf",
        stock_effect: "NONE",
      });
      const file = new File(["x"], "hoa-don.pdf", { type: "application/pdf" });

      await uploadWarrantyAttachment({
        caseId: "wc-6",
        file,
        attachmentType: "INTAKE",
      });

      const [url, body] = vi.mocked(http.post).mock.calls[0];
      expect(url).toBe("/warranty-cases/wc-6/attachments");
      expect(body).toBeInstanceOf(FormData);
      expect((body as FormData).get("file")).toBe(file);
      expect((body as FormData).get("attachment_type")).toBe("INTAKE");
    });

    it("deleteWarrantyAttachment gọi đúng endpoint canonical", async () => {
      vi.mocked(http.delete).mockResolvedValue(undefined);
      await deleteWarrantyAttachment("att-3");
      expect(http.delete).toHaveBeenCalledWith("/warranty-attachments/att-3");
    });
  });

  it("fetchWarrantyCase gọi GET detail và giữ nguyên version", async () => {
    vi.mocked(http.get).mockResolvedValue({
      id: "wc-7",
      case_code: "BH-0007",
      status: "CHECKING",
      version: 4,
    });
    const detail = await fetchWarrantyCase("wc-7");
    expect(http.get).toHaveBeenCalledWith("/warranty-cases/wc-7");
    expect(detail).toMatchObject({
      id: "wc-7",
      status: "CHECKING",
      version: 4,
    });
  });
});
