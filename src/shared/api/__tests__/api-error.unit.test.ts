/**
 * Unit test cho api-error.ts
 *
 * Cách chạy test này:
 * 1. Tạm thời comment setupFiles trong vite.config.ts
 * 2. Chạy: npx vitest run src/shared/api/__tests__/api-error.unit.test.ts
 * 3. Hoặc chạy toàn bộ suite: npx vitest run (sau khi fix setup.ts)
 */

import { describe, it, expect } from "vitest";
import { getApiErrorMessage, createMockAxiosError } from "../api-error";

describe("api-error.unit", () => {
  it("should extract BE message", () => {
    const error = createMockAxiosError({
      status: 400,
      data: { message: "Lỗi từ BE" },
    });
    expect(getApiErrorMessage(error)).toBe("Lỗi từ BE");
  });

  // `error_code`/`error.code` là mã kỹ thuật để so sánh bằng code, không phải
  // câu cho người dùng đọc — xem chú thích trong getApiErrorMessage. Hai test
  // dưới đây từng kỳ vọng ngược lại (lộ mã thô ra UI) và đã đỏ từ trước.
  it("should not leak error_code as the user-facing message", () => {
    const error = createMockAxiosError({
      status: 400,
      data: { error_code: "VALIDATION_ERROR" },
    });
    expect(getApiErrorMessage(error)).toBe("Máy chủ trả về lỗi (400).");
  });

  it("should not leak nested error.code as the user-facing message", () => {
    const error = createMockAxiosError({
      status: 500,
      data: { error: { code: "INTERNAL_ERROR" } },
    });
    expect(getApiErrorMessage(error)).toBe("Lỗi hệ thống");
  });

  it("should extract field errors", () => {
    const error = createMockAxiosError({
      status: 422,
      data: {
        errors: {
          email: ["Email không hợp lệ"],
          password: ["Mật khẩu quá ngắn"],
        },
      },
    });
    // Không kèm tên trường thô (`email:`) — message của BE đã tự mở đầu bằng
    // nhãn tiếng Việt của chính trường đó.
    expect(getApiErrorMessage(error)).toBe(
      "Email không hợp lệ Mật khẩu quá ngắn",
    );
  });

  it("should handle unknown error", () => {
    const error = createMockAxiosError({
      status: 500,
      data: {},
    });
    expect(getApiErrorMessage(error)).toBe("Lỗi hệ thống");
  });
});
