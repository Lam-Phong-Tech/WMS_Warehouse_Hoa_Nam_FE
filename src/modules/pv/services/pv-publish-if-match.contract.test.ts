import { beforeEach, describe, expect, it, vi } from "vitest";
import { api } from "@/shared/api/axios";
import { createMockAxiosError, normalizeError } from "@/shared/api/api-error";
import { setPvProductPublished } from "@/modules/pv/services/pv-admin.service";

/**
 * WWHN-252 · FE252-P1-08 — bằng chứng "network header".
 *
 * Test đi qua nguyên chuỗi service → `http` → instance axios (`api`), nên nếu
 * ai đó gỡ header ở bất kỳ tầng nào thì test đỏ. Assert trên `api.patch` chứ
 * không phải trên `http.patch` là có chủ đích: mock `http` sẽ vẫn xanh kể cả khi
 * `http.patch` quên chuyển tiếp `config` xuống axios — đúng loại lỗi cần chặn.
 *
 * Annex C (SRS/FRD v1.12 §Annex C, operationId publishPvProduct):
 * `PATCH /pv/products/{sku_id}/publish` — header `If-Match`, error set
 * 400/401/403/404/409/412/422/428/500.
 */
const SKU_ID = "11111111-1111-4111-8111-111111111111";

function mockPatchOk(publishedToApp: boolean, version: number) {
  vi.mocked(api.patch).mockResolvedValue({
    status: 200,
    data: {
      success: true,
      data: { published_to_app: publishedToApp, pv_profile_version: version },
    },
  });
}

describe("WWHN-252 · publishPvProduct gửi If-Match theo version hồ sơ App PV", () => {
  beforeEach(() => {
    vi.mocked(api.patch).mockReset();
  });

  it("gửi đúng path Annex C, body {published} và header If-Match = version hồ sơ", async () => {
    mockPatchOk(true, 4);

    const result = await setPvProductPublished(SKU_ID, true, 3);

    expect(api.patch).toHaveBeenCalledTimes(1);
    const [url, body, config] = vi.mocked(api.patch).mock.calls[0];
    expect(url).toBe(`/pv/products/${SKU_ID}/publish`);
    expect(body).toEqual({ published: true });
    expect(config?.headers).toEqual({ "If-Match": "3" });
    // Version mới về từ BE để màn hình cập nhật precondition tại chỗ.
    expect(result).toEqual({ published_to_app: true, pv_profile_version: 4 });
  });

  it("version 0 là hợp lệ — SKU chưa có hồ sơ App PV (DEC-API-IFMATCH-002)", async () => {
    mockPatchOk(true, 1);

    await setPvProductPublished(SKU_ID, true, 0);

    expect(vi.mocked(api.patch).mock.calls[0][2]?.headers).toEqual({
      "If-Match": "0",
    });
  });

  it("unpublish cũng phải kèm precondition, không được gửi rỗng", async () => {
    mockPatchOk(false, 6);

    await setPvProductPublished(SKU_ID, false, 5);

    const [, body, config] = vi.mocked(api.patch).mock.calls[0];
    expect(body).toEqual({ published: false });
    expect(config?.headers).toEqual({ "If-Match": "5" });
  });

  /**
   * Gốc của FE252-P1-08: trước đây FE không gửi header, và các hook master rơi
   * về `?? 1`. Thiếu version phải hỏng NGAY ở client, tuyệt đối không được đoán
   * rồi bắn lên server — một precondition bịa ra sẽ ghi đè thay đổi của người khác.
   */
  it("thiếu version thì ném lỗi tại client và KHÔNG gọi API", () => {
    // Ném ĐỒNG BỘ, trước cả khi có promise: request không bao giờ rời khỏi máy.
    expect(() =>
      setPvProductPublished(SKU_ID, true, undefined as unknown as number),
    ).toThrow(/Thiếu version/i);

    expect(api.patch).not.toHaveBeenCalled();
  });

  it("412 STALE_VERSION nổi lên nguyên status để UI tải lại danh sách", async () => {
    vi.mocked(api.patch).mockRejectedValue(
      createMockAxiosError({
        status: 412,
        data: {
          success: false,
          error_code: "STALE_VERSION",
          message: "Hồ sơ App PV đã được cập nhật bởi phiên khác.",
          error: {
            code: "STALE_VERSION",
            details: { expected_version: 3, current_version: 4 },
          },
        },
      }),
    );

    const error = await setPvProductPublished(SKU_ID, true, 3).catch(
      (err: unknown) => err,
    );

    expect(normalizeError(error).status).toBe(412);
    expect(normalizeError(error).code).toBe("STALE_VERSION");
  });

  it("428 PRECONDITION_REQUIRED nổi lên nguyên status (BE bắt buộc header)", async () => {
    vi.mocked(api.patch).mockRejectedValue(
      createMockAxiosError({
        status: 428,
        data: {
          success: false,
          error_code: "PRECONDITION_REQUIRED",
          message: "Publish App PV bắt buộc header If-Match.",
          error: {
            code: "PRECONDITION_REQUIRED",
            details: { current_version: 0 },
          },
        },
      }),
    );

    const error = await setPvProductPublished(SKU_ID, true, 3).catch(
      (err: unknown) => err,
    );

    expect(normalizeError(error).status).toBe(428);
    expect(normalizeError(error).code).toBe("PRECONDITION_REQUIRED");
  });
});
