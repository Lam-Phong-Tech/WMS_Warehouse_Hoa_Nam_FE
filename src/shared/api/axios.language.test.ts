import { afterEach, expect, it, vi } from "vitest";
vi.unmock("axios");
import MockAdapter from "axios-mock-adapter";
import { api } from "./axios";
import { useLanguageStore } from "@/shared/i18n/language.store";

const mock = new MockAdapter(api);
afterEach(() => {
  mock.reset();
  useLanguageStore.setState({ language: "vi" });
});

it("sends the current interface language for initial login and OTP resends", async () => {
  mock
    .onPost()
    .reply((config) => [
      200,
      { language: config.headers?.["Accept-Language"] },
    ]);
  for (const language of ["vi", "en", "zh"] as const) {
    useLanguageStore.setState({ language });
    for (const path of [
      "/auth/login",
      "/auth/device/resend",
      "/auth/step-up/resend",
    ]) {
      const response = await api.post(path, {});
      expect(response.data.language).toBe(language);
    }
  }
});
