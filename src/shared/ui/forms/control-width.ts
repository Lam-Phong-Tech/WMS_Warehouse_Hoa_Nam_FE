/**
 * Bề rộng "vừa chữ" cho control lọc trên thanh công cụ.
 *
 * VÌ SAO CẦN: dropdown thường (MUI Select) tự nở theo nhãn đang hiện, còn ô
 * gõ-để-tìm (Autocomplete) thì KHÔNG — bề rộng của nó chỉ do `minWidth` quyết.
 * `UiSelect` lại tự đổi giữa hai dạng theo SỐ OPTION lấy từ API (xem
 * searchable-options.ts), nên một `minWidth` đo vừa cho dropdown lúc dev (danh
 * mục rỗng) cắt cụt placeholder thành "Bệnh/lỗi: Tất c…" ngay khi danh mục
 * bệnh/lỗi trên máy thật vượt 8 dòng. Ở đây tính thẳng từ chữ + phụ kiện của
 * control, để bề rộng đi theo nhãn chứ không theo con số đoán tay ở từng màn.
 */
import type { ReactNode } from "react";
import { TYPOGRAPHY } from "@/shared/ui/tokens";

/** Thang bề rộng dùng chung cho control lọc — mọi thanh lọc lấy ở đây. */
export const FILTER_WIDTH = {
  /** Ô "N / trang". */
  pageSize: 110,
  /**
   * Sàn cho dropdown lọc; nhãn dài hơn thì tự nới (fitSelectMinWidth). Đặt
   * vừa đủ để nhãn ngắn ("Loại: Tất cả") không cụt lủn, nhưng không đội bề
   * rộng toàn thanh công cụ lên tới mức xuống hàng sớm ở laptop 1600px.
   */
  select: 140,
  /**
   * Dropdown mà LỰA CHỌN (không phải placeholder) mới là chuỗi dài: mã + tên
   * lấy từ danh mục API, ví dụ "DEF-013 · Chập điện / cháy mô-tơ". Nhánh
   * gõ-để-tìm gắn menu đúng bằng bề rộng ô, nên ô hẹp là mỗi dòng menu gãy
   * làm 2–3 dòng. `fitSelectMinWidth` chỉ đo được placeholder nên những ô
   * này phải khai sàn rộng bằng tay.
   */
  selectWide: 320,
  /** Trần phần "tự nới" của dropdown — nhãn dài hơn nữa cắt bằng "…". */
  selectMax: 320,
  /** Ô tìm kiếm trên thanh công cụ (cùng cỡ với thanh lọc trong thẻ báo cáo). */
  search: 240,
  /**
   * Ô tìm kiếm có placeholder DÀI (liệt kê 3-4 tiêu chí, vd "Tìm mã / tên /
   * thị trường / khu vực" ≈ 317px chữ + đệm): 240px cắt cụt placeholder ngay
   * khi ô còn trống (UAT TC_UI_06). Màn nào placeholder ước lượng vượt ~240px
   * thì dùng nấc này qua TOOLBAR_SEARCH_WIDE_SX.
   */
  searchWide: 340,
  /**
   * Lịch chọn khoảng ngày (`UiVuexyDateRangePicker`) khi đứng trên thanh công
   * cụ `.toolbar` (flex) thay vì trong lưới ô lọc của thẻ báo cáo. Control là
   * hai ô cạnh nhau, mỗi ô chứa "Từ ngày · 07/09/2026" + icon lịch, nên hẹp
   * hơn ngưỡng này là ngày bị cắt thành "07/09/20…".
   */
  dateRange: 340,
  /**
   * Cột của lưới ô lọc trong thẻ báo cáo (FILTER_GRID_COLUMNS_SX). 250px đủ
   * cho nhãn dài nhất hiện có ("Tất cả trạng thái hoàn tác" ≈ 213px + phụ
   * kiện) nên không ô nào bị "…" ở bất kỳ bề rộng nào từ 1280px trở lên.
   */
  gridTrack: 250,
} as const;

/**
 * Lưới ô lọc của thẻ báo cáo: cột ĐỀU nhau, số cột tự tính theo bề rộng
 * (auto-fill). Thay cho lưới 12 cột cố định từ `xl` (1280px): ở laptop
 * 1280–1536 một ô 2/12 chỉ còn ~120–160px nên nhãn "Tất cả người thực hiện",
 * "Ngày tiếp nhận"… bị cắt, còn ở 1920 các ô lại bị kéo dài quá mức. Ô rộng
 * (khoảng ngày, ô tìm dài) chiếm 2 cột từ `md` — dưới đó mọi ô chiếm trọn hàng
 * để không bao giờ xin thêm cột ngầm (tràn ngang).
 */
