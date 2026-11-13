import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { beforeEach, expect, it, vi } from "vitest";
import { renderWithProviders } from "@/test/test-utils";
import { useQueryClient } from "@tanstack/react-query";
import { profileKeys } from "../../types/profile.types";
import { profileService } from "../../services/profile.service";
import { ProfileLoginHistory } from "./ProfileLoginHistory";

const ended = {
  id: "ended-phone",
  auth_session_id: "phone-login",
  session_id: "phone-login",
  is_current: false,
  can_revoke: false,
  device_label: "Điện thoại Android",
  user_agent: "Chrome/140 Android Mobile",
  ip_address: null,
  platform: "Android",
  client_type: "web" as const,
  metadata_source: "stored",
  last_active_at: "2026-11-04T14:00:00Z",
  last_active_semantics: "LOGIN_OR_TOKEN_REFRESH_NOT_EACH_API_REQUEST",
  started_at: "2026-11-04T13:00:00Z",
  expires_at: "2026-12-04T13:00:00Z",
  status: "SIGNED_OUT" as const,
  ended_at: "2026-11-04T14:30:00Z",
};
beforeEach(() => vi.restoreAllMocks());

function RefreshHistory() {
  const client = useQueryClient();
  useEffect(() => {
    // Match production cache retention; the common test wrapper otherwise
    // removes inactive pages immediately and cannot reproduce a stale page.
    client.setQueryDefaults(profileKeys.deviceHistory("self"), { gcTime: 60_000 });
  }, [client]);
  return <button onClick={() => void client.invalidateQueries({
    queryKey: profileKeys.deviceHistory("self"),
  })}>Refresh history</button>;
}

it("shows a signed-out phone login with dates and no revoke action, then pages to expired logins", async () => {
  const get = vi
    .spyOn(profileService, "getDeviceHistory")
    .mockResolvedValueOnce({
      data: [ended],
      meta: { current_page: 1, per_page: 6, last_page: 2, total: 7 },
    })
    .mockResolvedValueOnce({
      data: [
        { ...ended, id: "expired", session_id: "expired", status: "EXPIRED" },
      ],
      meta: { current_page: 2, per_page: 6, last_page: 2, total: 7 },
    });
  renderWithProviders(<ProfileLoginHistory userId="self" />);
  expect(await screen.findByText("Đã đăng xuất")).toBeVisible();
  expect(screen.getByText("Điện thoại Android")).toBeVisible();
  expect(screen.getByText("Chrome · Android")).toBeVisible();
  expect(screen.getByText("Đăng nhập")).toBeVisible();
  expect(screen.getByText("Kết thúc")).toBeVisible();
  expect(
    screen.queryByRole("button", { name: /Đăng xuất/ }),
  ).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /next page/i }));
  expect(await screen.findByText("Hết hạn")).toBeVisible();
  expect(get).toHaveBeenLastCalledWith(2, 6);
});

