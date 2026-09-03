/**
 * HÌNH HỌC ICON của demo UI/UX "Trang Tổng quan" — chép 1:1 toàn bộ `iconPaths`
 * của `Other/Trang_Tong_Quan/assets/app.js` (32 icon).
 *
 * DÙNG Ở ĐÂU: thanh topbar (src/app/layouts/topbar) và màn Dashboard
 * (src/modules/dashboard) — hai nơi lấy hình từ CÙNG file demo nên dùng chung
 * một bộ, đừng nhân bản thêm.
 *
 * VÌ SAO KHÔNG CÀI `lucide-react`: guard `yarn ui:icons` cấm thư viện icon thứ
 * hai trong bundle. Yêu cầu người dùng là giống demo 100% kể cả icon.
 *
 * PHÂN BIỆT với `vuexy-nav-icon-paths.ts`: bộ đó chép từ demo SIDEBAR
 * (lucide@1.17.0, hình chi tiết hơn); bộ này chép từ demo Tổng quan (demo tự vẽ
 * lại đơn giản hơn). Hai bộ KHÁC nhau về hình — không gộp.
 *
 * Icon nghiệp vụ ngoài hai chỗ trên vẫn là Flaticon qua `UiIcon`.
 */
type DemoIconPart = readonly [string, Readonly<Record<string, string>>];

