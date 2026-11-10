import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const toast = vi.hoisted(() => ({
  info: vi.fn(),
  warning: vi.fn(),
  error: vi.fn(),
}));

vi.mock("sonner", () => ({ toast }));

import {
  claimUndeliveredNotifications,
  isNotificationEnabled,
  notificationCategory,
  notificationToastType,
  showNotificationToasts,
} from "./notification-toast";
import type { NotificationItem } from "../types/notification.types";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";

const item = (id: string, overrides: Partial<NotificationItem> = {}) =>
  ({
    id,
    notification_id: id,
    event_key: "stock.adjusted",
    title: "Stock changed",
    body: "Review the document",
    severity: "info",
    source_module: "inventory",
    subject_type: null,
    subject_id: null,
    actor_id: null,
    actor_name: null,
    payload: null,
    read_at: null,
    created_at: "2026-11-10T00:00:00Z",
    ...overrides,
  }) as NotificationItem;

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  useLanguageStore.setState({ language: "vi" });
});

describe("in-app notification toast batching", () => {
  it("shows at most three individual toasts and one summary for a burst", () => {
    const items = Array.from({ length: 50 }, (_, index) =>
      item(`burst-${index}`, {
        title: `Notification ${index}`,
        severity: index === 0 ? "critical" : "info",
      }),
    );

    showNotificationToasts(items);

    expect(toast.error).toHaveBeenCalledTimes(1);
    expect(toast.info).toHaveBeenCalledTimes(3);
    expect(toast.info).toHaveBeenLastCalledWith(
      "47 thông báo mới",
      expect.objectContaining({
        description: "Mở chuông thông báo để xem chi tiết.",
      }),
    );
  });

  it("does not show a summary when individual toasts cover the whole batch", () => {
    showNotificationToasts([item("small-1"), item("small-2")]);

    expect(toast.info).toHaveBeenCalledTimes(2);
    expect(toast.info).not.toHaveBeenCalledWith(
      expect.stringContaining("thông báo mới"),
      expect.anything(),
    );
  });

  it("claims each notification id once across batches", () => {
    const first = claimUndeliveredNotifications([
      item("duplicate"),
      item("duplicate"),
      item("unique"),
    ]);
    const second = claimUndeliveredNotifications([item("duplicate")]);

    expect(first.map((entry) => entry.id)).toEqual(["duplicate", "unique"]);
    expect(second).toEqual([]);
  });

  it("uses the current locale for toast text", async () => {
    await ensureEnglishMessages();
    useLanguageStore.setState({ language: "en" });
    showNotificationToasts([
      item("localized", {
        event_key: "outbound.posted",
        source_module: "outbound",
        payload: { doc_no: "PX-LOCALE-1" },
      }),
    ]);

    expect(toast.info).toHaveBeenLastCalledWith(
      "Outbound completed",
      expect.objectContaining({
        description: expect.stringContaining("PX-LOCALE-1"),
      }),
    );
  });
});

describe("notification delivery rules", () => {
  it.each([
    ["info", "info"],
    ["warning", "warning"],
    ["critical", "error"],
  ] as const)("maps %s to the %s toast type", (severity, expected) => {
    expect(notificationToastType(item(`severity-${severity}`, { severity }))).toBe(
      expected,
    );
  });

  it("honors optional in-app categories and keeps account mandatory", () => {
    const preferences = {
      inventory: { in_app: false, email: false },
      account: { in_app: false, email: false },
    };

    expect(
      isNotificationEnabled(
        item("optional", {
          event_key: "stock.adjusted",
          source_module: "inventory",
        }),
        preferences,
      ),
    ).toBe(false);
    expect(
      isNotificationEnabled(
        item("mandatory", {
          event_key: "security.changed",
          source_module: "auth",
        }),
        preferences,
      ),
    ).toBe(true);
    expect(
      isNotificationEnabled(
        item("unknown", {
          event_key: "unknown.event",
          source_module: "other",
        }),
        preferences,
      ),
    ).toBe(true);
  });

  it("matches backend categories without promoting unknown events to security", () => {
    expect(notificationCategory("outbound.posted", "outbound")).toBe(
      "stock_documents",
    );
    expect(notificationCategory("warranty.updated", "warranty")).toBe(
      "warranty",
    );
    expect(notificationCategory("unknown.event", "other")).toBeNull();
  });
});
