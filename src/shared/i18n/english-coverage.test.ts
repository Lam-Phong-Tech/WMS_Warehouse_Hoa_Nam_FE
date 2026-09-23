import { describe, expect, it } from "vitest";
import { MESSAGES_VI, type MessageKey } from "./messages";
import { MESSAGES_EN } from "./messages.en";
import { ensureEnglishMessages } from "./english-messages";
import { translate } from "./useT";

function flatten(tree: object, prefix = "", result: Record<string, string> = {}) {
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") result[path] = value;
    else if (value && typeof value === "object") flatten(value, path, result);
  }
  return result;
}

const viMessages = flatten(MESSAGES_VI);
const enMessages = flatten(MESSAGES_EN);
const placeholderNames = (value: string) =>
  Array.from(value.matchAll(/\{(\w+)\}/g), (match) => match[1]).sort();

describe("English catalog completeness", () => {
  it("contains an actual English entry for every Vietnamese key, without fallback", () => {
    expect(Object.keys(enMessages).sort()).toEqual(Object.keys(viMessages).sort());
    for (const [key, value] of Object.entries(enMessages)) {
      expect(value.trim().length, key).toBeGreaterThan(0);
    }
  });

  it("preserves interpolation variables in the actual catalogs", () => {
    for (const [key, value] of Object.entries(viMessages)) {
      expect(placeholderNames(enMessages[key]), key).toEqual(placeholderNames(value));
    }
  });

  it("resolves the aligned-screen copy in both languages without translating data", async () => {
    await ensureEnglishMessages();
    const vietnamese = /[ÀÁÂÃÈÉÊÌÍÒÓÔÕÙÚÝàáâãèéêìíòóôõùúýĂăĐđĨĩŨũƠơƯư\u1ea0-\u1ef9]/u;
    const customerValue = "Đại lý Nguyễn Văn An / SKU-001";
    for (const [key, english] of Object.entries(enMessages)) {
      if (!key.startsWith("updatedUi.")) continue;
      expect(vietnamese.test(english), key).toBe(false);
      const variables = Object.fromEntries(placeholderNames(english).map((name) => [name, customerValue]));
      const expected = (message: string) => message.replace(/\{(\w+)\}/g, (_, name: string) => variables[name]);
      expect(translate("en", key as MessageKey, variables), key).toBe(expected(english));
      expect(translate("vi", key as MessageKey, variables), key).toBe(expected(viMessages[key]));
    }
  });
});
