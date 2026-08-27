/**
 * LAYOUT tokens — số đo shell canonical Vuexy (Part 3 Vuexy sync).
 *
 * Nguồn: [X] spec "hệ X" §3 (xem docs/ui/vuexy-sync/11-canonical-token-contract.md
 * + DEC-UI-BASELINE-01): sidebar sáng ~260px, topbar sticky ~80px.
 * TODO(part-4): đo lại computed style khi có licensed source Vuexy đầy đủ.
 */
export const LAYOUT = {
  /** [X] bề rộng sidebar mở rộng */
  sidebarWidth: 260,
  /** [X] bề rộng sidebar thu gọn (chỉ icon) */
  sidebarCollapsedWidth: 72,
  /** [X] chiều cao topbar sticky */
  topbarHeight: 80,
} as const;
