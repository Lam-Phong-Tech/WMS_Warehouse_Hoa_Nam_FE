import Cookies from "js-cookie";
import type { StateStorage } from "zustand/middleware";

const COOKIE_OPTIONS: Cookies.CookieAttributes = {
  expires: 7, // số ngày cookie tồn tại
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
