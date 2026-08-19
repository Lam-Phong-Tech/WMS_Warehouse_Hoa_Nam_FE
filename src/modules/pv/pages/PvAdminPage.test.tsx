import { describe, expect, it, vi, beforeEach } from "vitest";
import { fireEvent, screen, waitFor } from "@testing-library/react";
import { createMockAxiosError } from "@/shared/api/api-error";
import { renderWithProviders } from "@/test/test-utils";
import { useAuthStore } from "@/shared/store/auth.store";
import type { PvAdminProfile } from "@/modules/pv/types/pv.types";

const { listPvAdminResourcesMock, setPvProductPublishedMock } = vi.hoisted(
  () => ({
    listPvAdminResourcesMock: vi.fn(),
    setPvProductPublishedMock: vi.fn(),
  }),
);

vi.mock("@/modules/pv/services/pv-admin.service", () => ({
  listPvAdminResources: listPvAdminResourcesMock,
  setPvProductPublished: setPvProductPublishedMock,
  createPvIndustry: vi.fn(),
  updatePvIndustry: vi.fn(),
  createPvTag: vi.fn(),
  updatePvTag: vi.fn(),
  createPvRule: vi.fn(),
  updatePvRule: vi.fn(),
  createPvProfile: vi.fn(),
  updatePvProfile: vi.fn(),
}));

import PvAdminPage from "@/modules/pv/pages/PvAdminPage";

const PROFILE: PvAdminProfile = {
  id: "33333333-3333-4333-8333-333333333333",
  sku_id: "11111111-1111-4111-8111-111111111111",
  sku_code: "SKU-PV-001",
  sku_name: "Máy khoan cầm tay",
  sku_status: "ACTIVE",
  display_name: "Máy khoan cầm tay HN",
  description: null,
  sort_order: 0,
  published: false,
  industry_ids: [],
  tag_ids: [],
  version: 3,
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
 * WWHN-252 · FE252-P1-03 — SCR-PV-ADM-01 phải thể hiện đúng ranh giới hai quyền:
 * `pv.master.manage` quản lý ngành nghề/tag/rule/hồ sơ hiển thị, còn bật/tắt
 * publish là `pv.publish`. Gộp hai quyền lại là đúng thứ mà register yêu cầu gỡ.
 */
describe("WWHN-252 · PvAdminPage (SCR-PV-ADM-01)", () => {
  beforeEach(() => {
    listPvAdminResourcesMock
      .mockReset()
      .mockImplementation((resource: string) =>
        Promise.resolve({
          data: resource === "product-profiles" ? [PROFILE] : [],
          meta: {},
        }),
      );
    setPvProductPublishedMock.mockReset().mockResolvedValue({
      published_to_app: true,
      pv_profile_version: PROFILE.version + 1,
    });
  });

  it("người chỉ có pv.master.manage KHÔNG bật/tắt được publish", async () => {
    signInWith(["pv.master.manage"]);

    renderWithProviders(<PvAdminPage />);

    const toggle = await screen.findByTestId("pv-admin-publish-switch");
    expect(toggle).toBeDisabled();
    expect(screen.getByText(/không có quyền pv\.publish/i)).toBeInTheDocument();
  });

  it("người có pv.publish bật/tắt được publish", async () => {
    signInWith(["pv.master.manage", "pv.publish"]);

    renderWithProviders(<PvAdminPage />);

    const toggle = await screen.findByTestId("pv-admin-publish-switch");
    expect(toggle).not.toBeDisabled();
  });

  /** sku.manage KHÔNG phải là quyền thay thế cho publish (§3). */
  it("sku.manage không mở khoá được publish", async () => {
    signInWith(["pv.master.manage", "sku.manage"]);

    renderWithProviders(<PvAdminPage />);

    expect(await screen.findByTestId("pv-admin-publish-switch")).toBeDisabled();
  });

  it("người chỉ có pv.publish không sửa được master App PV", async () => {
    signInWith(["pv.publish"]);

    renderWithProviders(<PvAdminPage />);

    await waitFor(() =>
      expect(screen.getByTestId("pv-admin-profile-edit")).toBeDisabled(),
    );
    expect(
      await screen.findByTestId("pv-admin-publish-switch"),
    ).not.toBeDisabled();
  });

  /**
   * FE252-P1-08 — công tắc phải gửi ĐÚNG version của dòng đang bấm. Đây là test
   * chặn hồi quy cho gốc lỗi: trước đây FE gọi publish không kèm precondition
   * nào, nên hai người bấm cùng lúc thì người bấm sau ghi đè im lặng.
   */
  it("gửi version hồ sơ của đúng dòng đang bấm làm precondition", async () => {
    signInWith(["pv.master.manage", "pv.publish"]);

    renderWithProviders(<PvAdminPage />);

    fireEvent.click(await screen.findByTestId("pv-admin-publish-switch"));

    await waitFor(() =>
      expect(setPvProductPublishedMock).toHaveBeenCalledWith(
        PROFILE.sku_id,
        true,
        PROFILE.version,
      ),
    );
  });

  /** 412/428 = màn hình đang cầm dữ liệu cũ ⇒ phải tải lại rồi mới cho bấm tiếp. */
  it.each([
    [412, "STALE_VERSION"],
    [428, "PRECONDITION_REQUIRED"],
  ])("%i làm màn hình tải lại danh sách hồ sơ", async (status, code) => {
    signInWith(["pv.master.manage", "pv.publish"]);
    setPvProductPublishedMock.mockRejectedValueOnce(
      createMockAxiosError({
        status,
        data: { success: false, error_code: code, message: "Version lệch." },
      }),
    );

    renderWithProviders(<PvAdminPage />);
    await screen.findByTestId("pv-admin-publish-switch");

    const callsBefore = listPvAdminResourcesMock.mock.calls.filter(
      ([resource]) => resource === "product-profiles",
    ).length;

    fireEvent.click(screen.getByTestId("pv-admin-publish-switch"));

    await waitFor(() => {
      const callsAfter = listPvAdminResourcesMock.mock.calls.filter(
        ([resource]) => resource === "product-profiles",
      ).length;
      expect(callsAfter).toBeGreaterThan(callsBefore);
    });
  });
});
