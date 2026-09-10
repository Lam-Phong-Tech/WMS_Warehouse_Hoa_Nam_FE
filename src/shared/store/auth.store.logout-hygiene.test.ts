import Cookies from "js-cookie";
import { beforeEach, describe, expect, it } from "vitest";

import { useAuthStore } from "@/shared/store/auth.store";

/**
 * WWHN-SEC-13 — vệ sinh khi Đăng xuất trên máy dùng chung giữa các ca:
 *
 * Trước đây chỉ nhánh 401 của axios interceptor gọi persist.clearStorage(),
 * còn bấm nút "Đăng xuất" thì cookie `erp-auth` (hồ sơ người dùng + contexts,
 * KHÔNG phải token nhưng là PII đọc được bằng JS) sống tiếp 7 ngày, và mọi
 * draft form (`erp_form_draft:*` — có thể chứa SĐT/địa chỉ khách gõ dở) nằm
 * lại localStorage cho ca sau đọc. Test này khoá hành vi dọn dẹp ở CHÍNH action
 * logout của store để cả hai đường (nút bấm lẫn 401) cùng sạch.
 */
describe("auth.store logout — vệ sinh máy dùng chung", () => {
  beforeEach(() => {
    window.localStorage.clear();
    Cookies.remove("erp-auth", { path: "/" });
  });

  it("logout xoá cookie erp-auth và toàn bộ draft form trong localStorage", () => {
    Cookies.set(
      "erp-auth",
      JSON.stringify({ state: { user: { name: "Ca sáng" } } }),
      {
        path: "/",
      },
    );
    window.localStorage.setItem(
      "erp_form_draft:org-unit-create",
      JSON.stringify({ customer_phone: "0912345678" }),
    );
    window.localStorage.setItem(
      "erp_form_draft:warranty-intake",
      JSON.stringify({ customer_address: "1 Phố Huế" }),
    );
    // Khoá KHÔNG thuộc prefix draft phải được giữ nguyên (vd. ngôn ngữ UI).
    window.localStorage.setItem("erp-language", "vi");

    useAuthStore.getState().logout();

    expect(Cookies.get("erp-auth")).toBeUndefined();
    expect(
      window.localStorage.getItem("erp_form_draft:org-unit-create"),
    ).toBeNull();
    expect(
      window.localStorage.getItem("erp_form_draft:warranty-intake"),
    ).toBeNull();
    expect(window.localStorage.getItem("erp-language")).toBe("vi");
  });
});
