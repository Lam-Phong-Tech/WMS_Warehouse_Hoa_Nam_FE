---
title: WMS Hoa Nam - Layout & Responsive Spec
status: active
version: 1.0
updated: 2026-10-30
owner: Frontend
applies_to: Web Admin (desktop / tablet / mobile)
---

# 02 - Layout & Responsive Spec

Tài liệu này quy định **khung ứng dụng, breakpoint và hành vi responsive** cho mọi màn hình WMS.
Mọi page mới phải dùng chung shell, không tự dựng layout riêng.

---

## 1. Breakpoint chính thức

| Nhóm                             |         Khoảng | Shell              | Ghi chú                 |
| -------------------------------- | -------------: | ------------------ | ----------------------- |
| Mobile                           |    `0 – 767px` | Hamburger + Drawer | Bảng chuyển card        |
| Tablet portrait                  |  `768 – 979px` | Hamburger + Drawer | Nội dung full width     |
| Tablet landscape / small desktop | `980 – 1279px` | Sidebar cố định    | Nội dung bị trừ sidebar |
| Desktop                          |     `≥ 1280px` | Sidebar cố định    | Layout đầy đủ           |

Nguồn token:

```ts
BREAKPOINTS = { xs: 0, sm: 576, md: 768, lg: 980, xl: 1280 };
```

Quy ước CSS:

- Mobile: `max-width: 767px`
- Tablet portrait: `min-width: 768px` và `max-width: 979px`
- Desktop nhỏ: `min-width: 980px` và `max-width: 1279px`
- Desktop: `min-width: 1280px`

Không tự thêm breakpoint mới khi chưa cập nhật token và tài liệu này.

---

## 2. Shell anatomy

```
┌────────────────────────────────────────────────────────────┐
│ Sidebar (300 / 76) │ Topbar (64)                           │
│                    ├────────────────────────────────────────┤
│                    │ Breadcrumb                             │
│                    │ Page header (title / description / chip)│
│                    │ Banner (nếu có)                        │
│                    │ Page content                           │
│                    │ Footer                                 │
└────────────────────┴────────────────────────────────────────┘
```

### Kích thước chuẩn

| Thành phần             |                                   Giá trị |
| ---------------------- | ----------------------------------------: |
| Sidebar mở             |                                   `300px` |
| Sidebar thu gọn (rail) |                                    `76px` |
| Topbar                 |                                    `64px` |
| Drawer mobile          | `min(300px, 100vw - 40px)`, tối đa `88vw` |
| Page padding desktop   |                                    `24px` |
| Page padding mobile    |                                    `16px` |
| Khoảng cách giữa block |                                    `24px` |
| Khoảng cách trong card |                                    `16px` |

---

## 3. Sidebar

### Desktop `≥ 980px`

- Sidebar cố định bên trái, mặc định mở `300px`.
- Có nút thu gọn về rail `76px`.
- Trạng thái thu gọn được lưu `localStorage`.
- Khi đang thu gọn, hover/focus vào rail sẽ **peek** mở rộng tạm thời;
  nội dung không bị đẩy, sidebar nổi lên trên.
- Khi peek, không ghi đè trạng thái đã lưu.

### Tablet/mobile `< 980px`

- Sidebar ẩn hoàn toàn.
- Topbar hiển thị nút hamburger.
- Bấm hamburger mở `Drawer`.
- Drawer dùng cùng nội dung `SideNav`, width tối đa `300px`.
- Điều hướng xong hoặc nhấn Escape phải đóng drawer.
- Không hiển thị cả sidebar và drawer cùng lúc.

### Nội dung sidebar

- Brand: logo + “HOA NAM SCANNER”.
- Nhóm menu theo nghiệp vụ, có thể thu gọn/mở rộng.
- Mục đang chọn có nền primary và chữ trắng.
- Nhóm Hệ thống tách biệt phía dưới.
- Footer sidebar: kho đang chọn + phiên bản.
- Không thêm menu mới nếu chưa có route + permission + nav-data.

