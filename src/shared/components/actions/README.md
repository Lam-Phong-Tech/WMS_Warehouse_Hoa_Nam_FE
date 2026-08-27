# Chuẩn nút hành động toàn dự án

> Mọi thao tác người dùng bấm được — trong bảng, thanh công cụ, modal, drawer —
> đều phải đi qua đúng một lớp component ở thư mục này. Không màn nào được tự
> chọn icon, tự tô màu hay tự đặt `variant` cho nút hành động nữa.

## Hình thức chốt cứng

| Thuộc tính       | Giá trị                          | Nơi quy định                            |
| ---------------- | -------------------------------- | --------------------------------------- |
| Nền              | phẳng — MUI `variant="text"`     | `ActionButton.tsx`                      |
| Màu chữ          | `color="primary"`                | `ActionButton.tsx`                      |
| Cỡ               | `size="small"`, cao 36px         | `ActionButton.tsx` + `app/mui-theme.ts` |
| Icon             | đứng trước nhãn, cỡ 16px         | `app/mui-theme.ts`                      |
| Màu icon         | theo tông nghiệp vụ của `kind`   | `shared/theme/actionIconColors.ts`      |
| Nhãn             | tiếng Việt, mặc định theo `kind` | `action-kinds.tsx`                      |
| Khoảng cách nhóm | 8px, hướng ngang                 | `ActionGroup.tsx`                       |

## Ba component

```tsx
import {
  ActionButton,
  ActionIconButton,
  ActionGroup,
} from "@/shared/components/actions";

// 1. Nút có nhãn — dùng cho hầu hết mọi trường hợp
<ActionButton kind="view" onClick={openDetail} />           // → 👁 Xem
<ActionButton kind="edit" label="Sửa thông tin" onClick={openEdit} />

// 2. Nhóm nút trong cột "Thao tác"
<ActionGroup>
  <ActionButton kind="view" onClick={() => openView(row)} />
  <ActionButton kind="edit" onClick={() => openEdit(row)} />
  <ActionButton kind="unpublish" onClick={() => unpublish(row)} />
</ActionGroup>

// 3. Nút chỉ-icon — CHỈ cho thao tác phụ ngoài bảng (đóng modal, gỡ file...)
<ActionIconButton kind="close" onClick={onClose} />
```

## Kiểm soát quyền

`ActionButton` tự kiểm tra permission + data scope khi màn khai đủ
`module` + `action`:

```tsx
<ActionButton
  kind="delete"
  module="sku"
  action="delete"
  mode="hide" // 'hide' ẩn hẳn, 'disable' hiện nhưng khoá
  onClick={remove}
/>
```

Bỏ trống `module`/`action` thì nút hiển thị bình thường, không gác quyền.

## Thêm một hành động mới

Sửa **đúng một chỗ**: `action-kinds.tsx`.

Thêm tên hành động vào union `ActionKind`, rồi khai một dòng trong
`ACTION_KINDS`:

```ts
export type ActionKind =
  | "view"
  | "edit"
  | "archive"; // ← thêm ở đây

export const ACTION_KINDS = {
  archive: { icon: InboxOutlined, tone: "neutral", label: "Lưu trữ" },
};
```

Nếu icon chưa có, khai thêm ở `shared/components/icons/index.tsx` (shim
Flaticon Uicons `fi-rr-*`) — **không** import trực tiếp `@ant-design/icons`
hay `@mui/icons-material` trong màn nghiệp vụ.

## Ngoại lệ được phép dùng `<Button>` thô

Chỉ các điều khiển **không phải hành động nghiệp vụ**, đã liệt kê tường minh
trong `action-standard.test.ts`:

- nút bật/tắt menu điều hướng (`AppHeader`)
- chuông thông báo (`NotificationBell`)
- bộ chọn kỳ và sơ đồ luồng trên `DashboardPage` (điều khiển chọn/điều hướng,
  cần giữ trạng thái "đang chọn" nên không dùng nút phẳng)

Thêm ngoại lệ mới phải sửa allowlist trong test đó — cố ý làm cho khó, để
không ai lặng lẽ vẽ nút riêng.
