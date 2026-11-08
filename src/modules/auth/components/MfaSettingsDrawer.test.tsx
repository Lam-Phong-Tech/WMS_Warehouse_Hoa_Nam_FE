import { fireEvent, screen, waitFor } from "@testing-library/react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { useAuthStore } from "@/shared/store/auth.store";
import { useMfaRecoveryStore } from "@/shared/store/mfa-recovery.store";
import { authService } from "../services/auth.service";
import { MfaSettingsDrawer } from "./MfaSettingsDrawer";

beforeEach(() => {
  vi.restoreAllMocks();
  useAuthStore.getState().setAuth({
    token: "mfa-owner",
    user: {
      id: "owner",
      user_id: "owner",
      name: "Owner",
      email: "owner@example.com",
      code: "OWNER",
    },
  });
});
it("requires acknowledgement before clearing retained recovery codes while status is still loading", async () => {
  vi.spyOn(authService, "mfaStatus").mockImplementation(
    () => new Promise(() => {}),
  );
  useMfaRecoveryStore
    .getState()
    .put("owner", useAuthStore.getState().authEpoch, ["AAAAA-11111"]);
  const onClose = vi.fn();
  renderWithProviders(<MfaSettingsDrawer open onClose={onClose} />);
  fireEvent.click(screen.getAllByRole("button", { name: /^Đóng$/ })[0]);
  expect(
    await screen.findByRole("button", { name: "Đã lưu mã khôi phục" }),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Tiếp tục lưu mã" }));
  await waitFor(() =>
    expect(
      screen.queryByRole("button", { name: "Đã lưu mã khôi phục" }),
    ).toBeNull(),
  );
  expect(useMfaRecoveryStore.getState().codes).toEqual(["AAAAA-11111"]);
  expect(onClose).not.toHaveBeenCalled();
  fireEvent.click(
    (await screen.findAllByRole("button", { name: /^Đóng$/ }))[0],
  );
  fireEvent.click(
    await screen.findByRole("button", { name: "Đã lưu mã khôi phục" }),
  );
  await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
  expect(useMfaRecoveryStore.getState().codes).toBeNull();
});
