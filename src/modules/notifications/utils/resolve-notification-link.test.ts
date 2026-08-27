import { describe, expect, it } from "vitest";
import { resolveNotificationLink } from "./resolve-notification-link";
import type { NotificationItem } from "@/modules/notifications/types/notification.types";

function makeItem(overrides: Partial<NotificationItem>): NotificationItem {
  return {
    id: "recip-1",
    notification_id: "notif-1",
    event_key: "inbound.completed",
    title: "t",
    body: "b",
    severity: "info",
    source_module: "warehouse",
    subject_type: "stock_document",
    subject_id: "doc-1",
    actor_id: null,
    actor_name: null,
    payload: null,
    read_at: null,
    created_at: "2026-08-27T00:00:00Z",
    ...overrides,
  };
}

describe("resolveNotificationLink", () => {
  it("maps inbound.* to inbound detail screen", () => {
    const link = resolveNotificationLink(
      makeItem({ event_key: "inbound.completed", subject_id: "doc-1" }),
    );
    expect(link).toEqual({
      path: "/inbound?screen=IN-03&id=doc-1",
      label: "Xem phiếu nhập",
    });
  });

  it("maps outbound.* to outbound detail screen", () => {
    const link = resolveNotificationLink(
      makeItem({ event_key: "outbound.posted", subject_id: "doc-2" }),
    );
    expect(link).toEqual({
      path: "/outbound?screen=OUT-02&id=doc-2",
      label: "Xem phiếu xuất",
    });
  });

  it("maps reversal.* to reversal detail screen", () => {
    const link = resolveNotificationLink(
      makeItem({ event_key: "reversal.posted", subject_id: "rev-1" }),
    );
    expect(link).toEqual({
      path: "/reverse?screen=REV-02&id=rev-1",
      label: "Xem phiếu điều chỉnh",
    });
  });

  it("maps warranty.* to warranty case detail screen", () => {
    const link = resolveNotificationLink(
      makeItem({ event_key: "warranty.case_created", subject_id: "case-1" }),
    );
    expect(link).toEqual({
      path: "/warranty?screen=WAR-03&id=case-1",
      label: "Xem case bảo hành",
    });
  });

  it("returns null for event types without an unambiguous target", () => {
    expect(
      resolveNotificationLink(
        makeItem({
          event_key: "role.permissions_changed",
          subject_type: "role",
        }),
      ),
    ).toBeNull();
    expect(
      resolveNotificationLink(
        makeItem({ event_key: "stock.shortage_detected" }),
      ),
    ).toBeNull();
  });

  it("returns null when subject_id is missing", () => {
    expect(
      resolveNotificationLink(
        makeItem({ event_key: "inbound.completed", subject_id: null }),
      ),
    ).toBeNull();
  });
});
