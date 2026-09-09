import Cookies from "js-cookie";
import type { StateStorage } from "zustand/middleware";

const COOKIE_OPTIONS: Cookies.CookieAttributes = {
  // 1 ngày, không phải 7: cookie này chứa hồ sơ người dùng (không phải token)
  // và js-cookie không đặt được HttpOnly, nên rút ngắn cửa sổ lộ trên máy
  // dùng chung nếu người dùng đóng trình duyệt mà không bấm Đăng xuất.
  // Phiên đăng nhập thật vẫn dài hơn — refresh cookie HttpOnly của BE mới là
  // nguồn khôi phục phiên; mất cookie này chỉ tốn một lượt /auth/me.
  expires: 1,
  sameSite: "Lax",
  // Chỉ gửi qua HTTPS khi đang chạy production (https)
  secure:
    typeof window !== "undefined" && window.location.protocol === "https:",
  path: "/",
};

/**
 * Adapter cho zustand `persist` để lưu state vào cookie thay vì localStorage.
 * Lưu ý: cookie giới hạn ~4KB nên chỉ dùng cho dữ liệu nhỏ (token, user...).
 */
export const cookieStorage: StateStorage = {
  getItem: (name) => Cookies.get(name) ?? null,
  setItem: (name, value) => {
    Cookies.set(name, value, COOKIE_OPTIONS);
  },
  removeItem: (name) => {
    Cookies.remove(name, { path: "/" });
  },
};
