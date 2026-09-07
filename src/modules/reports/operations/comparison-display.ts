/**
 * LUẬT CHỐT của mọi màn có nghiệp vụ so sánh: so bao nhiêu đối tượng thì đọc
 * bằng hình gì.
 *
 * Đây là quyết định NGHIỆP VỤ đã thống nhất, không phải mặc định kỹ thuật —
 * viết ra thành một chỗ để màn hình không tự suy diễn mỗi nơi một kiểu:
 *
 * · Dưới 2 đối tượng — chưa so sánh được. Nói thẳng "cần thêm đối tượng", không
 *   vẽ một cột đơn độc rồi để người đọc tưởng đó là kết quả so sánh.
 * · 2–3 đối tượng — CỘT NHÓM cạnh nhau. Ở cỡ này mắt so được trực tiếp "ai hơn
 *   ai bao nhiêu cái", và ba màu là mức tối đa mà người đọc còn nhớ được màu
 *   nào của ai mà không phải liếc chú giải.
 * · Từ 4 đối tượng — vẫn đọc được bằng cột nhóm nhưng mỗi cột mảnh dần và việc
 *   so cặp bất kỳ phải nhảy mắt qua cả cụm; HEATMAP giữ mỗi đối tượng một cột
 *   cố định nên dò cặp dễ hơn. `comparisonLayout` gọi mức này là "matrix" và
 *   khối ma trận nói câu gợi ý đó ra màn hình.
 *
 * MẶC ĐỊNH MỞ MÀN LUÔN LÀ BIỂU ĐỒ (yêu cầu người dùng 2026-09-06): người dùng
 * mở báo cáo này để nhìn hình trước, heatmap là bước dò sâu và chỉ cách một cú
 * bấm. Số đối tượng vì vậy KHÔNG còn đổi hình lúc mở màn — nó chỉ đổi câu gợi ý.
 * · Dù ở nhánh nào, một biểu đồ cũng chỉ vẽ tối đa COMPARISON_CHART_SERIES_LIMIT
 *   chuỗi; phần dư đọc ở bảng, không nhồi thêm vào chart.
 *
 * Trần SỐ LƯỢNG CHỌN ĐƯỢC cũng là 6 (COMPARISON_CHART_SERIES_LIMIT): chọn được
 * nhiều hơn số vẽ được thì màn sẽ luôn nợ người dùng một lời giải thích.
 */

/** Ít hơn ngần này thì chưa có gì để so. */
export const COMPARISON_MIN_OBJECTS = 2;

/** Tới ngần này đối tượng thì còn đọc bằng cột nhóm cạnh nhau. */
export const COMPARISON_SIDE_BY_SIDE_MAX = 3;

/** Trần số chuỗi trên MỘT biểu đồ, đồng thời là trần số đối tượng chọn được. */
export const COMPARISON_CHART_SERIES_LIMIT = 6;

/**
 * Ba trạng thái đọc của một màn so sánh.
 *
 * - `insufficient`: chưa đủ đối tượng.
 * - `sideBySide`: 2–3 đối tượng, đọc bằng cột nhóm.
 * - `matrix`: từ 4 đối tượng, đọc bằng heatmap + bảng xếp hạng.
 */
export type ComparisonLayout = "insufficient" | "sideBySide" | "matrix";

export function comparisonLayout(objectCount: number): ComparisonLayout {
  if (objectCount < COMPARISON_MIN_OBJECTS) return "insufficient";
  if (objectCount <= COMPARISON_SIDE_BY_SIDE_MAX) return "sideBySide";
  return "matrix";
}

/**
 * Cách đọc MẶC ĐỊNH cho khối ma trận (SKU × đối tượng): LUÔN là biểu đồ.
 *
 * Giữ nguyên chữ ký nhận `objectCount` dù không còn dùng tới, vì đây là điểm
 * duy nhất quyết định "mở màn thấy hình gì" — muốn cho số đối tượng chi phối
 * lại thì sửa đúng ở đây, không rải điều kiện ra từng màn.
 */
export function comparisonDefaultView(
  _objectCount: number,
): "chart" | "heatmap" {
  return "chart";
}

/** Số chuỗi thực sự được vẽ trên một biểu đồ. */
export function comparisonChartSeriesCount(objectCount: number): number {
  return Math.min(Math.max(0, objectCount), COMPARISON_CHART_SERIES_LIMIT);
}

/** Số đối tượng phải đọc ở bảng vì biểu đồ không vẽ hết. */
export function comparisonHiddenSeriesCount(objectCount: number): number {
  return Math.max(0, objectCount - COMPARISON_CHART_SERIES_LIMIT);
}
