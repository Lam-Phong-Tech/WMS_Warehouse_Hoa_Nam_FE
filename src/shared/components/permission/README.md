# Permission System

## Overview

Permission system cung cấp các components và hooks để kiểm soát quyền truy cập (RBAC) và data scope trong ứng dụng.

## Architecture

### Core Components

- **PermissionGuard** - Wrapper component để ẩn/disable children theo permission
- **ActionButton** - Button thông minh tự động ẩn/disable theo permission
- **ActionDropdown** - Dropdown với permission filtering
- **Can** - Legacy component (vẫn được maintain)

### Core Hooks

- **usePermission()** - Hook chính kiểm tra permission + data scope
- **useCanAny()** - Kiểm tra nhiều permissions (OR logic)
- **useCanAll()** - Kiểm tra nhiều permissions (AND logic)

### Helper Functions

- **hasScopeForAction()** - Kiểm tra scope có đủ rộng không
- **canAction()** - Row-level scope checking (chờ BE support)
- **meetsMinScope()** - Compare scope levels

---

## Import Patterns

### ✅ Recommended: Use Permission Barrel

```typescript
import {
  PermissionGuard,
  ActionButton,
  canAction,
  getRecordScope,
  type RowScopeRecord,
} from '@/shared/components/permission';
```

**Lý do:**

- Entry point chuyên biệt cho permission-related code
- Dễ discover và maintain
- Consistent với feature-based architecture
- Barrel này export đầy đủ các components, hooks, và helpers

### ⚠️ Legacy: Main Components Barrel (chỉ PermissionGuard/ActionButton)

```typescript
import { PermissionGuard, ActionButton } from '@/shared/components';
```

**Lý do:**

- Vẫn hoạt động (không break existing code)
- `src/shared/components/index.ts` re-export TRỰC TIẾP từ file con
  (`./permission/PermissionGuard`, `./permission/ActionButton`), **KHÔNG**
  qua barrel `./permission` nên **không** có `usePermission`, `canAction`,
  `getRecordScope`, `Can`, ... — nếu cần các API đó, luôn import từ
  `@/shared/components/permission`, không phải barrel tổng này.

### ❌ Cấm: Import trực tiếp hook/util nội bộ

```typescript
// KHÔNG được phép — ESLint `no-restricted-imports` sẽ chặn (eslint.config.js)
import { usePermission } from '@/shared/hooks/usePermission';
import { usePermissionState } from '@/modules/auth/utils/permission';
```

**Lý do:**

- Đây là 2 file nội bộ triển khai permission system (implementation detail),
  không phải public API
- Không nhất quán với pattern, khó maintain khi hook signature thay đổi
- Chỉ các file nội bộ hệ thống permission (barrel, `PermissionGuard`,
  `ActionButton`, `Can`, `RequirePermission`, `ActionDropdown`, `@/lib/permissions`, ...)
  mới được phép import trực tiếp — luôn dùng `@/shared/components/permission`
  (component-level) hoặc `@/lib/permissions` (route-level/data-scope) trong
  code ứng dụng.

---

## Usage Examples

### 1. PermissionGuard - Hide Mode

```typescript
import { PermissionGuard } from '@/shared/components/permission';

<PermissionGuard module="org_units" action="create" mode="hide">
  <Button type="primary">Thêm mới</Button>
</PermissionGuard>
```

**Behavior:**

- Nếu user có quyền ORG_CREATE và scope đủ → render button
- Nếu thiếu quyền hoặc scope → không render gì cả

### 2. PermissionGuard - Disable Mode

```typescript
<PermissionGuard module="org_units" action="edit" mode="disable">
  <Button>Sửa</Button>
</PermissionGuard>
```

**Behavior:**

- Nếu có quyền → render button bình thường
- Nếu thiếu quyền → render button disabled + tooltip

### 3. ActionButton - Hide Mode

```typescript
import { ActionButton } from '@/shared/components/permission';

<ActionButton module="org_units" action="create" mode="hide">
  Thêm mới
</ActionButton>
```

**Behavior:**

- Tự động render Ant Design Button
- Hide nếu thiếu quyền/scope

### 4. ActionButton - Disable Mode

```typescript
<ActionButton
  module="org_units"
  action="delete"
  mode="disable"
  disabledTooltip="Cần quyền xóa vĩnh viễn"
>
  Xóa
</ActionButton>
```

