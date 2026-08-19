/**
 * WWHN-267 (FE267-D06) — hợp đồng tiêu thụ mã 403 của FE.
 *
 * Bối cảnh: SRS §8.2 liệt kê `PERMISSION_DENIED` / `DATA_SCOPE_DENIED` ở cột *ví dụ*,
 * còn backend dùng `ACCESS_DENIED` làm mã mặc định và thêm `WAREHOUSE_SCOPE_DENIED`.
 * Khác biệt tên gọi này đang chờ disposition của BA + Tech Lead (DIV-403-01 trong
 * `docs/evidence/WWHN-267/HTTP_ERROR_CODE_PAIRING.json` ở repo BE), nên FE phải sống
 * được với **cả nhóm** thay vì đoán đúng một tên.
 *
 * Hai lỗi thật mà bộ test này khoá lại:
 *  - `isNoPermissionError` (nhánh envelope 2xx) trước đây thiếu
 *    `WAREHOUSE_SCOPE_DENIED` — đúng loại lỗi mà WWHN-289 đã sửa một lần cho
 *    `DATA_SCOPE_DENIED`, tái diễn vì danh mục được chép tay ở từng nhánh if.
 *  - Màn cấu hình kho chỉ so `code === "ACCESS_DENIED"` nên mọi mã 403 khác rơi về
 *    thông điệp chung, người dùng mất manh mối "ngoài phạm vi dữ liệu".
 */

import { describe, it, expect } from "vitest";
import {
  ApiEnvelopeError,
  FORBIDDEN_ERROR_CODES,
  createMockAxiosError,
  isForbiddenErrorCode,
  isNoPermissionError,
  normalizeError,
} from "../api-error";

describe("WWHN-267 · danh mục mã 403", () => {
  it("phủ đủ mã mà backend thực sự phát ở hạng 403", () => {
    // Nguồn: docs/api-contract/HN-BE-API-002_ERROR_CODE_CATALOG.json (repo BE) —
    // 403 gồm ACCESS_DENIED / DATA_SCOPE_DENIED / PERMISSION_DENIED /
    // WAREHOUSE_SCOPE_DENIED. FORBIDDEN / NO_PERMISSION là hai tên lịch sử còn dùng
    // trong envelope nghiệp vụ.
    for (const code of [
      "ACCESS_DENIED",
      "DATA_SCOPE_DENIED",
      "PERMISSION_DENIED",
      "WAREHOUSE_SCOPE_DENIED",
    ]) {
      expect(isForbiddenErrorCode(code)).toBe(true);
    }
  });

  it("không nhận nhầm mã ngoài hạng 403", () => {
    expect(isForbiddenErrorCode("STATE_CONFLICT")).toBe(false);
    expect(isForbiddenErrorCode("PASSWORD_CHANGE_REQUIRED")).toBe(false);
    expect(isForbiddenErrorCode(undefined)).toBe(false);
  });

  it("giữ danh mục ở đúng một nơi để không tái diễn việc chép tay", () => {
    expect(new Set(FORBIDDEN_ERROR_CODES).size).toBe(
      FORBIDDEN_ERROR_CODES.length,
    );
  });
});

describe("WWHN-267 · isNoPermissionError trên envelope nghiệp vụ", () => {
  const envelope = (code: string) =>
    new ApiEnvelopeError({
      status: "error",
      message: "Kho yêu cầu nằm ngoài data scope.",
      error_code: code,
      error: { code },
      meta: { request_id: "req-wwhn267" },
    });

  it("nhận diện WAREHOUSE_SCOPE_DENIED — mã trước đây bị bỏ sót", () => {
    expect(isNoPermissionError(envelope("WAREHOUSE_SCOPE_DENIED"))).toBe(true);
  });

  it("vẫn nhận diện các mã đã có từ WWHN-289", () => {
    expect(isNoPermissionError(envelope("DATA_SCOPE_DENIED"))).toBe(true);
    expect(isNoPermissionError(envelope("ACCESS_DENIED"))).toBe(true);
    expect(isNoPermissionError(envelope("PERMISSION_DENIED"))).toBe(true);
  });

  it("không coi PASSWORD_CHANGE_REQUIRED là thiếu quyền", () => {
    expect(isNoPermissionError(envelope("PASSWORD_CHANGE_REQUIRED"))).toBe(
      false,
    );
  });
});

describe("WWHN-267 · lỗi 403 qua axios luôn có status để phân biệt thông điệp", () => {
  it("normalizeError giữ được status 403 cho mọi mã trong danh mục", () => {
    for (const code of FORBIDDEN_ERROR_CODES) {
      const normalized = normalizeError(
        createMockAxiosError({
          status: 403,
          data: {
            success: false,
            message: "Kho yêu cầu nằm ngoài data scope.",
            error_code: code,
            error: { code },
            meta: { request_id: "req-wwhn267-axios" },
          },
        }),
      );

      expect(normalized.status).toBe(403);
      expect(isForbiddenErrorCode(normalized.code)).toBe(true);
    }
  });
});
