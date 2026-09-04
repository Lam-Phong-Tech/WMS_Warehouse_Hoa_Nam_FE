/**
 * Mật độ trục thời gian dùng chung cho MỌI biểu đồ của Dashboard và 8 màn báo
 * cáo — cả biểu đồ SVG tự vẽ (bản port mockup) lẫn biểu đồ ApexCharts.
 *
 * VẤN ĐỀ ĐANG SỬA: các chart xu hướng vẽ MỘT nhãn trục X cho MỖI điểm dữ liệu,
 * không quan tâm khung vẽ rộng bao nhiêu. Kỳ 7–14 ngày thì vừa; chọn kỳ dài
 * (30 / 90 / 365 ngày) thì các nhãn "07-08 08-08 09-08…" chồng khít lên nhau
 * thành một vệt chữ không đọc được, chấm điểm dính thành dải đặc và nhãn giá
 * trị đè lên đường. Không màn nào được phép rơi vào trạng thái đó.
 *
 * CÁCH GIẢI: thay vì để trình duyệt/ApexCharts tự xoay xở, tính TRƯỚC xem khung
 * vẽ chứa được bao nhiêu nhãn rồi chỉ vẽ đúng ngần ấy — giữ nguyên toàn bộ điểm
 * dữ liệu (đường vẫn liền mạch, số liệu không đổi), chỉ THƯA nhãn. Đây là lựa
 * chọn thiết kế có chủ đích: đọc mốc thời gian thưa mà rõ vẫn hơn đọc đủ mốc mà
 * mờ; số liệu đầy đủ đã có ở bảng "dữ liệu thay thế" ngay dưới mỗi biểu đồ.
 *
 * ĐƠN VỊ: `plotWidth` và `fontSize` phải CÙNG hệ. Với biểu đồ đo bằng pixel thì
 * truyền pixel; với SVG có `viewBox` cố định thì truyền đơn vị viewBox — chữ
 * trong SVG co giãn cùng viewBox nên phép so sánh vẫn đúng ở mọi bề rộng.
 */

/**
 * Bề rộng trung bình của một ký tự tính theo cỡ chữ, đo trên bộ chữ giao diện
 * (Public Sans / Inter) với nhãn số-và-dấu kiểu "01/09/2026". Nhỉnh hơn thực tế
 * một chút để nhãn không bao giờ chạm nhau.
 */
const CHAR_WIDTH_RATIO = 0.62;

export type AxisDensityInput = {
  /** Số điểm dữ liệu trên trục. */
  count: number;
  /** Bề rộng vùng vẽ (không kể lề trục Y). */
  plotWidth: number;
  /** Số ký tự của nhãn DÀI NHẤT sẽ vẽ. */
  labelChars: number;
  /** Cỡ chữ nhãn trục, cùng đơn vị với `plotWidth`. */
  fontSize: number;
  /** Khoảng trống tối thiểu giữa hai nhãn cạnh nhau. */
  minGap?: number;
  /** Bán kính chấm điểm dữ liệu ở mật độ thưa. */
  markerRadius?: number;
  /**
   * Góc xoay nhãn (độ, > 0). Nhãn xoay chiếm bề ngang bằng CHIỀU CAO dòng chữ
   * chiếu xuống trục chứ không phải bề dài chữ, nên sức chứa tăng vọt — dùng
   * cho trục hạng mục (tên nhóm) nơi giấu bớt nhãn là giấu mất chính hạng mục.
   */
  rotateDegrees?: number;
};

export type AxisDensity = {
  /** Bước nhảy giữa hai nhãn được vẽ (1 = vẽ hết). */
  stride: number;
  /** Số nhãn tối đa mà khung vẽ chứa được. */
  maxLabels: number;
  /** Có vẽ nhãn tại chỉ số này không — luôn gồm điểm cuối kỳ. */
  showLabel: (index: number) => boolean;
  /** Còn chỗ cho chấm điểm dữ liệu không. */
  showMarkers: boolean;
  /** Bán kính chấm đã co theo mật độ (0 khi không vẽ). */
  markerRadius: number;
  /** Còn chỗ in số ngay trên từng điểm không. */
  showPointValues: boolean;
  /** Hệ số bề dày nét vẽ — đường mảnh lại khi điểm san sát. */
  strokeScale: number;
  /** Khoảng cách giữa hai điểm dữ liệu liền kề. */
  slot: number;
};

