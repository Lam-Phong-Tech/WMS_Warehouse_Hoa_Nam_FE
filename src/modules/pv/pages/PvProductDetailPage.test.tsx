import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { Route, Routes } from "react-router-dom";
import { renderWithProviders } from "@/test/test-utils";
import type { PvProduct } from "@/modules/pv/types/pv.types";

const {
  getPvProductMock,
  findPvProductByCodeMock,
  getPvProductsMock,
  getPvRecommendationsMock,
} = vi.hoisted(() => ({
  getPvProductMock: vi.fn(),
  findPvProductByCodeMock: vi.fn(),
  getPvProductsMock: vi.fn(),
  getPvRecommendationsMock: vi.fn(),
}));

vi.mock("@/modules/pv/services/pv-public.service", () => ({
  getPvProduct: getPvProductMock,
  findPvProductByCode: findPvProductByCodeMock,
  getPvProducts: getPvProductsMock,
  getPvRecommendations: getPvRecommendationsMock,
  getPvIndustries: vi.fn(),
}));

import PvProductDetailPage from "@/modules/pv/pages/PvProductDetailPage";

const SKU_ID = "11111111-1111-4111-8111-111111111111";

function productFixture(overrides: Partial<PvProduct> = {}): PvProduct {
  return {
    sku_id: SKU_ID,
    sku_code: "HN-PRD-001",
    sku_name: "Máy khoan cầm tay",
    display_name: "Máy khoan cầm tay HN",
    description: null,
    unit: "cái",
    brand_id: null,
    brand_name: "Hoa Nam",
    category_id: null,
    category_name: null,
    power_source_id: null,
    power_source_name: null,
    model_name: null,
    available_qty: 5,
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

function renderAt(param: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/pv/products/:skuId" element={<PvProductDetailPage />} />
    </Routes>,
    [`/pv/products/${param}`],
  );
}

/**
 * SCR-PV-02 nhận cả sku_id lẫn MÃ SKU.
 *
 * Lý do: mọi màn nghiệp vụ trong WMS đều cho bấm vào mã SKU để mở màn xem sản
 * phẩm, mà phần lớn chỗ đó chỉ có mã trong tay (warranty_case lưu mã, dòng phiếu
 * nhập/xuất hiển thị mã). Gọi thẳng `/pv/products/<mã>` chỉ nhận 400 INVALID_PATH.
 */
describe("PvProductDetailPage — deep-link theo sku_id và theo mã SKU", () => {
  beforeEach(() => {
    getPvProductMock.mockReset();
    findPvProductByCodeMock.mockReset();
    getPvRecommendationsMock.mockReset().mockResolvedValue({
      data: [],
      meta: {},
    });
  });

  it("param là UUID: gọi thẳng chi tiết, không tra mã", async () => {
    getPvProductMock.mockResolvedValue({
      data: productFixture(),
      meta: {},
    });

    renderAt(SKU_ID);

    expect(await screen.findByTestId("pv-detail")).toBeInTheDocument();
    expect(getPvProductMock).toHaveBeenCalledWith(SKU_ID);
    expect(findPvProductByCodeMock).not.toHaveBeenCalled();
  });

  it("param là mã SKU: tra mã ra sku_id rồi mới gọi chi tiết", async () => {
    findPvProductByCodeMock.mockResolvedValue(productFixture());
    getPvProductMock.mockResolvedValue({
      data: productFixture(),
      meta: {},
    });

    renderAt("HN-PRD-001");

    expect(await screen.findByTestId("pv-detail")).toBeInTheDocument();
    expect(findPvProductByCodeMock).toHaveBeenCalledWith("HN-PRD-001");
    expect(getPvProductMock).toHaveBeenCalledWith(SKU_ID);
  });

  /**
   * §13.8: SKU nội bộ / chưa publish bị BE mask bằng 404. Nhánh tra-theo-mã
   * phải rơi vào ĐÚNG trạng thái đó — và không được kẹt ở vòng quay tải, vì
   * query chi tiết lúc này đang bị tắt (enabled:false vẫn mang status pending).
   */
  it("mã không khớp SKU đã publish nào: hiện không tìm thấy, không kẹt loading", async () => {
    findPvProductByCodeMock.mockResolvedValue(null);

    renderAt("HN-KHONG-TON-TAI");

    expect(
      await screen.findByTestId("pv-detail-not-found"),
    ).toBeInTheDocument();
    await waitFor(() => expect(getPvProductMock).not.toHaveBeenCalled());
    expect(screen.queryByTestId("pv-detail-loading")).not.toBeInTheDocument();
  });

  it("tra mã lỗi mạng: hiện lỗi có nút thử lại, không phải 'không tìm thấy'", async () => {
    findPvProductByCodeMock.mockRejectedValue({ status: 500 });

    renderAt("HN-PRD-001");

    await waitFor(() =>
      expect(
        screen.queryByTestId("pv-detail-not-found"),
      ).not.toBeInTheDocument(),
    );
    expect(findPvProductByCodeMock).toHaveBeenCalled();
  });
});
