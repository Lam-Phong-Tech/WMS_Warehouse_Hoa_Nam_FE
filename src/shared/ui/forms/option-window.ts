/**
 * Cửa sổ 5 dòng cho MỌI danh sách lựa chọn dài của app (SKU, đại lý/đối tượng
 * nhận, người dùng, kho…).
 *
 * Hai luật đi cùng nhau, cùng một lý do "đừng đổ cả danh mục ra màn hình":
 *
 * · NHÌN — hộp thả xuống cao đúng OPTION_VISIBLE_ROWS dòng. Danh sách vài trăm
 *   SKU mở ra che kín màn hình thì người dùng mất chỗ đứng, còn trên điện
 *   thoại nó đẩy trôi cả trang.
 * · DỰNG — chỉ mount OPTION_RENDER_CHUNK dòng đầu; cuộn tới đáy mới mount thêm
 *   một nhịp nữa. Mount 3.000 <li> trong một lượt làm khựng hẳn nhịp mở menu
 *   trong khi người dùng chỉ nhìn được 5 dòng.
 *
 * Cách chọn NHANH vẫn là gõ để tìm (xem `resolveSearchable`); cuộn chỉ dành
 * cho lúc lướt xem. Vì vậy chunk đặt lớn hơn nhiều so với 5: cuộn một quãng
 * ngắn không nên chạm đáy liên tục, mà 20 dòng thì dựng vẫn rẻ.
 *
 * VÌ SAO KHÔNG DÙNG `useRenderWindow` (@/shared/components/data-display): hook
 * đó dành cho bảng/lưới thẻ trong luồng tài liệu — nó nhả ra MẢNG đã cắt, đặt
 * lại theo identity của mảng, và chỉ cắt khi vượt 150 dòng. Dropdown cần ba thứ
 * ngược lại: (1) MUI Autocomplete tự lọc bên trong nên nơi gọi chỉ nhận được
 * một CON SỐ giới hạn chứ không phải mảng; (2) rất nhiều ô select dựng mảng
 * option ngay trong JSX nên mốc theo identity là đặt lại ở mọi lần render;
 * (3) hộp chỉ cao 5 dòng nên cắt từ dòng thứ 20 chứ không đợi tới 150.
 */
import { useCallback, useState } from "react";
import type { UIEvent } from "react";

/** Số dòng nhìn thấy khi mở danh sách — phần còn lại phải cuộn. */
export const OPTION_VISIBLE_ROWS = 5;

/**
 * Chiều cao một dòng (px). MUI ở desktop cho MenuItem/option của Autocomplete
 * padding 6px + line-height 24px = 36px; con số này chỉ dùng để TÍNH trần cao
 * của hộp nên lệch vài px cũng không sai nghĩa "khoảng 5 dòng".
 */
export const OPTION_ROW_HEIGHT = 36;

/** Trần cao của vùng cuộn chứa các dòng lựa chọn. */
export const OPTION_LIST_MAX_HEIGHT = OPTION_VISIBLE_ROWS * OPTION_ROW_HEIGHT;

/** Số dòng mount thêm mỗi lần cuộn chạm đáy. */
export const OPTION_RENDER_CHUNK = 20;

/** Còn cách đáy dưới ngần này px thì coi như đã chạm đáy. */
const SCROLL_TRIGGER_PX = 24;

export interface OptionWindow {
  /** Số dòng ĐƯỢC PHÉP dựng lúc này — cắt danh sách bằng `.slice(0, limit)`. */
  limit: number;
  /** Số dòng còn giấu (đã lọc nhưng chưa dựng). */
  hidden: number;
  /** Gắn vào vùng cuộn chứa danh sách. */
  onListScroll: (event: UIEvent<HTMLElement>) => void;
}

/**
 * Quản lý "đang cho dựng bao nhiêu dòng".
 *
 * `resetToken` là thứ khiến danh sách trở thành MỘT DANH SÁCH KHÁC dưới mắt
 * người dùng — từ khoá tìm kiếm, trạng thái đóng/mở của menu. Đổi token thì
 * quay về trang đầu, nếu không thì người gõ tìm sẽ thấy một cửa sổ đã cuộn sẵn
 * xuống giữa danh sách mới.
 *
 * Cố ý mốc theo `total` (số lượng) chứ KHÔNG theo identity của mảng options:
 * rất nhiều nơi gọi dựng mảng mới ngay trong JSX (`options.map(...)`), mốc
 * theo identity thì limit bị đặt lại ở mọi lần render và cuộn không bao giờ ăn.
 */
export function useOptionWindow(
  total: number,
  resetToken: string = "",
  chunk: number = OPTION_RENDER_CHUNK,
): OptionWindow {
  const key = `${total}|${resetToken}`;
  /**
   * Nhớ KÈM danh sách mà con số đó nói về. Đọc lại mà không cùng khoá thì coi
   * như vừa mở danh sách mới — không cần một effect chỉ để gọi setState (lối
   * đó sinh thêm một vòng render và bị hàng rào `set-state-in-effect` chặn).
   */
  const [grown, setGrown] = useState({ key, limit: chunk });
  const limit = grown.key === key ? grown.limit : chunk;

  const onListScroll = useCallback(
    (event: UIEvent<HTMLElement>) => {
      const element = event.currentTarget;
      const reachedBottom =
        element.scrollTop + element.clientHeight >=
        element.scrollHeight - SCROLL_TRIGGER_PX;
      if (!reachedBottom) return;
      setGrown((current) => {
        const at = current.key === key ? current.limit : chunk;
        if (at >= total)
          return current.key === key ? current : { key, limit: at };
        return { key, limit: at + chunk };
      });
    },
    [chunk, key, total],
  );

  return { limit, hidden: Math.max(0, total - limit), onListScroll };
}
