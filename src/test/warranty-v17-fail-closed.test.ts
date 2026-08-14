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
    postWithMeta: vi.fn(),
    patch: vi.fn(),
    downloadBlob: vi.fn(),
  },
}));

import { http } from "@/shared/api/http";
import { createWarrantyCase } from "@/modules/warranty/services/warrantyService";

describe("WWHN-181 warranty v1.7 fail-closed boundary", () => {
  beforeEach(() => {
    authMocks.getState.mockReturnValue({
      isSuperAdmin: false,
      permissionCodes: ["warranty.temp_only"],
    });
    vi.mocked(http.post).mockReset();
  });

  it("does not POST the create payload when actor only holds the legacy temp_only permission", async () => {
    await expect(
      createWarrantyCase({
        identification_type: "TEMP_ONLY",
        customer_name: "Khach hang",
        customer_phone: "0900000000",
        defect_code: "POWER",
        defect_description: "Khong len nguon",
        missing_code_reason: "Mat tem",
        manual_product_description: "May khoan mau do",
      }),
    ).rejects.toMatchObject({ code: "WMS_FE_PERMISSION_REQUIRED" });
    expect(http.post).not.toHaveBeenCalled();
  });
});
