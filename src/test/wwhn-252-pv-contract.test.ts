import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

// setup.ts thay cả module `axios` bằng stub vi.fn() để tránh lỗi load-time của
// vitest 4 + vite 8. Test này cần transport thật (chỉ giả lập tầng adapter) nên
// phải unmock trước khi import, giống axios.refresh.integration.test.ts.
vi.unmock("axios");
vi.unmock("@/shared/api/axios");
vi.unmock("@/shared/api/public-http");

import MockAdapter from "axios-mock-adapter";
import { publicApi, publicHttp } from "@/shared/api/public-http";
import { api } from "@/shared/api/axios";
import { memoryStorage } from "@/shared/lib/memory-storage";
import { PV_API_ENDPOINTS } from "@/modules/pv/services/pv-endpoints";
import {
  getPvProduct,
  getPvProducts,
  getPvRecommendations,
} from "@/modules/pv/services/pv-public.service";
import { computeFreshness } from "@/modules/pv/lib/pv-freshness";
import { ROUTES } from "@/shared/constants/routes";
import { ROUTE_PERMISSIONS } from "@/app/router/access";

/**
 * WWHN-252 / HN-PV-001 — khoá hợp đồng App PV ở tầng FE.
 *
 * Các bất biến được khoá ở đây tương ứng đúng register FE252:
 * - P1-01/P1-02: FE gọi ĐÚNG path canonical của Annex C.
 * - P1-03: gate publish là pv.publish, không phải sku.manage.
 * - P1-07: client ẩn danh không gửi Bearer; 429/404 được nhận diện riêng;
 *   độ tươi dữ liệu tính theo data_as_of của server.
 */
describe("WWHN-252 · App PV FE contract", () => {
  let mock: MockAdapter;

  beforeEach(() => {
    mock = new MockAdapter(publicApi);
  });

  afterEach(() => {
    mock.restore();
    vi.restoreAllMocks();
  });

  it("dùng đúng path canonical Annex C, không dùng path lịch sử /pv/catalog", () => {
    expect(PV_API_ENDPOINTS.PRODUCTS).toBe("/pv/products");
    expect(PV_API_ENDPOINTS.PRODUCT_DETAIL("abc")).toBe("/pv/products/abc");
    expect(PV_API_ENDPOINTS.INDUSTRIES).toBe("/pv/industries");
    expect(PV_API_ENDPOINTS.RECOMMENDATIONS).toBe("/pv/recommendations");
    expect(PV_API_ENDPOINTS.ADMIN_RESOURCES("industries")).toBe(
      "/pv-admin/resources/industries",
    );
    expect(PV_API_ENDPOINTS.PRODUCT_PUBLISH("abc")).toBe(
      "/pv/products/abc/publish",
    );
    expect(JSON.stringify(PV_API_ENDPOINTS)).not.toContain("/pv/catalog");
  });

  it("client PV ẩn danh KHÔNG gắn Authorization dù người dùng đang đăng nhập", async () => {
    memoryStorage.setItem("token-cua-nhan-vien-dang-dang-nhap");
    mock.onGet("/pv/products").reply((config) => {
      expect(config.headers?.Authorization).toBeUndefined();
      return [200, { success: true, data: [], meta: {} }];
    });

    await getPvProducts({});
    expect(publicApi.defaults.withCredentials).toBe(false);
    // Client nội bộ vẫn phải giữ hành vi cũ — đây là hai bề mặt khác nhau.
    expect(api.defaults.baseURL).toBe(publicApi.defaults.baseURL);
  });

  it("bỏ hẳn bộ lọc rỗng thay vì gửi chuỗi rỗng (BE trả 400 INVALID_QUERY)", async () => {
    let captured: Record<string, unknown> | undefined;
    mock.onGet("/pv/products").reply((config) => {
      captured = config.params as Record<string, unknown>;
      return [200, { success: true, data: [], meta: {} }];
    });

    await getPvProducts({
      keyword: "",
      industry_id: undefined,
      in_stock: false,
      page: 2,
      per_page: 12,
    });

    expect(captured).toEqual({ page: 2, per_page: 12 });
    expect(captured).not.toHaveProperty("keyword");
    expect(captured).not.toHaveProperty("industry_id");
    expect(captured).not.toHaveProperty("in_stock");
  });

  it("gửi in_stock=1 khi người dùng bật lọc còn hàng", async () => {
    let captured: Record<string, unknown> | undefined;
    mock.onGet("/pv/products").reply((config) => {
      captured = config.params as Record<string, unknown>;
      return [200, { success: true, data: [], meta: {} }];
    });

    await getPvProducts({ in_stock: true });
    expect(captured).toEqual({ in_stock: 1 });
  });

  it("nhận diện 404 masked của SKU chưa publish (không phải lỗi quyền)", async () => {
    mock.onGet("/pv/products/sku-1").reply(404, {
      success: false,
      message: "Không tìm thấy sản phẩm.",
      error: { code: "RESOURCE_NOT_FOUND" },
      meta: { request_id: "req-404" },
    });

    await expect(getPvProduct("sku-1")).rejects.toMatchObject({
      status: 404,
      isNotFound: true,
      code: "RESOURCE_NOT_FOUND",
      requestId: "req-404",
    });
  });

  it("nhận diện 429 kèm Retry-After để UI không tự retry", async () => {
    mock
      .onGet("/pv/recommendations")
      .reply(429, { error: { code: "RATE_LIMIT_EXCEEDED" } }, { "retry-after": "45" });

    await expect(getPvRecommendations("industry-1")).rejects.toMatchObject({
      status: 429,
      isRateLimited: true,
      retryAfterSeconds: 45,
    });
  });

  it("đánh dấu mất kết nối khi request không tới được BE", async () => {
    mock.onGet("/pv/products").networkError();

    await expect(getPvProducts({})).rejects.toMatchObject({ isOffline: true });
  });

  it("trả về mảng rỗng an toàn khi BE trả data null", async () => {
    mock.onGet("/pv/products").reply(200, { success: true, data: null, meta: {} });

    await expect(getPvProducts({})).resolves.toMatchObject({ data: [] });
  });

  it("giữ nguyên meta độ tươi do BE phát ra", async () => {
    mock.onGet("/pv/products").reply(200, {
      success: true,
      data: [],
      meta: {
        data_as_of: "2026-08-18T10:00:00+07:00",
        max_staleness_seconds: 60,
        inventory_freshness: "LIVE",
      },
    });

    const page = await getPvProducts({});
    expect(page.meta.max_staleness_seconds).toBe(60);
    expect(page.meta.inventory_freshness).toBe("LIVE");
  });

  it("publicHttp không nuốt lỗi thành công giả", async () => {
    mock.onGet("/pv/industries").reply(500, {
      success: false,
      message: "Lỗi hệ thống",
      error: { code: "INTERNAL_ERROR" },
      meta: { request_id: "req-500" },
    });

    await expect(publicHttp.get("/pv/industries")).rejects.toMatchObject({
      status: 500,
      isOffline: false,
      requestId: "req-500",
    });
  });
});

