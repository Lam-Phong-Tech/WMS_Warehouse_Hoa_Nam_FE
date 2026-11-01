import { afterEach, describe, expect, it } from "vitest";
import dayjs from "dayjs";
import { initializeLanguage, useLanguageStore } from "./language.store";
import { formatQuantity } from "@/shared/utils/format-number";

describe("Calendar and document language", () => {
  afterEach(() => useLanguageStore.getState().setLanguage("vi"));

  it("switches date names and the document language together", () => {
    useLanguageStore.getState().setLanguage("vi");
    expect(dayjs.locale()).toBe("vi");
    expect(document.documentElement.lang).toBe("vi");
    useLanguageStore.getState().setLanguage("en");
    expect(dayjs("2026-09-23").format("MMMM")).toBe("September");
    expect(document.documentElement.lang).toBe("en");
  });

  it("applies the restored English selection at bootstrap", () => {
    useLanguageStore.setState({ language: "en" });
    initializeLanguage();
    expect(dayjs.locale()).toBe("en");
    expect(document.documentElement.lang).toBe("en");
  });

  it("uses Simplified Chinese for the document and calendar", () => {
    useLanguageStore.getState().setLanguage("zh");
    expect(dayjs.locale()).toBe("zh-cn");
    expect(document.documentElement.lang).toBe("zh-CN");
    expect(dayjs("2026-09-23").format("MMMM")).toBe("九月");
    expect(formatQuantity(1234.5)).toBe("1,234.5");
  });
});
