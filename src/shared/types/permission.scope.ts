/**
 * Data-scope integration for Permission Guard.
 *
 * Trong mô hình RBAC + data scope của Module 1, permission code chỉ cho biết
 * "có quyền làm action X hay không" (vd ORG_CREATE), nhưng KHÔNG cho biết
 * "phạm vi dữ liệu hiện tại có cho phép action X không".
 *
 * File này định nghĩa scope requirement mapping: module → action → scope tối
 * thiểu cần có. Ví dụ:
 *   - Tạo org unit (ORG_CREATE) cần scope ≥ 'co_so' (không thể tạo trong
 *     phạm vi department)
 *   - Xóa department (DEPT_INACTIVE) cần scope ≥ 'co_so'
 *   - Xem employee (EMP_VIEW) OK với mọi scope
 *
 * Khi `usePermission()`, `PermissionGuard`, `ActionButton`, ... kiểm tra quyền,
 * chúng sẽ xét CẢ permission code lẫn scope requirement để quyết định ẩn/disable action.
 */
import type { PermissionAction } from "./permission";
import { getPermissionCode } from "./permission";

/**
 * Các scope type được BE định nghĩa trong AuthContext.scope_type.
 * Thứ tự từ cao → thấp:
 *   he_thong > co_so > phong_ban > kho
 */
export type ScopeType = "he_thong" | "co_so" | "phong_ban" | "kho";

/** Số rank cho mỗi scope type (cao hơn = rộng hơn). */
const SCOPE_RANK: Record<ScopeType, number> = {
  he_thong: 4,
  co_so: 3,
  phong_ban: 2,
  kho: 1,
};

/**
 * So sánh scope: scope hiện tại có "đủ rộng" để thực hiện action không.
 * `actualScope` là scope của context đang active; `requiredScope` là scope
 * tối thiểu cần có.
 */
export function meetsMinScope(
  actualScope: ScopeType | null | undefined,
  requiredScope: ScopeType,
): boolean {
  if (!actualScope) return false;
  const actualRank = SCOPE_RANK[actualScope] ?? 0;
  const requiredRank = SCOPE_RANK[requiredScope];
  return actualRank >= requiredRank;
}

/**
 * Định nghĩa scope requirement cho mỗi module + action.
 *
 * - `'none'` — scope không ảnh hưởng (mặc định)
 * - ScopeType — scope tối thiểu cần có
 *
 * Nếu module + action không có trong map này, scope check sẽ bỏ qua
 * (backward compatible — không breaking change).
 */
export type ScopeRequirement = ScopeType | "none";

export interface ModuleScopeConfig {
  [action: string]: ScopeRequirement;
}

/**
 * Scope requirement mapping cho các module.
 *
 * Quy tắc chung:
 * - `create`: thường cần scope rộng (he_thong hoặc co_so) vì tạo entity mới
 *    trong toàn hệ thống/cơ sở
 * - `delete`/`approve`: thường cần scope rộng (he_thong hoặc co_so)
 * - `edit`: tuỳ module, thường OK nếu trong phạm vi được giao
 * - `view`: thường OK với mọi scope (data filtering do BE lo)
 *
 * LƯU Ý: scope check là lớp kiểm tra PHỤ, bên cạnh permission code.
 * Nếu module không được liệt kê, scope check sẽ BỎ QUA (không ảnh hưởng).
 */
