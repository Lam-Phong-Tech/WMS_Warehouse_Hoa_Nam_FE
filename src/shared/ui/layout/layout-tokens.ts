/**
 * LAYOUT tokens — số đo shell canonical Vuexy (Part 3 Vuexy sync).
 *
 * Nguồn: [X] spec "hệ X" §3 (xem docs/ui/vuexy-sync/11-canonical-token-contract.md
 * + DEC-UI-BASELINE-01): sidebar sáng ~260px, topbar sticky ~80px.
 * TODO(part-4): đo lại computed style khi có licensed source Vuexy đầy đủ.
 */
export const LAYOUT = {
  /**
   * [ĐO] bề rộng sidebar mở rộng = 340px — CHỦ ĐỘNG LỆCH demo 260px (yêu cầu
   * người dùng 2026-08-31, sau khi demo 260px làm ellipsis cắt mất chữ mục
   * con: "Danh sách người dùng & phân quyền" ~249px, "Nhập dữ liệu / đối
   * chiếu & lỗi dữ liệu" ~246px — đo bằng canvas 400 15px Public Sans). Ở
   * childPaddingLeft(43) + itemPaddingX(12) + nav paddingX(10×2) thì 340px
   * chừa dư khoảng 15px cho nhãn dài nhất, đủ margin cho biến thiên font
   * renderer giữa các trình duyệt/OS — không cắt ellipsis nữa ở mọi mục.
   */
  sidebarWidth: 340,
  /** [ĐO] bề rộng rail thu gọn (chỉ icon) */
  sidebarCollapsedWidth: 76,
  /** [X] chiều cao topbar sticky */
  topbarHeight: 80,
} as const;
