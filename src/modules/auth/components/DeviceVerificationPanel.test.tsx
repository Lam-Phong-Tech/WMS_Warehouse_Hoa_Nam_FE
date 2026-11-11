import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DeviceVerificationPanel } from "./DeviceVerificationPanel";
import { useLanguageStore } from "@/shared/i18n/language.store";

const challenge = {
  kind: "device_verification_required" as const,
  device_verification_required: true as const,
  device_token: "device-token",
  masked_email: "a***@b.test",
  expires_in: 300,
};

function renderPanel(onResend = vi.fn().mockResolvedValue(undefined)) {
  render(
    <MemoryRouter>
      <DeviceVerificationPanel
        challenge={challenge}
        feedback={null}
        isVerifying={false}
        isResending={false}
        throttled={false}
        online
        onVerify={vi.fn()}
        onResend={onResend}
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

describe("DeviceVerificationPanel — đếm ngược gửi lại mã", () => {
  it("bắt đầu cooldown 60 giây ngay khi màn xác minh xuất hiện", () => {
    vi.useFakeTimers();
    renderPanel();

    // Mã vừa được gửi kèm lần đăng nhập, nên chưa được gửi lại ngay.
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
