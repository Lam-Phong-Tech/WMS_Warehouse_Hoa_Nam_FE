/**
 * Permission action types - chuẩn hóa toàn dự án
 */
/**
 * Permission entity interface - shared across modules
 */
export interface Permission {
  id: number;
  code: string;
  name: string;
  object: string;
  action: string;
  description: string | null;
}

export type PermissionAction =
  | "create"
  | "edit"
  | "delete"
  | "restore"
  | "approve"
  | "export"
  | "import"
  | "view";

/**
 * Permission mode - cách xử lý khi thiếu quyền
 */
export type PermissionMode = "hide" | "disable";

/**
 * Permission context cho module
 */
export interface PermissionContext {
  /** Mã module, ví dụ: 'org_units', 'departments', 'employees'. Bắt buộc nếu dùng `action`, optional nếu dùng `permissionCode` trực tiếp. */
  module?: string;
  /** Mã permission cụ thể, ví dụ: 'ORG_CREATE', 'ORG_EDIT' */
  permissionCode?: string;
  /** Action type - sẽ tự động map sang permission code nếu có rule */
  action?: PermissionAction;
  /** Cách xử lý khi thiếu quyền: 'hide' (ẩn) hoặc 'disable' (vô hiệu hóa) */
  mode?: PermissionMode;
}

/**
 * Permission rule mapping - ánh xạ action → permission code theo module
 * Ví dụ: { action: 'create', module: 'org_units' } → 'ORG_CREATE'
 */
export const PERMISSION_RULES: Record<
  string,
  Partial<Record<PermissionAction, string>>