export const VUEXY_DEMO_ICONS = {
  "layout-dashboard": [
    ["rect", { x: "3", y: "3", width: "7", height: "9", rx: "1" }],
    ["rect", { x: "14", y: "3", width: "7", height: "5", rx: "1" }],
    ["rect", { x: "14", y: "12", width: "7", height: "9", rx: "1" }],
    ["rect", { x: "3", y: "16", width: "7", height: "5", rx: "1" }],
  ],
  "package-search": [
    ["path", { d: "m7.5 4.27 9 5.15" }],
    [
      "path",
      {
        d: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l5 2.86",
      },
    ],
    ["path", { d: "M3.3 7 12 12l8.7-5" }],
    ["path", { d: "M12 22V12" }],
    ["circle", { cx: "18", cy: "18", r: "3" }],
    ["path", { d: "m20.2 20.2 1.8 1.8" }],
  ],
  "package-plus": [
    ["path", { d: "m7.5 4.27 9 5.15" }],
    [
      "path",
      {
        d: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
      },
    ],
    ["path", { d: "m3.3 7 8.7 5 8.7-5" }],
    ["path", { d: "M12 22V12" }],
    ["path", { d: "M16 13h4M18 11v4" }],
  ],
  "package-minus": [
    ["path", { d: "m7.5 4.27 9 5.15" }],
    [
      "path",
      {
        d: "M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z",
      },
    ],
    ["path", { d: "m3.3 7 8.7 5 8.7-5" }],
    ["path", { d: "M12 22V12" }],
    ["path", { d: "M16 13h4" }],
  ],
  "briefcase-medical": [
    ["path", { d: "M12 11v4M10 13h4" }],
    ["path", { d: "M16 6V4a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" }],
    ["rect", { x: "3", y: "6", width: "18", height: "14", rx: "2" }],
  ],
  warehouse: [
    ["path", { d: "M3 21V8l9-5 9 5v13" }],
    ["path", { d: "M13 13h4v8M13 17h4M3 21h18" }],
    ["path", { d: "M7 10h2v2H7z" }],
  ],
  "chart-column-big": [
    ["path", { d: "M3 3v18h18" }],
    ["rect", { x: "7", y: "12", width: "3", height: "5", rx: "1" }],
    ["rect", { x: "13", y: "7", width: "3", height: "10", rx: "1" }],
    ["rect", { x: "19", y: "4", width: "2", height: "13", rx: "1" }],
  ],
  "calendar-days": [
    ["rect", { x: "3", y: "4", width: "18", height: "17", rx: "2" }],
    ["path", { d: "M16 2v4M8 2v4M3 10h18" }],
    ["path", { d: "M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01" }],
  ],
  "chevron-left": [["path", { d: "m15 18-6-6 6-6" }]],
  "chevron-right": [["path", { d: "m9 18 6-6-6-6" }]],
  "settings-2": [
    ["path", { d: "M20 7h-9M14 17H5" }],
    ["circle", { cx: "17", cy: "17", r: "3" }],
    ["circle", { cx: "7", cy: "7", r: "3" }],
  ],
  "chevron-down": [["path", { d: "m6 9 6 6 6-6" }]],
  "circle-dot": [
    ["circle", { cx: "12", cy: "12", r: "9" }],
    ["circle", { cx: "12", cy: "12", r: "2" }],
  ],
  x: [["path", { d: "M18 6 6 18M6 6l12 12" }]],
  menu: [["path", { d: "M4 6h16M4 12h16M4 18h16" }]],
  bell: [
    [
      "path",
      { d: "M10.3 21h3.4M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" },
    ],
  ],
  search: [
    ["circle", { cx: "11", cy: "11", r: "7" }],
    ["path", { d: "m20 20-3.2-3.2" }],
  ],
  languages: [
    ["path", { d: "m5 8 6 6M4 14l6-6 2-3M2 5h12M7 2h1" }],
    ["path", { d: "m16 13 4 9M14 22l4-9 4 9M15.5 19h5" }],
  ],
  sun: [
    ["circle", { cx: "12", cy: "12", r: "4" }],
    [
      "path",
      {
        d: "M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.66 6.34l1.41-1.41",
      },
    ],
  ],
  moon: [
    ["path", { d: "M21 12.8A8.5 8.5 0 1 1 11.2 3 6.5 6.5 0 0 0 21 12.8Z" }],
  ],
  monitor: [
    ["rect", { x: "2", y: "3", width: "20", height: "14", rx: "2" }],
    ["path", { d: "M8 21h8M12 17v4" }],
  ],
  "grid-2x2-plus": [
    ["rect", { x: "3", y: "3", width: "7", height: "7", rx: "1" }],
    ["rect", { x: "14", y: "3", width: "7", height: "7", rx: "1" }],
    ["rect", { x: "3", y: "14", width: "7", height: "7", rx: "1" }],
    ["path", { d: "M17.5 14v7M14 17.5h7" }],
  ],
  "user-round": [
    ["circle", { cx: "12", cy: "8", r: "4" }],
    ["path", { d: "M4 22a8 8 0 0 1 16 0" }],
  ],
  "file-clock": [
    ["path", { d: "M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h7" }],
    ["path", { d: "M14 2v6h6M16 13.5V16l1.5 1" }],
    ["circle", { cx: "16", cy: "16", r: "5" }],
  ],
  "log-out": [
    ["path", { d: "M10 17l5-5-5-5M15 12H3" }],
    ["path", { d: "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" }],
  ],
  "refresh-cw": [
    ["path", { d: "M20 6v5h-5M4 18v-5h5" }],
    [
      "path",
      { d: "M18.5 9A7 7 0 0 0 6 6.5L4 9M5.5 15A7 7 0 0 0 18 17.5l2-2.5" },
    ],
  ],
  "arrow-right": [["path", { d: "M5 12h14M13 6l6 6-6 6" }]],
  "loader-circle": [["path", { d: "M21 12a9 9 0 1 1-6.22-8.56" }]],
  inbox: [
    ["path", { d: "M22 12h-6l-2 3h-4l-2-3H2" }],
    [
      "path",
      {
        d: "m5.45 5.11-3.3 7.43A2 2 0 0 0 4 15.35h16a2 2 0 0 0 1.85-2.81l-3.3-7.43A2 2 0 0 0 16.72 4H7.28a2 2 0 0 0-1.83 1.11Z",
      },
    ],
  ],
  "triangle-alert": [
    [
      "path",
      {
        d: "m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z",
      },
    ],
    ["path", { d: "M12 9v4M12 17h.01" }],
  ],
  lock: [
    ["rect", { x: "3", y: "11", width: "18", height: "10", rx: "2" }],
    ["path", { d: "M7 11V7a5 5 0 0 1 10 0v4" }],
  ],
  info: [
    ["circle", { cx: "12", cy: "12", r: "10" }],
    ["path", { d: "M12 16v-4M12 8h.01" }],
  ],
  // Nút "Xem" của báo cáo RPT-02 — chép `iconPaths.eye` từ demo đã chốt
  // Other/Report02_HTML_Export/report-02-offline.js (cùng họ hình với bộ trên).
  eye: [
    [
      "path",
      {
        d: "M2.06 12.35a1 1 0 0 1 0-.7C3.7 7.6 7.64 5 12 5s8.3 2.6 9.94 6.65a1 1 0 0 1 0 .7C20.3 16.4 16.36 19 12 19s-8.3-2.6-9.94-6.65Z",
      },
    ],
    ["circle", { cx: "12", cy: "12", r: "3" }],
  ],
} as const satisfies Record<string, readonly DemoIconPart[]>;

export type VuexyDemoIconName = keyof typeof VUEXY_DEMO_ICONS;
