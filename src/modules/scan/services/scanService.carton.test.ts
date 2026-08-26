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
const CONTAINER_ID = "99999999-8888-4777-8666-555555555555";

/**
 * Inbound Carton Scan v1.0 §3.1/§4.2: classify expose container_id /
 * container_code / container_type để FE đặt CARTON làm "Thùng đang quét".
 * classification=CONTAINER bắt buộc có container_id non-null (fail-closed).
 */
describe("classifyScanCodes — carton container identity contract", () => {
  const baseResponse = {
    raw_code: "CTN-001",
    context: "INBOUND",
    classification: "CONTAINER",
    item_id: null,
    sku_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    product_id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
    stock_status: "AVAILABLE",
    object_status: "EMPTY",
    resolved_source: "container.container_code",
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

  it("giữ lại container_id/container_code/container_type của CONTAINER", async () => {
    vi.mocked(http.post).mockResolvedValue({
      ...baseResponse,
      container_id: CONTAINER_ID,
      container_code: "CTN-001",
      container_type: "CARTON",
    });

    const result = await classifyScanCodes({
      raw_code: "CTN-001",
      context: "INBOUND",
      warehouse_id: WAREHOUSE_ID,
    });

    expect(result).toMatchObject({
      classification: "CONTAINER",
      container_id: CONTAINER_ID,
      container_code: "CTN-001",
      container_type: "CARTON",
    });
  });

  it("fail-closed khi CONTAINER thiếu container_id (§3.1 contract)", async () => {
    vi.mocked(http.post).mockResolvedValue({
      ...baseResponse,
      container_id: null,
      container_code: "CTN-001",
    });

    await expect(
      classifyScanCodes({
        raw_code: "CTN-001",
        context: "INBOUND",
        warehouse_id: WAREHOUSE_ID,
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_INVALID_SCAN_RESPONSE" });
  });

  it("ITEM/SKU không bịa container identity khi BE không trả", async () => {
    vi.mocked(http.post).mockResolvedValue({
      ...baseResponse,
      raw_code: "SN000012345",
      classification: "ITEM",
      item_id: CONTAINER_ID,
      resolved_source: "physical_code",
      object_status: "IN_STOCK",
    });

    const result = await classifyScanCodes({
      raw_code: "SN000012345",
      context: "INBOUND",
      warehouse_id: WAREHOUSE_ID,
    });

    expect(result.container_id).toBeNull();
    expect(result.container_code).toBeNull();
    expect(result.container_type).toBeNull();
  });
});