> = {
  // Catalog BE (xác minh qua GET /api/v1/permissions 2026-07-10):
  // ORG_VIEW, ORG_CREATE, ORG_EDIT, ORG_INACTIVE, ORG_FORCE_DELETE, ORG_EXPORT
  // Action "delete" (xóa mềm / ngừng hoạt động) → ORG_INACTIVE
  // "Lưu trữ" (xóa vĩnh viễn) → dùng permissionCode trực tiếp 'ORG_FORCE_DELETE'
  org_units: {
    view: "ORG_VIEW",
    create: "ORG_CREATE",
    edit: "ORG_EDIT",
    delete: "ORG_INACTIVE",
    // Khôi phục dùng chung mã với vô hiệu hóa (BE không có mã ORG_RESTORE riêng)
    restore: "ORG_INACTIVE",
    approve: "ORG_EDIT",
    export: "ORG_EXPORT",
    import: "ORG_EXPORT",
  },
  org_charts: {
    view: "ORG_VIEW",
    create: "ORG_CREATE",
    edit: "ORG_EDIT",
    delete: "ORG_INACTIVE",
    approve: "ORG_EDIT",
    export: "ORG_EXPORT",
    import: "ORG_EXPORT",
  },
  // REQ-011 (2026-08-25): catalog BE WMS KHÔNG có mã DEPT_* — Phòng ban chỉ là
  // danh mục gán trên màn User (user đã chủ ý bỏ tab quản lý master Phòng ban).
  // Map về cặp quyền IAM thật đang enforce ở runtime: xem danh sách phòng ban
  // đi kèm màn user (iam.user.view), mọi thao tác gán/sửa qua user
  // (iam.user.manage). Giữ mã DEPT_* cũ sẽ làm PermissionGuard check mã không
  // tồn tại → luôn false → ẩn/chặn sai.
  departments: {
    view: "iam.user.view",
    create: "iam.user.manage",
    edit: "iam.user.manage",
    delete: "iam.user.manage",
    approve: "iam.user.manage",
    export: "iam.user.view",
    import: "iam.user.manage",
  },
  employees: {
    view: "EMP_VIEW",
    create: "EMP_CREATE",
    edit: "EMP_EDIT",
    // Xóa mềm → EMP_INACTIVE (khớp màn Employee)
    delete: "EMP_INACTIVE",
    approve: "EMP_EDIT",
    export: "EMP_EXPORT",
    import: "EMP_IMPORT",
  },
  positions: {
    view: "POS_VIEW",
    create: "POS_CREATE",
    edit: "POS_EDIT",
    // Xóa mềm / vô hiệu → POS_INACTIVE (khớp màn Position)
    delete: "POS_INACTIVE",
    // Khôi phục → POS_INACTIVE (cùng quyền xóa mềm)
    restore: "POS_INACTIVE",
    approve: "POS_EDIT",
    export: "POS_EXPORT",
  },
  roles: {
    // Catalog BE thực tế cho object "Vai trò & quyền" (xác minh qua
    // GET /api/v1/permissions trên môi trường test 2026-07-12): ROLE_VIEW,
    // ROLE_MANAGE, ROLE_ASSIGN, PERM_CONFIG, SCOPE_CONFIG — 5 mã RIÊNG BIỆT,
    // không gộp chung vào ROLE_MANAGE. Mapping action chuẩn (create/edit/
    // delete) dưới đây chỉ áp dụng cho CRUD vai trò (RolesPage, nút "Thêm"
    // trong trang quản lý vai trò). Các thao tác granular hơn PHẢI dùng
    // permissionCode trực tiếp thay vì action, cụ thể:
    //   - Gán/Sửa/Thu hồi vai trò của user  → permissionCode: 'ROLE_ASSIGN'
    //   - Lưu ma trận quyền chức năng       → permissionCode: 'PERM_CONFIG'
    //   - Cấp/Sửa/Thu hồi phạm vi dữ liệu   → permissionCode: 'SCOPE_CONFIG'
    // Xem UserRoleScopesPage.tsx, UserDataScopesTable.tsx.
    view: "ROLE_VIEW",
    create: "ROLE_MANAGE",
    edit: "ROLE_MANAGE",
    delete: "ROLE_MANAGE",
    approve: "ROLE_MANAGE",
    export: "ROLE_MANAGE",
  },
  employee_status: {
    // Đổi trạng thái nhân sự (M9) → EMP_STATUS
    view: "EMP_VIEW",
    create: "EMP_STATUS",
    edit: "EMP_STATUS",
    delete: "EMP_STATUS",
    approve: "EMP_STATUS",
    export: "EMP_EXPORT",
  },
  employee_assignments: {
    view: "EMP_ASSIGNMENT_VIEW",
    create: "EMP_ASSIGNMENT_CREATE",
    edit: "EMP_ASSIGNMENT_EDIT",
    delete: "EMP_ASSIGNMENT_DELETE",
    approve: "EMP_ASSIGNMENT_APPROVE",
    export: "EMP_ASSIGNMENT_EXPORT",
  },
  tasks: {
    view: "TASK_VIEW",
    create: "TASK_CREATE",
    edit: "TASK_EDIT",
    delete: "TASK_DELETE",
    approve: "TASK_APPROVE",
    export: "TASK_EXPORT",
  },
  warehouses: {
    // Catalog BE (xác nhận qua GET /api/v1/permissions 2026-07-15): WAREHOUSE_VIEW/
    // CREATE/EDIT/INACTIVE/RESTORE/STATUS/FORCE_DELETE (không có DELETE/APPROVE
    // riêng). Xóa mềm → INACTIVE, khôi phục → RESTORE (mã riêng, khác ORG).
    view: "WAREHOUSE_VIEW",
    create: "WAREHOUSE_CREATE",
    edit: "WAREHOUSE_EDIT",
    delete: "WAREHOUSE_INACTIVE",
    restore: "WAREHOUSE_RESTORE",
    approve: "WAREHOUSE_EDIT",
    export: "WAREHOUSE_VIEW",
  },
  audit_logs: {
    view: "AUDIT_VIEW",
    create: "AUDIT_EXPORT",
    edit: "AUDIT_EXPORT",
    delete: "AUDIT_EXPORT",
    approve: "AUDIT_EXPORT",
    export: "AUDIT_EXPORT",
  },
  reports: {
    view: "REPORT_VIEW",
    export: "REPORT_EXPORT",
  },
};

/**
 * Helper: Lấy permission code từ action + module
 */
export function getPermissionCode(
  action: PermissionAction,
  module: string,
  customCode?: string,
): string {
  if (customCode) return customCode;

  const moduleRules = PERMISSION_RULES[module];
  if (moduleRules && moduleRules[action]) {
    return moduleRules[action];
  }

  // Fallback: tạo mã theo convention
  const moduleUpper = module.toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return `${moduleUpper}_${action.toUpperCase()}`;
}
