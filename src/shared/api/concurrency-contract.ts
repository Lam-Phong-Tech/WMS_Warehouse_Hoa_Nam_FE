/**
 * WWHN-234 (DEV234-P1-02) — hợp đồng đồng thời/trạng thái phía FE.
 *
 * SRS §8.2 chia xung đột thành bốn lớp và AC-GWT-CONC-001 nói rõ hành vi UI của
 * request **thua race**:
 *
 *   "Tối đa một request thành công; request còn lại trả 409/412/422 theo điểm phát hiện.
 *    […] UI request thua hiển thị refresh/retry, **không tự submit lại bằng key mới**."
 *
 * Trước WWHN-234, FE chỉ kiểm tra version *trước* khi gửi (pre-flight trong
 * `postInboundReceipt` / `postOutboundIssue`). Pre-flight không bao giờ bắt được race
 * thật — cửa sổ race nằm **giữa** lần đọc detail và lúc BE lấy `lockForUpdate`. Khi thua,
 * BE trả `412 STALE_VERSION` hoặc `409 CONCURRENCY_CONFLICT`, và cả hai đều rơi xuống
 * đường lỗi chung: người dùng chỉ thấy một message đỏ không nói phải làm gì, nên phản xạ
 * tự nhiên là bấm Post lại — đúng hành vi mà AC-GWT-CONC-001 cấm.
 *
 * Module này biến bốn lớp của §8.2 thành **hành động bắt buộc**, để chỗ gọi không phải
 * đoán từ 66 mã lỗi miền của BE:
 *
 * | HTTP / mã BE                     | `action`                 | Nghĩa                                     |
 * |----------------------------------|--------------------------|-------------------------------------------|
 * | 412 STALE_VERSION                | `RELOAD_THEN_RETRY`      | Reload rồi Post lại, **giữ nguyên** key    |
 * | 409 CONCURRENCY_CONFLICT         | `RELOAD_THEN_RETRY`      | như trên                                   |
 * | 409 IDEMPOTENCY_CONFLICT         | `NEW_KEY_REQUIRED`       | Payload đã đổi → phải sinh key mới          |
 * | 409 DOWNSTREAM_DEPENDENCY_EXISTS | `REVERSE_DEPENDENCY`     | Đảo giao dịch phụ thuộc trước (BR-REV-04)  |
 * | 409 còn lại / 428                | `STOP`                   | Trạng thái/precondition — dừng, không retry |
 *
 * @see docs/evidence/WWHN-234/CONCURRENCY_STATE_REVIEW.md §8
 */

import { WmsContractError } from "@/shared/api/wms-contract";
import { tStatic } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";

/** Hành động UI bắt buộc cho từng lớp xung đột của §8.2. */
export type ConcurrencyAction =
  | "RELOAD_THEN_RETRY"
  | "NEW_KEY_REQUIRED"
  | "REVERSE_DEPENDENCY"
  | "STOP";

export interface ConcurrencyOutcome {
  action: ConcurrencyAction;
  /** Mã BE đã phân loại (`STALE_VERSION`, `CONCURRENCY_CONFLICT`, …). */
  code: string;
  /** HTTP status đã quan sát được, nếu đọc được từ lỗi. */
  status?: number;
  /** Câu hướng dẫn tiếng Việt hiển thị được thẳng lên UI. */
  message: string;
  /**
   * `true` khi lần gửi lại **phải dùng lại đúng Idempotency-Key cũ**. Sinh key mới ở
   * đây sẽ biến một retry an toàn thành một lần Post thứ hai thật sự.
   */
  reuseIdempotencyKey: boolean;
}

/** Lớp CONCURRENCY của §8.2 — thua race, state đã đổi dưới chân request. */
const RELOAD_CODES = new Set(["STALE_VERSION", "CONCURRENCY_CONFLICT"]);

/** Lớp IDEMPOTENCY của §8.2 — cùng key nhưng payload hash khác. */
const NEW_KEY_CODES = new Set(["IDEMPOTENCY_CONFLICT"]);

/** Lớp DOWNSTREAM_DEPENDENCY của §8.2 / BR-REV-04. */
const DEPENDENCY_CODES = new Set(["DOWNSTREAM_DEPENDENCY_EXISTS"]);

