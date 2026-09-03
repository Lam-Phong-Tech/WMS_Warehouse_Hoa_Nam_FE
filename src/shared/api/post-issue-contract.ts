/**
 * WWHN-201 — hợp đồng lỗi của Post Issue (`POST /outbound-documents/{id}/post-issue`).
 *
 * Nền tảng: SRS §8.2 (REQ-SRS-024) là nguồn sự thật duy nhất cho cặp HTTP ↔ business
 * code. Quyết định DEC-OUT-STOCK-HTTP-001 (đóng DEV201-P1-05) chốt:
 *
 * | Tình huống                                   | HTTP | Business code                                  |
 * |----------------------------------------------|------|------------------------------------------------|
 * | Không đủ tồn khả dụng để trừ                 | 422  | `INSUFFICIENT_STOCK` / `INSUFFICIENT_AVAILABLE_STOCK` |
 * | Phiếu không ở SCANNING (đã POSTED/CANCELLED) | 409  | `STATE_CONFLICT`                               |
 * | Cùng Idempotency-Key, khác payload hash      | 409  | `IDEMPOTENCY_CONFLICT`                         |
 * | Thua lease/row-lock                          | 409  | `CONCURRENCY_CONFLICT`                         |
 * | If-Match cũ                                  | 412  | `STALE_VERSION`                                |
 * | Thiếu If-Match / Idempotency-Key             | 428  | `PRECONDITION_REQUIRED`                        |
 *
 * §8.2 xếp "không đủ tồn" vào lớp 422 (business validation), **không** phải 409. Đây
 * là điểm khác biệt duy nhất giữa parent AC cũ (409) và runtime/test/OpenAPI (422);
 * DEC-OUT-STOCK-HTTP-001 chọn 422 vì §8.2 là authority cao nhất và vì 409 mang ngữ
 * nghĩa "thử lại sau khi reload" — sai hoàn toàn với thiếu tồn (reload không tạo ra
 * tồn mới).
 *
 * Module này cố ý tách khỏi `concurrency-contract.ts`: file kia chỉ phân loại bốn lớp
 * xung đột và trả `null` cho 422 theo thiết kế. Ở đây ta bọc thêm một tầng cho riêng
 * Post Issue để UI có một câu hướng dẫn đúng cho từng lớp mà không phải sửa hợp đồng
 * xung đột dùng chung.
 */
import {
  classifyConcurrencyError,
  type ConcurrencyOutcome,
} from "@/shared/api/concurrency-contract";
import { tStatic } from "@/shared/i18n/useT";

export type PostIssueAction =
  | ConcurrencyOutcome["action"]
  /** 422 thiếu tồn: người dùng phải sửa dữ liệu/tồn, gửi lại y nguyên là vô nghĩa. */
  | "FIX_STOCK_THEN_RESTART";

export interface PostIssueOutcome {
  action: PostIssueAction;
  code: string;
  status?: number;
  message: string;
  /**
   * `true` khi lần gửi lại **phải dùng lại đúng Idempotency-Key cũ** (412/409
   * CONCURRENCY). Sinh key mới ở đây biến một retry an toàn thành lần Post thứ hai.
   */
  reuseIdempotencyKey: boolean;
}

/**
 * §8.2: mọi mã thiếu tồn đều là 422. `INSUFFICIENT_AVAILABLE_STOCK` là biến thể chi
 * tiết mà `AlignedOutboundStockService` phát ra; catalog HN-BE-API-002 gắn cả hai vào
 * 422 nên FE phải nhận diện cả hai.
 */
export const STOCK_SHORTAGE_CODES = new Set([
  "INSUFFICIENT_STOCK",
  "INSUFFICIENT_AVAILABLE_STOCK",
]);

function readStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const status = Number(
    (error as { response?: { status?: unknown } }).response?.status,
  );
  return Number.isFinite(status) ? status : undefined;
}

function readCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const record = error as {
    response?: { data?: { error_code?: unknown; error?: { code?: unknown } } };
    data?: { error_code?: unknown; error?: { code?: unknown } };
    code?: unknown;
  };
  const body = record.response?.data ?? record.data;
  const fromBody = body?.error_code ?? body?.error?.code;
  if (typeof fromBody === "string" && fromBody !== "") return fromBody;
  return typeof record.code === "string" && record.code !== ""
    ? record.code
    : undefined;
}

/**
 * Phân loại lỗi Post Issue theo §8.2. Trả `null` khi lỗi nằm ngoài hợp đồng (403,
 * 404, 5xx…) để chỗ gọi giữ nguyên đường xử lý sẵn có.
 */
export function classifyPostIssueError(
  error: unknown,
): PostIssueOutcome | null {
  const status = readStatus(error);
  const code = readCode(error);

  // Thiếu tồn nhận diện theo mã trước, status sau: BE luôn kèm error_code, còn
  // status 422 đơn thuần có thể là VALIDATION_ERROR của field khác.
  if (code !== undefined && STOCK_SHORTAGE_CODES.has(code)) {
    return {
      action: "FIX_STOCK_THEN_RESTART",
      code,
      status,
      message: tStatic("shared.api.stockShortage"),
      reuseIdempotencyKey: false,
    };
  }

  const concurrency = classifyConcurrencyError(error);
  if (concurrency === null) return null;
  return {
    action: concurrency.action,
    code: concurrency.code,
    status: concurrency.status,
    message: concurrency.message,
    reuseIdempotencyKey: concurrency.reuseIdempotencyKey,
  };
}

/**
 * `true` khi được phép gửi lại **cùng Idempotency-Key** sau khi người dùng tải lại
 * phiếu. Dùng để quyết định giữ hay xoá sticky key ở tầng UI.
 */
export function shouldReuseIdempotencyKey(error: unknown): boolean {
  const outcome = classifyPostIssueError(error);
  // Lỗi ngoài hợp đồng (mạng đứt, 5xx, timeout) là trường hợp NGUY HIỂM NHẤT: không
  // biết server đã ghi hay chưa, nên bắt buộc giữ key cũ để lần gửi lại là một replay
  // chứ không phải một lần Post thứ hai.
  if (outcome === null) return true;
  return outcome.reuseIdempotencyKey;
}
