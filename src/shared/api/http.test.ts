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

import { http, normalizeMultipartBooleanFields } from "@/shared/api/http";

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

describe("multipart boolean transport contract", () => {
  it("chuẩn hóa true/false thành 1/0 để Laravel boolean validator chấp nhận", () => {
    const body = new FormData();
    body.append("update_existing", "true");
    body.append("dry_run", "false");

    normalizeMultipartBooleanFields(body);

    expect(body.get("update_existing")).toBe("1");
    expect(body.get("dry_run")).toBe("0");
  });

  it("không ép dữ liệu rác thành false", () => {
    const body = new FormData();
    body.append("update_existing", "yes");
    body.append("dry_run", "invalid");

    normalizeMultipartBooleanFields(body);

    expect(body.get("update_existing")).toBe("yes");
    expect(body.get("dry_run")).toBe("invalid");
  });

  it("http.post luôn chuẩn hóa FormData trước khi gửi", async () => {
    const body = new FormData();
    body.append("update_existing", "true");
    body.append("dry_run", "false");
    postMock.mockResolvedValue({
      status: 200,
      data: { success: true, data: { ok: true } },
    });

    await expect(http.post("/api/v1/skus/import-excel", body)).resolves.toEqual(
      {
        ok: true,
      },
    );

    const sentBody = postMock.mock.calls[0]?.[1] as FormData;
    expect(sentBody.get("update_existing")).toBe("1");
    expect(sentBody.get("dry_run")).toBe("0");
  });
});
