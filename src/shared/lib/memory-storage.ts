/**
 * Memory-only storage cho token - không persist vào cookie/localStorage.
 * Token chỉ tồn tại trong memory của browser session, mất khi F5/đóng tab.
 * Giảm thiểu rủi ro XSS so với cookie storage.
 */

// Lưu token trong biến toàn cục (memory-only)
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
