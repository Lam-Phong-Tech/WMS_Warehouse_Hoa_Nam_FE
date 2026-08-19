import { describe, expect, it } from "vitest";
import {
  classifyPostIssueError,
  shouldReuseIdempotencyKey,
  STOCK_SHORTAGE_CODES,
} from "@/shared/api/post-issue-contract";

function apiError(status: number, code?: string) {
  return {
    response: {
      status,
      data: code === undefined ? {} : { error_code: code },
    },
  };
}

describe("WWHN-201 / DEC-OUT-STOCK-HTTP-001 — hợp đồng lỗi Post Issue", () => {
  it("thiếu tồn là 422, KHÔNG phải 409", () => {
    for (const code of STOCK_SHORTAGE_CODES) {
      const outcome = classifyPostIssueError(apiError(422, code));
      expect(outcome?.status).toBe(422);
      expect(outcome?.action).toBe("FIX_STOCK_THEN_RESTART");
      // Gửi lại y nguyên là vô nghĩa: reload không sinh ra tồn mới.
      expect(outcome?.reuseIdempotencyKey).toBe(false);
    }
  });

  it("không nhận 409 cho mã thiếu tồn (chống hồi quy parent AC cũ)", () => {
    // Nếu một ngày BE trả 409 kèm INSUFFICIENT_STOCK thì vẫn phải phân loại theo mã,
    // và test này là nơi phát hiện việc BE lệch khỏi §8.2.
    const outcome = classifyPostIssueError(apiError(409, "INSUFFICIENT_STOCK"));
    expect(outcome?.action).toBe("FIX_STOCK_THEN_RESTART");
    expect(outcome?.status).toBe(409);
  });

  it("412 STALE_VERSION: reload rồi gửi lại bằng ĐÚNG key cũ", () => {
    const error = apiError(412, "STALE_VERSION");
    const outcome = classifyPostIssueError(error);
    expect(outcome?.action).toBe("RELOAD_THEN_RETRY");
    expect(outcome?.reuseIdempotencyKey).toBe(true);
    expect(shouldReuseIdempotencyKey(error)).toBe(true);
  });

  it("409 CONCURRENCY_CONFLICT: giữ key cũ", () => {
    expect(
      shouldReuseIdempotencyKey(apiError(409, "CONCURRENCY_CONFLICT")),
    ).toBe(true);
  });

  it("409 IDEMPOTENCY_CONFLICT: bắt buộc key mới", () => {
    const error = apiError(409, "IDEMPOTENCY_CONFLICT");
    expect(classifyPostIssueError(error)?.action).toBe("NEW_KEY_REQUIRED");
    expect(shouldReuseIdempotencyKey(error)).toBe(false);
  });

  it("409 STATE_CONFLICT (đã POSTED/CANCELLED): dừng, không retry", () => {
    expect(
      classifyPostIssueError(apiError(409, "STATE_CONFLICT"))?.action,
    ).toBe("STOP");
  });

  it("428 PRECONDITION_REQUIRED: dừng", () => {
    expect(classifyPostIssueError(apiError(428))?.action).toBe("STOP");
  });

  it("lỗi ngoài hợp đồng trả null nhưng vẫn giữ key cũ", () => {
    const timeout = { message: "Network Error" };
    expect(classifyPostIssueError(timeout)).toBeNull();
    // Không biết server đã ghi hay chưa → replay an toàn hơn Post lần hai.
    expect(shouldReuseIdempotencyKey(timeout)).toBe(true);
    expect(shouldReuseIdempotencyKey(apiError(500, "INTERNAL_ERROR"))).toBe(
      true,
    );
  });

  it("422 VALIDATION_ERROR khác không bị nuốt vào nhánh thiếu tồn", () => {
    expect(
      classifyPostIssueError(apiError(422, "VALIDATION_ERROR")),
    ).toBeNull();
  });
});
