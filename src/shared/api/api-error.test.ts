/**
 * Unit test cho api-error.ts
 *
 * NOTE: File này cần chạy với `--no-coverage` và `--reporter=basic` để tránh
 * vấn đề với antd mock trong setup.ts:
 *   npx vitest run src/shared/api/api-error.test.ts --no-coverage --reporter=basic
 *
 * Hoặc tạm thời comment dòng `setupFiles: './src/test/setup.ts'` trong vite.config.ts
 * khi chạy test này.
 */

import { describe, it, expect } from "vitest";
import {
  getApiErrorMessage,
  createMockAxiosError,
  isNoPermissionError,
} from "./api-error";

describe("api-error", () => {
  it("should extract BE message", () => {
    const error = createMockAxiosError({
      status: 400,
      data: { message: "Lỗi từ BE" },
    });
    expect(getApiErrorMessage(error)).toBe("Lỗi từ BE");
  });

  it("should not leak error_code as the user-facing message", () => {
    const error = createMockAxiosError({
      status: 400,
      data: { error_code: "VALIDATION_ERROR" },
    });
    expect(getApiErrorMessage(error)).toBe(
      "Yêu cầu chưa thực hiện được. Kiểm tra lại thông tin rồi thử lại; nếu vẫn lỗi, liên hệ quản trị viên.",
    );
  });

  it("should not leak nested error.code as the user-facing message", () => {
    const error = createMockAxiosError({
      status: 500,
      data: { error: { code: "INTERNAL_ERROR" } },
    });
    expect(getApiErrorMessage(error)).toBe(
      "Hệ thống đang gặp sự cố, vui lòng thử lại sau ít phút. Nếu vẫn lỗi, liên hệ quản trị viên.",
    );
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
    // Không kèm tên trường thô (`email:`): message BE đã tự mở đầu bằng nhãn
    // tiếng Việt của trường đó.
    expect(getApiErrorMessage(error)).toBe(
      "Email không hợp lệ Mật khẩu quá ngắn",
    );
  });

  it("chi tiết theo trường thay thế câu tổng chung chung", () => {
    const error = createMockAxiosError({
      status: 422,
      data: {
        message: "Dữ liệu gửi lên không hợp lệ.",
        errors: {
          email: ["Email này đã được dùng cho một tài khoản khác."],
        },
      },
    });
    expect(getApiErrorMessage(error)).toBe(
      "Email này đã được dùng cho một tài khoản khác.",
    );
  });

  it("message nghiệp vụ cụ thể vẫn được giữ cùng chi tiết theo trường", () => {
    const error = createMockAxiosError({
      status: 422,
      data: {
        message: "Không đủ tồn để xuất kho.",
        errors: { quantity: ["Số lượng không được lớn hơn 5."] },
      },
    });
    expect(getApiErrorMessage(error)).toBe(
      "Không đủ tồn để xuất kho. Số lượng không được lớn hơn 5.",
    );
  });

  it("should handle unknown error", () => {
    const error = createMockAxiosError({
      status: 500,
      data: {},
    });
    expect(getApiErrorMessage(error)).toBe(
      "Hệ thống đang gặp sự cố, vui lòng thử lại sau ít phút. Nếu vẫn lỗi, liên hệ quản trị viên.",
    );
  });
  it("should treat plain HTTP 403 as no-permission even without interceptor flag", () => {
    const error = createMockAxiosError({
      status: 403,
      data: { message: "Forbidden" },
    });
    expect(isNoPermissionError(error)).toBe(true);
  });

  it("should not treat PASSWORD_CHANGE_REQUIRED 403 as generic no-permission", () => {
    const error = createMockAxiosError({
      status: 403,
      data: {
        message: "Password change required",
        error_code: "PASSWORD_CHANGE_REQUIRED",
      },
    });
    expect(isNoPermissionError(error)).toBe(false);
  });
});
