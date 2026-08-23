import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
  },
}));
vi.mock("@/shared/api/wms-action-permission", () => ({
  assertWmsActionPermission: vi.fn(),
}));

import { http } from "@/shared/api/http";
import { assertWmsActionPermission } from "@/shared/api/wms-action-permission";
import { WMS_ACTION_PERMISSIONS } from "@/shared/constants/wms-permissions";
import { issueItemPhysicalCode } from "./scanService";

const SKU_ID = "11111111-2222-4333-8444-555555555555";

/**
 * POST /api/v1/skus/{id}/items — trước đây KHÔNG có API/UI nào tạo được
 * Item_Instance kèm Physical_Code MỚI cùng lúc; xem
 * CurrentBaselineItemIdentityController@issue (BE) và IssuePhysicalCodeModal (FE).
 */
describe("issueItemPhysicalCode", () => {
  const baseResponse = {
    item_id: "22222222-3333-4444-8555-666666666666",
    sku_id: SKU_ID,
    serial_number: "SN-SP-0001-8F3C1A2B",
    item_status: "NEW",
    item_condition: "NORMAL",
    physical_code_id: "33333333-4444-4555-8666-777777777777",
    code_value: "SP-0001-20260822-AB12",
    carrier_type: "QR",
    is_primary: true,
    status: "ACTIVE",
    version: 1,
    stock_effect: "NONE",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gửi đúng permission gate và path /skus/{id}/items kèm Idempotency-Key", async () => {
    vi.mocked(http.post).mockResolvedValue(baseResponse);

    const result = await issueItemPhysicalCode({
      skuId: SKU_ID,
      carrier_type: "QR",
    });

    expect(assertWmsActionPermission).toHaveBeenCalledWith(
      WMS_ACTION_PERMISSIONS.PHYSICAL_CODE_CREATE,
      expect.any(String),
    );
    expect(http.post).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(http.post).mock.calls[0];
    expect(url).toBe(`/skus/${SKU_ID}/items`);
    expect(body).toMatchObject({ carrier_type: "QR" });
    expect(config?.headers?.["Idempotency-Key"]).toEqual(
      expect.stringMatching(/^fe:physical-code-issue-/),
    );
    expect(result).toMatchObject({
      item_id: baseResponse.item_id,
      sku_id: SKU_ID,
      code_value: baseResponse.code_value,
      carrier_type: "QR",
      stock_effect: "NONE",
    });
  });

  it("chỉ gửi code_value/serial_number khi người dùng nhập tường minh", async () => {
    vi.mocked(http.post).mockResolvedValue(baseResponse);

    await issueItemPhysicalCode({
      skuId: SKU_ID,
      carrier_type: "BARCODE",
      code_value: "  custom-code  ",
      serial_number: "  custom-serial  ",
    });

    const [, body] = vi.mocked(http.post).mock.calls[0];
    expect(body).toMatchObject({
      carrier_type: "BARCODE",
      code_value: "custom-code",
      serial_number: "custom-serial",
    });
  });

  it("từ chối skuId không phải UUID trước khi gọi API", async () => {
    await expect(
      issueItemPhysicalCode({ skuId: "not-a-uuid" }),
    ).rejects.toMatchObject({ code: "WMS_FE_INVALID_PAYLOAD" });
    expect(http.post).not.toHaveBeenCalled();
  });

  it("fail-closed khi response trả stock_effect khác NONE", async () => {
    vi.mocked(http.post).mockResolvedValue({
      ...baseResponse,
      stock_effect: "RECEIPT",
    });

    await expect(
      issueItemPhysicalCode({ skuId: SKU_ID }),
    ).rejects.toMatchObject({ code: "WMS_FE_INVALID_ISSUE_RESPONSE" });
  });
});
