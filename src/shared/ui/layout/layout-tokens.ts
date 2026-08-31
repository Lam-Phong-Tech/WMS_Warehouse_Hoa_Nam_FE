/**
 * LAYOUT tokens — số đo shell canonical Vuexy (Part 3 Vuexy sync).
 *
 * Nguồn: [X] spec "hệ X" §3 (xem docs/ui/vuexy-sync/11-canonical-token-contract.md
 * + DEC-UI-BASELINE-01): sidebar sáng ~260px, topbar sticky ~80px.
 * TODO(part-4): đo lại computed style khi có licensed source Vuexy đầy đủ.
 */
export const LAYOUT = {
  /**
   * [ĐO] bề rộng sidebar mở rộng = 260px — chốt lại đúng demo UI/UX
   * `1.WMS_Hoa_Nam_Sidebar_Demo.html` (2026-08-31). Nhãn dài hơn 260px được
   * xử lý ĐÚNG NHƯ DEMO: cắt bằng ellipsis + tooltip hiện đủ chữ khi rê chuột
   * (không nới rộng sidebar nữa).
   */
  sidebarWidth: 260,
  /** [ĐO] bề rộng rail thu gọn (chỉ icon) */
  sidebarCollapsedWidth: 76,
  /** [X] chiều cao topbar sticky */
  topbarHeight: 80,
} as const;
