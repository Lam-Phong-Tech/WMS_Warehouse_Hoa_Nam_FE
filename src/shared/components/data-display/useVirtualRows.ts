import { useCallback, useEffect, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";

/**
 * Cửa sổ CUỘN ẢO cho bảng nhận trọn tập dữ liệu lớn.
 *
 * VÌ SAO CẦN, DÙ ĐÃ CÓ `useRenderWindow`
 * `useRenderWindow` nới dần phần được vẽ và dựa vào một sentinel
 * (`useAutoLoadMore`) để biết "người đọc đã cuộn tới đáy". Sentinel đó nằm
 * NGOÀI khung cuộn khi bảng bật `maxBodyHeight` — xem ResponsiveDataTable: nó
 * là phần tử anh em ĐỨNG SAU hộp `overflowY: auto`. Hệ quả đo được (bàn đo
 * scripts/perf/bench, 5.956 dòng, viewport 1440×900):
 *
 *   · sentinel nhìn thấy được ngay từ lúc mount ⇒ IntersectionObserver bắn ĐÚNG
 *     MỘT lần ⇒ cửa sổ nhảy 60 → 120 dòng rồi ĐỨNG YÊN;
 *   · cuộn trong khung bảng không đổi trạng thái giao nhau của sentinel nên
 *     không có lần bắn thứ hai — cuộn tới đáy vẫn chỉ có 120/5.956 dòng;
 *   · gõ rồi xoá bộ lọc làm `rows` đổi tham chiếu ⇒ hook đặt lại về 60 dòng,
 *     nhưng effect của sentinel không chạy lại (deps `[hasMore, showMore]`
 *     không đổi) nên bảng KẸT ở 60/5.956 dòng.
 *
 * Tức là với các bảng báo cáo lớn, phần lớn dữ liệu chỉ tới được bằng cách bấm
 * "Hiện thêm" hàng chục lần. Cuộn ảo xoá hẳn lớp lỗi đó: thanh cuộn phản ánh
 * ĐỦ tập ngay từ đầu, mọi dòng tới được bằng cuộn, và số phần tử DOM không phụ
 * thuộc số dòng.
 *
 * CHIỀU CAO DÒNG KHÔNG ĐỀU
 * Ghi chú cũ ở `useRenderWindow` từ chối cuộn ảo vì "chiều cao dòng không đều".
 * Điều đó đúng với cuộn ảo chiều cao CỐ ĐỊNH. `@tanstack/react-virtual` đo
 * chiều cao THẬT của từng dòng sau khi vẽ (`measureElement`) nên ô hai tầng,
 * badge hay chữ xuống dòng đều được tính đúng; `estimateSize` chỉ là ước lượng
 * ban đầu cho các dòng chưa từng hiện ra.
 *
 * PHẠM VI ÁP DỤNG (cố ý hẹp)
 * Chỉ dùng cho bảng desktop có KHUNG CUỘN RIÊNG (`maxBodyHeight`). Bảng cuộn
 * theo cả trang giữ nguyên `useRenderWindow`: ở đó sentinel hoạt động đúng vì
 * nó cùng nằm trong dòng chảy cuộn của trang.
 *
 * KHÔNG TRẢ RA REF
 * Hook nhận `getScroller` (một callback) thay vì tự giữ ref, và trả về
 * `measureRow` như một hàm rời. Lý do giống hệt ghi chú ở `useRenderWindow`:
 * React Compiler coi mọi giá trị chảy vào `ref={...}` là ref, nên trộn ref với
 * giá trị đọc lúc render trong CÙNG một object sẽ làm cả object bị luật
 * `react-hooks/refs` chặn.
 */

/** Bảng dưới ngưỡng này giữ nguyên đường cũ — cuộn ảo không đáng chi phí. */
export const VIRTUAL_ROW_THRESHOLD = 150;

/**
 * Ước lượng chiều cao một dòng bảng (px) DÙNG TRƯỚC KHI đo được dòng thật đầu
 * tiên. Con số này chỉ là mồi: hook tự học lại từ dòng thật (xem learnedSize).
 */
const ESTIMATED_ROW_HEIGHT = 44;

/**
 * Số lần cho phép chỉnh lại ước lượng chiều cao dòng.
 *
 * Mỗi lần chỉnh phải gọi virtualizer.measure() để tính lại offset của các dòng
 * CHƯA đo, tức là một lượt dựng lại — cho phép vô hạn thì bảng có chiều cao dòng
 * lệch nhau sẽ chỉnh qua chỉnh lại không dừng. Hai lần là đủ để hội tụ về chiều
 * cao phổ biến; dòng lệch chuẩn vẫn được measureElement sửa RIÊNG từng dòng.
 */
const MAX_ESTIMATE_CORRECTIONS = 2;

/** Số dòng vẽ thêm ngoài khung nhìn ở mỗi đầu — chống trắng khi cuộn nhanh. */
const OVERSCAN = 8;

export type VirtualRowItem<T> = {
  row: T;
  index: number;
  /** Truyền vào `data-index` để `measureRow` biết đang đo dòng nào. */
  measureIndex: number;
};

export type VirtualRows<T> = {
  /** Có đang cuộn ảo hay không — `false` thì nơi gọi vẽ như trước. */
  enabled: boolean;
  /** Các dòng thực sự phải vẽ ở khung nhìn hiện tại. */
  items: VirtualRowItem<T>[];
  /** Chiều cao dòng đệm phía trên (px). */
  paddingTop: number;
  /** Chiều cao dòng đệm phía dưới (px). */
  paddingBottom: number;
  /** Gắn vào `ref` của mỗi `<tr>` thật để đo chiều cao sau khi vẽ. */
  measureRow: (node: HTMLElement | null) => void;
};

/**
 * @param rows       tập dòng ĐẦY ĐỦ đã sắp xếp/lọc (không cắt).
 * @param getScroller callback trả về phần tử có `overflow-y: auto`.
 * @param active     nơi gọi tự quyết định có đủ điều kiện cuộn ảo không
 *                   (desktop + có khung cuộn riêng). Hook vẫn tự tắt khi số
 *                   dòng dưới ngưỡng.
 */
export function useVirtualRows<T>(
  rows: T[],
  getScroller: () => HTMLElement | null,
  active: boolean,
): VirtualRows<T> {
  const enabled = active && rows.length > VIRTUAL_ROW_THRESHOLD;

  /**
   * CHIỀU CAO DÒNG TỰ HỌC — sửa đúng một lớp lỗi đã đo được.
   *
   * Ước lượng cứng 44px trong khi dòng thật cao 61px (bàn đo, bảng 9 cột) làm
   * getTotalSize() PHỒNG DẦN theo số dòng được đo: 5.956 × 44 = 262.064 px lúc
   * đầu, tiến tới 5.956 × 61 = 363.316 px khi cuộn. Người kéo thanh cuộn xuống
   * đáy vì thế đuổi theo một cái đáy đang chạy — đo được một tác vụ 1.128 ms
   * khoá luồng chính ở cuối bảng.
   *
   * Học chiều cao từ CHÍNH dòng đầu tiên đo được (thay vì ghim một hằng số) giữ
   * cho hook đúng ở mọi mật độ/chủ đề/bộ cột mà không ai phải chỉnh tay.
   */
  const learnedSize = useRef(ESTIMATED_ROW_HEIGHT);
  const corrections = useRef(0);

  const virtualizer = useVirtualizer({
    count: enabled ? rows.length : 0,
    getScrollElement: getScroller,
    estimateSize: () => learnedSize.current,
    overscan: OVERSCAN,
  });

  const measureElement = virtualizer.measureElement;
  const measure = virtualizer.measure;
  const measureRow = useCallback(
    (node: HTMLElement | null) => {
      measureElement(node);
      if (!node || corrections.current >= MAX_ESTIMATE_CORRECTIONS) return;
      const height = node.getBoundingClientRect().height;
      // Lệch dưới 2px là nhiễu làm tròn — không đáng một lượt tính lại.
      if (height <= 0 || Math.abs(height - learnedSize.current) < 2) return;
      learnedSize.current = height;
      corrections.current += 1;
      // Tính lại offset của các dòng chưa đo theo ước lượng mới; dòng đã đo sẽ
      // được measureElement đo lại ở lượt dựng kế tiếp.
      measure();
    },
    [measureElement, measure],
  );

  /**
   * Đổi bộ lọc/sắp xếp là một tập dòng KHÁC ⇒ phải quay về đầu bảng, cùng ngữ
   * nghĩa với `useEffect` đặt lại `shown` trong `useRenderWindow`. Không làm thì
   * người vừa lọc còn 3 dòng vẫn đang đứng ở offset của 5.956 dòng trước đó và
   * nhìn thấy một bảng trắng.
   *
   * Mốc theo CHÍNH mảng `rows`: nó chỉ đổi tham chiếu khi dữ liệu/bộ lọc/sắp
   * xếp đổi. Lần chạy đầu tiên (mount) cũng gọi `scrollToOffset(0)` — vô hại vì
   * khung cuộn vốn đang ở 0.
   */
  const scrollToOffset = virtualizer.scrollToOffset;
  const previousRows = useRef<T[] | null>(null);
  useEffect(() => {
    if (!enabled) return;
    if (previousRows.current === rows) return;
    previousRows.current = rows;
    const scroller = getScroller();
    if (scroller) scroller.scrollTop = 0;
    scrollToOffset(0);
    // `getScroller` là ref callback ổn định của nơi gọi; đưa vào deps sẽ buộc
    // nơi gọi phải memo hoá thêm một lớp mà không đổi hành vi.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, enabled, scrollToOffset]);

  if (!enabled) {
    return {
      enabled: false,
      items: [],
      paddingTop: 0,
      paddingBottom: 0,
      measureRow,
    };
  }

  const virtualItems = virtualizer.getVirtualItems();

  /**
   * LƯỚI AN TOÀN: khung cuộn chưa có chiều cao thật thì virtualizer không biết
   * phải vẽ dòng nào và trả về danh sách RỖNG.
   *
   * Chuyện này xảy ra thật, không chỉ trong test:
   *  · lượt dựng ĐẦU TIÊN — `ref` chưa gắn nên `getScrollElement()` còn null;
   *  · trang đang bị giữ sống ẩn đi bằng `<Activity mode="hidden">` (nhóm báo
   *    cáo, xem KeepAliveOutlet) — nội dung ẩn không có bố cục;
   *  · môi trường không có bố cục (jsdom trong unit test).
   *
   * Trả `enabled: false` ở những lúc đó để nơi gọi vẽ theo đường
   * `useRenderWindow` cũ, thay vì hiện một bảng TRỐNG. Khi khung cuộn đo được,
   * ResizeObserver của virtualizer báo lại và bảng chuyển sang cuộn ảo.
   */
  if (virtualItems.length === 0) {
    return {
      enabled: false,
      items: [],
      paddingTop: 0,
      paddingBottom: 0,
      measureRow,
    };
  }

  const totalSize = virtualizer.getTotalSize();
  const first = virtualItems[0];
  const last = virtualItems[virtualItems.length - 1];

  return {
    enabled: true,
    items: virtualItems.map((item) => ({
      row: rows[item.index],
      index: item.index,
      measureIndex: item.index,
    })),
    paddingTop: first ? first.start : 0,
    paddingBottom: last ? Math.max(0, totalSize - last.end) : 0,
    measureRow,
  };
}
