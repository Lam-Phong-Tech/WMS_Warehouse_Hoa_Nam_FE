# Shared Components

Bộ component dùng chung cho mọi module. **Không chứa logic nghiệp vụ** — page/feature truyền dữ liệu + callback vào.

> Quy tắc: nếu UI lặp ở ≥ 2 module → đưa vào đây. Page chỉ điều phối + gọi component; UI nghiệp vụ riêng đặt trong `modules/<tên>/components/`.

## Import (barrel)

Luôn import qua **barrel**, không trỏ thẳng vào từng file — tránh đường dẫn dài và copy UI vào page:

```tsx
import { PageHeader, DataTable, StatusBadge } from '@/shared/components';
import { FormInput, FormSelect } from '@/shared/components/forms';
```

- `@/shared/components` — mọi component + type props (`export *` cả nhóm `forms`).
- `@/shared/components/forms` — riêng nhóm Form field (dùng khi chỉ cần form).

## Cấu trúc & quy ước đặt tên

- Thư mục chia theo **taxonomy chung**: `layout/` · `forms/` · `data-display/` · `feedback/` · `navigation/` · `cards/`.
- File component: **PascalCase** (`PageHeader.tsx`, `Loading.tsx`), khớp tên component bên trong.
- Mỗi component **export kèm type props** đặt tên `<Tên>Props` (vd `PageHeaderProps`, `StatusBadgeProps`, `FormInputProps`, `FormModalProps`) để tái sử dụng/typing nhất quán.
- Nhóm `forms/` có barrel riêng (`forms/index.ts`); tất cả nhóm cùng được re-export ở `index.ts` gốc — consumer luôn import qua barrel, không phụ thuộc đường dẫn thư mục nội bộ.
- Component nhập liệu có **hai bộ tên**: `Form*` (gốc, đang dùng trong các modal) và alias theo taxonomy (`TextField`/`SelectField`/`DateField`/`FormError`).

> **Lưu ý vị trí:** dự án dùng `src/shared/components/` (khớp alias `@/shared/*` đã cấu hình), không phải `src/components/`. Taxonomy nhóm/tên component theo đúng spec review; chỉ khác thư mục gốc để không phải đổi alias toàn repo.

| Nhóm (thư mục)                 | Component                                                                                                                                                               |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Layout (`layout/`)             | `AppShell`, `Sidebar`, `Header`, `Breadcrumb`, `PageHeader`                                                                                                             |
| Forms (`forms/`)               | `FormInput`/`TextField`, `FormSelect`/`SelectField`, `FormDatePicker`/`DateField`, `FormNumber`, `FormSwitch`, `FormTextarea`, `FieldError`/`FormError`, `SubmitButton` |
| Data display (`data-display/`) | `DataTable`, `StatusBadge`, `EmptyState`, `LoadingState`                                                                                                                |
| Feedback (`feedback/`)         | `Modal`, `FormModal`, `ConfirmButton`, `ConfirmDialog`, `Alert`, `ApiErrorAlert`, `FieldError`, `ErrorBoundary`, `Loading`                                              |
| Navigation (`navigation/`)     | `MenuItem`, `Pagination`, `Tabs`                                                                                                                                        |
| Cards (`cards/`)               | `StatCard`, `InfoCard`                                                                                                                                                  |

## Quy ước props (convention)

- **Form field** (`form/*`): luôn nhận `control` + `name` (+ `label`, `placeholder`). Lỗi validation tự hiển thị qua `FormField` (gói `Controller` + `Form.Item`). Props phụ chuẩn: `size` (`small`/`middle`/`large`), `disabled`, `allowClear`… — đã hỗ trợ đồng nhất trên các field nhập liệu.
- **Trạng thái**: `loading`, `disabled`, `danger` đặt tên đúng như antd để truyền thẳng.
- Component thuần hiển thị nhận dữ liệu qua props, không tự fetch.

### Chuẩn props chung (CommonProps)

Tất cả shared component nên tuân theo một interface props chung để dễ tái sử dụng và predictable. Bên cạnh các props chuyên biệt, import `CommonProps`/`FieldProps` từ barrel:

- `size` — `'small' | 'middle' | 'large'`
- `variant` — string (variant/visual style)
- `disabled` — boolean
- `loading` — boolean
- `error` — boolean | string (true để bật trạng thái lỗi hoặc chuỗi để hiển thị thông báo)
- `helperText` — string
- `required` — boolean
- `className` — string
- `children` — ReactNode
- `onChange` — callback (value)
- `onSubmit` — callback (form submit)

Example import:

```tsx
import { CommonProps } from '@/shared/components';

type MyButtonProps = CommonProps & { onClick?: () => void };
```

## Hiển thị lỗi theo API contract

Contract: `{ success, message, error_code, errors? }` (xem `shared/api/api-error.ts`).

- **`ApiErrorAlert`** — lỗi cấp trang/khối (query lỗi). Tự lấy `message` + liệt kê `errors` (validation theo field), kèm nút "Thử lại".
  ```tsx
  {
    isError && (
      <ApiErrorAlert
        error={error}
        onRetry={refetch}
        style={{ marginBottom: 16 }}
      />
    );
  }
  ```
- **`FieldError`** — dòng lỗi nhỏ dưới một input đặt ngoài `Form.Item`.
- Trong **mutation**: báo thành công/lỗi bằng `toast.success(...)` / `toast.error(getApiErrorMessage(e))` — import trực tiếp `import { toast } from 'sonner'` (không phải component nội bộ). `<Toaster>` được mount một lần ở [App.tsx](../../App.tsx).

## Ví dụ

```tsx
// Bảng + trạng thái
<DataTable<Row> columns={columns} dataSource={rows} loading={isLoading} />
// trong cột:
render: (active: boolean) => <StatusBadge active={active} />

// Nút xoá kèm xác nhận
<ConfirmButton
  danger
  onConfirm={() => onDelete(id)}
  loading={deletingId === id}
>
  Xoá
</ConfirmButton>

// Form thêm/sửa trong Modal — dùng FormModal (đã gói Modal + Form dọc)
<FormModal
  open={open}
  title={editing ? 'Sửa' : 'Thêm'}
  onOk={handleSubmit(onSubmit)}
  onCancel={onCancel}
  loading={isPending}
>
  <FormInput control={control} name="code" label="Mã" />
  <FormSelect control={control} name="type" label="Loại" options={OPTIONS} />
</FormModal>
```

## Khi KHÔNG nên dùng

- UI gắn chặt nghiệp vụ một module → để trong `modules/<tên>/components/`.
- Cần biến thể quá khác biệt → ưu tiên props/variant thay vì fork component.