**Behavior:**

- Render Button disabled với custom tooltip

### 5. Custom Permission Code

```typescript
<PermissionGuard permissionCode="ORG_FORCE_DELETE" mode="hide">
  <Button danger>Xóa vĩnh viễn</Button>
</PermissionGuard>
```

**Behavior:**

- Chỉ check permission code, KHÔNG check scope — vì ở đây không truyền `module`.
  `PermissionGuard.module` là optional; khi bỏ trống, `usePermission` không có
  gì để tra `MODULE_SCOPE_REQUIREMENTS` nên scope check coi như pass mặc định.
- **Cảnh báo:** đây KHÔNG phải hành vi chung của "custom permission code" mà là
  hệ quả của việc thiếu `module`. Nếu action đặc biệt (như force-delete) vẫn cần
  scope-aware (ví dụ chỉ Super Admin hoặc scope ≥ 'co_so' mới được thực hiện),
  PHẢI truyền kèm `module` + `action` giống ví dụ dưới, không dùng cách trên.
- Pattern khuyến nghị (scope-aware custom permission), xem thực tế tại
  `OrgUnitsTable.tsx` action "archive": vẫn truyền `module` + `action` như bình
  thường, chỉ đổi `permissionCode` để override mã quyền cần check — scope
  requirement vẫn lấy theo `module`/`action`:

```typescript
<ActionButton
  module="org_units"
  action="delete"
  permissionCode="ORG_FORCE_DELETE"
  mode="disable"
>
  Xóa vĩnh viễn
</ActionButton>
```

- Với `ActionButton`/`ActionDropdown`, `module` là bắt buộc trong props nên
  scope luôn được enforce dù có truyền `permissionCode` custom hay không.
  Chỉ `PermissionGuard` mới cho phép bỏ `module` để bypass scope hoàn toàn —
  cân nhắc kỹ trước khi dùng theo cách đó.

### 6. ActionDropdown with Permission

```typescript
import { ActionDropdown } from '@/shared/components';

const actionItems = [
  {
    key: 'edit',
    icon: <EditOutlined />,
    label: 'Sửa',
    onClick: () => onEdit(record),
    permission: 'ORG_EDIT', // Cách cũ
  },
  {
    key: 'delete',
    icon: <DeleteOutlined />,
    label: 'Xóa',
    onClick: () => onDelete(record),
    module: 'org_units', // Cách mới
    action: 'delete',
  },
];

<ActionDropdown items={actionItems} />
```

**Behavior:**

- Tự động lọc items theo permission + scope
- Chỉ show items user có quyền thực hiện

### 7. Row-level Scope (Future)

```typescript
import { canAction } from '@/shared/components/permission';

const canEdit = canAction(record, 'edit', 'org_units', userPermissions);
if (canEdit) {
  return <Button>Edit</Button>;
}
```

**Behavior:**

- Check permission code + record scope
- Chỉ hoạt động khi BE trả `scope`/`scope_type` per-record

---

## Data Scope Integration

### Scope Levels

```typescript
type ScopeType = 'he_thong' | 'co_so' | 'phong_ban' | 'kho';
```

**Rank (cao → thấp):**

- `he_thong` (4) - Hệ thống
- `co_so` (3) - Cơ sở
- `phong_ban` (2) - Phòng ban
- `kho` (1) - Kho

### Scope Requirements

Mỗi module + action có scope requirement:

```typescript
// Example: MODULE_SCOPE_REQUIREMENTS
{
  org_units: {
    create: 'co_so',    // Cần scope ≥ cơ sở
    edit: 'co_so',      // Cần scope ≥ cơ sở
    view: 'none',       // Không cần scope
  },
  departments: {
    create: 'co_so',
    edit: 'phong_ban',  // Cần scope ≥ phòng ban
    view: 'none',
  }
}
```

### Super Admin Bypass

```typescript
// Super admin (isSuperAdmin = true) bypass toàn bộ scope check
// Họ có quyền trên tất cả data bất kể scope
```

---

## Best Practices

### 1. Use module + action (Recommended)

```typescript
// ✅ Good
<PermissionGuard module="org_units" action="create">
```

### 2. Use permissionCode only for special cases

