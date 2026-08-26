import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import type { PvProduct } from "@/modules/pv/types/pv.types";

const { getPvProductsMock, getPvIndustriesMock, getPvRecommendationsMock } =
  vi.hoisted(() => ({
    getPvProductsMock: vi.fn(),
    getPvIndustriesMock: vi.fn(),
    getPvRecommendationsMock: vi.fn(),
  }));

vi.mock("@/modules/pv/services/pv-public.service", () => ({
  getPvProducts: getPvProductsMock,
  getPvIndustries: getPvIndustriesMock,
  getPvRecommendations: getPvRecommendationsMock,
  getPvProduct: vi.fn(),
}));

import PvCatalogPage from "@/modules/pv/pages/PvCatalogPage";

function productFixture(overrides: Partial<PvProduct> = {}): PvProduct {
  return {
    sku_id: "11111111-1111-4111-8111-111111111111",
    sku_code: "SKU-PV-001",
    sku_name: "Máy khoan cầm tay",
    display_name: "Máy khoan cầm tay HN",
    description: null,
    unit: "cái",
    brand_id: null,
    brand_name: "Hoa Nam",
    category_id: null,
    category_name: null,
    power_source_id: null,
    power_source_name: "Điện 220V",
    model_name: null,
    available_qty: 12,
    stock_status: "IN_STOCK",
    stock_label: "Còn hàng",
    last_inventory_sync_at: null,
    max_staleness_seconds: 60,
    images: [],
    industries: [],
    tags: [],
    ...overrides,
  };
}

/**
 * WWHN-252 · SCR-PV-01 — Annex D yêu cầu mỗi màn có trạng thái Loading / Empty /
 * Error rõ ràng. Test khoá đúng ba trạng thái đó bằng hook `data-ui-state` của
 * WWHN-268, để bằng chứng QA2 không phải dò theo chuỗi tiếng Việt hiển thị.
 */
