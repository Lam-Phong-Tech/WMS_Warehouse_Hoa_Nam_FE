---
title: WMS Hoa Nam - UI Patterns & Governance
status: active
version: 1.0
updated: 2026-10-30
owner: Frontend
applies_to: Web Admin (desktop / tablet / mobile)
---

# 03 - UI Patterns & Governance

Tài liệu này quy định **cách lắp ghép màn hình, trạng thái, quyền, nội dung và quy trình thay đổi UI**.
Mục tiêu: nhiều người làm nhiều module vẫn ra cùng một trải nghiệm.

---

## 1. Page templates

### 1.1 Dashboard

```
Page header
KPI cards (5/2/1 cột)
Chart + panel phụ (2 cột → 1 cột)
Danh sách gần đây
```

- KPI tối đa 5 thẻ/hàng.
- Mỗi KPI có: icon, label, value, so sánh, xu hướng.
- Chart luôn có empty state riêng.
- Panel phụ không được cao hơn chart quá nhiều.

### 1.2 List page

```
Page header
Filter bar
KPI/tóm tắt (nếu có)
Table + pagination
```

- Filter bar: filter bên trái, action bên phải.
- Nút primary duy nhất: “Thêm mới” hoặc hành động chính.
- Table luôn có search, sort, pagination.
- Empty state phải có hướng dẫn tiếp theo.

### 1.3 Detail page

```
Page header + action
Thông tin chính (descriptions/card)
Timeline / lịch sử
Tài liệu đính kèm
```

- Action chính nằm góc phải page header.
- Action nguy hiểm tách khỏi action chính.
- Thông tin không được ẩn sau tab nếu là dữ liệu quyết định.

### 1.4 Form page / modal

```
Title
Mô tả ngắn
Form fields
Footer: Huỷ / Lưu
```

- Form ngắn: modal.
- Form dài: page riêng hoặc drawer.
- Không dùng modal cho form quá 2 nhóm nội dung.
- Nút “Lưu” disable khi đang submit.

### 1.5 Settings page

```
Page header
Tabs/section
Form từng nhóm
Footer lưu
```

- Mỗi nhóm cài đặt có mô tả.
- Thay đổi nguy hiểm cần confirm + giải thích hậu quả.
- Không trộn cài đặt cá nhân và cài đặt hệ thống trong cùng một card.

---

## 2. Component map

| Nhu cầu             | Dùng                           |
| ------------------- | ------------------------------ |
| Button              | `UiButton` / `UiIconButton`    |
| Text field          | `UiTextField`, `UiNumberField` |
| Form field          | `UiFormField`                  |
| Card                | `UiCard`                       |
| KPI                 | `UiKpiCard`                    |
| Status              | `UiStatusBadge`                |
| Dialog              | `UiDialog`, `UiConfirmDialog`  |
| Drawer              | `UiDrawer`                     |
| Alert               | `UiAlert`                      |
| Loading/empty/error | `UiStateSurface`               |
| Table               | `ResponsiveDataTable`          |
| Pagination          | `UiPagination`                 |
| Tabs                | `UiTabs`, `UiTabPanel`         |
| Descriptions        | `UiDescriptions`               |
| Timeline            | `UiTimeline`                   |
| Filter bar          | `FilterBar`                    |
| Page header         | `AppPageHeader` (shell)        |
| Toast               | `sonner`                       |

Không tự viết lại component đã có trong `src/shared/ui`.
Nếu cần biến thể mới: thêm prop/variant, không fork component.

---

## 3. Trạng thái bắt buộc

Mọi page có dữ liệu phải xử lý đủ:

| Trạng thái    | Hiển thị                                         |
| ------------- | ------------------------------------------------ |
| Loading       | Skeleton hoặc spinner + text, không nhảy layout  |
| Empty         | Icon + tiêu đề + mô tả + CTA                     |
| Error         | `ApiErrorAlert`, message thân thiện, nút thử lại |
| No permission | Thông báo rõ, không render dữ liệu               |
| Offline       | Banner + chặn mutation theo offline policy       |
| Partial data  | Ghi rõ phần nào chưa có dữ liệu                  |

