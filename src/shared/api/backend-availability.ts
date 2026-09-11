/**
 * CHỜ MÁY CHỦ KHỞI ĐỘNG LẠI XONG RỒI MỚI BÁO LỖI (10/09/2026).
 *
 * Mỗi lần backend khởi động lại (deploy, `docker compose up -d`, máy chủ bật lại)
 * có ~10–25 giây API chưa phục vụ được: gateway trả 502/503, hoặc — khi API khác
 * origin mà gateway không kèm CORS — trình duyệt chặn preflight nên axios chỉ thấy
 * ERR_NETWORK sau vài ms. Đăng nhập là mutation (không tự thử lại), nên bấm trúng
 * cửa sổ đó là nhận ngay "Không kết nối được hệ thống. Kiểm tra kết nối mạng" dù
 * mạng không lỗi gì. Ticket 10/09: mã chẩn đoán
 * "ERR_NETWORK/network | 13ms | ... | cross-origin", nginx của BE ghi
 * `OPTIONS /api/v1/auth/login 502` đúng lúc container backend đang dựng lại.
 *
 * `withBackendRecovery` bọc một thao tác:
 *  1. lỗi kiểu "máy chủ chưa sẵn sàng" (502/503, hoặc ERR_NETWORK không response)
 *     → dò `GET /health` tới khi máy chủ trả lời hoặc hết ngân sách chờ;
 *  2. máy chủ đã trả lời → chạy lại thao tác ĐÚNG MỘT LẦN;
 *  3. hết ngân sách → ném lại lỗi gốc, gắn kết quả lần dò cuối (`wmsBackendProbe`)
 *     để giao diện chọn đúng câu và in vào mã chẩn đoán.
 *
 * CHỈ dùng cho thao tác chạy lại được an toàn — đăng nhập và xác thực MFA: lỗi
 * gateway nghĩa là request chưa tới ứng dụng; ca hiếm nó đã tới và chỉ mất response
 * thì đăng nhập lại chỉ sinh thêm một phiên. TUYỆT ĐỐI KHÔNG bọc `/auth/refresh`:
 * refresh xoay vòng token, gửi lại cookie cũ sau khi lượt đầu đã xoay bị BE coi là
 * replay và thu hồi MỌI phiên của người dùng.
 */
import { isAxiosError } from "axios";
import { apiHealthUrl } from "@/shared/config/env";

/**
 * Kết quả một lần dò `/health`:
 *  - `ready`: ứng dụng đã trả lời (mọi mã trừ 502–504);
 *  - `unavailable`: gateway còn sống nhưng ứng dụng chưa phục vụ (502–504 đọc được,
 *    gồm cả health 503 khi CSDL chưa sẵn sàng);
 *  - `unreachable`: không đọc được response nào — không mở được kết nối, DNS, hoặc
 *    gateway trả lỗi thiếu CORS (từ trình duyệt không phân biệt được);
 *  - `offline`: trình duyệt báo mất mạng, không dò.
 */
export type BackendProbe = "ready" | "unavailable" | "unreachable" | "offline";

export interface BackendRecoveryOptions {
  /** Ngân sách chờ khi đã thấy gateway trả lời (máy chủ đang khởi động lại). */
  readonly unavailableBudgetMs?: number;
  /** Ngân sách khi chưa lần nào tới được máy chủ — ngắn hơn, có thể là mạng người dùng. */
  readonly unreachableBudgetMs?: number;
  /** Chỗ cắm cho test. */
  readonly probe?: () => Promise<BackendProbe>;
  readonly sleep?: (ms: number) => Promise<void>;
  readonly now?: () => number;
}

/** Cửa sổ khởi động lại đo trên stack dev ~23 s (tạo lại container + migrate + config:cache). */
const UNAVAILABLE_BUDGET_MS = 45_000;
const UNREACHABLE_BUDGET_MS = 15_000;
const PROBE_TIMEOUT_MS = 6_000;
const POLL_DELAYS_MS = [1_000, 1_500, 2_000, 2_500, 3_000];

type RecoverableError = { wmsBackendProbe?: BackendProbe };

let activeWaits = 0;
const waitListeners = new Set<() => void>();

function notifyWaitListeners(): void {
  for (const listener of waitListeners) listener();
}

