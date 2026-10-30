---
title: WMS Hoa Nam - Design Foundations
status: active
version: 1.0
updated: 2026-10-30
owner: Frontend
applies_to: Web Admin (desktop / tablet / mobile)
---

# 01 - Design Foundations

Tài liệu này là **chuẩn nền tảng thị giác** cho mọi màn hình mới của WMS Hoa Nam.
Mục tiêu: mọi module nhìn cùng một hệ, không mỗi trang một màu, một font, một kiểu card.

> **Baseline hiện hành (30/10/2026): Operations / SystemHNWeb.**
> Giao diện đang chạy dùng sidebar navy, primary xanh `#004E74`, topbar navy.
> Các tài liệu Vuexy cũ (`DEC-UI-BASELINE-01`, `11-canonical-token-contract.md`)
> chỉ còn là **lịch sử tham khảo**, không dùng để tạo màn hình mới.
> Nếu muốn quay lại Vuexy, phải đổi token + cập nhật đồng thời 3 file thiết kế này.

---

## 1. Thứ bậc nguồn sự thật

Khi có xung đột, thứ tự ưu tiên như sau:

1. **Token runtime**: `src/shared/ui/tokens/operations.ts` + `operations.css`
2. **Semantic tokens**: `src/shared/ui/tokens/palette.ts`, `semantic-light.ts`
3. **Component tokens**: `component-tokens.ts`
4. **Ba tài liệu thiết kế này**
5. Tài liệu Vuexy / audit cũ

Quy tắc:

- Không copy mã màu, font, spacing, radius vào page/component.
- Luôn dùng token semantic: `var(--wms-*)`, `SEMANTIC_LIGHT`, `COMPONENT_TOKENS`.
- Không tạo token mới trong file CSS của module.
- Không override theme ở cấp page. Chỉ có **một** composition root:
  `src/shared/ui/theme/AppThemeProvider.tsx`.

---

## 2. Nguyên tắc thiết kế

1. **Rõ ràng trước đẹp**: ưu tiên đọc được, quét nhanh, thao tác đúng.
2. **Một hành động chính**: mỗi vùng chỉ có một nút primary.
3. **Trạng thái luôn hiển thị**: loading, empty, error, no-permission, offline.
4. **Không giấu hành động quan trọng** sau hover hoặc icon mơ hồ.
5. **Nhất quán theo module**: cùng nghiệp vụ → cùng pattern, cùng vị trí nút.
6. **Mobile không phải desktop thu nhỏ**: bảng chuyển card, filter xếp dọc.
7. **Token-first**: mọi giá trị thị giác đi qua token.

---

## 3. Màu sắc

### 3.1 Light mode

| Nhóm          | Token                                 | Giá trị   |
| ------------- | ------------------------------------- | --------- |
| Heading       | `--ops-heading` / `--wms-text-strong` | `#003B63` |
| Primary       | `--ops-primary` / `--wms-primary`     | `#004E74` |
| Primary hover | `--ops-primary-hover`                 | `#003B63` |
| Text          | `--ops-text` / `--wms-text-high`      | `#12344B` |
| Muted         | `--ops-muted` / `--wms-text-medium`   | `#627C8E` |
| Line / border | `--ops-line` / `--wms-border`         | `#D9E8EF` |
| Pale / subtle | `--ops-pale` / `--wms-bg-subtle`      | `#EAF5F8` |
| Link          | `--ops-link`                          | `#086590` |
| Surface       | `--ops-surface` / `--wms-bg-surface`  | `#FFFFFF` |
| Canvas        | `--ops-canvas` / `--wms-bg-canvas`    | `#F5FAFC` |
| Success       | `--ops-success`                       | `#16865B` |
| Warning       | `--ops-warning`                       | `#B97809` |
| Danger        | `--ops-danger`                        | `#C2413A` |
| Inactive      | `--ops-inactive`                      | `#879BAA` |

Nền trạng thái:

| Tone           | Nền       | Chữ       |
| -------------- | --------- | --------- |
| Success        | `#E7F4ED` | `#106B48` |
| Warning        | `#FFF4DC` | `#8F5B00` |
| Danger         | `#FBEDEA` | `#A9322C` |
| Info / primary | `#EAF5F8` | `#086590` |

