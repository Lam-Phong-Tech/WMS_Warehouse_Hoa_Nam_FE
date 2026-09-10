/**
 * THEO DÕI REQUEST ĐANG BAY + CHẨN ĐOÁN LỖI TẦNG VẬN CHUYỂN (10/09/2026).
 *
 * Bám vào ADAPTER của axios chứ không phải interceptor: adapter là chỗ DUY NHẤT
 * mà mỗi request mạng đi qua đúng một lần. Interceptor thì không đếm cặp được —
 * nhánh 401 thử lại dựng config MỚI, còn request bị guard ngoại tuyến chặn thì
 * chưa từng ra mạng.
 *
 * 1. Đếm request GHI đang bay (POST/PUT/PATCH/DELETE). `register-pwa` dựa vào số
 *    này để KHÔNG reload áp bản cập nhật khi một request đổi trạng thái (đăng
 *    nhập, refresh xoay vòng token, ghi phiếu) còn đang chờ response — reload lúc
 *    đó là mất luôn response, và với refresh xoay vòng là mất cả cookie mới.
 *
 * 2. Chẩn đoán lỗi KHÔNG có HTTP response. Màn "Không kết nối được hệ thống" trước
 *    đây không để lại gì phân biệt mất mạng thật, request bị huỷ vì trang điều
 *    hướng, timeout hay proxy cắt kết nối. Mỗi lỗi như vậy nay có một bản ghi AN
 *    TOÀN — mã lỗi, method, mẫu đường dẫn (id bị che), thời gian, trạng thái mạng,
 *    giao thức, service worker, build — tuyệt đối không email, mật khẩu, token,
 *    body, query hay header. Bản ghi vào console, vào sessionStorage (sống qua
 *    reload trong cùng tab, tối đa 20 bản) và được gắn lên chính AxiosError để màn
 *    đăng nhập in ra một dòng "mã chẩn đoán" nằm ngay trong ảnh chụp của tester.
 */
import { getAdapter } from "axios";
import type {
  AxiosAdapter,
  AxiosInstance,
  InternalAxiosRequestConfig,
} from "axios";

declare module "axios" {
  interface AxiosError {
    /** Có mặt khi request hỏng ở tầng vận chuyển (không nhận được HTTP response). */
    wmsTransport?: TransportDiagnostic;
  }
}

export type TransportFailureReason = "network" | "timeout" | "aborted";

export interface TransportDiagnostic {
  /** Mã của axios: ERR_NETWORK, ECONNABORTED, ETIMEDOUT... */
  readonly code: string;
  readonly reason: TransportFailureReason;
  readonly method: string;
  /** Đường dẫn đã che id, không có query. */
  readonly path: string;
  /** Từ lúc request rời adapter tới lúc hỏng. */
  readonly elapsedMs: number;
  /** Tuổi của trang lúc hỏng — trả lời thẳng câu "có phải vừa mở trang không". */
  readonly pageAgeMs: number;
  readonly online: boolean;
  readonly visibility: string;
  /** Giao thức của tài liệu (http/1.1, h2, h3) — gợi ý khi nghi proxy/QUIC. */
  readonly protocol: string;
  readonly crossOrigin: boolean;
  readonly serviceWorker: "controlled" | "uncontrolled" | "unsupported";
  /** Trang đang rời đi (pagehide) hoặc app đã lên lịch reload. */
  readonly pageLeaving: boolean;
  readonly build: string;
  readonly at: string;
  /** Một dòng ngắn, chỉ ký tự ASCII, để in lên giao diện. */
  readonly summary: string;
}

const LOG_KEY = "wms:transport-log";
const LOG_LIMIT = 20;
const UNSAFE_METHODS = new Set(["post", "put", "patch", "delete"]);

let unsafeInFlight = 0;
let pageLeaving = false;
let leaveWatchInstalled = false;
const monitoredInstances = new WeakSet<object>();

/** Số request ghi đang chờ response trên các instance đã gắn monitor. */
export function unsafeRequestsInFlight(): number {
  return unsafeInFlight;
}

/** `register-pwa` gọi ngay trước khi tự reload, để lỗi xảy ra sau đó được gắn cờ. */
export function markPageLeaving(): void {
  pageLeaving = true;
}

function watchPageLeaving(): void {
  if (leaveWatchInstalled || typeof window === "undefined") return;
  leaveWatchInstalled = true;
  window.addEventListener("pagehide", markPageLeaving);
  // Trang được khôi phục từ bfcache: nó KHÔNG còn đang rời đi nữa.
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) pageLeaving = false;
  });
}

function nowMs(): number {
  return typeof performance === "undefined" ? Date.now() : performance.now();
}

function reasonOf(
  code: string | undefined,
  message: string,
): TransportFailureReason {
  // axios xhr: timeout → ECONNABORTED "timeout of Nms exceeded" (hoặc ETIMEDOUT khi
  // bật clarifyTimeoutError); trình duyệt huỷ → ECONNABORTED "Request aborted";
  // lỗi mạng/CORS/kết nối bị cắt → ERR_NETWORK "Network Error".
  if (code === "ETIMEDOUT" || /timeout/i.test(message)) return "timeout";
  if (code === "ECONNABORTED") return "aborted";
  return "network";
}

