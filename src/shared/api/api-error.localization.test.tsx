import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { localizeMessage } from "@/shared/i18n/localize-message";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  ApiEnvelopeError,
  createMockAxiosError,
  extractFieldErrors,
  extractFieldErrorsRaw,
  getApiErrorDetails,
  getApiErrorMessage,
  getMutationErrorMessage,
  normalizeError,
} from "./api-error";

beforeAll(ensureEnglishMessages);
afterEach(() => act(() => useLanguageStore.getState().setLanguage("vi")));

describe("localized API errors", () => {
  it("localizes both API envelope shapes and inline field errors without changing metadata", () => {
    useLanguageStore.getState().setLanguage("en");
    // The UI catalog also contains universal `{code}` / `{label}` templates.
    // They must not shadow specific backend-message translations.
    expect(localizeMessage("Mật khẩu hiện tại không chính xác")).toBe(
      "The current password is incorrect.",
    );
    const errors = { current_password: ["Mật khẩu hiện tại không chính xác"] };
    const envelope = new ApiEnvelopeError({
      message: "Dữ liệu gửi lên không hợp lệ.",
      error: { code: "VALIDATION_ERROR", details: errors },
      meta: { request_id: "trace-1" },
    });
    const axios = createMockAxiosError({
      status: 422,
      data: { message: "Dữ liệu gửi lên không hợp lệ.", errors },
    });
    for (const error of [envelope, axios]) {
      expect(getApiErrorMessage(error)).toBe(
        "The current password is incorrect.",
      );
      expect(extractFieldErrors(error)?.currentPassword).toBe(
        "The current password is incorrect.",
      );
      expect(extractFieldErrorsRaw(error)?.current_password).toBe(
        "The current password is incorrect.",
      );
      expect(normalizeError(error).errors).toBe(errors);
      expect(normalizeError(error).raw).toBe(error);
    }
  });

  it("translates actual backend validation templates and retains quantities", () => {
    useLanguageStore.getState().setLanguage("en");
    expect(localizeMessage("Mật khẩu mới phải có ít nhất 12 ký tự.")).toMatch(
      /new password must contain at least 12 characters\./i,
    );
    expect(localizeMessage("Số lượng phải lớn hơn 2.5.")).toMatch(
      /quantity must be greater than 2\.5\./i,
    );
    expect(
      localizeMessage(
        "Số lượng quét vượt quá số lượng còn lại ở dòng SKU-HÒA-12.",
      ),
    ).toBe(
      "The scanned quantity exceeds the remaining quantity on line SKU-HÒA-12.",
    );
  });

  it("keeps unknown business details and names, while filtering machine-only alert details", () => {
    useLanguageStore.getState().setLanguage("en");
    const error = new ApiEnvelopeError({
      message: "Lô Hòa Nam 42: 17/20",
      error: {
        code: "CONFLICT",
        details: {
          status: "COMPLETED",
          version: "4",
          can_retry: "false",
          reason: "Mật khẩu hiện tại không chính xác",
        },
      },
    });
    expect(getApiErrorDetails(error)).toEqual([
      "The current password is incorrect.",
    ]);
    expect(getApiErrorMessage(error)).toContain("Lô Hòa Nam 42: 17/20");
  });

  it("localizes permission mutations too", () => {
    useLanguageStore.getState().setLanguage("en");
    expect(
      getMutationErrorMessage(
        createMockAxiosError({
          status: 403,
          data: { message: "Bạn không có quyền truy cập." },
        }),
      ),
    ).toMatch(/access|permission/i);
  });

  it("re-renders existing alert details on a language switch and preserves Vietnamese", () => {
    const error = new ApiEnvelopeError({
      message: "Dữ liệu gửi lên không hợp lệ.",
      errors: {
        current_password: ["Mật khẩu hiện tại không chính xác"],
        version: "4",
      },
    });
    render(<ApiErrorAlert error={error} />);
    expect(
      screen.getAllByText("Mật khẩu hiện tại không chính xác").length,
    ).toBeGreaterThan(0);
    act(() => useLanguageStore.getState().setLanguage("en"));
    expect(
      screen.queryByText("Mật khẩu hiện tại không chính xác"),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByText("The current password is incorrect.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("4")).not.toBeInTheDocument();
    act(() => useLanguageStore.getState().setLanguage("vi"));
    expect(getApiErrorMessage(error)).toBe("Mật khẩu hiện tại không chính xác");
  });
});