export const FILTER_GRID_COLUMNS_SX = {
  xs: "1fr",
  sm: `repeat(auto-fill, minmax(${FILTER_WIDTH.gridTrack}px, 1fr))`,
} as const;

/** `gridColumn` cho một ô của lưới trên: `wide` = chiếm 2 cột từ `md`. */
export function filterGridColumnSx(wide: boolean) {
  return { xs: "1 / -1", md: wide ? "span 2" : "span 1" } as const;
}

/**
 * sx cho ô tìm kiếm trên thanh công cụ (`.toolbar` flex-wrap). Dùng `width`
 * chứ không phải min/max: lớp responsive dùng chung (hn-responsive.css) đè
 * min/max-width của control trong toolbar (0 / 100%) nhưng để nguyên `width`,
 * nên đây là cách duy nhất cho 12 màn danh sách cùng một cỡ ô tìm kiếm; dưới
 * 576px lớp đó ép `width: 100%` cho điện thoại.
 */
export const TOOLBAR_SEARCH_SX = {
  width: FILTER_WIDTH.search,
  maxWidth: "100%",
} as const;

/** Bản rộng của TOOLBAR_SEARCH_SX cho ô có placeholder dài (xem searchWide). */
export const TOOLBAR_SEARCH_WIDE_SX = {
  width: FILTER_WIDTH.searchWide,
  maxWidth: "100%",
} as const;

/** Padding hai bên + mũi tên của dropdown (đo thật trên bản dựng 07/09/2026). */
const SELECT_CHROME = 46;
/** Autocomplete: padding ngoài + nút mở menu + padding trong của <input>. */
const AUTOCOMPLETE_CHROME = 64;
/** Làm tròn lên bội số này cho các ô cạnh nhau không lệch lẻ vài px. */
const WIDTH_STEP = 4;

let canvasContext: CanvasRenderingContext2D | null | undefined;
const widthCache = new Map<string, number>();

function context(): CanvasRenderingContext2D | null {
  if (canvasContext !== undefined) return canvasContext;
  try {
    // jsdom (vitest) có HTMLCanvasElement nhưng getContext chưa cài đặt và in
    // cảnh báo ra console — dùng ước lượng thay vì gọi.
    const isJsdom =
      typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent);
    canvasContext =
      typeof document === "undefined" || isJsdom
        ? null
        : document.createElement("canvas").getContext("2d");
  } catch {
    canvasContext = null;
  }
  return canvasContext;
}

/** Ước lượng khi không có canvas: ~0,55em mỗi ký tự với Public Sans. */
function estimateTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * 0.55;
}

/** Bề rộng chữ (px) theo đúng font chữ body của app; có cache theo chuỗi. */
export function measureTextWidth(
  text: string,
  fontSize: number = TYPOGRAPHY.fontSizeBody,
  fontWeight = 400,
): number {
  const key = `${fontWeight}|${fontSize}|${text}`;
  const cached = widthCache.get(key);
  if (cached !== undefined) return cached;
  const ctx = context();
  let width = 0;
  if (ctx) {
    ctx.font = `${fontWeight} ${fontSize}px ${TYPOGRAPHY.fontFamily}`;
    width = ctx.measureText(text).width;
  }
  if (!(width > 0)) width = estimateTextWidth(text, fontSize);
  widthCache.set(key, width);
  return width;
}

/** Chỉ đo được nhãn dạng chuỗi/số; nhãn ReactNode (badge, icon) bỏ qua. */
export function measurableText(node: ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  return "";
}

/**
 * `minWidth` để control hiện đủ nhãn dài nhất trong `texts`.
 * - `floor`: minWidth màn hình khai (giữ nguyên nếu đã đủ rộng);
 * - phần "tự nới" bị chặn ở `max` — nhãn quá dài thì chấp nhận "…";
 * - `searchable`: Autocomplete có phụ kiện rộng hơn dropdown thường.
 */
export function fitSelectMinWidth({
  texts,
  floor,
  searchable,
  max = FILTER_WIDTH.selectMax,
}: {
  texts: ReadonlyArray<string>;
  floor: number;
  searchable: boolean;
  max?: number;
}): number {
  const chrome = searchable ? AUTOCOMPLETE_CHROME : SELECT_CHROME;
  const longest = texts
    .filter((text) => text.trim() !== "")
    .reduce((acc, text) => Math.max(acc, measureTextWidth(text)), 0);
  const needed =
    longest > 0 ? Math.ceil((longest + chrome) / WIDTH_STEP) * WIDTH_STEP : 0;
  return Math.max(floor, Math.min(max, needed));
}
