import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/test-utils";
import type { NotificationItem } from "@/modules/notifications/types/notification.types";

const querySpy = vi.fn();
const markReadSpy = vi.fn();

vi.mock("@/modules/notifications/hooks/useNotifications", () => ({
  useNotificationsQuery: (params: unknown) => querySpy(params),
  useMarkNotificationRead: () => ({ mutate: markReadSpy }),
  useMarkAllNotificationsRead: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("@/modules/notifications/components/NotificationDetailModal", () => ({
  NotificationDetailModal: ({ item }: { item: NotificationItem | null }) =>
    item ? <div data-testid="notification-detail">{item.title}</div> : null,
}));

import NotificationsPage from "./NotificationsPage";

const item: NotificationItem = {
  id: "recipient-1",
  notification_id: "notification-1",
  event_key: "warranty.case_created",
  title: "Đã tiếp nhận ca bảo hành mới",
  body: "Ca bảo hành WC-01 vừa được tiếp nhận.",
  severity: "info",
  source_module: "warehouse",
  subject_type: "warranty_case",
  subject_id: "case-1",
  actor_id: null,
  actor_name: null,
  payload: null,
  read_at: null,
  created_at: "2026-11-03T10:00:00+07:00",
};

describe("NotificationsPage", () => {
  it("filters unread notifications and opens a row with the keyboard", async () => {
    querySpy.mockReturnValue({
      data: { data: [item], meta: { total: 1 } },
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<NotificationsPage />);

    expect(
      screen.getByRole("navigation", { name: "Phân trang" }),
    ).toBeInTheDocument();

    fireEvent.click(
      within(screen.getByRole("group", { name: "Lọc thông báo" })).getByRole(
        "button",
        { name: /Chưa đọc/ },
      ),
    );
    expect(querySpy).toHaveBeenLastCalledWith({
      page: 1,
      per_page: 10,
      unread: true,
    });

    const row = screen.getByRole("button", {
      name: /Đã tiếp nhận ca bảo hành mới/,
    });
    row.focus();
    await userEvent.keyboard("{Enter}");
    expect(screen.getByTestId("notification-detail")).toBeInTheDocument();
    expect(markReadSpy).toHaveBeenCalledWith("recipient-1");
  });

  it("shows the next page when there are more than ten notifications", () => {
    querySpy.mockReturnValue({
      data: { data: [item], meta: { total: 11 } },
      isLoading: false,
      isError: false,
    });

    renderWithProviders(<NotificationsPage />);

    fireEvent.click(
      within(screen.getByRole("navigation", { name: "Phân trang" })).getByRole(
        "button",
        { name: /page 2$/ },
      ),
    );
    expect(querySpy).toHaveBeenLastCalledWith({ page: 2, per_page: 10 });
  });
});
