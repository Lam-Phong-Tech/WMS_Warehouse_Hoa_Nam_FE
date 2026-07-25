# Form/Drawer/Modal Pattern Guide

Pattern chuẩn cho các form Create/Edit/View trong toàn bộ dự án ERP.

## 📦 Components đã có sẵn

### 1. `useFormPattern` Hook

Hook quản lý form state với React Hook Form + Zod validation.

```tsx
import { useFormPattern } from '@/shared/hooks/useFormPattern';

const {
  control,
  submitForm,
  errors,
  isSubmitting,
  isDirty,
  mode,
  setMode,
  resetForm,
  setValues,
  // ... other RHF methods
} = useFormPattern<FormData>({
  schema: CreateSchema,
  defaultValues: { type: 'branch', status: 'active' },
  onSubmit: async (data) => {
    await createData(data);
  },
});
```

`onSubmit` được truyền vào hook và tự động gắn vào `submitForm` — không cần gọi `handleSubmit(onSubmit)` thủ công nữa. `handleSubmit` gốc của RHF vẫn được trả về cho trường hợp cần custom submit callback khác.

**Features:**

- ✅ Zod schema validation với `zodResolver`
- ✅ Real-time validation (onChange/onBlur)
- ✅ Form mode: create | edit | view
- ✅ Dirty state tracking
- ✅ Submit loading state

### 2. `FormDrawer` Component

Drawer wrapper cho forms, hỗ trợ 3 modes.

```tsx
import { FormDrawer } from '@/shared/components';

<FormDrawer
  open={open}
  title={(mode) => mode === 'create' ? 'Thêm mới' : mode === 'edit' ? 'Chỉnh sửa' : 'Chi tiết'}
  onOk={submitForm}
  onCancel={() => {
    setOpen(false);
    resetForm();
  }}
  loading={isSubmitting}
  mode={mode}
  showOk={mode !== 'view'}  // Hide buttons in view mode
  width={560}
>
  <FormInput control={control} name="code" label="Mã" required />
  <FormSelect control={control} name="type" label="Loại" options={[...]} />
</FormDrawer>
```

**Features:**

- ✅ Dynamic title based on mode
- ✅ Auto hide buttons in view mode
- ✅ Loading state on submit button
- ✅ Customizable width/placement
- ✅ Built-in Form layout="vertical"
- ✅ destroyOnClose by default

### 3. `FormModal` Component (Existing)

Modal wrapper cho forms (tương tự FormDrawer nhưng dùng Modal).

```tsx
import { FormModal } from '@/shared/components';

<FormModal
  open={open}
  title={editing ? 'Sửa' : 'Thêm'}
  onOk={submitForm}
  onCancel={() => {
    setOpen(false);
    resetForm();
  }}
  loading={isPending}
>
  {children}
</FormModal>;
```

### 4. `FormPage` Component

Khung form dạng TRANG (không phải overlay) — dùng khi wireframe yêu cầu "Form
view" độc lập thay vì Drawer/Modal (§8 Layout patterns, Design System Module 1).

```tsx
import { FormPage, FormSection } from '@/shared/components';

<FormPage
  title="Thêm nhân viên mới"
  onOk={submitForm}
  onCancel={onCancel}
  loading={isSubmitting}
>
  <FormSection title="Thông tin cơ bản" />
  <FormInput control={control} name="fullName" label="Họ tên" />
</FormPage>;
```

### 5. `FormSection` Component

