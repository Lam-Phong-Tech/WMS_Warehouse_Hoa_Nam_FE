/**
 * Vị trí của một dòng trong mảng đang hiển thị — tra bằng Map, KHÔNG quét mảng.
 *
 * Bảng trong dự án đánh số STT bằng `rows.indexOf(row)` ngay trong `render` của
 * cột. `render` chạy một lần cho MỖI dòng, nên `indexOf` biến việc đánh số thành
 * O(n²). Với bảng cắt trang 15–50 dòng thì không ai thấy; với bảng nhận TRỌN tập
 * đã lọc — sổ ledger của màn Truy vết hàng hoá là 5.956 dòng — đó là ~35 triệu
 * phép so sánh cho một lần render. Đo được: một lần gõ vào ô lọc của màn đó khoá
 * luồng chính 14.666 ms (xem docs/perf/), khớp với INP 14.696 ms người dùng báo.
 *
 * WeakMap khoá theo CHÍNH mảng dòng:
 *  - mảng chỉ đổi tham chiếu khi dữ liệu/bộ lọc/sắp xếp đổi, nên những lần render
 *    lại vì lý do khác (hover, đổi ngôn ngữ, resize) dùng lại bảng tra cũ;
 *  - entry tự biến mất khi không còn ai giữ mảng, không cần dọn thủ công.
 *
 * Trả `-1` cho dòng không thuộc mảng — giống hệt `indexOf`, để nơi gọi giữ
 * nguyên cách xử lý cũ.
 */
const cache = new WeakMap<readonly unknown[], Map<unknown, number>>();

export function rowIndexOf<T>(rows: readonly T[], row: T): number {
  let index = cache.get(rows);
  if (!index) {
    index = new Map<unknown, number>();
    for (let i = 0; i < rows.length; i += 1) {
      // Dòng trùng tham chiếu (hiếm, nhưng có thể xảy ra khi dữ liệu lặp) giữ
      // vị trí ĐẦU TIÊN — đúng ngữ nghĩa của indexOf.
      if (!index.has(rows[i])) index.set(rows[i], i);
    }
    cache.set(rows, index);
  }
  return index.get(row) ?? -1;
}

/**
 * Bản tra theo KHOÁ NGHIỆP VỤ, thay cho `rows.findIndex((x) => x.id === row.id)`.
 *
 * Dùng khi dòng đem đi tra KHÔNG chắc cùng tham chiếu với phần tử trong mảng
 * (vd. dòng lấy từ `detail` trong khi mảng là danh sách ngoài) — lúc đó
 * `rowIndexOf` sẽ trả -1 dù dòng đó thật sự có mặt. Ngữ nghĩa giữ nguyên
 * `findIndex`: khớp đầu tiên, không thấy trả -1.
 */
const keyedCache = new WeakMap<readonly unknown[], Map<unknown, number>>();

export function rowIndexOfBy<T>(
  rows: readonly T[],
  row: T,
  key: (row: T) => unknown,
): number {
  let index = keyedCache.get(rows);
  if (!index) {
    index = new Map<unknown, number>();
    for (let i = 0; i < rows.length; i += 1) {
      const value = key(rows[i]);
      if (!index.has(value)) index.set(value, i);
    }
    keyedCache.set(rows, index);
  }
  return index.get(key(row)) ?? -1;
}