describe("WWHN-252 · độ tươi dữ liệu tồn kho (NFR-SRS-016)", () => {
  const dataAsOf = "2026-08-18T10:00:00.000Z";
  const stampedAt = Date.parse(dataAsOf);

  it("dữ liệu vừa nhận trong ngưỡng là LIVE", () => {
    const result = computeFreshness({
      data_as_of: dataAsOf,
      max_staleness_seconds: 60,
      received_at: stampedAt + 30_000,
    });
    expect(result.ageSeconds).toBe(30);
    expect(result.isDegraded).toBe(false);
  });

  it("vượt ngưỡng staleness thì báo degraded", () => {
    const result = computeFreshness({
      data_as_of: dataAsOf,
      max_staleness_seconds: 60,
      received_at: stampedAt + 61_000,
    });
    expect(result.ageSeconds).toBe(61);
    expect(result.isDegraded).toBe(true);
  });

  it("thiếu data_as_of thì không được bịa ra trạng thái degraded", () => {
    expect(computeFreshness(undefined)).toMatchObject({
      ageSeconds: null,
      isDegraded: false,
      thresholdSeconds: 60,
    });
  });
});

describe("WWHN-252 · route và quyền", () => {
  it("SCR-PV-01/02 là route công khai nên không nằm trong bảng gate quyền", () => {
    expect(ROUTES.PV_CATALOG).toBe("/pv");
    expect(ROUTES.PV_PRODUCT_DETAIL).toBe("/pv/products/:skuId");
    expect(ROUTE_PERMISSIONS[ROUTES.PV_CATALOG]).toBeUndefined();
    expect(ROUTE_PERMISSIONS[ROUTES.PV_PRODUCT_DETAIL]).toBeUndefined();
  });

  it("SCR-PV-ADM-01 mở cho pv.master.manage hoặc pv.publish, KHÔNG mở cho sku.manage", () => {
    const required = ROUTE_PERMISSIONS[ROUTES.PV_ADMIN];
    expect(required).toEqual(["pv.master.manage", "pv.publish"]);
    expect(required).not.toContain("sku.manage");
  });
});