describe("WWHN-252 · PvCatalogPage (SCR-PV-01)", () => {
  beforeEach(() => {
    getPvProductsMock.mockReset();
    getPvIndustriesMock.mockReset().mockResolvedValue({ data: [], meta: {} });
    getPvRecommendationsMock
      .mockReset()
      .mockResolvedValue({ data: [], meta: {} });
  });

  it("hiện trạng thái loading trước khi có dữ liệu", async () => {
    getPvProductsMock.mockReturnValue(new Promise(() => {}));

    renderWithProviders(<PvCatalogPage />);

    expect(await screen.findByTestId("pv-list-loading")).toBeInTheDocument();
  });

  it("hiện sản phẩm kèm tồn khả dụng và nhãn còn hàng", async () => {
    getPvProductsMock.mockResolvedValue({
      data: [productFixture()],
      meta: { total: 1, last_page: 1, current_page: 1 },
    });

    renderWithProviders(<PvCatalogPage />);

    expect(await screen.findByTestId("pv-product-grid")).toBeInTheDocument();
    expect(screen.getByText("Máy khoan cầm tay HN")).toBeInTheDocument();
    expect(screen.getByTestId("pv-stock-badge")).toHaveAttribute(
      "data-stock-status",
      "IN_STOCK",
    );
    expect(screen.getByText(/12/)).toBeInTheDocument();
  });

  /** DEC-CATALOG-001 / REQ-SRS-036: publish độc lập tồn kho. */
  it("vẫn hiện sản phẩm tồn 0 với nhãn Chưa có hàng", async () => {
    getPvProductsMock.mockResolvedValue({
      data: [
        productFixture({
          available_qty: 0,
          stock_status: "OUT_OF_STOCK",
          stock_label: "Chưa có hàng",
        }),
      ],
      meta: { total: 1, last_page: 1, current_page: 1 },
    });

    renderWithProviders(<PvCatalogPage />);

    const badge = await screen.findByTestId("pv-stock-badge");
    expect(badge).toHaveAttribute("data-stock-status", "OUT_OF_STOCK");
    expect(badge).toHaveTextContent("Chưa có hàng");
  });

  it("hiện trạng thái rỗng khi chưa có sản phẩm công bố", async () => {
    getPvProductsMock.mockResolvedValue({ data: [], meta: { total: 0 } });

    renderWithProviders(<PvCatalogPage />);

    expect(await screen.findByTestId("pv-list-empty")).toBeInTheDocument();
  });

  it("hiện trạng thái rỗng kèm hành động xoá lọc khi đang lọc", async () => {
    getPvProductsMock.mockResolvedValue({ data: [], meta: { total: 0 } });

    renderWithProviders(<PvCatalogPage />, ["/pv?keyword=khong-ton-tai"]);

    expect(await screen.findByTestId("pv-list-empty")).toBeInTheDocument();
    expect(screen.getByTestId("pv-clear-filters")).toBeInTheDocument();
  });

  it("hiện lỗi kèm request_id khi BE trả 500", async () => {
    getPvProductsMock.mockRejectedValue(
      Object.assign(new Error("Lỗi hệ thống"), {
        status: 500,
        requestId: "req-500",
      }),
    );

    renderWithProviders(<PvCatalogPage />);

    expect(await screen.findByTestId("pv-error-generic")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText(/req-500/)).toBeInTheDocument(),
    );
  });

  /** WWHN-289: 429 phải là thông điệp riêng, không mời bấm Thử lại liên tục. */
  it("hiện thông điệp riêng khi bị rate limit 429", async () => {
    getPvProductsMock.mockRejectedValue(
      Object.assign(new Error("rate limited"), {
        status: 429,
        isRateLimited: true,
        retryAfterSeconds: 30,
      }),
    );

    renderWithProviders(<PvCatalogPage />);

    expect(
      await screen.findByTestId("pv-error-rate-limited"),
    ).toBeInTheDocument();
    expect(screen.getByText(/30 giây/)).toBeInTheDocument();
  });

  it("hiện trạng thái mất kết nối khi request không tới được BE", async () => {
    getPvProductsMock.mockRejectedValue(
      Object.assign(new Error("offline"), { isOffline: true }),
    );

    renderWithProviders(<PvCatalogPage />);

    expect(await screen.findByTestId("pv-error-offline")).toBeInTheDocument();
  });

  /** NFR-SRS-016: data_as_of phải hiển thị và chuyển degraded khi quá ngưỡng. */
  it("gắn nhãn độ tươi dữ liệu theo data_as_of của BE", async () => {
    getPvProductsMock.mockResolvedValue({
      data: [productFixture()],
      meta: {
        total: 1,
        last_page: 1,
        current_page: 1,
        data_as_of: new Date().toISOString(),
        received_at: Date.now(),
        max_staleness_seconds: 60,
        inventory_freshness: "LIVE",
      },
    });

    renderWithProviders(<PvCatalogPage />);

    const badge = await screen.findByTestId("pv-freshness");
    expect(badge).toHaveAttribute("data-pv-freshness", "live");
  });

  it("báo degraded khi response cũ hơn ngưỡng staleness", async () => {
    getPvProductsMock.mockResolvedValue({
      data: [productFixture()],
      meta: {
        total: 1,
        last_page: 1,
        current_page: 1,
        // Response bi mot tang cache giu lai 5 phut truoc khi toi client.
        data_as_of: new Date(Date.now() - 5 * 60_000).toISOString(),
        received_at: Date.now(),
        max_staleness_seconds: 60,
      },
    });

    renderWithProviders(<PvCatalogPage />);

    await waitFor(() =>
      expect(screen.getByTestId("pv-freshness")).toHaveAttribute(
        "data-pv-freshness",
        "degraded",
      ),
    );
  });

  it("đọc bộ lọc từ URL để link chia sẻ tái hiện đúng trạng thái", async () => {
    getPvProductsMock.mockResolvedValue({
      data: [],
      meta: { total: 0 },
    });

    renderWithProviders(<PvCatalogPage />, [
      "/pv?keyword=khoan&industry_id=22222222-2222-4222-8222-222222222222&in_stock=1&page=2",
    ]);

    await waitFor(() => expect(getPvProductsMock).toHaveBeenCalled());
    expect(getPvProductsMock).toHaveBeenCalledWith(
      expect.objectContaining({
        keyword: "khoan",
        industry_id: "22222222-2222-4222-8222-222222222222",
        in_stock: true,
        page: 2,
      }),
    );
  });
});