const MESSAGE_KEYS: Record<ConcurrencyAction, MessageKey> = {
  RELOAD_THEN_RETRY: "shared.api.reloadThenRetry",
  NEW_KEY_REQUIRED: "shared.api.newKeyRequired",
  REVERSE_DEPENDENCY: "shared.api.reverseDependency",
  STOP: "shared.api.stop",
};

interface ErrorBodyShape {
  error_code?: unknown;
  error?: { code?: unknown };
}

function readStatus(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const response = (error as { response?: { status?: unknown } }).response;
  const status = Number(response?.status);
  return Number.isFinite(status) ? status : undefined;
}

function readCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null) return undefined;
  const record = error as {
    response?: { data?: ErrorBodyShape };
    data?: ErrorBodyShape;
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
 * Phân loại một lỗi mutation thành lớp xung đột §8.2.
 *
 * Trả `null` khi lỗi **không** thuộc nhóm xung đột (422 validation, 403, 5xx…) để chỗ
 * gọi giữ nguyên đường xử lý sẵn có — module này cố ý không nuốt các lỗi khác.
 */
export function classifyConcurrencyError(
  error: unknown,
): ConcurrencyOutcome | null {
  const status = readStatus(error);
  const code = readCode(error);

  // 412 luôn là stale version theo §8.2, kể cả khi body thiếu error_code.
  if (status === 412) {
    return build("RELOAD_THEN_RETRY", code ?? "STALE_VERSION", status);
  }
  if (status === 428) {
    return build("STOP", code ?? "PRECONDITION_REQUIRED", status);
  }
  if (code !== undefined && RELOAD_CODES.has(code)) {
    return build("RELOAD_THEN_RETRY", code, status);
  }
  if (code !== undefined && NEW_KEY_CODES.has(code)) {
    return build("NEW_KEY_REQUIRED", code, status);
  }
  if (code !== undefined && DEPENDENCY_CODES.has(code)) {
    return build("REVERSE_DEPENDENCY", code, status);
  }
  if (status === 409) {
    // Mã miền cụ thể (ITEM_ALREADY_MATCHED, CONTAINER_CLOSED…) đều là biến thể của
    // lớp STATE_CONFLICT: dừng lại, không retry.
    return build("STOP", code ?? "STATE_CONFLICT", status);
  }
  return null;
}

function build(
  action: ConcurrencyAction,
  code: string,
  status?: number,
): ConcurrencyOutcome {
  return {
    action,
    code,
    status,
    message: tStatic(MESSAGE_KEYS[action]),
    reuseIdempotencyKey: action === "RELOAD_THEN_RETRY",
  };
}

/**
 * `true` khi thao tác được phép gửi lại sau khi người dùng tải lại dữ liệu — và khi gửi
 * lại **phải** dùng lại đúng Idempotency-Key cũ.
 */
export function isRetryableAfterReload(outcome: ConcurrencyOutcome): boolean {
  return outcome.action === "RELOAD_THEN_RETRY";
}

/**
 * Lỗi xung đột đã được phân loại. Kế thừa `WmsContractError` để mọi chỗ đang bắt
 * `WmsContractError` không phải sửa, đồng thời mang theo `outcome` cho UI nào muốn
 * render nút "Tải lại rồi thử lại" đúng theo AC-GWT-CONC-001.
 */
export class WmsConcurrencyError extends WmsContractError {
  readonly outcome: ConcurrencyOutcome;

  /** Lỗi gốc từ axios/BE, giữ lại để log request_id. */
  readonly cause: unknown;

  constructor(outcome: ConcurrencyOutcome, cause: unknown) {
    super(outcome.code, outcome.message);
    this.name = "WmsConcurrencyError";
    this.outcome = outcome;
    this.cause = cause;
  }
}

/**
 * Bọc một mutation đổi tồn: lỗi thuộc bốn lớp §8.2 được ném lại dưới dạng
 * `WmsConcurrencyError` kèm hướng dẫn hành động; mọi lỗi khác giữ nguyên.
 *
 * Cố ý **không** tự retry: AC-GWT-CONC-001 giao quyền quyết định cho người dùng sau khi
 * đã reload, vì auto-retry một lệnh đổi tồn là cách nhanh nhất tạo ra double-post.
 */
export async function withConcurrencyContract<T>(
  operation: () => Promise<T>,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const outcome = classifyConcurrencyError(error);
    if (outcome === null) throw error;
    throw new WmsConcurrencyError(outcome, error);
  }
}