export const MODULE_SCOPE_REQUIREMENTS: Record<string, ModuleScopeConfig> = {
  // ===== ORG UNITS =====
  // Org unit là cấp "cơ sở" — chỉ có scope hệ thống hoặc cơ sở mới tạo/xoá được.
  org_units: {
    view: "none",
    create: "co_so", // Cần scope cơ sở hoặc hệ thống để tạo org unit
    edit: "co_so",
    delete: "co_so", // Xoá (vô hiệu) org unit cần scope ≥ cơ sở
    restore: "co_so", // Khôi phục cùng scope với vô hiệu hóa
    approve: "co_so",
    export: "co_so",
    import: "co_so",
  },
  // ===== ORG CHARTS =====
  org_charts: {
    view: "none",
    create: "co_so",
    edit: "co_so",
    delete: "co_so",
    approve: "co_so",
    export: "none",
    import: "co_so",
  },
  // ===== DEPARTMENTS =====
  // Phòng ban là cấp dưới cơ sở. Tạo/xoá phòng ban cần scope ≥ cơ sở,
  // sửa/xem có thể OK ở scope phòng ban được giao.
  departments: {
    view: "none",
    create: "co_so", // Tạo phòng ban mới cần scope cơ sở
    edit: "phong_ban", // Sửa phòng ban trong phạm vi được giao
    delete: "co_so", // Vô hiệu phòng ban cần scope cơ sở
    approve: "phong_ban",
    export: "phong_ban",
    import: "phong_ban",
  },
  // ===== EMPLOYEES =====
  employees: {
    view: "none",
    create: "phong_ban", // Tạo nhân viên trong phạm vi phòng ban/cơ sở
    edit: "phong_ban",
    delete: "phong_ban", // Vô hiệu nhân viên trong phạm vi được giao
    approve: "phong_ban",
    export: "none",
    import: "phong_ban",
  },
  // ===== POSITIONS =====
  positions: {
    view: "none",
    create: "co_so",
    edit: "co_so",
    delete: "co_so",
    restore: "co_so",
    approve: "co_so",
    export: "co_so",
  },
  // ===== ROLES =====
  // Phân quyền là việc nhạy cảm — chỉ scope hệ thống mới được quản lý
  roles: {
    view: "co_so",
    create: "he_thong", // Chỉ admin hệ thống tạo/quản lý role
    edit: "he_thong",
    delete: "he_thong",
    approve: "he_thong",
    export: "co_so",
  },
  // ===== EMPLOYEE STATUS =====
  employee_status: {
    view: "none",
    create: "phong_ban",
    edit: "phong_ban",
    delete: "phong_ban",
    approve: "phong_ban",
    export: "none",
  },
  // ===== EMPLOYEE ASSIGNMENTS =====
  employee_assignments: {
    view: "none",
    create: "phong_ban",
    edit: "phong_ban",
    delete: "phong_ban",
    approve: "phong_ban",
    export: "none",
  },
  // ===== TASKS =====
  tasks: {
    view: "none",
    create: "none",
    edit: "none",
    delete: "none",
    approve: "none",
    export: "none",
  },
  // ===== WAREHOUSES =====
  // Kho là entity toàn hệ thống — không bị giới hạn bởi scope department
  warehouses: {
    view: "none",
    create: "co_so",
    edit: "co_so",
    delete: "co_so",
    restore: "co_so",
    approve: "co_so",
    export: "none",
  },
  // ===== AUDIT LOGS =====
  audit_logs: {
    view: "he_thong",
    create: "he_thong",
    edit: "he_thong",
    delete: "he_thong",
    approve: "he_thong",
    export: "he_thong",
  },
  reports: {
    view: "none",
    export: "none",
  },
};

/**
 * Lấy scope requirement tối thiểu cho một module + action.
 * Trả về `'none'` nếu không có config (bỏ qua scope check).
 */
export function getScopeRequirement(
  module: string,
  action?: PermissionAction,
): ScopeRequirement {
  if (!action) return "none";
  const moduleConfig = MODULE_SCOPE_REQUIREMENTS[module];
  if (!moduleConfig) return "none";
  return moduleConfig[action] ?? "none";
}

/**
 * Kiểm tra data scope có đáp ứng requirement cho module + action không.
 *
 * **Super admin bypass:** Nếu `isSuperAdmin = true`, scope check luôn pass
 * vì super admin có quyền truy cập toàn bộ dữ liệu, không bị giới hạn bởi
 * context scope. Điều này giải quyết vấn đề tài khoản super admin có
 * `active_context = null` (không có scope) nhưng vẫn cần thao tác được.
 *
 * @param currentScopeType - scope_type từ context đang active (vd 'phong_ban')
 * @param module - module name (vd 'org_units')
 * @param action - action (vd 'create')
 * @param isSuperAdmin - true nếu user là super admin (bypass scope check)
 * @returns true nếu scope đủ rộng hoặc không có requirement; false nếu không đủ
 */
export function hasScopeForAction(
  currentScopeType: ScopeType | null | undefined,
  module: string,
  action?: PermissionAction,
  isSuperAdmin: boolean = false,
): boolean {
  // Super admin luôn bypass scope check — họ có quyền trên toàn bộ dữ liệu
  if (isSuperAdmin) return true;

  const requirement = getScopeRequirement(module, action);
  if (requirement === "none") return true;
  return meetsMinScope(currentScopeType, requirement);
}

/**
 * Row-level scope record interface
 * Một record có thể có trường `scope` hoặc `scope_type` để xác định
 * phạm vi dữ liệu của nó.
 */
export interface RowScopeRecord {
  /** Scope type của record (vd: 'co_so', 'phong_ban') */
  scope?: ScopeType;
  /** Hoặc dùng scope_type (tùy convention của module) */
  scope_type?: ScopeType;
  /** ID của record */
  id?: string | number;
  /** Module name (optional, có thể infer từ context) */
  module?: string;
}

/**
 * Lấy scope type từ record.
 * Hỗ trợ cả 2 convention: `scope` và `scope_type`.
 */
export function getRecordScope(record: RowScopeRecord): ScopeType | undefined {
  return record.scope ?? record.scope_type;
}

/**
 * Context ID cụ thể của user đang active (org_unit_id/department_id), dùng
 * để so khớp trực tiếp với record — bổ sung cho `ScopeType` (vốn chỉ so rank).
 */
export interface RowScopeContext {
  scopeType: ScopeType | null | undefined;
  orgUnitId?: number | null;
  departmentId?: number | null;
}

/** ID tổ chức của 1 record cụ thể (vd employee.primaryAssignment). */
export interface RowScopeTarget {
  orgUnitId?: number | null;
  departmentId?: number | null;
}

