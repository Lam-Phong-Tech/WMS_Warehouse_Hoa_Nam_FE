import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { classifyLoginFailure, loginRetryAt, readLoginThrottle, rememberLoginThrottle } from "./login-feedback";

const httpError = (status: number, data: unknown = {}, headers: unknown = {}) => ({ response: { status, data, headers } });
describe("AUTH UAT outcome classification", () => {
  it.each([
    [httpError(401, { message: "internal diagnostic" }), "invalid-credentials"],
    [httpError(422), "invalid-input"],
    [httpError(403, { error_code: "ACCESS_DENIED" }), "account-unavailable"],
    [httpError(403, { error: { code: "ACCESS_DENIED" } }), "account-unavailable"],
    [httpError(423), "account-unavailable"],
    [httpError(403, { error_code: "OTHER_POLICY" }), "service-unavailable"],
    [httpError(500), "service-unavailable"],
    [httpError(502), "service-unavailable"],
    [httpError(503), "service-unavailable"],
    [httpError(504), "unknown"],
    [{ code: "ERR_NETWORK" }, "service-unavailable"],
    [{ code: "ECONNABORTED" }, "unknown"],
    [{ code: "ETIMEDOUT" }, "unknown"],
    [{ code: "ERR_CANCELED" }, "unknown"],
    [{ name: "AuthContractError" }, "unknown"],
  ])("classifies %o without displaying technical content", (error, kind) => {
    expect(classifyLoginFailure(error)).toEqual({ kind });
  });
  it("does not mistake an ambiguous committed request for an offline retry", () => {
    expect(classifyLoginFailure({ code: "ECONNABORTED" }, { offline: true }).kind).toBe("unknown");
    expect(classifyLoginFailure({ code: "ERR_NETWORK" }, { offline: true }).kind).toBe("offline");
  });
  it("reads Retry-After seconds, AxiosHeaders and HTTP dates with clock skew", () => {
    expect(loginRetryAt(httpError(429, {}, { "Retry-After": "30" }), 1000)).toBe(31000);
    expect(loginRetryAt(httpError(429, {}, { get: (key: string) => key === "retry-after" ? "2" : null }), 1000)).toBe(3000);
    expect(loginRetryAt(httpError(429, {}, { "Retry-After": "Wed, 01 Jan 2025 00:01:00 GMT", Date: "Wed, 01 Jan 2025 00:00:00 GMT" }), 1000)).toBe(61000);
  });
  it.each([undefined, "", "nonsense", "-1", Infinity])("never invents a deadline for %s", (value) => {
    expect(loginRetryAt(httpError(429, {}, { "Retry-After": value }), 1000)).toBeNull();
  });
  it("uses only the server deadline, not a guessed number of attempts", () => {
    expect(classifyLoginFailure(httpError(429), { now: 1000 })).toEqual({ kind: "rate-limited", retryAt: null });
  });
});
describe("AUTH UAT throttle persistence", () => {
  beforeEach(() => { sessionStorage.clear(); rememberLoginThrottle(null); });
  afterEach(() => { vi.restoreAllMocks(); rememberLoginThrottle(null); sessionStorage.clear(); });
  it("preserves a known lock across remounts, then releases at the deadline", () => {
    rememberLoginThrottle({ until: 2000 });
    expect(readLoginThrottle(1000)).toEqual({ until: 2000 });
    expect(readLoginThrottle(1999)).toEqual({ until: 2000 });
    expect(readLoginThrottle(2000)).toBeNull();
  });
  it("locks the current flow but never persists an infinite lock", () => {
    rememberLoginThrottle({ until: null });
    expect(readLoginThrottle()).toEqual({ until: null });
    expect(sessionStorage.length).toBe(0);
  });
  it("storage denial does not bypass a known lock", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("blocked"); });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => { throw new Error("blocked"); });
    rememberLoginThrottle({ until: 2000 });
    expect(readLoginThrottle(1000)).toEqual({ until: 2000 });
    expect(readLoginThrottle(2001)).toBeNull();
  });
});
