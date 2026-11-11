import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { ensureEnglishMessages } from "@/shared/i18n/english-messages";
import { ensureChineseMessages } from "@/shared/i18n/chinese-messages";
import { useLanguageStore } from "@/shared/i18n/language.store";
import { translate } from "@/shared/i18n/useT";
import type { NotificationItem } from "../types/notification.types";
import { localizeNotification, useNotificationText } from "./notification-text";

const item: NotificationItem = {
  id: "recipient-1",
  notification_id: "notification-1",
  event_key: "outbound.posted",
  title: "Đã hoàn tất xuất kho",
  body: "Phiếu xuất PX-20261105-ABC đã Post Issue thành công; tồn kho đã được trừ.",
  severity: "info",
  source_module: "warehouse",
  subject_type: "stock_document",
  subject_id: "doc-1",
  actor_id: "user-1",
  actor_name: "Nguyễn Văn A",
  payload: { doc_no: "PX-20261105-ABC" },
  read_at: null,
  created_at: "2026-11-05T10:00:00+07:00",
};
beforeAll(async () => {
  await Promise.all([ensureEnglishMessages(), ensureChineseMessages()]);
});
afterEach(() => {
  act(() => useLanguageStore.setState({ language: "vi" }));
});
describe("notification content locale", () => {
  it("shows a localized access-denied message and ignores revoked payload", () => {
    const denied = { ...item, content_access: "DENIED" as const };
    const vi = localizeNotification(
      denied,
      "vi",
      (key: Parameters<typeof translate>[1]) => translate("vi", key),
    );
    expect(vi).toEqual({
      title: "Không còn quyền xem nội dung",
      body: "Bạn không còn quyền xem nội dung thông báo này.",
    });
    const en = localizeNotification(
      denied,
      "en",
      (key: Parameters<typeof translate>[1]) => translate("en", key),
    );
    expect(en.title).toBe("Content access revoked");
    expect(en.body).not.toContain("PX-20261105-ABC");
  });

  it("việt hóa 'case' thành 'ca' cho thông báo bảo hành đã lưu", () => {
    const t = (key: Parameters<typeof translate>[1]) => translate("vi", key);
    const created = localizeNotification(
      {
        ...item,
        event_key: "warranty.case_created",
        title: "Đã tiếp nhận case bảo hành mới",
        body: "Case bảo hành WC-01 vừa được tiếp nhận.",
        payload: null,
      },
      "vi",
      t,
    );
    expect(created.title).toBe("Đã tiếp nhận ca bảo hành mới");
    expect(created.body).toBe("Ca bảo hành WC-01 vừa được tiếp nhận.");

    const status = localizeNotification(
      {
        ...item,
        event_key: "warranty.status_changed",
        title: "Case bảo hành đổi trạng thái",
        body: "Case bảo hành chuyển từ RECEIVED sang CHECKING.",
        payload: null,
      },
      "vi",
      t,
    );
    expect(status.title).toBe("Ca bảo hành đổi trạng thái");
    expect(status.body).toBe(
      "Ca bảo hành chuyển từ Đã tiếp nhận sang Đang kiểm tra.",
    );
  });

  it("việt hóa Post/reversal/movement và mã trạng thái còn sót trong thông báo hệ thống", () => {
    const t = (
      key: Parameters<typeof translate>[1],
      vars?: Parameters<typeof translate>[2],
    ) => translate("vi", key, vars);

    const posted = localizeNotification(
      {
        ...item,
        event_key: "reversal.posted",
        title: "Đã Post điều chỉnh tồn kho",
        body: "Reversal REV-20261112044401-KBGXSA đã Post; movement điều chỉnh đã ghi.",
        payload: { doc_no: "REV-20261112044401-KBGXSA" },
      },
      "vi",
      t,
    );
    expect(posted.title).toBe("Đã ghi nhận điều chỉnh tồn kho");
    expect(posted.body).toBe(
      "Phiếu điều chỉnh REV-20261112044401-KBGXSA đã ghi nhận; biến động điều chỉnh đã ghi.",
    );

    const created = localizeNotification(
      {
        ...item,
        event_key: "reversal.created",
        title: "Đã tạo phiếu điều chỉnh (reversal)",
        body: "Reversal REV-20261112044401-KBGXSA đang chờ xác nhận hàng vật lý quay lại kho.",
        payload: { doc_no: "REV-20261112044401-KBGXSA" },
      },
      "vi",
      t,
    );
    expect(created.title).toBe("Đã tạo phiếu điều chỉnh");
    expect(created.body).toBe(
      "Phiếu điều chỉnh REV-20261112044401-KBGXSA đang chờ xác nhận hàng vật lý quay lại kho.",
    );

    // Bản BE cũ không bọc "(reversal)" mà nối thẳng vào tiêu đề.
    expect(
      localizeNotification(
        {
          ...item,
          event_key: "reversal.created",
          title: "Đã tạo phiếu điều chỉnh reversal",
          body: "Reversal REV-2 đang chờ xác nhận.",
          payload: { doc_no: "REV-2" },
        },
        "vi",
        t,
      ).title,
    ).toBe("Đã tạo phiếu điều chỉnh");

    for (const [from, to, expected] of [
      ["REPAIRING", "COMPLETED", "Đang sửa chữa sang Hoàn tất"],
      ["CHECKING", "REPAIRING", "Đang kiểm tra sang Đang sửa chữa"],
      ["RECEIVED", "CHECKING", "Đã tiếp nhận sang Đang kiểm tra"],
    ] as const) {
      const status = localizeNotification(
        {
          ...item,
          event_key: "warranty.status_changed",
          title: "Ca bảo hành đổi trạng thái",
          body: `Ca bảo hành chuyển từ ${from} sang ${to}.`,
          payload: null,
        },
        "vi",
        t,
      );
      expect(status.body).toBe(`Ca bảo hành chuyển từ ${expected}.`);
      expect(status.body).not.toMatch(/\b[A-Z]{3,}\b/);
    }
  });

  it("việt hóa Post Issue / Post Receipt trong thông báo hệ thống đã lưu", () => {
    const t = (key: Parameters<typeof translate>[1]) => translate("vi", key);
    const outbound = localizeNotification(item, "vi", t);
    expect(outbound.body).toBe(
      "Phiếu xuất PX-20261105-ABC đã ghi nhận xuất kho thành công; tồn kho đã được trừ.",
    );
    expect(outbound.body).not.toMatch(/Post Issue/);

    const inbound = localizeNotification(
      {
        ...item,
        event_key: "inbound.completed",
        title: "Đã hoàn tất nhập kho",
        body: "Phiếu nhập PN-TEST-01 đã Post Receipt thành công.",
      },
      "vi",
      t,
    );
    expect(inbound.body).toBe(
      "Phiếu nhập PN-TEST-01 đã ghi nhận nhập kho thành công.",
    );
    expect(inbound.body).not.toMatch(/Post Receipt/);

    // Tin tự soạn không bị thay chữ.
    const custom = localizeNotification(
      { ...item, event_key: "custom.message" },
      "vi",
      t,
    );
    expect(custom.body).toBe(item.body);
  });

  it("translates the same cached notification immediately when switching VI → EN → ZH", () => {
    useLanguageStore.setState({ language: "vi" });
    const { result } = renderHook(() => useNotificationText()(item));
    expect(result.current.title).toBe(item.title);
    act(() => useLanguageStore.setState({ language: "en" }));
    expect(result.current.title).toBe("Outbound completed");
    expect(result.current.body).toContain("PX-20261105-ABC");
    expect(result.current.body).not.toMatch(/Phiếu|đã|kho/);
    act(() => useLanguageStore.setState({ language: "zh" }));
    expect(result.current.title).toBe("出库已完成");
    expect(result.current.body).toContain("PX-20261105-ABC");
    expect(item.title).toBe("Đã hoàn tất xuất kho");
    expect(item.actor_name).toBe("Nguyễn Văn A");
  });
  it.each(["en", "zh"] as const)(
    "localizes stock lifecycle notifications in %s",
    (language) => {
      for (const event_key of [
        "inbound.created",
        "inbound.scan_started",
        "inbound.completed",
        "inbound.cancelled",
        "outbound.created",
        "outbound.scan_started",
        "outbound.posted",
        "outbound.cancelled",
      ]) {
        const copy = localizeNotification(
          { ...item, event_key },
          language,
          (key, vars) => translate(language, key, vars),
        );
        expect(copy.title).not.toBe(item.title);
        expect(copy.body).toContain("PX-20261105-ABC");
        expect(copy.body).not.toMatch(/Phiếu|đã|thành công/);
        expect(copy.body).not.toMatch(/\{\w+\}/);
      }
    },
  );
  it("keeps custom events and Vietnamese content intact and resolves legacy document numbers", () => {
    const t = (
      key: Parameters<typeof translate>[1],
      vars?: Parameters<typeof translate>[2],
    ) => translate("en", key, vars);
    expect(
      localizeNotification({ ...item, event_key: "custom.message" }, "en", t),
    ).toEqual({ title: item.title, body: item.body });
    expect(
      localizeNotification({ ...item, event_key: "constructor" }, "en", t),
    ).toEqual({ title: item.title, body: item.body });
    expect(localizeNotification(item, "vi", t)).toEqual({
      title: item.title,
      body: "Phiếu xuất PX-20261105-ABC đã ghi nhận xuất kho thành công; tồn kho đã được trừ.",
    });
    expect(
      localizeNotification({ ...item, payload: null }, "en", t).body,
    ).toContain("PX-20261105-ABC");
    for (const [event_key, payload] of [
      ["user.account_changed", { action: "FUTURE_ACTION" }],
      ["security.alert_raised", { reason_code: "CUSTOM_REASON" }],
    ] as const) {
      expect(
        localizeNotification({ ...item, event_key, payload }, "en", t),
      ).toEqual({ title: item.title, body: item.body });
    }
    const security = localizeNotification(
      {
        ...item,
        event_key: "security.alert_raised",
        body: "Tài khoản nguyen van a bị từ chối đăng nhập vì đang ở trạng thái LOCKED.",
        payload: { reason_code: "LOGIN_DENIED", user_id: "internal-user-id" },
      },
      "en",
      t,
    );
    expect(security.body).toContain("nguyen van a");
    expect(security.body).toContain("Locked");
    expect(security.body).not.toContain("internal-user-id");
    for (const [body, code] of [
      ["Ca bảo hành WC-NEW-01 vừa được tiếp nhận.", "WC-NEW-01"],
      ["Case bảo hành WC-OLD-01 vừa được tiếp nhận.", "WC-OLD-01"],
    ] as const) {
      expect(
        localizeNotification(
          {
            ...item,
            event_key: "warranty.case_created",
            body,
            payload: null,
          },
          "en",
          t,
        ).body,
      ).toContain(code);
    }
  });
  it.each(["en", "zh"] as const)(
    "covers warranty, account, security and inventory events in %s",
    (language) => {
      const t = (
        key: Parameters<typeof translate>[1],
        vars?: Parameters<typeof translate>[2],
      ) => translate(language, key, vars);
      for (const [event_key, payload] of [
        [
          "inbound.sku_info_pending",
          { doc_no: "PN-1", sku_codes: ["SKU-1", "SKU-2"] },
        ],
        ["reversal.created", { reversal_no: "RV-1" }],
        ["reversal.posted", { doc_no: "RV-1" }],
        ["reversal.cancelled", { doc_no: "RV-1" }],
        [
          "stock.shortage_detected",
          { document_id: "doc-1", product_code: "SKU-1" },
        ],
        ["role.permissions_changed", { role_code: "WAREHOUSE" }],
        ["user.account_changed", { action: "CREATE" }],
        ["user.account_changed", { action: "UPDATE" }],
        ["user.account_changed", { action: "AUTO_LOCK" }],
        ["warranty.case_created", { case_code: "WC-1" }],
        [
          "warranty.status_changed",
          { from_status: "RECEIVED", to_status: "REPAIRING" },
        ],
        ["security.alert_raised", { reason_code: "LOGIN_THROTTLED" }],
        [
          "security.alert_raised",
          { reason_code: "LOGIN_DENIED", username: "admin", status: "LOCKED" },
        ],
      ] as const) {
        const copy = localizeNotification(
          { ...item, event_key, payload },
          language,
          t,
        );
        expect(copy.title).not.toBe(item.title);
        expect(copy.body).not.toMatch(/Phiếu|đã|thành công|\{\w+\}/);
        expect(copy.title).not.toContain("notifications.");
      }
      const copy = localizeNotification(
        {
          ...item,
          event_key: "warranty.status_changed",
          payload: { from_status: "RECEIVED", to_status: "REPAIRING" },
        },
        language,
        t,
      );
      expect(copy.body).not.toMatch(/RECEIVED|REPAIRING/);
    },
  );
});
