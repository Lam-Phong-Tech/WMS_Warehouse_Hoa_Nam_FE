import { MOTION, RADIUS, SEMANTIC_LIGHT as S, TYPOGRAPHY } from "@/shared/ui";

/**
 * Ngôn ngữ hình khối của trang Báo cáo vận hành — CỐ Ý trùng với Dashboard
 * (`modules/dashboard/components/dashboard-styles`): card viền mỏng theo token,
 * tiêu đề card 18/600, caption 12 secondary. Hai màn hình này luôn được đọc
 * cạnh nhau nên chỉ được có MỘT nhịp thị giác.
 */
export const RPT_CARD_SX = {
  p: 2,
  bgcolor: S.bgSurface,
  border: `1px solid ${S.border}`,
  borderRadius: `${RADIUS.card}px`,
  minWidth: 0,
} as const;

export const RPT_CAPTION_SX = {
  fontSize: 12,
  color: S.textMedium,
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
  fontSize: TYPOGRAPHY.cardTitle.fontSize,
  fontWeight: TYPOGRAPHY.cardTitle.fontWeight,
  lineHeight: TYPOGRAPHY.cardTitle.lineHeight,
  color: S.textHigh,
} as const;
