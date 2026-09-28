/** AUTH UAT: classify transport/domain outcomes without exposing diagnostic text.
 * A response timeout is not proof that the server rejected the login. Never replay it.
 * A blocked request (ERR_NETWORK while online) is the service-unavailable UI, not
 * evidence of an expired/locked account. No response body is rendered verbatim.
 */
export type LoginFeedbackKind =
  | "invalid-credentials"
  | "invalid-input"
  | "offline"
  | "unknown"
  | "rate-limited"
  | "account-unavailable"
  | "service-unavailable";

export interface LoginFeedback {
  kind: LoginFeedbackKind;
  retryAt?: number | null;
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object"
    ? (value as Record<string, unknown>)
    : {};
}

function header(headers: unknown, name: string): unknown {
  const value = record(headers);
  if (typeof value.get === "function") {
    return value.get.call(headers, name);
  }
  return Object.entries(value).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  )?.[1];
}

/** Retry-After is either delay-seconds or an HTTP date. Never invent a lock duration. */
export function loginRetryAt(error: unknown, now = Date.now()): number | null {
  const response = record(record(error).response);
  const raw = header(response.headers, "retry-after");
  if (typeof raw !== "string" && typeof raw !== "number") return null;
  const value = String(raw).trim();
  if (/^\d+(?:\.\d+)?$/.test(value)) {
    const deadline = now + Number(value) * 1000;
    return Number.isFinite(deadline) ? deadline : null;
  }
  // Date.parse also accepts bare numbers (e.g. -1) as calendar dates; exclude them.
  if (!/[a-z]{3}/i.test(value)) return null;
  const expires = Date.parse(value);
  if (!Number.isFinite(expires)) return null;
  const serverDate = header(response.headers, "date");
  const serverNow = typeof serverDate === "string" ? Date.parse(serverDate) : NaN;
  return Number.isFinite(serverNow)
    ? now + Math.max(0, expires - serverNow)
    : Math.max(now, expires);
}

export function classifyLoginFailure(
  error: unknown,
  { offline = false, now = Date.now() }: { offline?: boolean; now?: number } = {},
): LoginFeedback {
  const source = record(error);
  const response = record(source.response);
  const status = response.status;
  const data = record(response.data);
  const code = data.error_code ?? record(data.error).code;

  if (status === 429) return { kind: "rate-limited", retryAt: loginRetryAt(error, now) };
  if (status === 401) return { kind: "invalid-credentials" };
  if (status === 423 || (status === 403 && code === "ACCESS_DENIED")) {
    return { kind: "account-unavailable" };
  }
  if (status === 422) return { kind: "invalid-input" };
  if (status === 504) return { kind: "unknown" };
  if (typeof status === "number") return { kind: "service-unavailable" };

  // These errors may follow a committed request, even if connectivity subsequently
  // disappeared. Do not turn them into an offline state with an enabled retry CTA.
  if (
    source.code === "ECONNABORTED" || source.code === "ETIMEDOUT" ||
    source.code === "ERR_CANCELED" || source.name === "AuthContractError"
  ) return { kind: "unknown" };
  if (offline) return { kind: "offline" };
  return { kind: "service-unavailable" };
}

export interface LoginThrottle { until: number | null }
const THROTTLE_KEY = "hn-wms.login.throttle-until";
let memoryThrottle: LoginThrottle | null = null;

/** Only the server-issued deadline is persisted, never an identifier/password/token. */
export function readLoginThrottle(now = Date.now()): LoginThrottle | null {
  try {
    const raw = window.sessionStorage.getItem(THROTTLE_KEY);
    if (raw !== null) {
      const until = Number(raw);
      if (Number.isFinite(until) && until > now) return { until };
      window.sessionStorage.removeItem(THROTTLE_KEY);
    }
  } catch { /* Storage may be unavailable; keep this tab's in-memory lock. */ }
  if (memoryThrottle?.until !== null && (memoryThrottle?.until ?? 0) <= now) {
    memoryThrottle = null;
  }
  return memoryThrottle;
}

export function rememberLoginThrottle(throttle: LoginThrottle | null): void {
  memoryThrottle = throttle;
  try {
    if (throttle?.until != null) {
      window.sessionStorage.setItem(THROTTLE_KEY, String(throttle.until));
    } else {
      // No Retry-After: lock this mounted flow, but do not persist an infinite lock.
      window.sessionStorage.removeItem(THROTTLE_KEY);
    }
  } catch { /* The in-memory guard remains active. */ }
}
