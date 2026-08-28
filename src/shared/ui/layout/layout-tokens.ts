/**
 * LAYOUT tokens — số đo shell canonical Vuexy (Part 3 Vuexy sync).
 *
 * Nguồn: [X] spec "hệ X" §3 (xem docs/ui/vuexy-sync/11-canonical-token-contract.md
 * + DEC-UI-BASELINE-01): sidebar sáng ~260px, topbar sticky ~80px.
 * TODO(part-4): đo lại computed style khi có licensed source Vuexy đầy đủ.
 */
export const LAYOUT = {
  /**
   * [X] bề rộng sidebar mở rộng — nâng từ 260 lên 300 rồi 320 (yêu cầu người
   * dùng 2026-08-28/29): nhãn dài như "Danh sách phiếu điều chỉnh tồn kho"
   * hay "Danh sách người dùng & phân quyền" bị ellipsis mất chữ ở 260px; ở
   * 300px nhãn dài nhất ("Danh sách linh kiện chờ xếp khay") vừa khít tuyệt
   * đối (0px dư) — chừa thêm biên ở 320px để không bị đè khi mở nhóm con.
   */
  sidebarWidth: 320,
  /** [X] bề rộng sidebar thu gọn (chỉ icon) */
  sidebarCollapsedWidth: 72,
  /** [X] chiều cao topbar sticky */
  topbarHeight: 80,
} as const;