---

## 4. Topbar

### Desktop `≥ 1280px`

- Search box rộng, placeholder “Tìm kiếm chức năng”.
- Cụm action bên phải: ngôn ngữ, giao diện, lối tắt, thông báo, tài khoản.
- Tài khoản hiển thị avatar + tên + vai trò.

### Tablet `768 – 1279px`

- Search co lại nhưng vẫn là input.
- Action giữ đủ icon.
- Menu dropdown chuyển sang dạng overlay khi không đủ chỗ.

### Mobile `< 768px`

- Topbar cao `64px`.
- Search co thành icon; khi focus mới mở rộng.
- Ẩn bớt text phụ, giữ icon + badge.
- Menu dropdown dạng fixed, full width trừ 12px mỗi bên.
- Touch target tối thiểu `44px`.

### Quy tắc

- Topbar luôn sticky.
- Không đặt nghiệp vụ riêng của page vào topbar.
- Không thêm quá 2 action mới vào topbar nếu chưa kiểm tra mobile.
- Search phải lọc theo quyền; không hiển thị route người dùng không có quyền.

---

## 5. Page frame

Thứ tự chuẩn:

1. Breadcrumb
2. Page header
3. Banner cảnh báo (nếu có)
4. Nội dung page
5. Footer

### Page header

- Eyebrow: tên nhóm menu, uppercase, `11px/700`, primary.
- Title: `24px/700` desktop, `20px/700` mobile.
- Description: `13px`, muted.
- Bên phải: chip phạm vi kho + chip vai trò (nếu có).
- Không lặp lại title trong nội dung page.

### Nội dung page

- Dùng `Box`/`Stack` với token spacing.
- Không set `height: 100vh` cho page content.
- Không tạo scroll container ngoài; chỉ table/card được scroll nội bộ.
- Không dùng `overflow-x: hidden` trên `body` để che lỗi layout.

---

## 6. Grid & số cột

| Vùng                    | Desktop `≥ 1280` | Tablet `768 – 1279` | Mobile `< 768`              |
| ----------------------- | ---------------- | ------------------- | --------------------------- |
| KPI cards               | 5 cột            | 2 cột               | 1 cột                       |
| Dashboard chart + panel | 2 cột            | 1 cột               | 1 cột                       |
| Form 2 cột              | 2 cột            | 2 cột               | 1 cột                       |
| Stats nhỏ               | 4 cột            | 2 cột               | 2 cột (`<420px`: 1 cột)     |
| Filter bar              | 1 hàng, wrap     | 1 hàng, wrap        | Xếp dọc, control full width |

Quy tắc:

- KPI dùng `minmax(0, 1fr)` để tránh tràn.
- Không đặt width cố định cho card KPI.
- Card cao bằng nhau trong cùng hàng.
- Nếu số item lẻ ở 2 cột, chấp nhận card cuối bên trái; không kéo giãn sai.

---

## 7. Responsive table — quy tắc bắt buộc

Đây là điểm đã phát hiện lệch trong giao diện hiện tại.

### Hành vi hiện tại

- `ResponsiveDataTable` mặc định chuyển card khi `< 768px`.
- Đúng `768px` vẫn là bảng.
- Bảng báo cáo có `min-width` khoảng `880px`.
- Tại `768px`, khung bảng chỉ khoảng `730px` → **cuộn ngang trong bảng**.
- Tại `1024px`, sidebar `300px` còn nội dung `724px` → cũng có nguy cơ cuộn ngang.
- Trang không tràn ngang, nên kiểm tra `document.scrollWidth` sẽ **không phát hiện** lỗi này.

### Quy tắc mới

1. Bảng nhiều cột phải chuyển card ở `≤ 1024px`, hoặc
2. Giảm số cột hiển thị trên tablet, hoặc
3. Cho phép scroll ngang **có chủ đích** với shadow/scroll hint rõ ràng.

Khuyến nghị:

```tsx
<ResponsiveDataTable
  mobileBreakpoint="lg" // < 980px chuyển card
  columns={columns}
  ...
/>
```

