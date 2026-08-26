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
import { classifyScanCodes } from "./scanService";

const WAREHOUSE_ID = "11111111-2222-4333-8444-555555555555";

/**
 * Change Pack QR/SKU 20/08/2026 (DEC-QR-001): classify là resolver dùng chung
 * cho composite PRODUCT QR — FE gửi RAW payload (trần 512) và nhận identity đã
 * parse từ BE (payload_format/sku_code/item_unique/normalized_code_value/
 * resolution_status) để hiển thị, tuyệt đối không tự parse (AC-QR-10).
 */
describe("classifyScanCodes — composite PRODUCT QR contract", () => {
  const RAW = "HN1|SKU=DCH-DRILL-DJZ10A-20V-V1|ITEM=SN000012345";

  const baseResponse = {
    raw_code: RAW,
    context: "WARRANTY_RECEIVE",
    classification: "ITEM",
    item_id: "99999999-8888-4777-8666-555555555555",
    sku_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    product_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    stock_status: "AVAILABLE",
    object_status: "ISSUED",
    resolved_source: "physical_code",
    contract_version: "WWHN-150.1.1.0",
    stock_effect: "NONE",
    movement_created: false,
    posting_event_created: false,
    idempotency_cache_written: false,
    current_location: {
      warehouse_id: WAREHOUSE_ID,
      warehouse_code: "KHO-TONG-HN",
      warehouse_name: "Kho tổng Hoa Nam",
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("gửi RAW composite payload nguyên trạng và pass-through identity BE đã parse", async () => {
    vi.mocked(http.post).mockResolvedValue({
      ...baseResponse,
      payload_format: "COMPOSITE_V1",
      payload_version: 1,
      sku_code: "DCH-DRILL-DJZ10A-20V-V1",
      item_unique: "SN000012345",
      normalized_code_value: "SN000012345",
      resolution_status: "EXISTING_ITEM",
    });

    const result = await classifyScanCodes({
      raw_code: RAW,
      context: "WARRANTY_RECEIVE",
      warehouse_id: WAREHOUSE_ID,
    });

    expect(http.post).toHaveBeenCalledWith("/scan/classify", {
      raw_code: RAW,
      context: "WARRANTY_RECEIVE",
      warehouse_id: WAREHOUSE_ID,
    });
    expect(result).toMatchObject({
      payload_format: "COMPOSITE_V1",
      payload_version: 1,
      sku_code: "DCH-DRILL-DJZ10A-20V-V1",
      item_unique: "SN000012345",
      normalized_code_value: "SN000012345",
      resolution_status: "EXISTING_ITEM",
    });
  });

  it("giữ contract cũ cho plain code — không bịa payload fields khi BE không trả", async () => {
    vi.mocked(http.post).mockResolvedValue({
      ...baseResponse,
      raw_code: "SN000012345",
    });

    const result = await classifyScanCodes({
      raw_code: "SN000012345",
      context: "WARRANTY_RECEIVE",
      warehouse_id: WAREHOUSE_ID,
    });

    expect(result.payload_format).toBeUndefined();
    expect(result.resolution_status).toBeUndefined();
  });

  it("nhận raw_code dài tới 512 ký tự (trần mới của Change Pack) và chặn 513", async () => {
    vi.mocked(http.post).mockResolvedValue({
      ...baseResponse,
      raw_code: "A".repeat(512),
    });

    await expect(
      classifyScanCodes({
        raw_code: "A".repeat(512),
        context: "WARRANTY_RECEIVE",
        warehouse_id: WAREHOUSE_ID,
      }),
    ).resolves.toBeTruthy();

    await expect(
      classifyScanCodes({
        raw_code: "A".repeat(513),
        context: "WARRANTY_RECEIVE",
        warehouse_id: WAREHOUSE_ID,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_INVALID_PAYLOAD" });
  });
});