```typescript
// ⚠️ Only for special actions
<PermissionGuard permissionCode="ORG_FORCE_DELETE">
```

### 3. Choose appropriate mode

```typescript
// Hide: Khi action không có ý nghĩa nếu thiếu quyền
<PermissionGuard mode="hide">

// Disable: Khi muốn show nhưng không cho interact
<PermissionGuard mode="disable">
```

### 4. Use ActionButton for simple buttons

```typescript
// ✅ Good - Simple, concise
<ActionButton module="org_units" action="create">
  Thêm mới
</ActionButton>

// ❌ Verbose
<PermissionGuard module="org_units" action="create">
  <Button type="primary">Thêm mới</Button>
</PermissionGuard>
```

### 5. Use PermissionGuard for complex children

```typescript
// ✅ Good - Complex children
<PermissionGuard module="org_units" action="create">
  <div>
    <Icon />
    <Text>Thêm mới</Text>
    <Tooltip>...</Tooltip>
  </div>
</PermissionGuard>
```

---

## Common Patterns

### Pattern 1: Table Actions

```typescript
const columns = [
  {
    title: 'Thao tác',
    render: (_, record) => {
      const actionItems = [];

      if (canEdit) {
        actionItems.push({
          key: 'edit',
          label: 'Sửa',
          onClick: () => onEdit(record),
          module: 'org_units',
          action: 'edit',
        });
      }

      if (canDelete) {
        actionItems.push({
          key: 'delete',
          label: 'Xóa',
          danger: true,
          onClick: () => onDelete(record),
          module: 'org_units',
          action: 'delete',
        });
      }

      return <ActionDropdown items={actionItems} />;
    },
  },
];
```

### Pattern 2: Toolbar Actions

```typescript
<Space>
  <ActionButton module="org_units" action="create" type="primary">
    Thêm mới
  </ActionButton>

  <ActionButton module="org_units" action="export">
    Xuất Excel
  </ActionButton>
</Space>
```

### Pattern 3: Conditional Rendering

```typescript
const { can } = usePermission({
  module: 'org_units',
  action: 'create',
});

return (
  <div>
    {can && <Button>Create</Button>}
  </div>
);
```

---

## Testing

### Unit Tests

```typescript
import { renderHook } from '@testing-library/react';
import { usePermission } from '@/shared/components/permission';

// Test with permission
const { result } = renderHook(() =>
  usePermission({ module: 'org_units', action: 'create' }),
);
expect(result.current.can).toBe(true);

// Test without permission
// Mock auth state without ORG_CREATE
```

### Integration Tests

```typescript
import { PermissionGuard } from '@/shared/components/permission';

render(
  <PermissionGuard module="org_units" action="create">
    <Button>Create</Button>
  </PermissionGuard>
);

// Assert button not in DOM when no permission
expect(screen.queryByText('Create')).not.toBeInTheDocument();
```

---

## Troubleshooting

### Issue: Button still shows even without permission

**Check:**

1. User có permission code đúng không? (check `permissionCodes` trong auth state)
2. Scope có đủ rộng không? (check `currentScopeType`)
3. Is super admin? (bypass scope check)

### Issue: Scope check not working

**Check:**

1. Module có trong `MODULE_SCOPE_REQUIREMENTS` không?
2. Action có config scope requirement không?
3. `currentScopeType` có đúng không?

### Issue: ActionDropdown not filtering

**Check:**

1. Items có `permission` hoặc `module` + `action` không?
2. Permission code đúng format không? (VD: `ORG_EDIT`)
3. Module name đúng không? (VD: `org_units`)

---

## Related Documentation

- [Permission Test Matrix](../PERMISSION_TEST_MATRIX.md)
- [QA Evidence Checklist](../PERMISSION_QA_EVIDENCE_CHECKLIST.md)
- [Permission Catalog Alignment](../PERMISSION_CATALOG_ALIGNMENT.md)
- [Data Scope Check Fix](../P1_DATA_SCOPE_CHECK_FIX.md)

---

## Support

For questions or issues:

1. Check this README
2. Review demo page: `/demo/permission`
3. Check test matrix for expected behavior
4. Contact backend team for scope per-record API

---

**Last Updated:** 14/07/2026  
**Maintained by:** Frontend Team  
**Version:** 1.0.0
