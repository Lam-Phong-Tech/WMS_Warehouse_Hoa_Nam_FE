import { describe, expect, it, vi, beforeEach } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/test-utils";
import { useAuthStore } from "@/shared/store/auth.store";
import type { PvAdminProfile } from "@/modules/pv/types/pv.types";

const {
  listPvAdminResourcesMock,
  setPvProductPublishedMock,
} = vi.hoisted(() => ({
  listPvAdminResourcesMock: vi.fn(),
  setPvProductPublishedMock: vi.fn(),
}));

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
    listPvAdminResourcesMock.mockReset().mockImplementation((resource: string) =>
      Promise.resolve({
        data: resource === "product-profiles" ? [PROFILE] : [],
        meta: {},
      }),
    );
    setPvProductPublishedMock.mockReset().mockResolvedValue({
      published_to_app: true,
    });
  });

  it("người chỉ có pv.master.manage KHÔNG bật/tắt được publish", async () => {
    signInWith(["pv.master.manage"]);

    renderWithProviders(<PvAdminPage />);

    const toggle = await screen.findByTestId("pv-admin-publish-switch");
    expect(toggle).toBeDisabled();
    expect(
      screen.getByText(/không có quyền pv\.publish/i),
    ).toBeInTheDocument();
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
});