function requestTarget(config: InternalAxiosRequestConfig): {
  path: string;
  crossOrigin: boolean;
} {
  const pageOrigin =
    typeof window === "undefined" ? "http://localhost" : window.location.origin;
  try {
    const base = config.baseURL
      ? `${config.baseURL.replace(/\/+$/, "")}/`
      : `${pageOrigin}/`;
    const url = new URL((config.url ?? "").replace(/^\/+/, ""), base);
    const path = url.pathname
      .split("/")
      .map((segment) =>
        /^[0-9a-f-]{8,}$/i.test(segment) || /^\d+$/.test(segment)
          ? ":id"
          : segment,
      )
      .join("/");
    return { path, crossOrigin: url.origin !== pageOrigin };
  } catch {
    return { path: "unknown", crossOrigin: false };
  }
}

function documentProtocol(): string {
  try {
    const entry = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;
    return entry?.nextHopProtocol || "unknown";
  } catch {
    return "unknown";
  }
}

function serviceWorkerState(): TransportDiagnostic["serviceWorker"] {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return "unsupported";
  }
  return navigator.serviceWorker.controller ? "controlled" : "uncontrolled";
}

export function summarizeTransport(
  diagnostic: Omit<TransportDiagnostic, "summary">,
): string {
  const parts = [
    `${diagnostic.code}/${diagnostic.reason}`,
    `${diagnostic.elapsedMs}ms`,
    `+${(diagnostic.pageAgeMs / 1000).toFixed(1)}s`,
    diagnostic.online ? "online" : "offline",
    diagnostic.protocol,
  ];
  if (diagnostic.serviceWorker === "controlled") parts.push("sw");
  if (diagnostic.crossOrigin) parts.push("cross-origin");
  if (diagnostic.pageLeaving) parts.push("page-leaving");
  if (diagnostic.visibility === "hidden") parts.push("hidden");
  return parts.join(" | ");
}

/**
 * Dựng bản ghi cho một lỗi của adapter. Trả `null` khi lỗi CÓ response (401, 422,
 * 5xx... — đã có mã HTTP, không cần chẩn đoán tầng mạng) hoặc là huỷ chủ động.
 */
export function describeTransportFailure(
  error: unknown,
  config: InternalAxiosRequestConfig,
  startedAt: number,
): TransportDiagnostic | null {
  if (typeof error !== "object" || error === null) return null;
  const candidate = error as {
    isAxiosError?: boolean;
    response?: unknown;
    code?: string;
    message?: string;
  };
  if (
    candidate.isAxiosError !== true ||
    candidate.response ||
    candidate.code === "ERR_CANCELED"
  ) {
    return null;
  }

  const failedAt = nowMs();
  const { path, crossOrigin } = requestTarget(config);
  const diagnostic: Omit<TransportDiagnostic, "summary"> = {
    code: candidate.code ?? "UNKNOWN",
    reason: reasonOf(candidate.code, candidate.message ?? ""),
    method: (config.method ?? "get").toUpperCase(),
    path,
    elapsedMs: Math.max(0, Math.round(failedAt - startedAt)),
    pageAgeMs: Math.round(failedAt),
    online: typeof navigator === "undefined" ? true : navigator.onLine,
    visibility:
      typeof document === "undefined" ? "unknown" : document.visibilityState,
    protocol: documentProtocol(),
    crossOrigin,
    serviceWorker: serviceWorkerState(),
    pageLeaving,
    build: __APP_BUILD_ID__,
    at: new Date().toISOString(),
  };
  return { ...diagnostic, summary: summarizeTransport(diagnostic) };
}

function remember(diagnostic: TransportDiagnostic): void {
  try {
    const list = readTransportLog();
    list.push(diagnostic);
    window.sessionStorage.setItem(
      LOG_KEY,
      JSON.stringify(list.slice(-LOG_LIMIT)),
    );
  } catch {
    // Storage bị chặn (chế độ riêng tư) — chẩn đoán không được làm hỏng request.
  }
}

/** Các lỗi vận chuyển gần nhất của tab này (cả trước lần reload gần nhất). */
export function readTransportLog(): TransportDiagnostic[] {
  try {
    const raw = window.sessionStorage.getItem(LOG_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as TransportDiagnostic[]) : [];
  } catch {
    return [];
  }
}

export function transportDiagnosticOf(
  error: unknown,
): TransportDiagnostic | null {
  if (typeof error !== "object" || error === null) return null;
  return (error as { wmsTransport?: TransportDiagnostic }).wmsTransport ?? null;
}

function monitorAdapter(base: AxiosAdapter): AxiosAdapter {
  return async (config) => {
    const unsafe = UNSAFE_METHODS.has((config.method ?? "get").toLowerCase());
    const startedAt = nowMs();
    if (unsafe) unsafeInFlight += 1;
    try {
      return await base(config);
    } catch (error) {
      const diagnostic = describeTransportFailure(error, config, startedAt);
      if (diagnostic) {
        (error as { wmsTransport?: TransportDiagnostic }).wmsTransport =
          diagnostic;
        remember(diagnostic);
        console.warn("[wms-transport]", diagnostic);
      }
      throw error;
    } finally {
      if (unsafe) unsafeInFlight -= 1;
    }
  };
}

/** Gắn monitor vào một axios instance. Gọi lại nhiều lần là vô hại. */
export function installTransportMonitor(instance: AxiosInstance): void {
  if (monitoredInstances.has(instance)) return;
  const configured = instance.defaults.adapter;
  if (configured === undefined) return;
  monitoredInstances.add(instance);
  const base: AxiosAdapter =
    typeof configured === "function" ? configured : getAdapter(configured);
  instance.defaults.adapter = monitorAdapter(base);
  watchPageLeaving();
}