Hoặc dùng CSS:

```css
@media (max-width: 1024px) {
  .report-table {
    /* chuyển layout card */
  }
}
```

### Checklist bảng

- [ ] Không tràn ngang cấp trang.
- [ ] Không tràn ngang cấp bảng ở 768/1024.
- [ ] Header sort có `aria-sort`.
- [ ] Row action luôn nhìn thấy.
- [ ] Empty / loading / error state đúng.
- [ ] Pagination wrap được trên mobile.
- [ ] Cột quan trọng không bị ẩn trên mobile.

---

## 8. Form & modal trên mobile

- Form 2 cột → 1 cột dưới `768px`.
- Input full width dưới `576px`.
- Modal:
  - Desktop: radius `12px`, max-width theo nội dung.
  - Mobile: chuyển bottom sheet hoặc modal full width trừ `16px`.
  - Không để modal rộng hơn viewport.
- Footer modal: nút chính bên phải, nút huỷ bên trái.
- Bàn phím mobile không che input đang focus.
- Form dài dùng scroll trong modal, không scroll body.

---

## 9. Overflow rules

- `min-width: 0` cho flex/grid child.
- `max-width: 100%` cho ảnh, chart, input, card.
- Bảng: scroll trong wrapper, không làm tràn page.
- Chart: wrapper có `min-width: 0`; không đặt width px cố định.
- Text dài (SKU, UUID, barcode): `overflow-wrap: anywhere`.
- Không dùng `overflow-x: hidden` trên `body` để che lỗi.
- Kiểm tra cả `document.scrollWidth` và `table.scrollWidth`.

---

## 10. Ma trận kiểm tra

| Viewport     | Shell       | KPI     | Bảng                          | Kỳ vọng          |
| ------------ | ----------- | ------- | ----------------------------- | ---------------- |
| `1440 × 900` | Sidebar 300 | 5 cột   | Bảng đầy đủ                   | Không overflow   |
| `1280 × 800` | Sidebar 300 | 5/4 cột | Bảng đầy đủ                   | Không overflow   |
| `1024 × 768` | Sidebar 300 | 2 cột   | Card hoặc scroll có kiểm soát | Không tràn trang |
| `768 × 1024` | Drawer      | 2 cột   | **Card** (khuyến nghị)        | Không tràn bảng  |
| `390 × 844`  | Drawer      | 1 cột   | Card                          | Không overflow   |
| `375 × 812`  | Drawer      | 1 cột   | Card                          | Không overflow   |
| `320 × 568`  | Drawer      | 1 cột   | Card                          | Không overflow   |

---

## 11. Lỗi đã biết cần tránh lặp lại

1. **Bảng 880px trong khung 730px tại 768px** → cuộn ngang.
2. **Sidebar 300px tại 1024px** → nội dung còn 724px, quá chật.
3. **Breakpoint biên 768px** → đúng 768 vẫn là bảng, không phải card.
4. **Kiểm tra chỉ `document.scrollWidth`** → bỏ sót overflow trong bảng.
5. **Topbar mobile quá nhiều icon** → dễ chật ở 320–360px.
6. **Title mobile quá dài** → xuống 2 dòng, cần kiểm tra với tên dài.

---

## 12. Checklist trước khi merge layout mới

- [ ] Dùng `MainLayout`/`UiAppShell`, không tự dựng shell.
- [ ] Sidebar/drawer đúng breakpoint `980px`.
- [ ] KPI đúng 5/2/1 cột.
- [ ] Form đúng 2/1 cột.
- [ ] Bảng đã kiểm tra 768 và 1024, không cuộn ngang ngoài ý muốn.
- [ ] Không có `overflow-x: hidden` trên body.
- [ ] Kiểm tra 1440 / 1024 / 768 / 390 / 375.
- [ ] Không có scroll ngang cấp trang.
- [ ] Drawer đóng khi đổi route hoặc nhấn Escape.
- [ ] Touch target ≥ 44px trên mobile.