/**
 * Row-level scope theo ID cụ thể — dùng khi BE CHƯA trả field `scope`/
 * `scope_type` theo từng record (trường hợp Employees/Departments hiện tại),
 * nhưng record vẫn có `org_unit_id`/`department_id` (qua join/assignment) để
 * so khớp trực tiếp với ID của context đang active.
 *
 * Quy tắc:
 * - `he_thong`: không giới hạn (toàn hệ thống).
 * - `co_so`: chỉ khớp nếu `orgUnitId` của context === của record.
 * - `phong_ban`: chỉ khớp nếu `departmentId` của context === của record.
 * - Thiếu dữ liệu ID ở 1 trong 2 phía (context hoặc record) → fail-safe, coi
 *   như KHÔNG cùng phạm vi (từ chối action) thay vì mặc định cho phép.
 */
export function isRecordInScopeById(
  context: RowScopeContext,
  target: RowScopeTarget,
): boolean {
  switch (context.scopeType) {
    case "he_thong":
      return true;
    case "co_so":
      return (
        context.orgUnitId != null &&
        target.orgUnitId != null &&
        context.orgUnitId === target.orgUnitId
      );
    case "phong_ban":
      return (
        context.departmentId != null &&
        target.departmentId != null &&
        context.departmentId === target.departmentId
      );
    default:
      return false;
  }
}

/**
 * Kiểm tra quyền thực hiện action trên 1 record cụ thể, kết hợp:
 * 1. Kết quả `usePermission()`/`useCan()` (permission code + scope-tier context)
 *    đã tính sẵn (`hasModulePermission`).
 * 2. Row-level scope theo ID cụ thể (`isRecordInScopeById`) khi requirement
 *    của module+action là `co_so` hoặc `phong_ban` — chặn thao tác lên record
 *    thuộc đơn vị/phòng ban khác ngoài phạm vi context đang active.
 *
 * Super admin luôn bypass (nhất quán với `hasScopeForAction()`/`canAction()`).
 */
export function canActionOnRow(
  hasModulePermission: boolean,
  context: RowScopeContext,
  target: RowScopeTarget,
  module: string,
  action: PermissionAction | undefined,
  isSuperAdmin: boolean = false,
): boolean {
  if (isSuperAdmin) return true;
  if (!hasModulePermission) return false;

  const requirement = getScopeRequirement(module, action);
  if (requirement === "none" || requirement === "he_thong") return true;

  return isRecordInScopeById(context, target);
}

/**
 * Row-level scope check nâng cao: ưu tiên dùng `scope_type` từ BE nếu record
 * có, fallback về ID matching nếu không.
 *
 * **Logic:**
 * 1. Nếu record có `scope_type` → dùng `meetsMinScope(recordScope, requirement)`
 *    (scope thật từ BE, bao gồm allow/deny/union).
 * 2. Nếu record KHÔNG có `scope_type` → fallback về `canActionOnRow()` (ID matching).
 *
 * Cách dùng:
 * ```tsx
 * const canEdit = canActionOnRowWithScope(
 *   hasModulePermission,
 *   rowScopeContext,
 *   record, // record có thể có scope_type
 *   { orgUnitId: record.orgUnitId, departmentId: record.departmentId },
 *   'org_units',
 *   'edit',
 *   isSuperAdmin,
 * );
 * ```
 */
export function canActionOnRowWithScope(
  hasModulePermission: boolean,
  context: RowScopeContext,
  record: RowScopeRecord,
  target: RowScopeTarget,
  module: string,
  action: PermissionAction | undefined,
  isSuperAdmin: boolean = false,
): boolean {
  // Super admin bypass
  if (isSuperAdmin) return true;
  if (!hasModulePermission) return false;

  const requirement = getScopeRequirement(module, action);
  if (requirement === "none" || requirement === "he_thong") return true;

  // Ưu tiên 1: Nếu BE đã trả scope_type theo record → dùng scope thật
  const recordScope = getRecordScope(record);
  if (recordScope) {
    return meetsMinScope(recordScope, requirement);
  }

  // Fallback: ID matching (cách cũ)
  return isRecordInScopeById(context, target);
}

export function canAction(
  record: RowScopeRecord,
  action: PermissionAction,
  module: string,
  userPermissions: string[],
  isSuperAdmin: boolean = false,
): boolean {
  // Super admin bypass — nhất quán với hasScopeForAction()/usePermission():
  // có quyền trên toàn bộ dữ liệu, không bị chặn bởi permission code hay scope.
  if (isSuperAdmin) return true;

  // Bước 1: Lấy permission code cần thiết
  const requiredCode = getPermissionCode(action, module);

  // Bước 2: Kiểm tra user có permission code không
  if (!userPermissions.includes(requiredCode)) {
    return false;
  }

  // Bước 3: Kiểm tra scope requirement cho module + action
  const requirement = getScopeRequirement(module, action);
  if (requirement === "none") {
    // Không có scope requirement → chỉ cần permission code
    return true;
  }

  // Bước 4: Kiểm tra scope của record có đủ rộng không
  const recordScope = getRecordScope(record);
  if (!recordScope) {
    // Không xác định được scope của record → từ chối (fail-safe)
    return false;
  }

  return meetsMinScope(recordScope, requirement);
}