Quy tắc:

- Không hiển thị bảng trắng không giải thích.
- Không nuốt lỗi API.
- Không dùng toast thay cho error state của page.
- Loading phải giữ kích thước tương đương nội dung thật.

---

## 4. Feedback & confirmation

### Toast

- Dùng `sonner`, vị trí top-right.
- Success: xác nhận ngắn.
- Error: message từ API, không mã lỗi thô.
- Không toast cho mọi thao tác nhỏ.

### Confirm

- Xoá, huỷ, post, reverse, đổi trạng thái: luôn confirm.
- Confirm phải nêu:
  - đối tượng bị ảnh hưởng,
  - hành động,
  - hậu quả không thể hoàn tác (nếu có).
- Nút nguy hiểm dùng `error`, không dùng primary.

### Inline validation

- Validate on blur + submit.
- Không validate khi người dùng chưa nhập.
- Lỗi hiển thị dưới field, giữ nguyên dữ liệu đã nhập.

---

## 5. Form & validation

- React Hook Form + Zod.
- Label trên field, placeholder chỉ là gợi ý.
- Field bắt buộc có `*`.
- Không disable nút submit chỉ vì form chưa valid; cho phép submit để hiện lỗi.
- Khi submit:
  - disable nút,
  - hiện spinner,
  - chống double submit.
- Rời form khi có thay đổi chưa lưu: confirm.
- Server error map về đúng field nếu có `errors`.

---

## 6. RBAC trên UI

- Quyền quyết định bởi **permission code**, không phải role name.
- Dùng `useCan`, `<Can permission="...">`, `RequirePermission`.
- Không hard-code `admin`, `super_admin` trong page.
- Không render nút nếu người dùng không có quyền.
- Với hành động nguy hiểm: vẫn kiểm tra lại ở backend.
- Ẩn menu/route không có quyền; không để người dùng bấm vào rồi 403.
- 403 page phải có CTA quay về trang có quyền.

---

## 7. Accessibility

- Mọi input có label liên kết.
- Icon-only button có `aria-label`.
- Focus ring rõ, dùng token `--wms-focus-ring`.
- Keyboard:
  - Tab đi đúng thứ tự,
  - Enter submit,
  - Escape đóng dialog/menu,
  - phím mũi tên cho radio/select.
- Dialog: focus trap + trả focus về trigger.
- Màu không phải tín hiệu duy nhất.
- Touch target tối thiểu `44px`.
- Tôn trọng `prefers-reduced-motion`.
- Không dùng `div` giả button.

---

## 8. Nội dung & i18n

- Ngôn ngữ mặc định: tiếng Việt.
- Không hard-code chuỗi trong page; dùng `t()` hoặc file i18n.
- Câu ngắn, động từ rõ: “Lưu”, “Huỷ”, “Xác nhận nhập kho”.
- Không viết hoa toàn bộ câu.
- Ngày: `dd/MM/yyyy`; thời gian: `HH:mm`.
- Số: phân tách hàng nghìn theo locale Việt Nam.
- Trạng thái dùng danh từ/tính từ thống nhất:
  - `Hoàn tất`, `Đang nhập`, `Chờ duyệt`, `Đã huỷ`.
- Không đổi nhãn trạng thái giữa các module.

---

## 9. Loading & performance UX

- Route mới: lazy load + skeleton.
- Không block toàn app vì một query phụ.
- Không hiện spinner toàn trang nếu chỉ một card đang tải.
- Giữ layout ổn định khi dữ liệu về.
- Ảnh/chart phải có kích thước trước khi load.
- Tránh render bảng lớn không virtualize nếu > 100 dòng.
- Preload route phổ biến khi idle.

---

## 10. Anti-patterns

