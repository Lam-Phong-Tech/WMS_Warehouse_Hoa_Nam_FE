import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { useAuthStore } from "@/shared/store/auth.store";
import type { PvAdminProfile } from "@/modules/pv/types/pv.types";

const {
  listPvAdminResourcesMock,
  createPvProfileMock,
  updatePvProfileMock,
  getMvpSkusMock,
} = vi.hoisted(() => ({
  listPvAdminResourcesMock: vi.fn(),
  createPvProfileMock: vi.fn(),
  updatePvProfileMock: vi.fn(),
  getMvpSkusMock: vi.fn(),
}));

vi.mock("@/modules/pv/services/pv-admin.service", () => ({
  listPvAdminResources: listPvAdminResourcesMock,
  createPvProfile: createPvProfileMock,
  updatePvProfile: updatePvProfileMock,
  setPvProductPublished: vi.fn(),
  createPvIndustry: vi.fn(),
  updatePvIndustry: vi.fn(),
  createPvTag: vi.fn(),
  updatePvTag: vi.fn(),
  createPvRule: vi.fn(),
  updatePvRule: vi.fn(),
}));

vi.mock("@/modules/master-data/services/mvp-master.service", () => ({
  getMvpSkus: getMvpSkusMock,
  getMvpAgencies: vi.fn(),
  getMvpDefects: vi.fn(),
  getMvpProductCatalogs: vi.fn(),
  hasMvpSkuStock: vi.fn(),
  createMvpSku: vi.fn(),
  updateMvpSku: vi.fn(),
  setMvpSkuPublished: vi.fn(),
  createMvpAgency: vi.fn(),
  updateMvpAgency: vi.fn(),
  createMvpDefect: vi.fn(),
  updateMvpDefect: vi.fn(),
}));

import { PvProductCatalogPage } from "@/modules/pv/pages/PvProductCatalogPage";

const IMAGE_URL = "https://res.cloudinary.com/demo/image/upload/v1/pv/a.jpg";

const WITH_IMAGE: PvAdminProfile = {
  id: "33333333-3333-4333-8333-333333333333",
  sku_id: "11111111-1111-4111-8111-111111111111",
  sku_code: "SKU-PV-001",
  sku_name: "Máy khoan cầm tay",
  sku_status: "ACTIVE",
  display_name: "Máy khoan cầm tay HN",
  description: "Mô tả cho khách xem",
  sort_order: 7,
  published: true,
  industry_ids: [],
  tag_ids: [],
  images: [{ url: IMAGE_URL, alt_text: "Ảnh chính", is_primary: true }],
  version: 3,
};

const WITHOUT_IMAGE: PvAdminProfile = {
  ...WITH_IMAGE,
  id: "44444444-4444-4444-8444-444444444444",
  sku_id: "22222222-2222-4222-8222-222222222222",
  sku_code: "SKU-PV-002",
  sku_name: "Máy mài góc",
  display_name: "Máy mài góc HN",
  published: false,
  images: [],
};

function signInWith(permissionCodes: string[]) {
  useAuthStore.setState({
    isSuperAdmin: false,
    isProfileLoaded: true,
    isAuthenticated: true,
    permissionCodes,
  });
}

/**
 * MST-PV-01 — màn danh mục sản phẩm App PV.
 *
 * Hai thứ được khoá ở đây là hai thứ dễ vỡ trong im lặng nhất:
 *  1. ranh giới quyền pv.master.manage ↔ pv.publish (giống SCR-PV-ADM-01),
 *  2. `images` phải đi kèm payload khi lưu — thiếu nó thì ảnh vừa upload lên
 *     Cloudinary không bao giờ tới BE, và người dùng chỉ phát hiện khi mở lại.
 */
