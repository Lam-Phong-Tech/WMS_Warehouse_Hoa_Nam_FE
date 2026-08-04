import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Hardening cho `unwrap()`: BE lẽ ra luôn giữ envelope `ApiResponse<T>`, nhưng
 * nếu một endpoint lệch chuẩn (204 No Content, raw array, object thiếu
 * `data`) thì không được crash hay âm thầm trả `undefined` không rõ nguyên do.
 */

const getMock = vi.fn();
const postMock = vi.fn();

vi.mock("@/shared/api/axios", () => ({
  api: {
    get: (...args: unknown[]) => getMock(...args),
    post: (...args: unknown[]) => postMock(...args),
    put: vi.fn(),
    patch: vi.fn(),
    delete: vi.fn(),
  },
}));

import { http } from "@/shared/api/http";

describe("http unwrap hardening", () => {
  beforeEach(() => {
    getMock.mockReset();
    postMock.mockReset();
  });

  it("204 No Content → trả undefined, không throw", async () => {
    getMock.mockResolvedValue({ status: 204, data: "" });
    await expect(http.get("/x")).resolves.toBeUndefined();
  });

  it("body null → trả undefined, không throw", async () => {
    getMock.mockResolvedValue({ status: 200, data: null });
    await expect(http.get("/x")).resolves.toBeUndefined();
  });

  it("raw array (không có envelope) → trả thẳng array", async () => {
    const raw = [1, 2, 3];
    getMock.mockResolvedValue({ status: 200, data: raw });
    await expect(http.get("/x")).resolves.toEqual(raw);
  });

  it("object hợp lệ nhưng thiếu field `data` → trả thẳng object (fallback)", async () => {
    const raw = { foo: "bar" };
    getMock.mockResolvedValue({ status: 200, data: raw });
    await expect(http.get("/x")).resolves.toEqual(raw);
  });

  it("envelope lỗi (success:false) vẫn throw như cũ", async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { success: false, message: "Có lỗi" },
    });
    await expect(http.get("/x")).rejects.toThrow("Có lỗi");
  });

  it("envelope thành công chuẩn vẫn bóc data như cũ", async () => {
    getMock.mockResolvedValue({
      status: 200,
      data: { success: true, data: { id: 1 } },
    });
    await expect(http.get("/x")).resolves.toEqual({ id: 1 });
  });

  it("getPage: object thiếu `data` → fallback trả thẳng object, meta rỗng", async () => {
    const raw = { items: [1, 2] };
    getMock.mockResolvedValue({ status: 200, data: raw });
    await expect(http.getPage("/x")).resolves.toEqual({ data: raw, meta: {} });
  });
});
