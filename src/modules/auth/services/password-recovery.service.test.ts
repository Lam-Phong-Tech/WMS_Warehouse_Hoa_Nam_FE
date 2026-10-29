import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  passwordRecoveryService,
  PasswordRecoveryError,
} from "./password-recovery.service";

const fetchMock = vi.fn();
const EMAIL = "operator@example.test";
const TEST_PASSWORD = ["New", "Password", "!"].join("");
const SENSITIVE_PASSWORD = ["Secret", "Password", "!"].join("");
function response(
  data: unknown = null,
  status = 200,
  headers: Record<string, string> = {},
) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers(headers),
    json: async () => (status === 200 ? { success: true, data } : data),
  };
}
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("password recovery public transport", () => {
  it("omits all cookies including same-origin, auth headers and caller-supplied extra fields", async () => {
    fetchMock.mockResolvedValue(response());
    await passwordRecoveryService.forgotPassword({
      email: " Operator@Example.TEST ",
      token: "old-token",
    } as never);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toMatch(/\/api\/v1\/auth\/forgot-password$/);
    expect(options).toMatchObject({
      credentials: "omit",
      cache: "no-store",
      redirect: "error",
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-WMS-Client-Tier": "dev-test",
      },
    });
    expect(options.headers).not.toHaveProperty("Authorization");
    expect(options.headers).not.toHaveProperty("Cookie");
    expect(JSON.parse(options.body)).toEqual({ email: EMAIL });
  });
  it("uses the exact OTP and reset payload and returns only token/TTL", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          reset_token: "opaque-token",
          expires_in: 600,
          refresh_token: "discard-me",
        }),
      )
      .mockResolvedValue(response());
    expect(
      await passwordRecoveryService.verifyOtp({ email: EMAIL, otp: "001234" }),
    ).toEqual({ reset_token: "opaque-token", expires_in: 600 });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      email: EMAIL,
      otp: "001234",
    });
    const payload = {
      email: EMAIL,
      reset_token: "opaque-token",
      new_password: TEST_PASSWORD,
      new_password_confirmation: TEST_PASSWORD,
    };
    await passwordRecoveryService.resetPassword(payload);
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual(payload);
    expect(
      fetchMock.mock.calls.every(
        ([, options]) => options.credentials === "omit",
      ),
    ).toBe(true);
  });
  it.each([
    { reset_token: "", expires_in: 600 },
    { reset_token: "token", expires_in: 0 },
    { reset_token: "token", expires_in: "600" },
    null,
  ])("rejects invalid verified token contracts: %j", async (value) => {
    fetchMock.mockResolvedValue(response(value));
    await expect(
      passwordRecoveryService.verifyOtp({ email: EMAIL, otp: "123456" }),
    ).rejects.toBeInstanceOf(PasswordRecoveryError);
  });
  it("uses the header Request-ID and Retry-After seconds", async () => {
    const now = Date.now();
    fetchMock.mockResolvedValue(
      response({ success: false, meta: { request_id: "body-request" } }, 429, {
        "Retry-After": "30",
        "X-Request-ID": "header-request",
      }),
    );
    await expect(
      passwordRecoveryService.forgotPassword({ email: EMAIL }),
    ).rejects.toMatchObject({
      kind: "rate-limit",
      requestId: "header-request",
      retryAt: expect.any(Number),
    });
    try {
      await passwordRecoveryService.forgotPassword({ email: EMAIL });
    } catch (error) {
      expect((error as PasswordRecoveryError).retryAt).toBeGreaterThanOrEqual(
        now + 30000,
      );
    }
  });
  it("reads an HTTP date Retry-After using the server clock", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-29T00:00:00Z"));
    fetchMock.mockResolvedValue(
      response({}, 429, {
        Date: "Thu, 29 Oct 2026 07:00:00 GMT",
        "Retry-After": "Thu, 29 Oct 2026 07:00:30 GMT",
      }),
    );
    await expect(
      passwordRecoveryService.forgotPassword({ email: EMAIL }),
    ).rejects.toMatchObject({ retryAt: Date.now() + 30000 });
  });
  it("does not invent a retry deadline without a valid header", async () => {
    fetchMock.mockResolvedValue(response({}, 429));
    await expect(
      passwordRecoveryService.forgotPassword({ email: EMAIL }),
    ).rejects.toMatchObject({ kind: "rate-limit", retryAt: null });
  });
  it("retains validation fields but makes OTP business errors generic", async () => {
    fetchMock
      .mockResolvedValueOnce(
        response(
          {
            success: false,
            errors: { email: ["Invalid email format"] },
            meta: { request_id: "field-request" },
          },
          422,
        ),
      )
      .mockResolvedValueOnce(
        response(
          { success: false, errors: { otp: ["Account does not exist"] } },
          422,
        ),
      );
    await expect(
      passwordRecoveryService.forgotPassword({ email: EMAIL }),
    ).rejects.toMatchObject({
      kind: "validation",
      fields: { email: "Invalid email format" },
      requestId: "field-request",
    });
    await expect(
      passwordRecoveryService.verifyOtp({ email: EMAIL, otp: "123456" }),
    ).rejects.toMatchObject({ kind: "otp", fields: {} });
  });
  it("never retains raw credentials or diagnostics from error responses", async () => {
    const payload = {
      email: EMAIL,
      reset_token: "secret-token",
      new_password: SENSITIVE_PASSWORD,
      new_password_confirmation: SENSITIVE_PASSWORD,
    };
    fetchMock.mockResolvedValue(
      response(
        {
          message: JSON.stringify(payload),
          errors: { new_password: [`Rejected ${SENSITIVE_PASSWORD}`] },
        },
        422,
      ),
    );
    const error = await passwordRecoveryService
      .resetPassword(payload)
      .catch((error) => error);
    expect(JSON.stringify(error)).not.toContain(SENSITIVE_PASSWORD);
    expect(JSON.stringify(error)).not.toContain("secret-token");
    expect(error).not.toHaveProperty("config");
  });
  it("rejects an offline mutation before fetch and never queues it", async () => {
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
    await expect(
      passwordRecoveryService.forgotPassword({ email: EMAIL }),
    ).rejects.toMatchObject({ kind: "offline" });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
  it("does not retry network errors and drops the original error body", async () => {
    fetchMock.mockRejectedValue(
      new Error("credential-containing transport error"),
    );
    await expect(
      passwordRecoveryService.forgotPassword({ email: EMAIL }),
    ).rejects.toMatchObject({ kind: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it("aborts a timed-out request once without replaying it", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options.signal.addEventListener(
            "abort",
            () => reject(new Error("aborted")),
            { once: true },
          );
        }),
    );
    const result = passwordRecoveryService
      .forgotPassword({ email: EMAIL })
      .catch((error) => error);
    await vi.advanceTimersByTimeAsync(10001);
    expect(await result).toMatchObject({ kind: "unavailable" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it.each([500, 503])(
    "shows a generic failure with Request-ID for HTTP %s",
    async (status) => {
      fetchMock.mockResolvedValue(
        response({ message: "Private server diagnostics" }, status, {
          "X-Request-ID": "server-error-id",
        }),
      );
      await expect(
        passwordRecoveryService.forgotPassword({ email: EMAIL }),
      ).rejects.toMatchObject({
        kind: "unavailable",
        requestId: "server-error-id",
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    },
  );
});
