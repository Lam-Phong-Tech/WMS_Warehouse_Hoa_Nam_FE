import { describe, it, expect } from "vitest";
import {
  isErrorEnvelope,
  getErrorCode,
  getFieldErrors,
  getRequestId,
} from "@/shared/types/api-response";

/**
 * isErrorEnvelope() nhận tham số kiểu hẹp `{ success?; status? }` — response
 * thật luôn kèm thêm `message`/`data`/... Bọc qua biến trung gian có type rộng
 * hơn để không bị TS "excess property check" (chỉ áp dụng cho object literal
 * truyền thẳng vào lời gọi hàm, không áp dụng khi gán qua biến trước).
 */
function envelope(body: {
  success?: boolean;
  status?: string;
  message?: string;
  data?: unknown;
}) {
  return body;
}

// P0.3: BE dùng lẫn lộn 2 kiểu báo lỗi tuỳ endpoint — `success: false` (vd
// /auth/login, /auth/me) và CHỈ `status: "error"` không kèm `success` (vd
// /user-role-scopes, /user-data-scopes — xem docs/api-evidence/). Trước đây
// isErrorEnvelope chỉ check `success === false` nên các response chỉ có
// `status: "error"` bị coi là thành công và unwrap thành `data: undefined`.
describe("isErrorEnvelope", () => {
  it("nhận diện lỗi qua success: false (contract cũ)", () => {
    expect(isErrorEnvelope(envelope({ success: false, message: "lỗi" }))).toBe(
      true,
    );
  });

  it('nhận diện lỗi qua CHỈ status: "error", không có success', () => {
    expect(isErrorEnvelope(envelope({ status: "error", message: "lỗi" }))).toBe(
      true,
    );
  });

  it('nhận diện lỗi khi cả success: false lẫn status: "error"', () => {
    expect(
      isErrorEnvelope(
        envelope({ success: false, status: "error", message: "lỗi" }),
      ),
    ).toBe(true);
  });

  it('không coi HTTP 2xx kèm status: "error" là thành công', () => {
    // Case rủi ro nhất theo P0.3: BE trả HTTP 200/201 nhưng body báo lỗi.
    expect(
      isErrorEnvelope(
        envelope({ status: "error", message: "Validation failed" }),
      ),
    ).toBe(true);
  });

  it("coi success: true là thành công", () => {
    expect(isErrorEnvelope(envelope({ success: true, data: {} }))).toBe(false);
  });

  it('coi status: "success" (không có success boolean) là thành công', () => {
    expect(isErrorEnvelope(envelope({ status: "success", data: {} }))).toBe(
      false,
    );
  });

  it("body null/undefined không phải lỗi", () => {
    expect(isErrorEnvelope(null)).toBe(false);
    expect(isErrorEnvelope(undefined)).toBe(false);
  });
});

// Đối chiếu OpenAPI spec thật của dự án (GET /docs?api-docs.json): BE publish
// song song 2 contract lỗi tuỳ module — flat root-level (schema ApiError, vd
// employee-assignments) và nested theo API_Convention.md (schema ErrorResponse,
// đa số endpoint mới: webhooks, sales-order, price-list...). Các hàm dưới đây
// phải đọc đúng cả 2 dạng để FE không "mù" khi BE dùng dạng nested.
describe("getErrorCode / getFieldErrors / getRequestId (bridge 2 contract lỗi)", () => {
  it("đọc error_code dạng flat (root-level)", () => {
    expect(
      getErrorCode({ message: "x", error_code: "VALIDATION_FAILED" }),
    ).toBe("VALIDATION_FAILED");
  });

  it("đọc error.code dạng nested", () => {
    expect(
      getErrorCode({ message: "x", error: { code: "VALIDATION_FAILED" } }),
    ).toBe("VALIDATION_FAILED");
  });

  it("ưu tiên error_code flat nếu cả 2 cùng có", () => {
    expect(
      getErrorCode({
        message: "x",
        error_code: "FLAT",
        error: { code: "NESTED" },
      }),
    ).toBe("FLAT");
  });

  it("đọc errors dạng flat (root-level)", () => {
    expect(
      getFieldErrors({ message: "x", errors: { email: ["Bắt buộc"] } }),
    ).toEqual({ email: ["Bắt buộc"] });
  });

  it("đọc error.details dạng nested", () => {
    expect(
      getFieldErrors({
        message: "x",
        error: { code: "VALIDATION_FAILED", details: { email: ["Bắt buộc"] } },
      }),
    ).toEqual({ email: ["Bắt buộc"] });
  });

  it("đọc request_id dạng flat và meta.request_id dạng nested", () => {
    expect(getRequestId({ message: "x", request_id: "abc" })).toBe("abc");
    expect(getRequestId({ message: "x", meta: { request_id: "xyz" } })).toBe(
      "xyz",
    );
  });

  it("trả undefined khi không có field nào", () => {
    expect(getErrorCode({ message: "x" })).toBeUndefined();
    expect(getFieldErrors({ message: "x" })).toBeUndefined();
    expect(getRequestId({ message: "x" })).toBeUndefined();
  });
});
