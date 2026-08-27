import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/api/http", () => ({
  http: {
    get: vi.fn(),
    getPage: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { http } from "@/shared/api/http";
import { API_ENDPOINTS } from "@/shared/api/endpoints";
import {
  createMvpSku,
  setMvpSkuPublished,
  updateMvpAgency,
  updateMvpDefect,
  updateMvpSku,
} from "@/modules/master-data/services/mvp-master.service";
import {
  assignIamUserRole,
  updateIamUser,
} from "@/modules/iam/services/iam.service";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mocked = http as any;

const SKU_FORM = {
  code: "DCH-DRILL-DJZ10A-220V",
  name: "Máy khoan Dongcheng DJZ10A",
  sku_type: "PRODUCT" as const,
  unit: "cái",
  is_serial_tracked: true,
  status: "ACTIVE" as const,
  brand_id: "brand-1",
  category_id: "cat-1",
  model_id: "model-1",
  power_source_id: "power-1",
  package_variant_id: "package-1",
  version_code: "V1",
};

describe("Luồng 01 · hợp đồng API hệ thống & danh mục", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocked.post.mockResolvedValue({ sku_id: "sku-1", status: "ACTIVE" });
    mocked.patch.mockResolvedValue({ sku_id: "sku-1", status: "ACTIVE" });
  });

  /**
   * ERD bảng 16: SKU liên kết master bằng FK. Trước đây FE gửi mã dạng text và
   * bỏ hẳn power_source_id/package_variant_id.
   */
  it("gửi thẳng id master canonical khi tạo SKU", async () => {
    await createMvpSku(SKU_FORM);

    const [url, body] = mocked.post.mock.calls[0];
    expect(url).toBe(API_ENDPOINTS.PRODUCTS);
    expect(body).toMatchObject({
      sku_code: SKU_FORM.code,
      brand_id: "brand-1",
      category_id: "cat-1",
      model_id: "model-1",
      power_source_id: "power-1",
      package_variant_id: "package-1",
      version_code: "V1",
    });
    expect(body).not.toHaveProperty("brand_code");
    expect(body).not.toHaveProperty("power_source_code");
  });

  it("gỡ liên kết master bằng null tường minh thay vì bỏ field", async () => {
    await updateMvpSku("sku-1", 3, { ...SKU_FORM, package_variant_id: "" });

    const [, body, config] = mocked.patch.mock.calls[0];
    expect(body.package_variant_id).toBeNull();
    expect(config.headers["If-Match"]).toBe("3");
  });

  /** Annex C publishPvProduct + §3: publish đi qua endpoint và quyền riêng. */
  it("publish App PV gọi /pv/products/{id}/publish với body published", async () => {
    await setMvpSkuPublished("sku-1", 4, true);

    const [url, body, config] = mocked.patch.mock.calls[0];
    expect(url).toBe("/pv/products/sku-1/publish");
    expect(body).toEqual({ published: true });
    expect(config.headers["If-Match"]).toBe("4");
  });

  /** ERD bảng 9/15 + Annex C updateAgency/updateDefect: optimistic lock. */
  it("PATCH đại lý và bệnh/lỗi gửi If-Match khi có version", async () => {
    await updateMvpAgency(
      "agency-1",
      {
        agency_code: "AG-HN-001",
        agency_name: "Đại lý Minh Anh",
        status: "ACTIVE",
      },
      7,
    );
    expect(mocked.patch.mock.calls[0][2].headers["If-Match"]).toBe("7");

    await updateMvpDefect(
      "defect-1",
      {
        defect_code: "DF-MOTOR-01",
        defect_name: "Không chạy motor",
        status: "ACTIVE",
      },
      2,
    );
    const [url, , config] = mocked.patch.mock.calls[1];
    expect(url).toBe("/defects/defect-1");
    expect(config.headers["If-Match"]).toBe("2");
  });

  it("bỏ If-Match khi bản ghi chưa có version", async () => {
    await updateMvpAgency("agency-1", {
      agency_code: "AG-HN-001",
      agency_name: "Đại lý Minh Anh",
      status: "ACTIVE",
    });

    expect(mocked.patch.mock.calls[0][2]).toBeUndefined();
  });

  /** §8.1 Master: path chuẩn Annex C là /defects. */
  it("dùng path Annex C /defects cho danh mục bệnh lỗi", () => {
    expect(API_ENDPOINTS.DEFECT_CATALOGS).toBe("/defects");
  });

  /** §8.1 IAM "If-Match on update". */
  it("PATCH người dùng gửi If-Match theo version hiện tại", async () => {
    mocked.patch.mockResolvedValue({ user_id: "user-1", version: 3 });

    await updateIamUser("user-1", {
      username: "nvkho01",
      display_name: "Nguyễn Văn Kho",
      status: "ACTIVE",
      version: 2,
    });

    const [url, , config] = mocked.patch.mock.calls[0];
    expect(url).toBe("/users/user-1");
    expect(config.headers["If-Match"]).toBe("2");
  });

  /** BR-IAM-08 "explicit role/scope assignment". */
  it("gán vai trò gửi roles[] kèm scope_ref và cửa sổ hiệu lực", async () => {
    mocked.post.mockResolvedValue({ user_id: "user-1" });

    await assignIamUserRole(
      "user-1",
      {
        role_id: "role-1",
        scope_ref: "wh-1",
        effective_from: "2026-08-17",
        effective_to: null,
      },
      "Test reason for audit",
    );

    const [url, body] = mocked.post.mock.calls[0];
    expect(url).toBe("/users/user-1/roles");
    expect(body).toEqual({
      roles: [
        {
          role_id: "role-1",
          scope_ref: "wh-1",
          effective_from: "2026-08-17",
          effective_to: null,
        },
      ],
      reason: "Test reason for audit",
    });
  });

  it("scope_ref rỗng gửi null (toàn hệ thống) thay vì chuỗi rỗng", async () => {
    mocked.post.mockResolvedValue({ user_id: "user-1" });

    await assignIamUserRole(
      "user-1",
      { role_id: "role-1", scope_ref: "" },
      "Test reason for audit",
    );

    expect(mocked.post.mock.calls[0][1].roles[0].scope_ref).toBeNull();
  });
});
