/**
 * HÌNH HỌC ICON của thanh điều hướng — chép 1:1 từ đúng bản lucide mà demo
 * UI/UX `1.WMS_Hoa_Nam_Sidebar_Demo.html` nạp (lucide@1.17.0, giấy phép ISC).
 *
 * VÌ SAO KHÔNG CÀI `lucide-react`: guard `yarn ui:icons` CẤM thư viện icon thứ
 * hai trong bundle. Yêu cầu người dùng (2026-08-31) là sidebar giống demo 100%
 * kể cả icon, nên chép hình học của ĐÚNG 10 icon sidebar dùng vào đây.
 *
 * PHẠM VI: CHỈ thanh điều hướng. Icon khác của app vẫn là Flaticon qua UiIcon —
 * đừng mở rộng bộ này ra màn nghiệp vụ.
 *
 * File tách riêng khỏi component (react-refresh: một file .tsx chỉ nên export
 * component).
 */
type NavIconPart = readonly [string, Readonly<Record<string, string>>];

/** 8 icon nhóm + chevron + nút thu gọn — đúng bằng số icon demo hiển thị. */
export const VUEXY_NAV_ICONS = {
  /** Tổng quan */
  "layout-dashboard": [
    ["rect", { width: "7", height: "9", x: "3", y: "3", rx: "1" }],
    ["rect", { width: "7", height: "5", x: "14", y: "3", rx: "1" }],
    ["rect", { width: "7", height: "9", x: "14", y: "12", rx: "1" }],
    ["rect", { width: "7", height: "5", x: "3", y: "16", rx: "1" }],
  ],
  /** Danh mục */
  "package-search": [
    ["path", { d: "M12 22V12" }],
    ["path", { d: "M20.27 18.27 22 20" }],
    [
      "path",
      {
        d: "M21 10.498V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l.98-.559",
      },
    ],
    ["path", { d: "M3.29 7 12 12l8.71-5" }],
    ["path", { d: "m7.5 4.27 8.997 5.148" }],
    ["circle", { cx: "18.5", cy: "16.5", r: "2.5" }],
  ],
  /** Nhập kho */
  "package-plus": [
    ["path", { d: "M12 22V12" }],
    ["path", { d: "M16 17h6" }],
    ["path", { d: "M19 14v6" }],
    [
      "path",
      {
        d: "M21 10.535V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l1.675-.955",
      },
    ],
    ["path", { d: "M3.29 7 12 12l8.71-5" }],
    ["path", { d: "m7.5 4.27 8.997 5.148" }],
  ],
  /** Xuất kho */
  "package-minus": [
    ["path", { d: "M12 22V12" }],
    ["path", { d: "M16 17h6" }],
    [
      "path",
      {
        d: "M21 13V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.729l7 4a2 2 0 0 0 2 .001l1.675-.955",
      },
    ],
    ["path", { d: "M3.29 7 12 12l8.71-5" }],
    ["path", { d: "m7.5 4.27 8.997 5.148" }],
  ],
  /** Bảo hành & linh kiện */
  "briefcase-medical": [
    ["path", { d: "M12 11v4" }],
    ["path", { d: "M14 13h-4" }],
    ["path", { d: "M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" }],
    ["path", { d: "M18 6v14" }],
    ["path", { d: "M6 6v14" }],
    ["rect", { width: "20", height: "14", x: "2", y: "6", rx: "2" }],
  ],
  /** Tồn kho & truy vết */
  warehouse: [
    ["path", { d: "M18 21V10a1 1 0 0 0-1-1H7a1 1 0 0 0-1 1v11" }],
    [
      "path",
      {
        d: "M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 1.132-1.803l7.95-3.974a2 2 0 0 1 1.837 0l7.948 3.974A2 2 0 0 1 22 8z",
      },
    ],
    ["path", { d: "M6 13h12" }],
    ["path", { d: "M6 17h12" }],
  ],
  /** Báo cáo */
  "chart-column-big": [
    ["path", { d: "M3 3v16a2 2 0 0 0 2 2h16" }],
    ["rect", { x: "15", y: "5", width: "4", height: "12", rx: "1" }],
    ["rect", { x: "7", y: "8", width: "4", height: "9", rx: "1" }],
  ],
  /** Hệ thống */
  "settings-2": [
    ["path", { d: "M14 17H5" }],
    ["path", { d: "M19 7h-9" }],
    ["circle", { cx: "17", cy: "17", r: "3" }],
    ["circle", { cx: "7", cy: "7", r: "3" }],
  ],
  /** Mũi tên sổ nhóm (xoay 180° khi mở) */
  "chevron-down": [["path", { d: "m6 9 6 6 6-6" }]],
  /** Nút thu gọn trong khối brand */
  "circle-dot": [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["circle", { cx: "12", cy: "12", r: "1" }],
  ],
} as const satisfies Record<string, readonly NavIconPart[]>;

export type VuexyNavIconName = keyof typeof VUEXY_NAV_ICONS;
