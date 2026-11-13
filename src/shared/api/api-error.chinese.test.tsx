import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { localizeMessage } from "@/shared/i18n/localize-message";
import { tStatic } from "@/shared/i18n/useT";
import * as english from "@/shared/i18n/server-message-catalog";
import * as chinese from "@/shared/i18n/server-message-catalog.zh";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import {
  ApiEnvelopeError,
  createMockAxiosError,
  extractFieldErrorsRaw,
  getApiErrorMessage,
  getMutationErrorMessage,
  normalizeError,
} from "./api-error";

beforeAll(async () => {
  await Promise.all([ensureChineseMessages(), ensureEnglishMessages()]);
});
afterEach(() => act(() => useLanguageStore.getState().setLanguage("vi")));

describe("Simplified Chinese server errors", () => {
  it("covers every source-backed exact message, validation rule and attribute", () => {
    expect(Object.keys(chinese.BACKEND_MESSAGES_ZH)).toEqual(
      Object.keys(english.BACKEND_MESSAGES),
    );
    expect(Object.keys(chinese.VALIDATION_ATTRIBUTES_ZH)).toEqual(
      Object.keys(english.VALIDATION_ATTRIBUTES),
    );
    expect(chinese.VALIDATION_MESSAGES_ZH.map(([source]) => source)).toEqual(
      english.VALIDATION_MESSAGES.map(([source]) => source),
    );
    for (const [source, target] of chinese.VALIDATION_MESSAGES_ZH) {
      expect(target.match(/\{\w+\}/g)?.sort()).toEqual(
        source.match(/\{\w+\}/g)?.sort(),
      );
      expect(target).toMatch(/\p{Script=Han}/u);
    }
    for (const target of [
      ...Object.values(chinese.BACKEND_MESSAGES_ZH),
      ...Object.values(chinese.VALIDATION_ATTRIBUTES_ZH),
    ])
      expect(target).toMatch(/\p{Script=Han}/u);
  });

  it("translates validation details in both envelopes and keeps raw metadata intact", () => {
    useLanguageStore.getState().setLanguage("zh");
    const errors = { current_password: ["Mật khẩu hiện tại không chính xác"] };
    const nested = new ApiEnvelopeError({
      message: "Dữ liệu gửi lên không hợp lệ.",
      error: { code: "VALIDATION_ERROR", details: errors },
      meta: { request_id: "trace-HÒA-42" },
    });
    const flat = createMockAxiosError({
      status: 422,
      data: { message: "Dữ liệu gửi lên không hợp lệ.", errors },
    });
    for (const error of [nested, flat]) {
      expect(getApiErrorMessage(error)).toBe("当前密码不正确。");
      expect(extractFieldErrorsRaw(error)).toEqual({
        current_password: "当前密码不正确。",
      });
      expect(normalizeError(error).errors).toBe(errors);
      expect(normalizeError(error).raw).toBe(error);
    }
    expect(normalizeError(nested).code).toBe("VALIDATION_ERROR");
    expect(nested.data.meta?.request_id).toBe("trace-HÒA-42");
  });

  it("translates attributes and quantities while preserving names and SKU data", () => {
    useLanguageStore.getState().setLanguage("zh");
    expect(localizeMessage("Mật khẩu mới phải có ít nhất 12 ký tự.")).toBe(
      "新密码至少需要 12 个字符。",
    );
    expect(localizeMessage("Số lượng phải lớn hơn 2.5.")).toBe(
      "数量必须大于 2.5。",
    );
    expect(
      localizeMessage(
        "Số lượng quét vượt quá số lượng còn lại ở dòng SKU-HÒA-12.",
      ),
    ).toBe("扫描数量超过行 SKU-HÒA-12 的剩余数量。");
    expect(localizeMessage("Nguyễn Văn An phải có ít nhất 12 ký tự.")).toBe(
      "Nguyễn Văn An至少需要 12 个字符。",
    );
  });

  it("resolves every known backend field including uppercase acronyms", () => {
    useLanguageStore.getState().setLanguage("zh");
    for (const attribute of Object.keys(english.VALIDATION_ATTRIBUTES)) {
      const translated = localizeMessage(`Vui lòng nhập ${attribute}.`);
      expect(translated, attribute).toMatch(/\p{Script=Han}/u);
      expect(translated, attribute).not.toMatch(
        /Vui lòng|đ|[àáảãạăâèéẻẽẹêìíỉĩịòóỏõọôơùúủũụưỳýỷỹỵ]/iu,
      );
    }
  });

  it("uses attribute-aware rules before generic UI templates", () => {
    useLanguageStore.getState().setLanguage("zh");
    expect(localizeMessage("Vui lòng nhập mật khẩu hiện tại.")).toBe(
      "请输入当前密码。",
    );
    expect(localizeMessage("Vui lòng nhập Nguyễn Văn An.")).toBe(
      "请输入Nguyễn Văn An。",
    );
    useLanguageStore.getState().setLanguage("en");
    expect(localizeMessage("Vui lòng nhập mật khẩu hiện tại.")).toMatch(
      /^Enter current password\.$/i,
    );
  });

  it("translates permission messages without broad templates swallowing unknown prose", () => {
    useLanguageStore.getState().setLanguage("zh");
    expect(
      getMutationErrorMessage(
        createMockAxiosError({
          status: 403,
          data: { message: "Bạn không có quyền truy cập." },
        }),
      ),
    ).toBe("您没有访问权限。");
    expect(localizeMessage("Mật khẩu hiện tại không chính xác")).toBe(
      "当前密码不正确。",
    );
    expect(localizeMessage("Lô Hòa Nam 42: 17/20")).toBe(
      "Lô Hòa Nam 42: 17/20",
    );
  });

  it("rerenders an existing Vietnamese error in Chinese and English", () => {
    const error = new ApiEnvelopeError({
      message: "Dữ liệu gửi lên không hợp lệ.",
      errors: { current_password: ["Mật khẩu hiện tại không chính xác"] },
    });
    render(<ApiErrorAlert error={error} />);
    expect(
      screen.getAllByText("Mật khẩu hiện tại không chính xác").length,
    ).toBeGreaterThan(0);
    act(() => useLanguageStore.getState().setLanguage("zh"));
    expect(screen.getAllByText("当前密码不正确。").length).toBeGreaterThan(0);
    expect(
      screen.queryByText("Mật khẩu hiện tại không chính xác"),
    ).not.toBeInTheDocument();
    act(() => useLanguageStore.getState().setLanguage("en"));
    expect(
      screen.getAllByText("The current password is incorrect.").length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText("当前密码不正确。")).not.toBeInTheDocument();
  });

  it("rerenders an Error created from an English client-service message in Chinese", () => {
    useLanguageStore.getState().setLanguage("en");
    const error = new Error(tStatic("reports.export.noJobId"));
    const englishMessage = error.message;
    render(<ApiErrorAlert error={error} />);
    expect(screen.getByText(englishMessage)).toBeInTheDocument();
    act(() => useLanguageStore.getState().setLanguage("zh"));
    const chineseMessage = tStatic("reports.export.noJobId");
    expect(screen.getByText(chineseMessage)).toBeInTheDocument();
    expect(screen.queryByText(englishMessage)).not.toBeInTheDocument();
    expect(error.message).toBe(englishMessage);
    act(() => useLanguageStore.getState().setLanguage("en"));
    expect(localizeMessage(chineseMessage)).toBe(englishMessage);
    expect(localizeMessage("Order Nguyễn Văn An / SKU-HÒA-12 failed.")).toBe(
      "Order Nguyễn Văn An / SKU-HÒA-12 failed.",
    );
  });
});