Không được làm:

- Tạo `ThemeProvider` thứ hai.
- Thêm thư viện UI/icon mới khi chưa duyệt.
- Copy CSS từ module khác rồi sửa màu.
- Dùng `!important` để đè style.
- Đặt `style={{ color: "#..." }}` trong page.
- Dùng `overflow-x: hidden` để che lỗi.
- Dùng modal cho mọi thứ.
- Dùng toast thay error state.
- Hard-code role/permission.
- Thêm menu/route không có permission.
- Tạo page tự dựng header/sidebar riêng.
- Dùng màu Vuexy tím cho màn hình mới.

---

## 11. Quy trình thay đổi UI

### Bước 1 — Xác định phạm vi

- Màn hình mới hay sửa màn hình cũ?
- Có cần token/component mới không?
- Có ảnh hưởng mobile/tablet không?

### Bước 2 — Chọn pattern

- Dùng page template nào?
- Dùng component nào?
- Trạng thái nào cần xử lý?

### Bước 3 — Làm đúng token

- Nếu thiếu token: bổ sung vào `src/shared/ui/tokens/`.
- Không sửa trực tiếp `css-vars.css` nếu chưa sửa TS token.
- Chạy parity test.

### Bước 4 — Kiểm tra

```bash
yarn ui:guards        # architecture + tokens + styles + icons + dependencies
yarn ui:components    # test foundation components
yarn ui:foundation    # test UI foundation
yarn test:e2e         # E2E nếu có môi trường
```

### Bước 5 — Kiểm tra thủ công

- 1440 × 900
- 1024 × 768
- 768 × 1024
- 390 × 844
- 375 × 812

Kiểm tra:

- không tràn trang,
- không tràn bảng,
- drawer/menu đóng đúng,
- focus/keyboard,
- light/dark.

### Bước 6 — Cập nhật tài liệu

Nếu thay đổi token, breakpoint, component hoặc pattern:

- cập nhật 1 trong 3 file này,
- cập nhật `docs/ui/` liên quan,
- ghi rõ lý do nếu lệch baseline.

---

## 12. Definition of Done cho UI

Một màn hình chỉ được coi là xong khi:

- [ ] Đúng page template.
- [ ] Đúng token màu/font/spacing/radius.
- [ ] Có đủ loading / empty / error / no-permission.
- [ ] Có phân quyền theo permission code.
- [ ] Có i18n, không hard-code chuỗi.
- [ ] Keyboard + screen reader cơ bản hoạt động.
- [ ] Light + dark mode đều đọc được.
- [ ] 1440 / 1024 / 768 / 390 không tràn ngang.
- [ ] Bảng không cuộn ngang ngoài ý muốn.
- [ ] Không tạo theme provider/CSS toàn cục mới.
- [ ] Guard UI pass.
- [ ] Có screenshot hoặc evidence cho 3 viewport.

---

## 13. Khi nào được tạo design mới?

Chỉ tạo pattern mới khi:

1. Pattern hiện có không giải quyết được nghiệp vụ, và
2. Đã thử mở rộng component/props hiện có, và
3. Có ghi chú lý do + ảnh hưởng tới các module khác.

Nếu pattern mới được chấp nhận:

- thêm vào `src/shared/ui`,
- thêm vào `component-tokens.ts` nếu cần,
- cập nhật tài liệu này,
- thêm test/visual evidence.

---

## 14. Liên kết nguồn

- Token: `src/shared/ui/tokens/`
- Theme: `src/shared/ui/theme/`
- Foundation components: `src/shared/ui/components/`
- Shared components: `src/shared/components/`
- Responsive CSS: `src/styles/hn-responsive.css`
- Shell: `src/shared/ui/layout/UiAppShell.tsx`
- Main layout: `src/app/layouts/MainLayout.tsx`
- Table: `src/shared/components/data-display/ResponsiveDataTable.tsx`
- Guards: `yarn ui:guards`
