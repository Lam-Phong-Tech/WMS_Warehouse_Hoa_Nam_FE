import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { tStatic } from "@/shared/i18n/useT";
import { useThemeStore } from "@/shared/ui/theme/theme.store";
import { DeviceVerificationPanel } from "./DeviceVerificationPanel";
import { LoginStepUpPanel } from "./LoginStepUpPanel";

afterEach(() => {
  cleanup();
  useLanguageStore.getState().setLanguage("vi");
});
it.each(["device", "stepUp"] as const)(
  "localizes the missing-email fallback and theme action for %s verification",
  async (kind) => {
    const common = {
      feedback: null,
      isVerifying: false,
      isResending: false,
      throttled: false,
      online: true,
      onVerify: vi.fn(),
      onResend: vi.fn().mockResolvedValue(undefined),
      onBack: vi.fn(),
    };
    render(
      <MemoryRouter>
        {kind === "device" ? (
          <DeviceVerificationPanel
            {...common}
            challenge={{
              kind: "device_verification_required",
              device_verification_required: true,
              device_token: "token",
              masked_email: "",
              expires_in: 300,
            }}
          />
        ) : (
          <LoginStepUpPanel
            {...common}
            challenge={{
              kind: "step_up_required",
              step_up_required: true,
              step_up_token: "token",
              method: "email",
              masked_email: "",
              expires_in: 300,
            }}
            verified={null}
            isContinuing={false}
            onContinueLogin={vi.fn()}
          />
        )}
      </MemoryRouter>,
    );
    for (const language of ["en", "zh"] as const) {
      await act(async () => {
        await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
        useLanguageStore.getState().setLanguage(language);
      });
      const fallback = tStatic("auth.login.registeredEmailFallback");
      expect(
        screen.getByText(
          tStatic(
            kind === "device"
              ? "auth.login.deviceSubtitle"
              : "auth.login.stepUpEmailSubtitle",
            { email: fallback },
          ),
        ),
      ).toBeVisible();
      expect(
        screen.getByRole("button", {
          name: tStatic(
            useThemeStore.getState().mode === "light"
              ? "topbar.enableDarkTheme"
              : "topbar.enableLightTheme",
          ),
        }),
      ).toBeVisible();
      expect(
        screen.queryByRole("button", { name: /Bật giao diện/ }),
      ).not.toBeInTheDocument();
    }
  },
);
