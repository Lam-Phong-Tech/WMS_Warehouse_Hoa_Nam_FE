/**
 * HỌ ICON — nguồn sự thật DUY NHẤT cho biến thể Flaticon Uicons của cả app.
 *
 * Đổi bộ mặt icon toàn dự án = sửa MỘT object bên dưới + đổi dòng import CSS
 * tương ứng trong src/main.tsx. Guard `yarn ui:icons` đối chiếu 3 thứ phải khớp
 * nhau: hằng số này ↔ import CSS ở main.tsx ↔ font-family dùng trong index.css;
 * lệch một chỗ là CI đỏ chứ không âm thầm hiện ô trống.
 *
 * Bốn biến thể có sẵn trong @flaticon/flaticon-uicons (bản rounded):
 *
 * | biến thể | prefix  | fontFamily             | cssImport                                         | phủ slug đang dùng |
 * |----------|---------|------------------------|---------------------------------------------------|--------------------|
 * | Regular (đang dùng) | `fi-rr` | uicons-regular-rounded | @flaticon/flaticon-uicons/css/regular/rounded.css | 113/113 |
 * | Bold     | `fi-br` | uicons-bold-rounded    | @flaticon/flaticon-uicons/css/bold/rounded.css    | 113/113            |
 * | Solid | `fi-sr` | uicons-solid-rounded | @flaticon/flaticon-uicons/css/solid/rounded.css | 113/113 |
 * | Thin     | `fi-tr` | uicons-thin-rounded    | @flaticon/flaticon-uicons/css/thin/rounded.css    | 66/113 — THIẾU 47  |
 *
 * KHÔNG chọn Thin: 47 slug đang dùng không có trong bộ đó (guard sẽ đỏ).
 */
export const ICON_FAMILY = {
  /** Tiền tố class: `fi-rr-user`, `fi-rr-box`… */
  prefix: "fi-rr",
  /** font-family do CSS của package khai báo — dùng khi phải override bằng CSS. */
  fontFamily: "uicons-regular-rounded",
  /** PHẢI khớp đúng chuỗi import CSS đầu tiên trong src/main.tsx. */
  cssImport: "@flaticon/flaticon-uicons/css/regular/rounded.css",
} as const;

/**
 * Class đầy đủ cho một icon. `fi` là hook ổn định của dự án (không do package
 * định nghĩa) để test/CSS bắt được icon mà không phụ thuộc biến thể đang chọn.
 */
export function flatIconClass(slug: string): string {
  return `fi ${ICON_FAMILY.prefix}-${slug}`;
}
