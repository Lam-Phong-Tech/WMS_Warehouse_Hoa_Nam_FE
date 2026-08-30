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
    // Không kèm tên trường thô (`email:`) — message của BE đã tự mở đầu bằng
    // nhãn tiếng Việt của chính trường đó.
    expect(getApiErrorMessage(error)).toBe(
      "Email không hợp lệ Mật khẩu quá ngắn",
    );
  });

  // Bug thật gặp khi in nhãn thất bại chưa kết nối máy in: một endpoint từng
  // đính kèm siêu dữ liệu audit thuần (uuid sự kiện, version, cờ boolean) vào
  // đúng field `errors` mà formatFieldErrors nối thẳng lại để hiển thị — toast
  // hiện "54ce74be-... 4 false" thay vì câu message thật. Endpoint in nhãn đã
  // được sửa để không còn gửi field này nữa; test này giữ nguyên bộ lọc như
  // lưới an toàn cho các endpoint khác lỡ tái phạm cùng kiểu trộn dữ liệu.
  it("should ignore non-message values (uuid/number/boolean) in field errors and fall back to message", () => {
    const error = createMockAxiosError({
      status: 409,
      data: {
        message:
          "Không thể kết nối tới máy in. Kiểm tra máy in đã bật và đã kết nối mạng, sau đó thử lại.",
        errors: {
          label_print_event_id: "54ce74be-9359-4cbd-9561-cc148efb31a2",
          version: 4,
          reprint: false,
        },
      },
    });
    expect(getApiErrorMessage(error)).toBe(
      "Không thể kết nối tới máy in. Kiểm tra máy in đã bật và đã kết nối mạng, sau đó thử lại.",
    );
  });

  it("should keep a real sentence field error even when siblings are metadata", () => {
    const error = createMockAxiosError({
      status: 422,
      data: {
        errors: {
          container_id: "11111111-1111-4111-8111-111111111111",
          reason: "Container đã CLOSED/ISSUED nên không dùng cho scan mới.",
        },
      },
    });
    expect(getApiErrorMessage(error)).toBe(
      "Container đã CLOSED/ISSUED nên không dùng cho scan mới.",
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
});
