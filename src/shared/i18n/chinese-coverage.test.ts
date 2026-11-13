import { describe, expect, it } from "vitest";
import { MESSAGES_VI, type MessageKey } from "./messages";
import { MESSAGES_EN } from "./messages.en";
import { MESSAGES_ZH } from "./messages.zh";
import { ensureChineseMessages } from "./chinese-messages";
import { translate } from "./useT";

function flatten(
  tree: object,
  prefix = "",
  result: Record<string, string> = {},
) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result[path] = value;
    else if (value && typeof value === "object") flatten(value, path, result);
  }
  return result;
}

const viMessages = flatten(MESSAGES_VI);
const enMessages = flatten(MESSAGES_EN);
const zhMessages = flatten(MESSAGES_ZH);
const placeholderNames = (value: string) =>
  Array.from(value.matchAll(/\{(\w+)\}/g), (match) => match[1]).sort();
const vietnamese =
  /[ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯư\u1ea0-\u1ef9]/u;
const nativeLanguageLabels = new Set([
  "topbar.languageVietnamese",
  "topbar.languageVi",
  "topbar.languageEnglish",
  "topbar.languageEn",
]);
// These names and symbols are deliberately shared by all locales.
const prose = (value: string) =>
  value
    .replace(/\{\w+\}/g, "")
    .replace(/\b(?:SKU|Excel|PDF|xlsx|pdf|A|Z)\b/g, "");

describe("Simplified Chinese catalog completeness", () => {
  it("has a nonempty Chinese entry for every Vietnamese key without fallback", () => {
    expect(Object.keys(zhMessages).sort()).toEqual(
      Object.keys(viMessages).sort(),
    );
    for (const [key, value] of Object.entries(zhMessages)) {
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("preserves every interpolation variable, including repeated variables", () => {
    for (const [key, value] of Object.entries(viMessages)) {
      expect(placeholderNames(zhMessages[key]), key).toEqual(
        placeholderNames(value),
      );
    }
  });

  it("contains no Vietnamese prose or untranslated English UI copy", () => {
    for (const [key, value] of Object.entries(zhMessages)) {
      if (nativeLanguageLabels.has(key)) continue;
      expect(vietnamese.test(value), key).toBe(false);
      // Variable-only templates, file extensions and SKU are language independent.
      if (!/[\p{Script=Han}]/u.test(value)) {
        expect(/[A-Za-z]/.test(prose(value)), `${key}: ${value}`).toBe(false);
      }
      if (/[A-Za-z]/.test(prose(enMessages[key]))) {
        expect(value, key).not.toBe(enMessages[key]);
      }
    }
  });

  it("resolves every Chinese message and preserves user supplied values", async () => {
    await ensureChineseMessages();
    const customerValue = "Đại lý Nguyễn Văn An / SKU-001 / English data";
    for (const [key, message] of Object.entries(zhMessages)) {
      const variables = Object.fromEntries(
        placeholderNames(message).map((name) => [name, customerValue]),
      );
      const expected = message.replace(
        /\{(\w+)\}/g,
        (_, name: string) => variables[name],
      );
      expect(translate("zh", key as MessageKey, variables), key).toBe(expected);
    }
  });

  it("keeps the report and export copy translated in the actual runtime catalog", () => {
    expect(zhMessages["reportExport.allHint"]).toBe("跨页导出所有匹配结果");
    expect(zhMessages["packingLabelReport.paperTitle"]).toBe("包装标签");
    expect(zhMessages["goodsTraceAudit.historyTitle"]).toBe(
      "追溯历史（{count} 条事件）",
    );
    expect(zhMessages["dashboardAudit.skuIdentityLocked"]).toContain(
      "无法更改编码",
    );
    expect(zhMessages["uiAudit.text_4c99ba2b46"]).toBe("搜索状态...");
  });
});
