import { execFileSync } from "node:child_process";
import { afterEach, expect, expectTypeOf, it } from "vitest";
import { reportTopOptions } from "@/modules/reports/operations/report-top-options";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { tStatic } from "@/shared/i18n/useT";

afterEach(() => useLanguageStore.getState().setLanguage("vi"));
it("guards JSX text, expression literals, human properties and frozen module-level copy with narrow data exceptions", () => {
  const result = execFileSync(
    process.execPath,
    ["scripts/check-i18n-jsx-literals.mjs", "--self-test"],
    { encoding: "utf8" },
  );
  expect(JSON.parse(result)).toEqual({ selfTests: 12, passed: true });
});
it("keeps cached report option modules reactive across English and Chinese switches", async () => {
  const cachedFactory = reportTopOptions;
  expectTypeOf(cachedFactory([5, 10], tStatic)[0].value).toEqualTypeOf<
    "5" | "10"
  >();
  await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
  useLanguageStore.getState().setLanguage("en");
  expect(
    cachedFactory([5, 10, 20], tStatic).map((option) => option.label),
  ).toEqual(["Top 5", "Top 10", "Top 20"]);
  useLanguageStore.getState().setLanguage("zh");
  expect(
    cachedFactory([5, 10, 20], tStatic).map((option) => option.label),
  ).toEqual(["前 5 项", "前 10 项", "前 20 项"]);
  expect(
    cachedFactory([5, 10, 20], tStatic).map((option) => option.value),
  ).toEqual(["5", "10", "20"]);
  useLanguageStore.getState().setLanguage("en");
  expect(cachedFactory([5], tStatic)[0].label).toBe("Top 5");
});
