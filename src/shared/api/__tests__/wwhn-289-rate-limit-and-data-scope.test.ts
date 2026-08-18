/**
 * WWHN-289 (DEV289-P1-04) — FE consumer contract cho hai thay đổi bảo mật của BE:
 *
 * 1. 429 `RATE_LIMIT_EXCEEDED`: BE nay có rate limit thật (khoá brute-force
 *    `/auth/login` theo lần đăng nhập SAI, và nhóm PV ẩn danh mà Annex C đã khai
 *    error set 400,404,429,500). Trước đó FE chưa từng nhìn thấy 429 nên không
 *    có nhánh nào nhận diện — người dùng chỉ thấy "Máy chủ trả về lỗi (429)".
 * 2. 403 `DATA_SCOPE_DENIED`: luồng nhập kho nay có data scope
 *    (EnforceInboundWarehouseScope). §8.2 xếp mã này cùng hạng 403 với
 *    PERMISSION_DENIED nên FE phải coi là lỗi thiếu quyền, không phải lỗi hệ thống.
 */

import { describe, it, expect } from "vitest";
import {
  createMockAxiosError,
  getApiErrorMessage,
  getRetryAfterSeconds,
  isNoPermissionError,
  isRateLimitedError,
  normalizeError,
} from "../api-error";

describe("WWHN-289 · 429 RATE_LIMIT_EXCEEDED", () => {
  const throttled = () =>
    createMockAxiosError({
      status: 429,
      statusText: "Too Many Requests",
      headers: { "retry-after": "42" },
      data: {
        success: false,
        message:
          "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 42 giây.",
        error_code: "RATE_LIMIT_EXCEEDED",
        errors: {},
        error: { code: "RATE_LIMIT_EXCEEDED", details: {} },
        meta: { request_id: "req-wwhn289-throttle" },
      },
    });

  it("nhận diện được lỗi rate limit", () => {
    expect(isRateLimitedError(throttled())).toBe(true);
  });

  it("không nhầm lỗi khác thành rate limit", () => {
    expect(isRateLimitedError(createMockAxiosError({ status: 409 }))).toBe(
      false,
    );
    expect(isRateLimitedError(new Error("network"))).toBe(false);
  });

  it("đọc được Retry-After để UI lùi đúng khoảng chờ", () => {
    expect(getRetryAfterSeconds(throttled())).toBe(42);
    expect(getRetryAfterSeconds(createMockAxiosError({ status: 429 }))).toBe(
      undefined,
    );
  });

  it("hiển thị message tiếng Việt của BE thay vì mã lỗi thô", () => {
    expect(getApiErrorMessage(throttled())).toBe(
      "Bạn đã đăng nhập sai quá nhiều lần. Vui lòng thử lại sau 42 giây.",
    );
  });

  it("normalizeError giữ nguyên status/code để query layer fail-fast", () => {
    const normalized = normalizeError(throttled());
    expect(normalized.status).toBe(429);
    expect(normalized.code).toBe("RATE_LIMIT_EXCEEDED");
  });
});

describe("WWHN-289 · 403 DATA_SCOPE_DENIED", () => {
  it("được coi là lỗi thiếu quyền, không phải lỗi hệ thống", () => {
    const error = createMockAxiosError({
      status: 403,
      data: {
        success: false,
        message: "Phiếu nhập nằm ngoài warehouse data scope hiện hành.",
        error_code: "DATA_SCOPE_DENIED",
        error: { code: "DATA_SCOPE_DENIED", details: {} },
      },
    });

    expect(isNoPermissionError(error)).toBe(true);
    expect(getApiErrorMessage(error)).toBe(
      "Phiếu nhập nằm ngoài warehouse data scope hiện hành.",
    );
    expect(normalizeError(error).code).toBe("DATA_SCOPE_DENIED");
  });
});
