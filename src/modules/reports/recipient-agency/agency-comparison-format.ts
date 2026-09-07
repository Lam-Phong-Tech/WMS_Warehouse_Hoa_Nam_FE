/**
 * Định dạng & token hình khối dùng chung của tab "So sánh đối tượng nhận hàng".
 *
 * Tách khỏi `agency-comparison-views.tsx` vì luật `react-refresh`: một file
 * `.tsx` chỉ được export component, nếu không hot-reload sẽ dựng lại sai. Đây
 * cũng là ranh giới đúng về nội dung — mấy hàm dưới đây thuần chuỗi/số, không
 * biết gì về React.
 */
import { RADIUS, SEMANTIC_LIGHT as S } from "@/shared/ui";
import { EMPTY_TEXT } from "@/shared/constants/display";
import { formatQuantity } from "@/shared/utils/format-number";

export const SURFACE_SX = {
  bgcolor: S.bgSurface,
  border: `1px solid ${S.border}`,
  borderRadius: `${RADIUS.card}px`,
  boxShadow: S.shadowCard,
  minWidth: 0,
} as const;

export function quantityText(value: number | null | undefined): string {
  return formatQuantity(Number.isFinite(Number(value)) ? Number(value) : null);
}

/**
 * "+18%" / "−12%" — DẤU luôn hiện, và là dấu trừ thật (U+2212) chứ không phải
 * gạch nối, để cột số không lẫn giữa "âm 12" và "12 gạch nối gì đó".
 *
 * `null` = kỳ trước không có phát sinh ⇒ trả ô rỗng chuẩn của dự án; nơi gọi
 * chịu trách nhiệm nói rõ "Chưa đủ dữ liệu" thay vì để người đọc tự suy.
 */
export function deltaText(delta: number | null): string {
  if (delta === null) return EMPTY_TEXT;
  const rounded = Math.round(Math.abs(delta) * 10) / 10;
  return `${delta >= 0 ? "+" : "−"}${formatQuantity(rounded)}%`;
}

/**
 * Định dạng lại các giá trị SỐ trong một câu nhận xét trước khi ghép chuỗi.
 *
 * `t()` chỉ `String(value)` nên "3440%" trong câu nhận xét đứng cạnh "+3.440%"
 * ở thẻ KPI — cùng một con số, hai cách viết, trong cùng một khung nhìn. Đưa
 * hết qua `formatQuantity` (bộ định dạng DUY NHẤT của dự án) để chỉ còn một
 * cách viết số trên cả màn.
 */
export function formatInsightValues<T extends Record<string, string | number>>(
  values: T,
): Record<string, string | number> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key,
      typeof value === "number" ? formatQuantity(value) : value,
    ]),
  );
}

/** Dưới 1% coi như đứng yên — không tô màu cho một dao động của làm tròn. */
export function deltaTone(
  delta: number | null,
): "success" | "error" | "neutral" {
  if (delta === null || Math.abs(delta) < 1) return "neutral";
  return delta > 0 ? "success" : "error";
}

/** "09/2026" từ khoá tháng "2026-09". */
export function monthLabel(value: string): string {
  if (!value || value.length < 7) return EMPTY_TEXT;
  return `${value.slice(5, 7)}/${value.slice(0, 4)}`;
}
