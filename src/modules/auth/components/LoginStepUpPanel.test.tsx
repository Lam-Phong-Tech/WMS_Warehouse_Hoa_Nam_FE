import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginStepUpPanel } from "./LoginStepUpPanel";
import { useLanguageStore } from "@/shared/i18n/language.store";

const challenge = {
  kind: "step_up_required" as const,
  step_up_required: true as const,
  step_up_token: "step-up-token",
  method: "email" as const,
  masked_email: "a***@b.test",
  expires_in: 300,
};

function renderPanel(onResend = vi.fn().mockResolvedValue(undefined)) {
  render(
    <MemoryRouter>
      <LoginStepUpPanel
        challenge={challenge}
        verified={null}
        feedback={null}
        isVerifying={false}
        isResending={false}
        isContinuing={false}
        throttled={false}
        online
        onVerify={vi.fn()}
        onResend={onResend}
        onContinueLogin={vi.fn()}
        onBack={vi.fn()}
      />
    </MemoryRouter>,
  );
  return onResend;
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  useLanguageStore.getState().setLanguage("vi");
});

describe("LoginStepUpPanel — đếm ngược gửi lại mã", () => {
  it("bắt đầu cooldown 60 giây ngay khi màn xác minh xuất hiện", () => {
    vi.useFakeTimers();
    renderPanel();

    expect(
      screen.getByRole("button", { name: "Gửi lại mã sau 60s" }),
    ).toBeDisabled();
  });

  it("chỉ bật gửi lại khi hết giờ và đếm lại sau khi gửi thành công", async () => {
    vi.useFakeTimers();
    const onResend = renderPanel();

    act(() => {
      vi.advanceTimersByTime(60_000);
    });

    const resend = screen.getByRole("button", { name: "Gửi lại mã" });
    expect(resend).toBeEnabled();

    fireEvent.click(resend);
    await act(async () => {
      await Promise.resolve();
    });

    expect(onResend).toHaveBeenCalledTimes(1);
    expect(
      screen.getByRole("button", { name: "Gửi lại mã sau 60s" }),
    ).toBeDisabled();
  });
});