/** Có thao tác nào đang tự chờ máy chủ sẵn sàng không (dùng với useSyncExternalStore). */
export function isWaitingForBackend(): boolean {
  return activeWaits > 0;
}

export function subscribeBackendWait(listener: () => void): () => void {
  waitListeners.add(listener);
  return () => {
    waitListeners.delete(listener);
  };
}

/**
 * Lỗi có thể chỉ vì máy chủ chưa sẵn sàng. Loại trừ có chủ đích: 504 (request có
 * thể đang/đã được xử lý), ECONNABORTED/ETIMEDOUT (hết giờ, trang huỷ), guard ngoại
 * tuyến WWHN-325 và mọi lỗi đã có câu trả lời nghiệp vụ (401, 422, 429...).
 */
export function isBackendUnavailableError(error: unknown): boolean {
  if (!isAxiosError(error)) return false;
  const status = error.response?.status;
  if (status !== undefined) return status === 502 || status === 503;
  return error.code === "ERR_NETWORK";
}

/** Kết quả lần dò cuối nếu lỗi này đã qua một vòng chờ máy chủ. */
export function backendProbeOf(error: unknown): BackendProbe | null {
  if (typeof error !== "object" || error === null) return null;
  return (error as RecoverableError).wmsBackendProbe ?? null;
}

function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

/**
 * Dò `/health` bằng request ĐƠN GIẢN (GET, không header tự đặt, không cookie) nên
 * trình duyệt không phát preflight — kể cả khi API khác origin.
 */
export async function probeBackend(
  url: string = apiHealthUrl,
): Promise<BackendProbe> {
  if (isOffline()) return "offline";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  try {
    const response = await fetch(url, {
      method: "GET",
      mode: "cors",
      credentials: "omit",
      cache: "no-store",
      signal: controller.signal,
    });
    return response.status >= 502 && response.status <= 504
      ? "unavailable"
      : "ready";
  } catch {
    return "unreachable";
  } finally {
    clearTimeout(timer);
  }
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/** Dò tới khi máy chủ trả lời, mất mạng, hoặc hết ngân sách. Trả kết quả lần dò cuối. */
export async function waitForBackend(
  options: BackendRecoveryOptions = {},
): Promise<BackendProbe> {
  const probe = options.probe ?? (() => probeBackend());
  const sleep = options.sleep ?? defaultSleep;
  const now = options.now ?? Date.now;
  const startedAt = now();
  let sawGateway = false;

  for (let attempt = 0; ; attempt += 1) {
    const result = await probe();
    if (result === "ready" || result === "offline") return result;
    // Đã một lần thấy gateway trả lời thì máy chủ gần như chắc đang khởi động lại:
    // giữ ngân sách dài kể cả khi lần dò sau lỡ nhịp (nginx cũng đang dựng lại).
    if (result === "unavailable") sawGateway = true;
    const budget = sawGateway
      ? (options.unavailableBudgetMs ?? UNAVAILABLE_BUDGET_MS)
      : (options.unreachableBudgetMs ?? UNREACHABLE_BUDGET_MS);
    const delay =
      POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)] ?? 3_000;
    if (now() - startedAt + delay > budget) return result;
    await sleep(delay);
  }
}

function annotate(error: unknown, probe: BackendProbe): void {
  if (typeof error === "object" && error !== null) {
    (error as RecoverableError).wmsBackendProbe = probe;
  }
}

export async function withBackendRecovery<T>(
  task: () => Promise<T>,
  options: BackendRecoveryOptions = {},
): Promise<T> {
  try {
    return await task();
  } catch (error) {
    if (!isBackendUnavailableError(error) || isOffline()) throw error;

    activeWaits += 1;
    notifyWaitListeners();
    const probe = await waitForBackend(options).finally(() => {
      activeWaits -= 1;
      notifyWaitListeners();
    });

    if (probe !== "ready") {
      annotate(error, probe);
      throw error;
    }
  }

  // Máy chủ đã trả lời /health: chạy lại đúng MỘT lần. Lần này hỏng thì lỗi đi
  // thẳng lên giao diện — không lặp vô hạn trên một backend chập chờn.
  try {
    return await task();
  } catch (error) {
    if (isBackendUnavailableError(error)) annotate(error, "ready");
    throw error;
  }
}