/**
 * Tính mật độ nhãn/điểm vừa khung.
 *
 * Nhãn được neo vào ĐIỂM CUỐI chứ không phải điểm đầu: mốc gần hiện tại nhất là
 * mốc người dùng tra trước tiên, nên nó phải luôn có nhãn. Điểm đầu chỉ được
 * thêm nhãn khi còn cách nhãn kế tiếp đủ xa để không dính chữ.
 */
export function fitAxisDensity({
  count,
  plotWidth,
  labelChars,
  fontSize,
  minGap = 10,
  markerRadius = 3.5,
  rotateDegrees,
}: AxisDensityInput): AxisDensity {
  const points = Math.max(0, Math.floor(count));
  const width = Math.max(0, plotWidth);

  if (points <= 1) {
    return {
      stride: 1,
      maxLabels: Math.max(points, 1),
      showLabel: () => true,
      showMarkers: true,
      markerRadius,
      showPointValues: true,
      strokeScale: 1,
      slot: width,
    };
  }

  const slot = width / (points - 1);
  const labelWidth =
    rotateDegrees !== undefined && rotateDegrees > 0
      ? // Nhãn xoay: hai nhãn cạnh nhau chỉ cần cách nhau đúng chiều cao dòng
        // chữ chiếu xuống trục ngang.
        (fontSize * 1.25) / Math.sin((rotateDegrees * Math.PI) / 180)
      : Math.max(labelChars, 1) * fontSize * CHAR_WIDTH_RATIO;
  // +1 vì n nhãn chỉ cần (n−1) khoảng: nhãn đầu và nhãn cuối tì vào hai mép.
  const maxLabels = Math.max(
    2,
    Math.floor(width / Math.max(labelWidth + minGap, 1)) + 1,
  );
  const stride =
    points <= maxLabels ? 1 : Math.ceil((points - 1) / (maxLabels - 1));

  // Điểm đầu chỉ lấy nhãn khi nó không rơi vào lưới stride sẵn có VÀ còn cách
  // nhãn gần nhất quá nửa bước — nếu không, hai nhãn ở mép trái sẽ dính nhau.
  const remainder = (points - 1) % stride;
  const showFirst = remainder === 0 || remainder >= stride * 0.55;

  const showLabel = (index: number): boolean => {
    if (stride <= 1) return true;
    if (index === points - 1) return true;
    if (index === 0) return showFirst;
    return (points - 1 - index) % stride === 0;
  };

  // Chấm điểm: cần đủ chỗ cho đường kính + viền + một chút thở. Dưới ngưỡng đó
  // các chấm chồng lên nhau thành dải đặc che mất chính đường xu hướng.
  const markerFootprint = markerRadius * 2 + 3;
  const showMarkers = slot >= markerFootprint;
  const resolvedRadius = showMarkers
    ? Math.min(markerRadius, Math.max(2, slot / 2.6))
    : 0;

  // Nhãn giá trị trên điểm: ước lượng 4 ký tự ("1.234").
  const showPointValues = slot >= 4 * fontSize * CHAR_WIDTH_RATIO + 6;

  const strokeScale = slot >= 12 ? 1 : slot >= 6 ? 0.85 : 0.7;

  return {
    stride,
    maxLabels,
    showLabel,
    showMarkers,
    markerRadius: resolvedRadius,
    showPointValues,
    strokeScale,
    slot,
  };
}

/**
 * Số nhãn tối đa cho trục category của ApexCharts.
 *
 * ApexCharts nhận `xaxis.tickAmount` (số KHOẢNG, không phải số nhãn) và tự rải
 * đều nhãn theo đó. Trả về `undefined` khi vẫn còn chỗ vẽ hết — để nguyên hành
 * vi mặc định thay vì ép thưa một cách không cần thiết.
 */
export function apexTickAmount(input: AxisDensityInput): number | undefined {
  const density = fitAxisDensity(input);
  if (density.stride <= 1) return undefined;
  const points = Math.max(1, Math.floor(input.count));
  return Math.max(2, Math.min(points - 1, density.maxLabels - 1));
}

/**
 * Số ký tự của nhãn dài nhất — dùng làm `labelChars`. Nhãn rỗng/thiếu tính là
 * 1 để phép chia không bao giờ ra 0.
 */
export function longestLabelChars(labels: readonly string[]): number {
  let longest = 1;
  for (const label of labels) {
    if (label.length > longest) longest = label.length;
  }
  return longest;
}
