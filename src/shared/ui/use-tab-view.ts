import { useCallback, useState, useTransition } from "react";

/**
 * CHUYỂN TAB KHÔNG KHOÁ LUỒNG CHÍNH.
 *
 * Vấn đề đo được: một cú bấm tab trong màn báo cáo dựng lại toàn bộ panel (bảng
 * vài nghìn ô, biểu đồ, KPI) NGAY TRONG tác vụ của cú bấm, ở mức ưu tiên GẤP.
 * Trình duyệt không kịp vẽ khung hình nào cho tới khi render xong, nên INP —
 * thời gian từ lúc bấm tới khung hình kế tiếp — bằng đúng thời gian dựng panel.
 *
 * Cách sửa KHÔNG phải là "làm panel nhẹ đi" (đã làm ở lớp cửa sổ vẽ) mà là tách
 * hai việc vốn có hai mức khẩn khác nhau:
 *
 *   · `shown` — tab nào đang sáng. Đổi ở mức GẤP, chỉ vẽ lại thanh tab (vài chục
 *     node). Người dùng thấy phản hồi ngay ở khung hình kế tiếp.
 *   · `view`  — panel nào được dựng. Đổi trong `startTransition`, tức React được
 *     phép cắt nhỏ và nhường luồng chính cho cuộn/gõ/bấm tiếp.
 *
 * Cả hai chốt lại trong CÙNG một lần commit của transition (`setPending(null)`
 * nằm trong transition), nên không có khung hình nào tab sáng một đằng panel một
 * nẻo sau khi đã xong.
 *
 * `isPending` để màn hình muốn có thể làm mờ panel cũ trong lúc chờ; không dùng
 * cũng không sao.
 */
export interface TabView<T> {
  /** Giá trị đang được DỰNG (panel đọc giá trị này). */
  readonly view: T;
  /** Giá trị người dùng vừa chọn — dùng cho aria-selected/class của thanh tab. */
  readonly shown: T;
  /** Chọn tab. Dùng cho cả cú bấm lẫn lệnh đặt lại trong mã. */
  readonly select: (next: T) => void;
  /** Panel đang được dựng ở nền. */
  readonly isPending: boolean;
}

export function useTabView<T>(initial: T): TabView<T> {
  const [committed, setCommitted] = useState<T>(initial);
  const [pending, setPending] = useState<T | null>(null);
  const [isPending, startTransition] = useTransition();

  const select = useCallback((next: T) => {
    // GẤP: thanh tab sáng ngay ở khung hình kế tiếp.
    setPending(next);
    // KHÔNG GẤP: panel nặng dựng ở nền, React nhường luồng chính khi cần.
    startTransition(() => {
      setCommitted(next);
      setPending(null);
    });
  }, []);

  return {
    view: committed,
    shown: pending ?? committed,
    select,
    isPending,
  };
}