### 3.2 Dark mode

| Nhóm          | Giá trị   |
| ------------- | --------- |
| Heading       | `#DAECF6` |
| Primary       | `#086B92` |
| Primary hover | `#075B7D` |
| Text          | `#C8DDEB` |
| Muted         | `#9DB7CA` |
| Line          | `#344D60` |
| Pale          | `#223D50` |
| Link          | `#72C9EE` |
| Surface       | `#192D3E` |
| Canvas        | `#122332` |
| Success       | `#68D5A4` |
| Warning       | `#F1BF66` |
| Danger        | `#F18E87` |

### 3.3 Quy tắc dùng màu

- Primary chỉ dùng cho: hành động chính, trạng thái đang chọn, link quan trọng.
- Không dùng primary cho toàn bộ tiêu đề; tiêu đề dùng `text-strong`.
- Màu semantic phải đi kèm **nhãn hoặc icon**, không chỉ dựa vào màu.
- Nền soft + chữ đậm tương ứng; không dùng chữ trắng trên nền soft.
- Trong dark mode: không hard-code `#fff`, `#000`, `rgba(...)`; dùng token.

---

## 4. Typography

| Vai trò            | Size |  Weight | Ghi chú                            |
| ------------------ | ---: | ------: | ---------------------------------- |
| Font family        |    — |       — | `"Public Sans", system-ui, ...`    |
| Body               | 14px |     400 | line-height 22px                   |
| Secondary / label  | 13px | 400–600 | label form, mô tả                  |
| Page title desktop | 24px |     700 | letter-spacing `-0.025em`          |
| Page title mobile  | 20px |     700 | dưới `md`                          |
| Card title         | 18px |     600 | line-height 26px                   |
| KPI value          | 22px |     600 | line-height 30px                   |
| Button             | 14px |     600 | không viết hoa toàn bộ             |
| Eyebrow            | 11px |     700 | uppercase, letter-spacing `0.08em` |

Quy tắc:

- Không dùng quá 3 cấp tiêu đề trong một page.
- Không dùng font weight 800+ nếu không có lý do.
- Số liệu KPI dùng tabular numbers nếu có.
- Không dùng font ngoài hệ token.

---

## 5. Spacing, radius, shadow, z-index

### Spacing

`4 / 8 / 12 / 16 / 24 / 32`

- Khoảng cách giữa các khối lớn: `24px`.
- Khoảng cách trong card: `16px`.
- Khoảng cách giữa label và control: `8px`.
- Khoảng cách giữa các nút: `8px`.

### Radius

| Thành phần                  | Radius |
| --------------------------- | -----: |
| Control (button/input)      |    6px |
| Card                        |    8px |
| Dialog                      |   12px |
| Bottom sheet / mobile modal |   16px |
| Pill / badge tròn           |  999px |

### Shadow

| Token    | Giá trị                             |
| -------- | ----------------------------------- |
| Card     | `0 2px 8px rgba(0, 59, 99, 0.04)`   |
| Floating | `0 10px 28px rgba(0, 59, 99, 0.14)` |
| Dialog   | `0 20px 60px rgba(0, 59, 99, 0.22)` |

Không tự tạo shadow mới. Muốn nhấn mạnh hơn, dùng border hoặc nền `pale`, không tăng shadow.

### Z-index

| Lớp              | Giá trị |
| ---------------- | ------: |
| Header           |      30 |
| Sidebar          |      40 |
| Dropdown / menu  |     999 |
| PWA banner       |    2200 |
| Blocking loading |    9999 |

---

## 6. Motion

| Token   | Thời gian |
| ------- | --------: |
| Instant |      90ms |
| Fast    |     140ms |
| Normal  |     200ms |
| Slow    |     280ms |

Easing:

- Standard: `cubic-bezier(0.4, 0, 0.2, 1)`
- Out: `cubic-bezier(0.16, 1, 0.3, 1)`
- In: `cubic-bezier(0.4, 0, 1, 1)`

Quy tắc:

