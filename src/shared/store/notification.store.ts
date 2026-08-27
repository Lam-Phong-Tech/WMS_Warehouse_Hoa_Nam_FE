import { create } from "zustand";

interface NotificationState {
  unreadCount: number;
  isConnected: boolean;
  isDropdownOpen: boolean;
  setUnreadCount: (count: number) => void;
  increment: () => void;
  setConnected: (connected: boolean) => void;
  setDropdownOpen: (open: boolean) => void;
  reset: () => void;
}

/**
 * State kết nối/badge tức thời — KHÔNG persist (khác auth.store): số chưa đọc
 * luôn lấy mới từ BE qua GET /notifications/unread-count sau khi đăng nhập/F5,
 * persist ở đây chỉ gây lệch số khi có thiết bị khác đọc hộ trong lúc offline.
 */
export const useNotificationStore = create<NotificationState>((set) => ({
  unreadCount: 0,
  isConnected: false,
  isDropdownOpen: false,
  setUnreadCount: (count) => set({ unreadCount: Math.max(0, count) }),
  increment: () => set((state) => ({ unreadCount: state.unreadCount + 1 })),
  setConnected: (connected) => set({ isConnected: connected }),
  setDropdownOpen: (open) => set({ isDropdownOpen: open }),
  reset: () =>
    set({ unreadCount: 0, isConnected: false, isDropdownOpen: false }),
}));
