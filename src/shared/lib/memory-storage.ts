/**
 * Memory-only storage cho ACCESS token - không persist vào cookie/localStorage.
 * Token chỉ tồn tại trong memory của browser session, mất khi F5/đóng tab.
 *
 * P1 bảo mật 10/09/2026: module này KHÔNG giữ refresh token. Trước đây nó có các
 * hàm lưu/đọc refresh token và FE gửi lại token 14 ngày đó trong body
 * `/auth/refresh` — một lỗi XSS là đủ để lấy nó mang đi dùng từ máy khác. Refresh
 * token nay chỉ nằm trong cookie HttpOnly do BE đặt: JavaScript không đọc, không
 * ghi, không gửi được nó. `src/test/sec-p1-refresh-token-out-of-js.test.ts` chặn
 * việc thêm lại.
 */

// Lưu access token trong biến toàn cục (memory-only)
let accessToken: string | null = null;

export const memoryStorage = {
  getItem: (): string | null => {
    return accessToken;
  },

  setItem: (value: string): void => {
    accessToken = value;
  },

  removeItem: (): void => {
    accessToken = null;
  },

  /**
   * Clear token ngay lập tức (dùng cho logout)
   */
  clear: (): void => {
    accessToken = null;
  },

  /**
   * Lấy token hiện tại
   */
  getToken: (): string | null => {
    return accessToken;
  },
};