- Chỉ animate `opacity`, `transform`, `width`, `margin-left` khi cần.
- Không animate layout lớn gây giật.
- Luôn tôn trọng `prefers-reduced-motion`.
- Không dùng animation để che loading chậm.

---

## 7. Iconography

- Bộ icon chính: **Flaticon Uicons** qua `@flaticon/flaticon-uicons`.
- Kích thước chuẩn: `16 / 18 / 20px`.
- Icon trong button phải cùng màu chữ, không tự đổi màu.
- Icon-only button phải có `aria-label`.
- Không trộn icon từ nhiều bộ khác nhau trong cùng một màn hình.
- Không dùng emoji làm icon nghiệp vụ.

---

## 8. Quy tắc component nền tảng

### Button

| Appearance | Dùng khi                       |
| ---------- | ------------------------------ |
| `filled`   | Hành động chính của vùng       |
| `tonal`    | Hành động phụ, ít rủi ro       |
| `outlined` | Hành động trung tính           |
| `text`     | Hành động nhẹ, trong bảng/menu |

- Chiều cao: `40px`; touch target tối thiểu `44px`.
- Không có elevation mặc định.
- Loading: disable + spinner + giữ nguyên width nếu có thể.
- Nút destructive dùng `color="error"`, luôn có confirm.

### Input / Form field

- Label phía trên, size `13px`.
- Control cao `40px`, radius `6px`, padding ngang `14px`.
- Placeholder không thay thế label.
- Lỗi hiển thị ngay dưới field, màu `--wms-error`.
- Required có dấu `*` và `aria-required`.
- Không đổi border/focus ring theo page.

### Card

- Radius `8px`, padding `16px` (mobile) / `24px` (desktop).
- Title `18px/600`.
- Card không lồng quá 2 cấp.
- Card trong dashboard có thể có accent trái theo semantic, nhưng phải dùng token.

### Badge / Status

Tone: `primary | success | warning | error | info | neutral`.

- Luôn có text, không chỉ chấm màu.
- Nền soft, chữ đậm tương ứng.
- Không dùng badge để thay thế button.

### Dialog / Drawer

- Dialog radius `12px`; mobile sheet `16px`.
- Title `18px/600`, footer căn phải.
- Escape đóng, backdrop đóng được (trừ khi có thay đổi chưa lưu).
- Focus trap + trả focus về trigger.
- Destructive confirm phải nêu rõ đối tượng bị ảnh hưởng.

### Table

- Header nền `--wms-bg-subtle`, chữ `13px/600`.
- Cell padding `10px`, font `13px`.
- Sortable có icon và `aria-sort`.
- Row action cố định bên phải nếu bảng nhiều cột.
- Mobile: chuyển card theo `ResponsiveDataTable`, không bóp cột.

---

## 9. Do / Don't

### Nên

- Dùng `UiButton`, `UiTextField`, `UiCard`, `UiStatusBadge`, `UiDialog`.
- Dùng `--wms-*` cho mọi màu.
- Dùng `SPACING`, `RADIUS`, `TYPOGRAPHY` trong `sx`.
- Kiểm tra cả light và dark mode.
- Kiểm tra 3 viewport: 1440, 768, 390.

### Không nên

- Không hard-code `#hex`, `rgb()`, `px` màu trong page.
- Không tự tạo `ThemeProvider` thứ hai.
- Không thêm thư viện UI mới khi chưa được duyệt.
- Không dùng `!important` để sửa style.
- Không tạo CSS toàn cục mới cho một module.
- Không dùng màu Vuexy tím `#7367F0` cho màn hình mới.

---

## 10. Checklist trước khi merge UI mới

- [ ] Màu lấy từ token, không có hex trong page.
- [ ] Font, size, weight đúng bảng typography.
- [ ] Spacing/radius/shadow đúng token.
- [ ] Có đủ trạng thái loading / empty / error / no-permission.
- [ ] Có keyboard focus và `aria-label` cho icon-only.
- [ ] Kiểm tra light + dark.
- [ ] Kiểm tra 1440 / 768 / 390, không tràn ngang cấp trang.
- [ ] Không tạo theme provider hoặc CSS toàn cục mới.
- [ ] `yarn ui:tokens`, `yarn ui:styles`, `yarn ui:components` pass.
