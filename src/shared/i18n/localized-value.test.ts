import { afterEach, describe, expect, it } from "vitest";
import { localizedValue } from "./localized-value";
import { useLanguageStore } from "./language.store";
import { ensureEnglishMessages } from "./english-messages";
import { tStatic } from "./useT";

describe("localized UI constants", () => {
  afterEach(() => useLanguageStore.setState({ language: "vi" }));

  it("keeps array identity between renders and resolves labels after a language switch", async () => {
    useLanguageStore.setState({ language: "vi" });
    const options = localizedValue(() => [{ label: tStatic("dashboard.title"), value: "MAP-01" }]);
    const vietnamese = options();
    expect(options()).toBe(vietnamese);
    expect(vietnamese[0].label).toBe("Tổng quan vận hành");
    await ensureEnglishMessages();
    useLanguageStore.setState({ language: "en" });
    const english = options();
    expect(english).not.toBe(vietnamese);
    expect(options()).toBe(english);
    expect(english[0]).toEqual({ label: "Operations overview", value: "MAP-01" });
    useLanguageStore.setState({ language: "vi" });
    expect(options()[0]).toEqual(vietnamese[0]);
  });
});