Divider chia nhóm trường trong form (§8 Layout patterns: "form view chia mục
có tiêu đề"). Trích từ pattern từng lặp lại độc lập ở `OrgUnitFormModal`.

```tsx
import { FormSection } from '@/shared/components';

<FormSection title="Thông tin liên hệ" />
<FormInput control={control} name="email" label="Email" />
```

### 6. `FormActions` Component

Hàng nút Hủy/Lưu dùng chung — `FormDrawer`/`FormPage` đã dùng sẵn bên trong,
chỉ cần tự dựng UI riêng (không dùng Drawer/Modal/Page) mới cần gọi trực tiếp.

```tsx
import { FormActions } from '@/shared/components';

<FormActions onOk={submitForm} onCancel={onCancel} loading={isSubmitting} />;
```

## 🎯 Complete Pattern Example

### Step 1: Define Zod Schema

```tsx
// types/org-unit.schemas.ts
import { z } from 'zod';

export const CreateOrgUnitSchema = z.object({
  code: z
    .string()
    .min(2, 'Mã phải có ít nhất 2 ký tự')
    .max(20, 'Mã không được quá 20 ký tự')
    .regex(/^[A-Z0-9\-_]+$/, 'Mã chỉ gồm chữ hoa, số, dấu - và _')
    .toUpperCase(),
  name: z
    .string()
    .min(2, 'Tên phải có ít nhất 2 ký tự')
    .max(100, 'Tên không được quá 100 ký tự'),
  type: z.enum(['parent', 'subsidiary', 'branch'], {
    required_error: 'Vui lòng chọn loại đơn vị',
  }),
  parent_id: z.number().nullable().optional(),
  tax_code: z
    .string()
    .regex(/^\d{10,13}$/, 'MST phải gồm 10-13 chữ số')
    .optional()
    .or(z.literal('')),
  province: z.string().optional(),
  address: z.string().max(200, 'Địa chỉ không được quá 200 ký tự').optional(),
  status: z.enum(['active', 'inactive']).default('active'),
});

export const EditOrgUnitSchema = CreateOrgUnitSchema.partial().required({
  code: true,
  name: true,
  type: true,
});

export type CreateOrgUnitFormData = z.infer<typeof CreateOrgUnitSchema>;
export type EditOrgUnitFormData = z.infer<typeof EditOrgUnitSchema>;
```

### Step 2: Create Form Component

```tsx
// components/OrgUnitForm.tsx
import { useEffect } from 'react';
import { useFormPattern } from '@/shared/hooks/useFormPattern';
import { FormDrawer } from '@/shared/components';
import { FormInput, FormSelect, FormTextarea } from '@/shared/components/forms';
import {
  CreateOrgUnitSchema,
  EditOrgUnitSchema,
  type CreateOrgUnitFormData,
} from '@/types/org-unit.schemas';

interface OrgUnitFormProps {
  open: boolean;
  onClose: () => void;
  record?: OrgUnit | null;
  onSuccess: () => void;
}

export function OrgUnitForm({
  open,
  onClose,
  record,
  onSuccess,
}: OrgUnitFormProps) {
  const isEdit = !!record;

  const {
    control,
    submitForm,
    isSubmitting,
    mode,
    setMode,
    setValues,
    resetForm,
  } = useFormPattern<CreateOrgUnitFormData>({
    schema: isEdit ? EditOrgUnitSchema : CreateOrgUnitSchema,
    defaultValues: {
      type: 'branch',
      status: 'active',
      code: '',
      name: '',
    },
    onSubmit: async (data) => {
      if (isEdit) {
        await updateOrgUnit(record.id, data);
      } else {
        await createOrgUnit(data);
      }
      onSuccess();
    },
  });

  // Set form values when editing
  useEffect(() => {
    if (isEdit && record) {
      setMode('edit');
      setValues(record);
    }
  }, [isEdit, record, setMode, setValues]);

  return (
    <FormDrawer
      open={open}
      title={(mode) =>
        mode === 'create'
          ? 'Thêm đơn vị mới'
          : mode === 'edit'
            ? 'Chỉnh sửa đơn vị'
            : 'Chi tiết đơn vị'
      }
      onOk={submitForm}
      onCancel={() => {
        onClose();
        resetForm();
      }}
      loading={isSubmitting}
      mode={mode}
      showOk={mode !== 'view'}
      width={560}
    >
      {/* Form sections */}
      <FormInput
        control={control}
        name="code"
        label="Mã đơn vị *"
        placeholder="CTY-0001"
        required
      />

      <FormInput
        control={control}
        name="name"
        label="Tên đơn vị *"
        placeholder="Công ty mẹ ABC"
        required
      />

      <FormSelect
        control={control}
        name="type"
        label="Loại đơn vị *"
        placeholder="Chọn loại đơn vị"
        required
        options={[
          { value: 'parent', label: 'Công ty mẹ' },
          { value: 'subsidiary', label: 'Công ty con' },
          { value: 'branch', label: 'Chi nhánh' },
        ]}
      />
    </FormDrawer>
  );
}
```

### Step 3: Use in Page

```tsx
// pages/OrgUnitsPage.tsx
import { useState } from 'react';
import { OrgUnitTable } from '@/modules/org-units/components/OrgUnitTable';
import { OrgUnitForm } from '@/modules/org-units/components/OrgUnitForm';

export function OrgUnitsPage() {
  const [formOpen, setFormOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<OrgUnit | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleCreate = () => {
    setSelectedRecord(null);
    setFormOpen(true);
  };

  const handleEdit = (record: OrgUnit) => {
    setSelectedRecord(record);
    setFormOpen(true);
  };

  const handleSuccess = () => {
    setFormOpen(false);
    setSelectedRecord(null);
    setRefreshKey((k) => k + 1); // Refresh table
  };

  return (
    <>
      <OrgUnitTable
        key={refreshKey}
        onCreate={handleCreate}
        onEdit={handleEdit}
      />

      <OrgUnitForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        record={selectedRecord}
        onSuccess={handleSuccess}
      />
    </>
  );
}
```

## 📋 Validation Rules từ Wireframe

### Org Unit (F1.x)

```tsx
// Mã đơn vị
code: z.string()
  .min(2, 'Mã phải có ít nhất 2 ký tự')
  .max(20, 'Mã không được quá 20 ký tự')
  .regex(/^[A-Z0-9\-_]+$/, 'Mã chỉ gồm chữ hoa, số, dấu - và _')
  .toUpperCase(),

// MST
tax_code: z.string()
  .regex(/^\d{10,13}$/, 'MST phải gồm 10-13 chữ số')
  .optional()
  .or(z.literal('')),

// Unique constraints (check on backend)
// - code: unique toàn hệ thống (kể cả inactive/soft-deleted)
// - tax_code: unique toàn hệ thống
// - parent_id: không được chọn chính nó hoặc con/cháu (chặn vòng lặp)
```

### Department (F2.x)

```tsx
// Mã phòng ban
code: z.string()
  .min(2, 'Mã phải có ít nhất 2 ký tự')
  .max(20, 'Mã không được quá 20 ký tự')
  .regex(/^PB-[A-Z0-9\-_]+$/i, 'Mã phải bắt đầu bằng PB-'),

// Trưởng phòng
manager_id: z.number()
  .nullable()
  .optional()
  .refine((id) => {
    // Validate: manager phải là nhân sự active thuộc cùng đơn vị
    return true; // Backend validation
  }, 'Trưởng phòng phải là nhân sự đang làm thuộc cùng đơn vị'),
```

### Employee (F3.x)

```tsx
// CCCD
id_card: z.string()
  .regex(/^\d{9}(\d{3})?$/, 'CCCD phải là 9 hoặc 12 chữ số'),

// Email
email: z.string()
  .email('Email không hợp lệ')
  .max(100, 'Email không được quá 100 ký tự'),

// Số điện thoại
phone: z.string()
  .regex(/^[0-9]{10,11}$/, 'SĐT phải là 10-11 chữ số'),

// Ngày sinh
dob: z.string()
  .refine((date) => {
    const d = new Date(date);
    return d < new Date(); // Phải là ngày trong quá khứ
  }, 'Ngày sinh phải là ngày trong quá khứ'),

// Trạng thái
employment_status: z.enum(['intern', 'probation', 'official', 'suspended', 'resigned']),
```

## 🎨 Design System Colors

Sử dụng màu từ Design System đã định nghĩa:

```tsx
// Primary
const COLORS = {
  accent: '#356fa3',
  accentBg: '#eaf1f8',
  accentBorder: '#bcd2e6',

  // Success
  success: '#3c6e4f',
  successBg: '#dceadf',
  successBorder: '#9cc3a8',

  // Warning
  warning: '#8a6d1f',
  warningBg: '#f6eed6',
  warningBorder: '#d9c489',

  // Danger
  danger: '#b94a48',
  dangerBg: '#fbe7e6',
  dangerBorder: '#d8a9a6',

  // Neutrals
  ink: '#2b2b2b',
  ink2: '#4a463e',
  muted: '#7a766c',
  muted2: '#8c887e',
  placeholder: '#9a968c',
  border: '#b9b6ad',
  divider: '#d8d5cc',
  paper: '#ffffff',
  canvas: '#e7e5df',
};
```

## 🔄 State Management

### Form Modes

```tsx
type FormMode = 'create' | 'edit' | 'view';

// Create mode
- Show all input fields
- Show Save/Cancel buttons
- Title: "Thêm mới"

// Edit mode
- Show all input fields
- Show Save/Cancel buttons
- Title: "Chỉnh sửa"
- Pre-fill with existing data

// View mode
- Show all fields as read-only
- Hide action buttons (or show Edit button)
- Title: "Chi tiết"
```

### Mode Switching

```tsx
const { mode, setMode } = useFormPattern({...});

// Switch to create
const handleCreate = () => {
  setMode('create');
  resetForm();
  setOpen(true);
};

// Switch to edit
const handleEdit = (record) => {
  setMode('edit');
  setValues(record);
  setOpen(true);
};

// Switch to view
const handleView = (record) => {
  setMode('view');
  setValues(record);
  setOpen(true);
};
```

## ✅ Acceptance Criteria

Pattern này đáp ứng các yêu cầu:

- [x] **Zod/React Hook Form validation**: Schema định nghĩa rõ rules, error messages
- [x] **Submit loading**: `isSubmitting` state, button loading indicator
- [x] **Server validation map vào field**: Backend trả `errors` object, frontend hiển thị inline
- [x] **Create/Edit/View modes**: Hook + Drawer hỗ trợ 3 modes
- [x] **Form sections**: Group fields theo chức năng (wireframe §6.4)
- [x] **Design system compliance**: Màu, font, spacing theo Design System doc
- [x] **Reusable**: Hook + Component dùng chung cho tất cả modules

## 📚 References

- `docs/ERP_Techstack_Architecture_Dev_Guide.md` - Tech stack
- `Wireframe P0/Design System - Module 1.md` - Design tokens
- `Wireframe P0/BA Wireframe P0 - 01 Org Unit.dc.html` - Wireframe examples
- `src/shared/components/data-display/TABLE_PATTERN.md` - Table pattern (tương tự)

## 🚀 Migration từ code cũ

### Trước (Modal thủ công)

```tsx
const [open, setOpen] = useState(false);
const [form] = Form.useForm();

<Modal
  open={open}
  onOk={() => form.submit()}
  onCancel={() => {
    setOpen(false);
    form.resetFields();
  }}
>
  <Form form={form} layout="vertical">
    <Form.Item name="code" label="Mã" rules={[...]}>
      <Input />
    </Form.Item>
  </Form>
</Modal>
```

### Sau (với pattern)

```tsx
const { control, submitForm, resetForm } = useFormPattern({
  schema: Schema,
  defaultValues: {...},
  onSubmit: async (data) => {...},
});

<FormDrawer
  open={open}
  onOk={submitForm}
  onCancel={() => {
    setOpen(false);
    resetForm();
  }}
  loading={isSubmitting}
>
  <FormInput control={control} name="code" label="Mã" />
</FormDrawer>
```

## 📝 Notes

- Tất cả validation rules đều lấy từ wireframe P0
- Backend vẫn validate lại dù frontend đã validate
- Error messages thống nhất theo message spec trong wireframe
- Mỗi field có `help` text để ghi rõ rule (vd: "2-20 ký tự")
- Required fields đánh dấu `*` màu đỏ theo design system
