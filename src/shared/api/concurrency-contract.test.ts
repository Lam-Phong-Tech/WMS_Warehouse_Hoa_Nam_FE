import { describe, expect, it } from "vitest";

import {
  classifyConcurrencyError,
  isRetryableAfterReload,
  WmsConcurrencyError,
  withConcurrencyContract,
} from "./concurrency-contract";

/**
 * WWHN-234 DEV234-P1-02 — AC-GWT-CONC-001 / TC-P1-007 / TC-P1-015 / TC-P1-031.
 *
 * Điều mà bộ test này canh: request **thua race** phải nhận được một hướng dẫn hành
 * động chứ không phải một lỗi chung, và hướng dẫn đó không bao giờ được là "gửi lại
 * bằng Idempotency-Key mới" — đó chính là cách tạo ra double-post.
 */

function axiosError(status: number, code?: string) {
  return {
    isAxiosError: true,
    response: {
      status,
      data: code === undefined ? {} : { error_code: code },
    },
  };
}

describe("classifyConcurrencyError", () => {
  it("412 STALE_VERSION yêu cầu reload rồi thử lại bằng đúng key cũ", () => {
    const outcome = classifyConcurrencyError(axiosError(412, "STALE_VERSION"));

    expect(outcome?.action).toBe("RELOAD_THEN_RETRY");
    expect(outcome?.reuseIdempotencyKey).toBe(true);
    expect(isRetryableAfterReload(outcome!)).toBe(true);
  });

  it("412 vẫn phân loại đúng khi body thiếu error_code", () => {
    const outcome = classifyConcurrencyError(axiosError(412));

    expect(outcome?.action).toBe("RELOAD_THEN_RETRY");
    expect(outcome?.code).toBe("STALE_VERSION");
  });

  it("409 CONCURRENCY_CONFLICT cùng lớp với 412 — reload, giữ nguyên key", () => {
    const outcome = classifyConcurrencyError(
      axiosError(409, "CONCURRENCY_CONFLICT"),
    );

    expect(outcome?.action).toBe("RELOAD_THEN_RETRY");
    expect(outcome?.reuseIdempotencyKey).toBe(true);
  });

  it("409 IDEMPOTENCY_CONFLICT bắt buộc sinh key mới, không phải retry", () => {
    const outcome = classifyConcurrencyError(
      axiosError(409, "IDEMPOTENCY_CONFLICT"),
    );

    expect(outcome?.action).toBe("NEW_KEY_REQUIRED");
    expect(outcome?.reuseIdempotencyKey).toBe(false);
    expect(isRetryableAfterReload(outcome!)).toBe(false);
  });

  it("409 DOWNSTREAM_DEPENDENCY_EXISTS chỉ dẫn đảo dependency theo BR-REV-04", () => {
    const outcome = classifyConcurrencyError(
      axiosError(409, "DOWNSTREAM_DEPENDENCY_EXISTS"),
    );

    expect(outcome?.action).toBe("REVERSE_DEPENDENCY");
    expect(outcome?.reuseIdempotencyKey).toBe(false);
  });

  it("mã 409 miền cụ thể rơi về lớp STATE_CONFLICT: dừng, không retry", () => {
    const outcome = classifyConcurrencyError(
      axiosError(409, "ITEM_ALREADY_MATCHED"),
    );

    expect(outcome?.action).toBe("STOP");
    expect(outcome?.reuseIdempotencyKey).toBe(false);
  });

  it("428 PRECONDITION_REQUIRED là lỗi thiếu header, không phải race", () => {
    expect(classifyConcurrencyError(axiosError(428))?.action).toBe("STOP");
  });

  it("lỗi ngoài nhóm xung đột trả null để giữ nguyên đường xử lý cũ", () => {
    expect(classifyConcurrencyError(axiosError(422, "VALIDATION_ERROR"))).toBe(
      null,
    );
    expect(classifyConcurrencyError(axiosError(403, "PERMISSION_DENIED"))).toBe(
      null,
    );
    expect(classifyConcurrencyError(axiosError(500, "INTERNAL_ERROR"))).toBe(
      null,
    );
    expect(classifyConcurrencyError(new Error("network down"))).toBe(null);
  });

  it("đọc được mã ở dạng nested error.code của envelope BE", () => {
    const outcome = classifyConcurrencyError({
      isAxiosError: true,
      response: {
        status: 409,
        data: { error: { code: "CONCURRENCY_CONFLICT" } },
      },
    });

    expect(outcome?.action).toBe("RELOAD_THEN_RETRY");
  });
});

describe("withConcurrencyContract", () => {
  it("trả nguyên kết quả khi không có lỗi", async () => {
    await expect(withConcurrencyContract(async () => 42)).resolves.toBe(42);
  });

  it("bọc lỗi xung đột thành WmsConcurrencyError kèm outcome", async () => {
    const cause = axiosError(412, "STALE_VERSION");

    await expect(
      withConcurrencyContract(async () => {
        throw cause;
      }),
    ).rejects.toBeInstanceOf(WmsConcurrencyError);

    try {
      await withConcurrencyContract(async () => {
        throw cause;
      });
    } catch (error) {
      const conflict = error as WmsConcurrencyError;
      expect(conflict.code).toBe("STALE_VERSION");
      expect(conflict.outcome.action).toBe("RELOAD_THEN_RETRY");
      expect(conflict.cause).toBe(cause);
      // Thông điệp phải nói rõ hành động, vì đây là thứ người vận hành đọc.
      expect(conflict.message).toContain("tải lại");
    }
  });

  it("không nuốt lỗi ngoài nhóm xung đột", async () => {
    const cause = axiosError(422, "VALIDATION_ERROR");

    await expect(
      withConcurrencyContract(async () => {
        throw cause;
      }),
    ).rejects.toBe(cause);
  });

  it("không tự retry — callback chỉ được gọi đúng một lần", async () => {
    let calls = 0;

    await expect(
      withConcurrencyContract(async () => {
        calls += 1;
        throw axiosError(409, "CONCURRENCY_CONFLICT");
      }),
    ).rejects.toBeInstanceOf(WmsConcurrencyError);

    expect(calls).toBe(1);
  });
});
