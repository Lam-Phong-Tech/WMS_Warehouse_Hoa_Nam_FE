import { afterEach, describe, expect, it, vi } from "vitest";
import {
  browserNotificationCategory,
  deliverBrowserNotification,
} from "./browser-notification";
import type { NotificationItem } from "../types/notification.types";

const item = (id: string, event_key = "stock.adjusted") =>
  ({
    id,
    event_key,
    source_module: "inventory",
    title: "Stock changed",
    body: "Review the document",
  }) as NotificationItem;
afterEach(() => vi.unstubAllGlobals());
describe("foreground browser notification delivery", () => {
  it("does not request permission or deliver when permission is denied", () => {
    const NotificationMock = Object.assign(vi.fn(), { permission: "denied" });
    vi.stubGlobal("Notification", NotificationMock);
    expect(deliverBrowserNotification(item("denied"))).toBe(false);
    expect(NotificationMock).not.toHaveBeenCalled();
  });
  it("honors optional categories, keeps security mandatory, and deduplicates events", () => {
    const NotificationMock = Object.assign(
      vi.fn(function () {}),
      { permission: "granted" },
    );
    vi.stubGlobal("Notification", NotificationMock);
    const preferences = {
      inventory: { in_app: false, email: false },
      account: { in_app: false, email: false },
    };
    expect(deliverBrowserNotification(item("optional"), preferences)).toBe(
      false,
    );
    expect(
      deliverBrowserNotification(
        item("mandatory", "security.changed"),
        preferences,
      ),
    ).toBe(true);
    expect(
      deliverBrowserNotification(
        item("mandatory", "security.changed"),
        preferences,
      ),
    ).toBe(false);
    expect(NotificationMock).toHaveBeenCalledTimes(1);
  });
  it("matches backend categories without promoting unknown events to security", () => {
    expect(browserNotificationCategory("outbound.posted", "outbound")).toBe(
      "stock_documents",
    );
    expect(browserNotificationCategory("warranty.updated", "warranty")).toBe(
      "warranty",
    );
    expect(browserNotificationCategory("unknown.event", "other")).toBeNull();
  });
});
