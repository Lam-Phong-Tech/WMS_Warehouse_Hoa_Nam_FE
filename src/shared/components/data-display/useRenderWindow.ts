import { useCallback, useEffect, useMemo, useRef, useState } from "react";

/**
 * Cửa sổ render tăng dần cho danh sách dài.
 *
 * VẤN ĐỀ CÓ THẬT, ĐÃ ĐO: màn Truy vết hàng hoá nhận TRỌN tập đã lọc (5.956 dòng
 * — xem ghi chú "KHÔNG gửi per_page" ở movement-trace-api.ts, đó là yêu cầu
 * nghiệp vụ: bảng, dòng thời gian và 4 thẻ KPI phải mô tả CÙNG một tập). Cả
 * 5.956 dòng được đổ thẳng vào DOM: 293.514 node, và MỘT lần gõ vào ô lọc khoá
 * luồng chính 14.666 ms. Người dùng báo INP 14.696 ms — cùng một sự việc.
 *
 * KHÔNG cắt trang phía server để chữa (sẽ phá đúng bất biến ở trên) và cũng
 * không cắt bớt DỮ LIỆU: mọi con số trên màn vẫn tính trên TOÀN BỘ tập. Chỉ cắt
 * phần ĐƯỢC VẼ RA — vẽ `chunk` dòng đầu, rồi nới thêm khi người đọc cuộn tới
 * cuối phần đang vẽ. Mọi dòng vẫn tới được bằng cách cuộn, thứ tự không đổi,
 * không thêm thư viện nào.
 *
 * Vì sao không virtual-scroll cổ điển: các bảng ở đây có chiều cao dòng KHÔNG
 * đều (ô xuống dòng, badge, ô hai tầng), nên virtual-scroll theo chiều cao cố
 * định sẽ nhảy giật. Nới dần giữ nguyên dòng chảy tài liệu nên không có lớp lỗi
 * đó.
 *
 * `total <= threshold` thì hook trả về NGUYÊN mảng và không có gì thay đổi —
 * đường đi của bảng nhỏ (đại đa số) giữ nguyên hành vi cũ.
 *
 * Hook này KHÔNG trả ra ref nào. Việc "cuộn tới đáy thì nới thêm" do
 * `useAutoLoadMore` lo, và hook đó sống trong chính component chân danh sách
 * (`WindowedMore` / `WindowedRowsFooter`). Tách như vậy vì React Compiler coi
 * MỌI giá trị chảy vào `ref={...}` là ref: chỉ cần một trường của object trả về
 * được gắn vào `ref`, mọi trường còn lại của cùng object bị báo lỗi
 * `react-hooks/refs` khi đọc trong lúc render.
 */
export type RenderWindow<T> = {
  /** Phần đang thực sự được vẽ. */
  visible: T[];
  /** Còn dòng chưa vẽ hay không. */
  hasMore: boolean;
  /** Tổng số dòng của tập đầy đủ (KHÔNG phải số đang vẽ). */
  total: number;
  /** Số dòng đang vẽ. */
  shown: number;
  /** Nới thêm một nhịp. */
  showMore: () => void;
};

export function useRenderWindow<T>(
  rows: T[],
  { chunk = 60, threshold = 150 }: { chunk?: number; threshold?: number } = {},
): RenderWindow<T> {
  const total = rows.length;
  const windowed = total > threshold;
  const [shown, setShown] = useState(chunk);

  // Đổi bộ lọc/sắp xếp là một tập dòng KHÁC — phải quay lại nhịp đầu, nếu không
  // người lọc còn 3 dòng vẫn đang giữ cửa sổ 3.000 dòng của lần trước.
  useEffect(() => {
    setShown(chunk);
  }, [rows, chunk]);

  const showMore = useCallback(() => {
    setShown((prev) => prev + chunk);
  }, [chunk]);

  const visible = useMemo(
    () => (windowed && shown < total ? rows.slice(0, shown) : rows),
    [rows, windowed, shown, total],
  );

  return {
    visible,
    hasMore: windowed && shown < total,
    total,
    shown: visible.length,
    showMore,
  };
}

/**
 * "Cuộn tới chân danh sách thì tự nới thêm."
 *
 * Trả về ref để gắn vào phần tử SENTINEL nằm ở cuối phần đang vẽ.
 * IntersectionObserver nên chạy đúng với cả khung cuộn riêng (`overflow:auto`)
 * lẫn cuộn của cả trang, không phải tự tính scrollTop cho từng trường hợp.
 *
 * Ref chỉ được ĐỌC trong effect, không đọc lúc render — đúng luật
 * `react-hooks/refs`.
 */
export function useAutoLoadMore(hasMore: boolean, showMore: () => void) {
  const sentinelRef = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!hasMore || !node || typeof IntersectionObserver === "undefined") {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) showMore();
      },
      // rootMargin: nới TRƯỚC khi chạm đáy để người đọc không thấy khựng.
      { rootMargin: "400px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMore, showMore]);

  return sentinelRef;
}