it("shows numbered pagination and resets to page one when the page size changes", async () => {
  const entries = Array.from({ length: 13 }, (_, index) => ({
    ...ended,
    id: `history-${index}`,
    session_id: `history-${index}`,
    device_label: `Thiết bị ${index + 1}`,
  }));
  const get = vi.spyOn(profileService, "getDeviceHistory")
    .mockImplementation(async (page = 1, size = 6) => ({
      data: entries.slice((page - 1) * size, page * size),
      meta: { current_page: page, per_page: size, last_page: Math.ceil(entries.length / size), total: entries.length },
    }));
  renderWithProviders(<ProfileLoginHistory userId="self" />);
  expect(await screen.findByText("Thiết bị 1")).toBeVisible();
  expect(screen.getByText("Hiển thị 1–6 / 13 phiên đăng nhập")).toBeVisible();
  expect(screen.queryByText("Thiết bị 7")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
  expect(await screen.findByText("Thiết bị 7")).toBeVisible();
  expect(screen.getByText("Hiển thị 7–12 / 13 phiên đăng nhập")).toBeVisible();
  expect(get).toHaveBeenLastCalledWith(2, 6);
  fireEvent.mouseDown(screen.getByRole("combobox", { name: "Số bản ghi mỗi trang" }));
  fireEvent.click(screen.getByRole("option", { name: "9 / trang" }));
  expect(await screen.findByText("Thiết bị 1")).toBeVisible();
  expect(screen.getByText("Hiển thị 1–9 / 13 phiên đăng nhập")).toBeVisible();
  expect(get).toHaveBeenLastCalledWith(1, 9);
  expect(screen.queryByText("Thiết bị 10")).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
  expect(await screen.findByText("Thiết bị 10")).toBeVisible();
  expect(screen.getByText("Hiển thị 10–13 / 13 phiên đăng nhập")).toBeVisible();
  expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
});

it("keeps the pagination footer visible when there is only one page", async () => {
  vi.spyOn(profileService, "getDeviceHistory").mockResolvedValue({
    data: [ended], meta: { current_page: 1, per_page: 6, last_page: 1, total: 1 },
  });
  renderWithProviders(<ProfileLoginHistory userId="self" />);
  expect(await screen.findByText("Hiển thị 1–1 / 1 phiên đăng nhập")).toBeVisible();
  expect(screen.getByRole("button", { name: /previous page/i })).toBeDisabled();
  expect(screen.getByRole("button", { name: /next page/i })).toBeDisabled();
});

it("corrects a pruned page after refetch and allows that page again when history grows", async () => {
  const entries = Array.from({ length: 7 }, (_, index) => ({
    ...ended, id: `history-${index}`, session_id: `history-${index}`,
    device_label: `Thiết bị ${index + 1}`,
  }));
  let total = 7;
  let deferPageTwo = false;
  let releasePageTwo: (() => void) | undefined;
  vi.spyOn(profileService, "getDeviceHistory")
    .mockImplementation(async (page = 1, size = 6) => {
      if (deferPageTwo && page === 2) {
        await new Promise<void>((resolve) => { releasePageTwo = resolve; });
      }
      return {
        data: entries.slice(0, total).slice((page - 1) * size, page * size),
        meta: { current_page: page, per_page: size, last_page: Math.ceil(total / size), total },
      };
    });
  renderWithProviders(<><ProfileLoginHistory userId="self" /><RefreshHistory /></>);
  await screen.findByText("Thiết bị 1");
  fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
  await screen.findByText("Thiết bị 7");
  total = 6;
  fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
  expect(await screen.findByText("Thiết bị 1")).toBeVisible();
  expect(await screen.findByText("Hiển thị 1–6 / 6 phiên đăng nhập")).toBeVisible();
  total = 7;
  fireEvent.click(screen.getByRole("button", { name: "Refresh history" }));
  await screen.findByText("Hiển thị 1–6 / 7 phiên đăng nhập");
  deferPageTwo = true;
  fireEvent.click(screen.getByRole("button", { name: /page 2/i }));
  await waitFor(() => expect(releasePageTwo).toBeTypeOf("function"));
  await act(async () => releasePageTwo?.());
  expect(await screen.findByText("Thiết bị 7")).toBeVisible();
  expect(screen.getByText("Hiển thị 7–7 / 7 phiên đăng nhập")).toBeVisible();
});

it("hides an empty login history", async () => {
  const get = vi.spyOn(profileService, "getDeviceHistory").mockResolvedValue({
    data: [],
    meta: { current_page: 1, last_page: 1, total: 0 },
  });
  renderWithProviders(<ProfileLoginHistory userId="self" />);
  await waitFor(() => expect(get).toHaveBeenCalled());
  await waitFor(() =>
    expect(screen.queryByRole("status")).not.toBeInTheDocument(),
  );
  expect(
    screen.queryByRole("heading", { name: "Lịch sử đăng nhập" }),
  ).not.toBeInTheDocument();
});

it("uses the phone illustration for a scanner app without platform metadata", async () => {
  vi.spyOn(profileService, "getDeviceHistory").mockResolvedValue({
    data: [
      {
        ...ended,
        device_label: null,
        platform: null,
        client_type: "app",
        user_agent: "App Scanner",
      },
    ],
    meta: { current_page: 1, last_page: 1, total: 1 },
  });
  const { container } = renderWithProviders(
    <ProfileLoginHistory userId="self" />,
  );
  expect(await screen.findByText("Điện thoại")).toBeVisible();
  expect(
    container.querySelector('[data-device-kind="phone"]'),
  ).toBeInTheDocument();
});

it("can retry a history error independently", async () => {
  vi.spyOn(profileService, "getDeviceHistory")
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValue({
      data: [ended],
      meta: { current_page: 1, last_page: 1, total: 1 },
    });
  renderWithProviders(<ProfileLoginHistory userId="self" />);
  fireEvent.click(await screen.findByRole("button", { name: "Thử lại" }));
  expect(await screen.findByText("Đã đăng xuất")).toBeVisible();
});
