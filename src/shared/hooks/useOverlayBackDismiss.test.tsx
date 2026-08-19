import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {
  OVERLAY_HISTORY_STATE_KEY,
  useOverlayBackDismiss,
} from "./useOverlayBackDismiss";

/**
 * WWHN-217 · TC-217-BACK-* — hợp đồng của Back khi có overlay:
 * 1. mở overlay đẩy đúng MỘT history entry mang marker;
 * 2. Back đóng overlay và KHÔNG rời màn hình;
 * 3. đóng bằng nút trong UI thì entry đã push được tiêu thụ, không để lại rác khiến
 *    người dùng phải bấm Back hai lần.
 *
 * Test chạy trên History API thật của jsdom vì đó đúng là bề mặt hook đang dùng —
 * mock `popstate` sẽ không chứng minh được gì về hành vi Back thật.
 */

const OVERLAY_ID = "test-overlay";

function OverlayScreen() {
  const [open, setOpen] = useState(false);
  useOverlayBackDismiss(open, () => setOpen(false), OVERLAY_ID);

  return (
    <div>
      <h1>Màn hình hub</h1>
      <button type="button" onClick={() => setOpen(true)}>
        Mở overlay
      </button>
      <button type="button" onClick={() => setOpen(false)}>
        Đóng overlay
      </button>
      {open ? <div role="dialog">Nội dung overlay</div> : null}
    </div>
  );
}

function currentMarker(): string | undefined {
  const state = window.history.state as Record<string, unknown> | null;
  if (typeof state !== "object" || state === null) return undefined;
  const marker = state[OVERLAY_HISTORY_STATE_KEY];
  return typeof marker === "string" ? marker : undefined;
}

describe("useOverlayBackDismiss", () => {
  it("mở overlay đẩy đúng một history entry mang marker", async () => {
    const user = userEvent.setup();
    render(<OverlayScreen />);
    const lengthBefore = window.history.length;

    await user.click(screen.getByRole("button", { name: "Mở overlay" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(currentMarker()).toBe(OVERLAY_ID);
    expect(window.history.length).toBe(lengthBefore + 1);

    // Dọn entry đã đẩy để test sau không kế thừa stack bẩn.
    await user.click(screen.getByRole("button", { name: "Đóng overlay" }));
    await waitFor(() => expect(currentMarker()).toBeUndefined());
  });

  it("Back đóng overlay và giữ nguyên URL màn hình đang thao tác", async () => {
    const user = userEvent.setup();
    render(<OverlayScreen />);
    const urlBefore = window.location.href;

    await user.click(screen.getByRole("button", { name: "Mở overlay" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();

    window.history.back();

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(window.location.href).toBe(urlBefore);
    expect(screen.getByRole("heading", { name: "Màn hình hub" })).toBeVisible();
  });

  it("đóng bằng nút trong UI thì entry đã push được tiêu thụ", async () => {
    const user = userEvent.setup();
    render(<OverlayScreen />);

    await user.click(screen.getByRole("button", { name: "Mở overlay" }));
    expect(currentMarker()).toBe(OVERLAY_ID);

    await user.click(screen.getByRole("button", { name: "Đóng overlay" }));

    // Marker biến mất = entry rác đã được pop; Back tiếp theo là Back "thật" của người dùng.
    await waitFor(() => expect(currentMarker()).toBeUndefined());
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("mở lại overlay sau khi đã Back vẫn đẩy entry mới", async () => {
    const user = userEvent.setup();
    render(<OverlayScreen />);

    await user.click(screen.getByRole("button", { name: "Mở overlay" }));
    window.history.back();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    await user.click(screen.getByRole("button", { name: "Mở overlay" }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(currentMarker()).toBe(OVERLAY_ID);

    window.history.back();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });
});
