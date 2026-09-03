import { useMemo, useState } from "react";

/**
 * BỘ LỌC NẰM TRONG TỪNG KHỐI của 8 màn Báo cáo vận hành.
 *
 * VÌ SAO CÓ: các khối danh sách ("Đối chiếu từng SKU", "Sổ tồn kho biến động",
 * "Lịch sử Print / Reprint"…) cố ý đổ TRỌN tập dòng đã lọc — bảng, biểu đồ và
 * KPI của cùng một mục buộc phải mô tả CÙNG một tập (xem ghi chú đầu
 * `report-data.ts`). Hệ quả: một kỳ nhiều dữ liệu cho ra hàng trăm dòng trong
 * một khối, và bộ lọc Ở ĐẦU TRANG thì quá thô — đổi nó là đổi luôn KPI, chart
 * và mọi khối khác, trong khi việc người dùng đang làm chỉ là "tìm cái SKU này
 * trong đúng bảng này".
 *
 * Nên bộ lọc này CỐ Ý:
 *  · nằm ngay trong khối, ngay dưới tiêu đề khối;
 *  · chỉ thu hẹp TẦM NHÌN của riêng khối đó, KHÔNG gọi lại API và KHÔNG đụng
 *    tới KPI/chart — nếu không thì nó chỉ là bản sao của bộ lọc đầu trang;
 *  · luôn nói rõ "đang xem N / M dòng" để không ai đọc nhầm một tập đã lọc
 *    thành toàn bộ dữ liệu của kỳ.
 *
 * Dùng chung cho CẢ tám màn để 13 khối có cùng một cách lọc, thay vì mỗi màn
 * tự chế một thanh lọc riêng.
 */

export type SectionFilterOption = { value: string; label: string };

/** Một dropdown của thanh lọc trong khối. */
export type SectionFilterSelect<T> = {
  /** Khoá nội bộ, duy nhất trong một khối. */
  key: string;
  /** Nhãn hiển thị khi chưa chọn gì (đóng vai trò "Tất cả …"). */
  placeholder: string;
  /** Nhãn trợ năng của ô. Bỏ trống thì lấy `placeholder`. */
  ariaLabel?: string;
  /** Bề rộng tối thiểu (px). */
  minWidth?: number;
  /**
   * Danh sách lựa chọn. Truyền hàm để tự dựng từ chính dữ liệu đang có (vd
   * "Actor" liệt kê đúng những người xuất hiện trong khối).
   */
  options: SectionFilterOption[] | ((rows: T[]) => SectionFilterOption[]);
  /** Giữ lại dòng nào khi ô này đang chọn `value`. */
  match: (row: T, value: string) => boolean;
};

export type SectionFilterConfig<T> = {
  /**
   * Các chuỗi có thể tìm bằng từ khoá của một dòng. Trả về đúng những gì người
   * đọc THẤY trên dòng đó — tìm theo trường không hiển thị sẽ cho ra kết quả
   * mà người dùng không giải thích được vì sao khớp.
   */
  searchText?: (row: T) => Array<string | number | null | undefined>;
  searchPlaceholder?: string;
  searchAriaLabel?: string;
  searchWidth?: number | string;
  selects?: Array<SectionFilterSelect<T>>;
};

export type SectionFilterState<T> = {
  /** Tập dòng sau khi lọc — đây là thứ khối đem đi render. */
  rows: T[];
  /** Tổng số dòng TRƯỚC khi lọc, để nói "N / M". */
  total: number;
  keyword: string;
  setKeyword: (value: string) => void;
  values: Record<string, string>;
  setValue: (key: string, value: string) => void;
  /** Có ít nhất một điều kiện đang bật. */
  active: boolean;
  clear: () => void;
  config: SectionFilterConfig<T>;
  /** Lựa chọn đã giải xong (đã gọi hàm `options` nếu có) theo thứ tự khai báo. */
  resolvedSelects: Array<
    SectionFilterSelect<T> & { options: SectionFilterOption[] }
  >;
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .trim();
}

/**
 * Trạng thái + phép lọc của một khối. Lọc CHỈ chạy trên mảng đã truyền vào,
 * không gọi API: khối nào đang xem tập dòng nào thì lọc đúng tập đó.
 */
export function useSectionFilter<T>(
  rows: T[],
  config: SectionFilterConfig<T>,
): SectionFilterState<T> {
  const [keyword, setKeyword] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});

  const selects = useMemo(() => config.selects ?? [], [config.selects]);

  const resolvedSelects = useMemo(
    () =>
      selects.map((select) => ({
        ...select,
        options:
          typeof select.options === "function"
            ? select.options(rows)
            : select.options,
      })),
    [selects, rows],
  );

  const filtered = useMemo(() => {
    const needle = normalize(keyword);
    const activeSelects = selects.filter(
      (select) => (values[select.key] ?? "") !== "",
    );
    if (needle === "" && activeSelects.length === 0) return rows;

    return rows.filter((row) => {
      for (const select of activeSelects) {
        if (!select.match(row, values[select.key] as string)) return false;
      }
      if (needle === "") return true;
      const haystack = (config.searchText?.(row) ?? [])
        .map((part) => normalize(part))
        .join(" ");
      return haystack.includes(needle);
    });
  }, [rows, keyword, values, selects, config]);

  const active =
    keyword.trim() !== "" ||
    selects.some((select) => (values[select.key] ?? "") !== "");

  return {
    rows: filtered,
    total: rows.length,
    keyword,
    setKeyword,
    values,
    setValue: (key, value) => setValues((prev) => ({ ...prev, [key]: value })),
    active,
    clear: () => {
      setKeyword("");
      setValues({});
    },
    config,
    resolvedSelects,
  };
}

/**
 * Tiện ích dựng danh sách lựa chọn từ chính dữ liệu của khối: chỉ liệt kê giá
 * trị THẬT SỰ có mặt, sắp theo tiếng Việt. Nhờ vậy dropdown không bao giờ đưa
 * ra một lựa chọn cho ra 0 dòng.
 */
export function optionsFromRows<T>(
  rows: T[],
  pick: (row: T) => string | null | undefined,
  labelOf?: (value: string) => string,
): SectionFilterOption[] {
  const values = new Set<string>();
  for (const row of rows) {
    const value = pick(row);
    if (value !== null && value !== undefined && value !== "") {
      values.add(String(value));
    }
  }
  return [...values]
    .sort((a, b) => a.localeCompare(b, "vi"))
    .map((value) => ({ value, label: labelOf ? labelOf(value) : value }));
}