describe("MST-PV-01 · PvProductCatalogPage", () => {
  beforeEach(() => {
    listPvAdminResourcesMock
      .mockReset()
      .mockImplementation((resource: string) =>
        Promise.resolve({
          data:
            resource === "product-profiles" ? [WITH_IMAGE, WITHOUT_IMAGE] : [],
          meta: { current_page: 1, per_page: 20, total: 2, last_page: 1 },
        }),
      );
    createPvProfileMock.mockReset().mockResolvedValue(WITH_IMAGE);
    updatePvProfileMock.mockReset().mockResolvedValue(WITH_IMAGE);
    getMvpSkusMock.mockReset().mockResolvedValue({ data: [], meta: {} });
  });

  it("vẽ lưới thẻ sản phẩm kèm ảnh đại diện", async () => {
    signInWith(["pv.master.manage", "pv.publish"]);

    renderWithProviders(<PvProductCatalogPage />);

    const cards = await screen.findAllByTestId("pv-catalog-card");
    expect(cards).toHaveLength(2);
    expect(screen.getByAltText("Ảnh chính")).toBeInTheDocument();
    // Sản phẩm chưa có ảnh vẫn lên lưới, kèm nhãn thay cho ảnh trống.
    expect(screen.getByTestId("pv-catalog-card-no-image")).toBeInTheDocument();
  });

  it("người chỉ có pv.master.manage không bật/tắt được hiển thị", async () => {
    signInWith(["pv.master.manage"]);

    renderWithProviders(<PvProductCatalogPage />);

    const toggles = await screen.findAllByTestId("pv-catalog-publish-switch");
    expect(toggles[0]).toBeDisabled();
  });

  it("người chỉ có pv.publish không thêm được sản phẩm", async () => {
    signInWith(["pv.publish"]);

    renderWithProviders(<PvProductCatalogPage />);

    await waitFor(() =>
      expect(screen.getByTestId("pv-catalog-add")).toBeDisabled(),
    );
  });

  /**
   * Hồi quy chính của tính năng: sửa sản phẩm phải gửi `images` (kể cả khi
   * người dùng không đụng tới ảnh) để BE ghi lại đúng danh sách đang hiển thị
   * trên form, thay vì bỏ khoá đi và giữ nguyên ảnh cũ một cách ngầm định.
   */
  it("lưu sản phẩm gửi kèm danh sách ảnh", async () => {
    signInWith(["pv.master.manage", "pv.publish"]);

    renderWithProviders(<PvProductCatalogPage />);

    const editButtons = await screen.findAllByTestId("pv-catalog-edit");
    fireEvent.click(editButtons[0]);

    expect(await screen.findByTestId("pv-image-list")).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("pv-catalog-submit"));

    await waitFor(() => expect(updatePvProfileMock).toHaveBeenCalledTimes(1));
    const [, version, payload] = updatePvProfileMock.mock.calls[0];
    expect(version).toBe(WITH_IMAGE.version);
    expect(payload.images).toEqual([
      { url: IMAGE_URL, alt_text: "Ảnh chính", is_primary: true },
    ]);
    // Form không còn ô "Thứ tự hiển thị", nhưng giá trị cũ phải đi nguyên vẹn
    // xuống BE — gửi 0 là xáo lại thứ tự hiển thị của cả danh mục App PV.
    expect(payload.sort_order).toBe(WITH_IMAGE.sort_order);
  });

  it("không còn ô Thứ tự hiển thị trên form", async () => {
    signInWith(["pv.master.manage", "pv.publish"]);

    renderWithProviders(<PvProductCatalogPage />);

    fireEvent.click(await screen.findByTestId("pv-catalog-add"));

    expect(await screen.findByTestId("pv-catalog-sku-picker")).toBeVisible();
    expect(screen.queryByLabelText(/thứ tự hiển thị/i)).not.toBeInTheDocument();
  });

  /** Không chọn SKU thì không được gọi API — BE sẽ trả 422 cho payload rỗng. */
  it("thêm sản phẩm mà chưa chọn SKU thì báo lỗi tại ô, không gọi API", async () => {
    signInWith(["pv.master.manage", "pv.publish"]);

    renderWithProviders(<PvProductCatalogPage />);

    fireEvent.click(await screen.findByTestId("pv-catalog-add"));
    fireEvent.click(await screen.findByTestId("pv-catalog-submit"));

    expect(
      await screen.findByText(/chọn sku cần đưa lên app pv/i),
    ).toBeInTheDocument();
    expect(createPvProfileMock).not.toHaveBeenCalled();
  });

  /**
   * Ô ảnh phải LUÔN có vùng tải lên: ảnh đi qua API của hệ thống nên không còn
   * cấu hình bên thứ ba nào để thiếu. Ô dán URL vẫn giữ cho ảnh sẵn trên CDN khác.
   */
  it("ô ảnh luôn có vùng tải lên và ô dán URL", async () => {
    signInWith(["pv.master.manage", "pv.publish"]);

    renderWithProviders(<PvProductCatalogPage />);

    fireEvent.click(await screen.findByTestId("pv-catalog-add"));

    expect(await screen.findByTestId("pv-image-dropzone")).toBeInTheDocument();
    expect(
      screen.getByLabelText(/hoặc dán url ảnh có sẵn/i),
    ).toBeInTheDocument();
  });
});
