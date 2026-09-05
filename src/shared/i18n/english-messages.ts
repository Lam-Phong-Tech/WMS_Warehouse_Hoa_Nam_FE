import { create } from "zustand";
import type { MessageTree } from "./messages";

/**
 * NẠP ĐỘNG từ điển tiếng Anh.
 *
 * VÌ SAO: `messages.ts` từng chứa cả hai ngôn ngữ (465 KB) và nằm trong đồ thị
 * tải-ngay, nên MỌI lần F5 — kể cả của người dùng tiếng Việt, tức gần như toàn
 * bộ nhân viên kho — đều phải tải và phân tích cả từ điển tiếng Anh. Tách ra rồi
 * chỉ nạp khi thật sự chọn tiếng Anh, đường tới hạn của mọi lần tải trang nhẹ đi
 * ~217 KB.
 *
 * AN TOÀN VỀ HIỂN THỊ: trong lúc chờ tải, `t()` rơi về tiếng Việt — đúng bằng
 * hành vi vốn có với những khoá chưa được dịch (`en` là bản phủ dần). Người dùng
 * KHÔNG bao giờ nhìn thấy khoá thô kiểu `topbar.searchTitle`.
 */
interface EnglishMessagesState {
  /** null = chưa nạp xong. Đọc qua `englishMessages()`, đừng đọc thẳng. */
  messages: MessageTree | null;
}

const useEnglishMessagesStore = create<EnglishMessagesState>(() => ({
  messages: null,
}));

let loading: Promise<void> | null = null;

/**
 * Bắt đầu nạp nếu chưa có. Idempotent và không bao giờ ném lỗi: hỏng mạng thì
 * app vẫn chạy bằng tiếng Việt, không có màn hình trắng.
 *
 * Trả về Promise để test (và nơi nào cần) chờ được bản dịch về; mã sản phẩm
 * không cần await — UI tự render lại qua useEnglishMessages().
 */
export function ensureEnglishMessages(): Promise<void> {
  if (useEnglishMessagesStore.getState().messages) return Promise.resolve();
  if (loading) return loading;

  loading = import("./messages.en")
    .then((module) => {
      useEnglishMessagesStore.setState({ messages: module.MESSAGES_EN });
    })
    .catch(() => {
      // Im lặng có chủ đích: thiếu bản dịch không phải lỗi chặn người dùng.
    })
    .finally(() => {
      loading = null;
    });

  return loading;
}

/** Bản dịch đã nạp, hoặc null khi chưa có. */
export function englishMessages(): MessageTree | null {
  return useEnglishMessagesStore.getState().messages;
}

/**
 * Hook để component render lại đúng một lần khi bản dịch về tới nơi. Không có nó
 * thì người vừa bấm sang tiếng Anh sẽ kẹt ở tiếng Việt cho tới lần render sau.
 */
export function useEnglishMessages(): MessageTree | null {
  return useEnglishMessagesStore((state) => state.messages);
}

/** Chỉ dùng cho test. */
export function __resetEnglishMessages(): void {
  useEnglishMessagesStore.setState({ messages: null });
  loading = null;
}
