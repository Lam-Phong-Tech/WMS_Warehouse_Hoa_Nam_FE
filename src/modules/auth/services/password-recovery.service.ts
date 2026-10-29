import { API_ENDPOINTS } from "@/shared/api/endpoints";
import { resolveApiUrl, runtimeConfig } from "@/shared/config/env";
import {
  getFieldErrors,
  getRequestId,
  isErrorEnvelope,
  type ApiErrorResponse,
} from "@/shared/types/api-response";
import { loginRetryAt } from "@/modules/auth/utils/login-feedback";
import type {
  ForgotPasswordRequest,
  ResetPasswordRequest,
  VerifyOtpRequest,
  VerifyOtpResponse,
} from "../types/auth.types";

export type RecoveryFailure =
  | "offline"
  | "unavailable"
  | "validation"
  | "rate-limit"
  | "otp"
  | "token";

// Keep only safe diagnostics, never fetch options, response bodies or credentials.
export class PasswordRecoveryError extends Error {
  readonly kind: RecoveryFailure;
  readonly requestId?: string;
  readonly retryAt: number | null;
  readonly fields: Record<string, string>;
  constructor(
    kind: RecoveryFailure,
    requestId?: string,
    retryAt: number | null = null,
    fields: Record<string, string> = {},
  ) {
    super(`Password recovery: ${kind}`);
    this.name = "PasswordRecoveryError";
    this.kind = kind;
    this.requestId = requestId;
    this.retryAt = retryAt;
    this.fields = fields;
  }
}

function safeRequestId(value: unknown): string | undefined {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value)
    ? value
    : undefined;
}

const fieldNames = new Set([
  "email",
  "otp",
  "new_password",
  "new_password_confirmation",
]);

async function postRecovery(
  endpoint: string,
  payload: object,
): Promise<{ data: unknown; requestId?: string }> {
  if (typeof navigator !== "undefined" && !navigator.onLine)
    throw new PasswordRecoveryError("offline");
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    runtimeConfig.apiTimeoutMs,
  );
  try {
    const response = await fetch(
      resolveApiUrl(runtimeConfig.apiBaseUrl, endpoint),
      {
        method: "POST",
        // XHR withCredentials=false still sends same-origin cookies. Fetch omit does not.
        credentials: "omit",
        cache: "no-store",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(["local", "dev", "test"].includes(runtimeConfig.envName)
            ? { "X-WMS-Client-Tier": "dev-test" }
            : {}),
        },
        body: JSON.stringify(payload),
      },
    );
    const body = await response.json().catch(() => null);
    const record = body && typeof body === "object" ? body : {};
    const requestId =
      safeRequestId(response.headers.get("X-Request-ID")) ??
      safeRequestId(getRequestId(record));
    if (!response.ok || isErrorEnvelope(record)) {
      if (response.status === 429) {
        throw new PasswordRecoveryError(
          "rate-limit",
          requestId,
          loginRetryAt({ response: { headers: response.headers } }),
        );
      }
      if (response.status === 422) {
        const details = getFieldErrors(record as ApiErrorResponse) ?? {};
        const fields: Record<string, string> = {};
        for (const [key, values] of Object.entries(details)) {
          const message = Array.isArray(values) ? values[0] : values;
          const echoesInput =
            typeof message === "string" &&
            Object.values(payload).some(
              (value) =>
                typeof value === "string" &&
                value.length > 0 &&
                message.includes(value),
            );
          if (
            fieldNames.has(key) &&
            typeof message === "string" &&
            message.length <= 500 &&
            !echoesInput
          )
            fields[key] = message;
        }
        const kind =
          endpoint === API_ENDPOINTS.VERIFY_OTP
            ? "otp"
            : endpoint === API_ENDPOINTS.RESET_PASSWORD &&
                (!Object.keys(fields).length || "reset_token" in details)
              ? "token"
              : "validation";
        throw new PasswordRecoveryError(
          kind,
          requestId,
          null,
          kind === "validation" ? fields : {},
        );
      }
      throw new PasswordRecoveryError("unavailable", requestId);
    }
    if (record.success !== true || !("data" in record))
      throw new PasswordRecoveryError("unavailable", requestId);
    return { data: record.data, requestId };
  } catch (error) {
    if (error instanceof PasswordRecoveryError) throw error;
    throw new PasswordRecoveryError("unavailable");
  } finally {
    clearTimeout(timeout);
  }
}

export const passwordRecoveryService = {
  async forgotPassword(data: ForgotPasswordRequest): Promise<null> {
    await postRecovery(API_ENDPOINTS.FORGOT_PASSWORD, {
      email: data.email.trim().toLowerCase(),
    });
    return null;
  },
  async verifyOtp(data: VerifyOtpRequest): Promise<VerifyOtpResponse> {
    const result = await postRecovery(API_ENDPOINTS.VERIFY_OTP, {
      email: data.email.trim().toLowerCase(),
      otp: data.otp,
    });
    const value = result.data as Partial<VerifyOtpResponse> | null;
    if (
      !value ||
      typeof value.reset_token !== "string" ||
      !value.reset_token.trim() ||
      typeof value.expires_in !== "number" ||
      !Number.isFinite(value.expires_in) ||
      value.expires_in <= 0
    ) {
      throw new PasswordRecoveryError("unavailable", result.requestId);
    }
    return {
      reset_token: value.reset_token,
      expires_in: Math.min(value.expires_in, 600),
    };
  },
  async resetPassword(data: ResetPasswordRequest): Promise<null> {
    await postRecovery(API_ENDPOINTS.RESET_PASSWORD, {
      email: data.email.trim().toLowerCase(),
      reset_token: data.reset_token,
      new_password: data.new_password,
      new_password_confirmation: data.new_password_confirmation,
    });
    return null;
  },
};
