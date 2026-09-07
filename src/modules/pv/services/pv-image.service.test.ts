import { beforeEach, describe, expect, it, vi } from "vitest";

const { postMock } = vi.hoisted(() => ({ postMock: vi.fn() }));

vi.mock("@/shared/api/http", () => ({ http: { post: postMock } }));

import {
  isValidImageUrl,
  uploadPvProductImage,
} from "@/modules/pv/services/pv-image.service";

describe("pv-image.service · uploadPvProductImage", () => {
  beforeEach(() => {
    postMock.mockReset().mockResolvedValue({
      url: "http://localhost:8080/api/v1/pv/product-images/abc.jpg",
      storage_key: "pv-product-images/abc.jpg",
      bytes: 1234,
      mime_type: "image/jpeg",
    });
  });

  it("gửi FormData chứa file lên endpoint upload của hệ thống", async () => {
    const file = new File(["x"], "may-khoan.jpg", { type: "image/jpeg" });

    const result = await uploadPvProductImage(file);

    expect(postMock).toHaveBeenCalledTimes(1);
    const [url, body] = postMock.mock.calls[0];
    expect(url).toBe("/pv-admin/product-images");
    expect(body).toBeInstanceOf(FormData);
    expect((body as FormData).get("file")).toBe(file);
    expect(result.url).toBe(
      "http://localhost:8080/api/v1/pv/product-images/abc.jpg",
    );
    expect(result.storageKey).toBe("pv-product-images/abc.jpg");
  });

  it("chuyển tiếp AbortSignal để đóng hộp thoại là huỷ được request", async () => {
    const controller = new AbortController();
    await uploadPvProductImage(
      new File(["x"], "a.png", { type: "image/png" }),
      {
        signal: controller.signal,
      },
    );

    expect(postMock.mock.calls[0][2]).toEqual({ signal: controller.signal });
  });

  /**
   * BE luôn trả `url`. Rơi vào đây nghĩa hợp đồng đã trôi — phải nổ chứ không
   * được ghi chuỗi rỗng xuống hồ sơ rồi App PV vẽ ra ô ảnh trống.
   */
  it("ném lỗi khi response thiếu url", async () => {
    postMock.mockResolvedValue({ storage_key: "pv-product-images/abc.jpg" });

    await expect(
      uploadPvProductImage(new File(["x"], "a.jpg", { type: "image/jpeg" })),
    ).rejects.toThrow(/địa chỉ ảnh/i);
  });
});

/**
 * Bản sao FE của luật `PvAdminResourceController::imageListInput`. Hai chỗ lệch
 * nhau nghĩa là hoặc FE chặn oan một URL BE nhận, hoặc FE cho qua một URL BE trả
 * 422 — cả hai chỉ lộ ra lúc người dùng bấm Lưu.
 */
describe("pv-image.service · isValidImageUrl", () => {
  it("nhận http và https tuyệt đối", () => {
    expect(isValidImageUrl("https://cdn.hoanam.vn/a.jpg")).toBe(true);
    expect(
      isValidImageUrl("http://localhost:8080/api/v1/pv/product-images/a.jpg"),
    ).toBe(true);
    expect(isValidImageUrl("  https://cdn.vn/a.webp  ")).toBe(true);
  });

  /**
   * Chốt chặn XSS thật sự: App PV render chuỗi này thẳng vào `<img src>`, nên
   * một `javascript:` lọt xuống DB là mã chạy trên máy KHÁCH xem ứng dụng.
   */
  it("loại scheme không phải http(s) và chuỗi không phải URL", () => {
    expect(isValidImageUrl("javascript:alert(1)")).toBe(false);
    expect(isValidImageUrl("data:image/png;base64,AAAA")).toBe(false);
    expect(isValidImageUrl("//cdn.vn/a.jpg")).toBe(false);
    expect(isValidImageUrl("cdn.vn/a.jpg")).toBe(false);
    expect(isValidImageUrl("")).toBe(false);
  });

  /** `pv_product_images.image_url` là varchar(500) — dài hơn là 500 ở tầng DB. */
  it("loại URL dài quá 500 ký tự", () => {
    expect(isValidImageUrl(`https://cdn.vn/${"a".repeat(500)}.jpg`)).toBe(
      false,
    );
  });
});
