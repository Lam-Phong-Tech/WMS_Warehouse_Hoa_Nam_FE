/**
 * RPT-IO-01 · bộ icon của mockup 8.3.
 *
 * Hình học chép NGUYÊN từ `Other/8.3.WMS_Hoa_Nam_Bao_Cao_Lich_Su_Nhap_Xuat/
 * report-8.3-shell.js` (bảng `paths`) — mười hình mà DOM của báo cáo tham
 * chiếu qua `data-icon`.
 *
 * VÌ SAO ĐẶT Ở ĐÂY chứ không thêm vào `src/shared/ui/icons/
 * vuexy-demo-icon-paths.ts`: bộ dùng chung đó là bản chép 1:1 của demo "Trang
 * Tổng quan" (32 icon, đúng hình của demo đó) — chèn hình từ một mockup khác
 * vào sẽ phá hợp đồng "chép 1:1" ghi ở đầu file ấy. Sáu trong mười hình dưới
 * đây (file / swap / undo / check / trend / download / list) cũng không tồn tại
 * trong bộ chung.
 *
 * VÌ SAO KHÔNG CÀI thư viện icon: guard `yarn ui:icons` cấm bộ icon thứ hai
 * trong bundle.
 */

/** Đúng bảng `paths` của `report-8.3-shell.js`. */
const IO_ICON_PATHS = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.2-3.2" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 6v5h-5M4 18v-5h5" />
      <path d="M18.5 9A7 7 0 0 0 6 6.5L4 9M5.5 15A7 7 0 0 0 18 17.5l2-2.5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12M7 10l5 5 5-5" />
      <path d="M5 21h14" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13M8 12h13M8 18h13" />
      <path d="M3 6h.01M3 12h.01M3 18h.01" />
    </>
  ),
  "grid-2x2-plus": (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1" />
      <rect x="14" y="3" width="7" height="7" rx="1" />
      <rect x="3" y="14" width="7" height="7" rx="1" />
      <path d="M17.5 14v7M14 17.5h7" />
    </>
  ),
  trend: (
    <>
      <path d="m3 17 6-6 4 4 8-8" />
      <path d="M14 7h7v7" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6M8 13h8M8 17h8" />
    </>
  ),
  swap: (
    <>
      <path d="m7 7 3-3 3 3M10 4v16M17 17l-3 3-3-3M14 20V4" />
    </>
  ),
  undo: (
    <>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" />
    </>
  ),
  check: (
    <>
      <path d="m5 12 4 4L19 6" />
    </>
  ),
} as const;

export type IoIconName = keyof typeof IO_ICON_PATHS;

/**
 * Một icon của báo cáo.
 *
 * Mockup bọc mỗi hình trong một phần tử mang `data-icon` rồi mới nhét `<svg>`
 * vào — CSS của mockup neo vào chính thuộc tính đó (`.btn [data-icon]`,
 * `.tab [data-icon]`), nên vỏ ngoài phải giữ nguyên.
 */
export function IoIcon({ name }: { name: IoIconName }) {
  return (
    <span data-icon={name} aria-hidden="true">
      <svg viewBox="0 0 24 24" focusable="false">
        {IO_ICON_PATHS[name]}
      </svg>
    </span>
  );
}
