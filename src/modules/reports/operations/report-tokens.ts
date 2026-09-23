import { MOTION } from "@/shared/ui";

/**
 * Ngôn ngữ hình khối của trang Báo cáo vận hành — CỐ Ý trùng với Dashboard
 * (`modules/dashboard/components/dashboard-styles`): card viền mỏng theo token,
 * tiêu đề card 18/600, caption 12 secondary. Hai màn hình này luôn được đọc
 * cạnh nhau nên chỉ được có MỘT nhịp thị giác.
 */
export const RPT_CARD_SX = {
  p: 2,
  bgcolor: "var(--ops-surface)",
  border: "1px solid var(--ops-line)",
  borderRadius: "var(--ops-radius-card)",
  boxShadow: "var(--ops-shadow-card)",
  minWidth: 0,
} as const;

export const RPT_CAPTION_SX = {
  fontSize: 12,
  color: "var(--ops-muted)",
  lineHeight: "18px",
} as const;

/**
 * Trần chiều cao của các khối danh sách dài trong 8 màn Báo cáo (bảng chi tiết,
 * nhật ký chứng từ, dòng thời gian…).
 *
 * VÌ SAO CÓ: các khối này đổ trọn tập dòng đã lọc — bảng và biểu đồ cùng một
 * mục buộc phải mô tả CÙNG một tập (xem ghi chú đầu `report-data.ts`) — nên
 * một kỳ nhiều dữ liệu kéo trang thành dải rất dài và người đọc mất luôn ngữ
 * cảnh mục kế tiếp. Đặt `max-height` + cuộn trong khung: khối ngắn KHÔNG bị
 * độn thêm khoảng trắng, chỉ khối dài mới sinh thanh cuộn.
 *
 * `clamp` thay vì `vh` thuần: màn hình lùn (laptop 13" chia đôi cửa sổ) vẫn
 * còn tối thiểu 320px để thấy được vài dòng, màn hình cao thì khung không kéo
 * quá 640px — dài hơn nữa là mất tác dụng của chính việc gom lại.
 *
 * Dùng chung cho CẢ tám màn: hai bản port CSS đọc qua biến `--hn-rpt-scroll-h`
 * khai cùng giá trị này ở đầu mỗi file CSS.
 */
export const RPT_SCROLL_MAX_HEIGHT = "clamp(320px, 56vh, 640px)";

/**
 * Chiều cao THÂN BIỂU ĐỒ của hai thẻ xếp cạnh nhau trong một hàng 6/6.
 *
 * VÌ SAO CÓ: hai biểu đồ cạnh nhau tự nhiên KHÔNG bằng chiều cao. Cột ngang
 * cao theo số dòng (10 SKU × 6 đối tượng ≈ 816px) còn đường xu hướng thì cố
 * định — thả tự do là một thẻ dài gấp đôi thẻ kia, chừa một mảng trống to bằng
 * nửa màn hình ở cột ngắn. Ép CÙNG một chiều cao thân thì hai thẻ bằng nhau và
 * hàng đọc thành một khối.
 *
 * Là SỐ PX (không phải clamp như RPT_SCROLL_MAX_HEIGHT) vì ApexCharts chỉ nhận
 * `height` dạng số — cùng một con số mới ép được cả hai bên bằng nhau.
 *
 * Biểu đồ nào tự nhiên cao hơn thì CUỘN trong khung, không bóp thanh cột: bóp
 * theo chiều cao khung thì ở "Top 20"/"Tất cả" mỗi thanh còn 2–3px, mất luôn
 * thứ người ta mở biểu đồ ra để nhìn.
 */
export const PAIRED_CHART_HEIGHT = 460;

/**
 * Trần chiều cao của KHUNG bọc biểu đồ trong hàng 6/6.
 *
 * Cao hơn `PAIRED_CHART_HEIGHT` đúng 16px vì ApexCharts luôn vẽ ra khối cao
 * hơn `height` được truyền khoảng 15px (khung bọc của thư viện) — đo được ở
 * 300/460/600px đều lệch đúng 15. Không chừa chỗ đó thì trường hợp biểu đồ
 * "vừa khít khung" vẫn sinh một thanh cuộn thừa vài px, và trục hoành bị giấu
 * đúng cái phần lẽ ra không cần giấu.
 */
export const PAIRED_CHART_FRAME_HEIGHT = PAIRED_CHART_HEIGHT + 16;

/**
 * Chuyển động của các nút TỰ DỰNG trong 8 màn Báo cáo (`<Box component="button">`
 * làm tab "Bảng / Lát cắt", chip lọc, nút mở drawer…).
 *
 * VÌ SAO CẦN: `MuiButton` đã có transition + phản hồi bấm khai trong theme
 * (`shared/ui/theme/mui-adapter.ts`), nhưng `Box` thì không đi qua theme nào —
 * các nút tự dựng vì thế đổi trạng thái "nhảy" một phát trong khi nút chuẩn
 * ngay cạnh lại mượt. Trải sẵn object này vào `sx` để hai loại nút cùng một
 * nhịp; giá trị lấy từ CÙNG bộ token `MOTION` mà theme dùng.
 *
 * `prefers-reduced-motion` đã được `src/styles/hn-motion.css` tắt toàn cục nên
 * không cần khai lại ở đây.
 */
export const RPT_CONTROL_MOTION_SX = {
  transition: [
    `color ${MOTION.duration.instant}ms ${MOTION.easing.standard}`,
    `background-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
    `border-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
    `box-shadow ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
    `transform ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
  ].join(", "),
  "&:hover:not(:disabled)": { transform: "translateY(-1px)" },
  "&:active:not(:disabled)": {
    transform: "translateY(0) scale(0.97)",
    transitionDuration: `${MOTION.duration.instant}ms`,
  },
} as const;

/**
 * Chuyển động của các KHỐI tự dựng (thẻ lát cắt, thẻ chứng từ, ô KPI bấm được).
 * Chỉ đổi bóng/viền/vị trí — không đụng tới thuộc tính layout, đúng nguyên tắc
 * ghi ở đầu `src/styles/hn-motion.css`.
 */
export const RPT_SURFACE_MOTION_SX = {
  transition: [
    `box-shadow ${MOTION.duration.normal}ms ${MOTION.easing.standard}`,
    `border-color ${MOTION.duration.fast}ms ${MOTION.easing.standard}`,
    `transform ${MOTION.duration.normal}ms ${MOTION.easing.out}`,
  ].join(", "),
} as const;

export const RPT_TITLE_SX = {
  m: 0,
  fontSize: 18,
  fontWeight: 600,
  lineHeight: "26px",
  color: "var(--ops-heading)",
} as const;
