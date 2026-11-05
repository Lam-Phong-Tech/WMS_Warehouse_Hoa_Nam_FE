import { http } from "@/shared/api/http";
import type {
  IamPermission,
  IamRole,
  IamUser,
} from "@/modules/iam/types/iam.types";
import type { AuditLog } from "@/modules/audit-logs/types/audit-logs.types";

export const LONG_USER_NAME =
  "Nguyễn Minh Anh — Điều phối vận hành kho và kiểm soát dữ liệu Hoa Nam";
export const LONG_ROLE_CODE = "WAREHOUSE_COORDINATOR_LONG_REFERENCE_20261104";
export const permissions: IamPermission[] = [
  ["iam.user.view", "Xem người dùng"],
  ["iam.user.manage", "Quản lý người dùng"],
  ["iam.role.view", "Xem vai trò"],
  ["iam.role.manage", "Quản lý vai trò"],
  ["inbound.view", "Xem phiếu nhập kho"],
  ["inbound.create", "Tạo phiếu nhập kho"],
  ["inbound.update", "Sửa phiếu nhập kho"],
  ["inbound.post", "Ghi nhận nhập kho"],
  ["outbound.view", "Xem phiếu xuất kho"],
  ["outbound.create", "Tạo phiếu xuất kho"],
  ["outbound.post", "Ghi nhận xuất kho"],
  ["inventory.view", "Tra cứu tồn kho"],
  ["inventory.trace", "Truy vết tồn kho"],
  ["sku.view", "Xem danh sách SKU"],
  ["sku.manage", "Quản lý danh mục SKU"],
  ["report.view", "Xem báo cáo"],
  ["report.export", "Xuất báo cáo"],
  ["audit_log.view", "Xem nhật ký hệ thống"],
  ["warranty.view", "Xem bảo hành"],
  ["legacy.permission", "Legacy quyền cũ không còn thực thi"],
].map(([key, name], index) => ({
  permission_id: `permission-${index + 1}`,
  permission_key: key,
  permission_name: name,
  scope_type: "FUNCTION",
  status: "ACTIVE",
  is_enforced: index !== 19,
  replaced_by: index === 19 ? "inventory.view" : null,
}));

export const roles: IamRole[] = [
  {
    role_id: "role-manager",
    role_code: LONG_ROLE_CODE,
    role_name: "Quản lý kho",
    scope_type: "WAREHOUSE",
    status: "ACTIVE",
    permissions: permissions.slice(0, 14),
  },
  {
    role_id: "role-staff",
    role_code: "WAREHOUSE_STAFF",
    role_name: "Nhân viên kho",
    scope_type: "FUNCTION",
    status: "ACTIVE",
    permissions: permissions.filter((p) => p.permission_key.endsWith(".view")),
  },
  {
    role_id: "role-report",
    role_code: "REPORT_VIEWER",
    role_name: "Theo dõi báo cáo",
    scope_type: "SYSTEM",
    status: "ACTIVE",
    permissions: permissions.slice(15, 17),
  },
  {
    role_id: "role-inactive",
    role_code: "OLD_ROLE",
    role_name: "Vai trò đã ngừng sử dụng",
    scope_type: "FUNCTION",
    status: "INACTIVE",
    permissions: [],
  },
];
export const departments = [
  {
    department_id: "department-operations",
    department_code: "OPS",
    department_name: "Vận hành kho",
    status: "ACTIVE",
  },
  {
    department_id: "department-support",
    department_code: "CS",
    department_name: "Chăm sóc khách hàng và bảo hành",
    status: "ACTIVE",
  },
];
export const users: IamUser[] = Array.from({ length: 32 }, (_, index) => ({
  user_id: `user-${index + 1}`,
  username: index === 0 ? "minh.anh" : `nhan.vien.${index + 1}`,
  display_name:
    index === 0
      ? LONG_USER_NAME
      : `Nhân viên Hoa Nam ${String(index + 1).padStart(2, "0")}`,
  email:
    index === 0
      ? "minh.anh.dieu.phoi.van.hanh.kho@example.com"
      : `staff.${index + 1}@hoanam.example.com`,
  phone: index === 2 ? null : "0901234567",
  department_id: departments[index % 2].department_id,
  department: departments[index % 2],
  status: index < 24 ? "ACTIVE" : index < 28 ? "INACTIVE" : "LOCKED",
  version: index + 1,
  last_login_at: index === 2 ? null : "2026-11-02T09:40:00+07:00",
  roles: [
    {
      ...roles[index % 2],
      pivot: {
        scope_ref: "warehouse-main",
        effective_from: "2026-01-01",
        effective_to: null,
      },
    },
    ...(index === 0
      ? [{ ...roles[2], pivot: { scope_ref: "warehouse-main" } }]
      : []),
  ],
}));

export const logs: AuditLog[] = Array.from({ length: 32 }, (_, index) => ({
  id: `audit-${index + 1}`,
  actor_id: index === 2 ? null : "user-1",
  actor:
    index === 2
      ? null
      : {
          user_id: "user-1",
          username: "minh.anh",
          display_name: LONG_USER_NAME,
          email: "minh.anh@example.com",
          phone: null,
          department_id: "department-operations",
          status: "ACTIVE",
          created_at: "2026-01-01",
          updated_at: "2026-11-02",
          deleted_at: null,
        },
  action:
    index % 3 === 0
      ? "UPDATE"
      : index % 3 === 1
        ? "ASSIGN_ROLES"
        : "LOGIN_DENIED",
  object_type: index % 2 === 0 ? "Role" : "User",
  object_id: index % 2 === 0 ? "role-manager" : "user-1",
  object_code:
    index % 2 === 0
      ? LONG_ROLE_CODE
      : "minh.anh.dieu.phoi.van.hanh.kho@example.com",
  module: "SYSTEM",
  reason:
    "Điều chỉnh quyền nhập, xuất và đối soát tồn kho theo phân công vận hành",
  description: "Thay đổi quyền vai trò Quản lý kho",
  request_id: `REQUEST-AUDIT-LONG-20261104-00000000000000000000000${index}`,
  result:
    index % 4 === 0
      ? "SUCCESS"
      : index % 4 === 1
        ? "FAILED"
        : index % 4 === 2
          ? "DENIED"
          : null,
  error_code: index % 4 === 1 ? "IAM_PERMISSION_CONFLICT" : null,
  ip_address: "192.168.1.100",
  before_data: {
    role_name: "Quản lý kho",
    permission_ids: ["permission-5", "permission-9"],
    scope_ref: "warehouse-main",
    nested: { note: "Nội dung kiểm tra trước thay đổi" },
  },
  after_data: {
    role_name: "Quản lý kho",
    permission_ids: ["permission-5", "permission-9", "permission-14"],
    scope_ref: "warehouse-main",
    nested: { note: "Nội dung kiểm tra sau thay đổi — không được mất dữ liệu" },
  },
  created_at: `2026-11-02T09:${String(59 - index).padStart(2, "0")}:00+07:00`,
}));

declare global {
  interface Window {
    __iamRequests: {
      method: string;
      url: string;
      params?: Record<string, unknown>;
      payload?: unknown;
      headers?: unknown;
    }[];
    __iamConflictNext: boolean;
    __iamFailRoles: boolean;
  }
}

function apiError(status: number, message: string) {
  return Object.assign(new Error(message), {
    isAxiosError: true,
    response: {
      status,
      data: {
        code: status === 412 ? "STALE_VERSION" : "IAM_ROLE_CONFLICT",
        message,
      },
    },
    status,
  });
}
export function installIamAuditTransport() {
  if (new URLSearchParams(location.search).has("profilePreferences")) {
    Object.assign(logs[0], {
      action: "UPDATE_PROFILE_PREFERENCES",
      object_type: "app_user",
      object_code: "account@example.test",
      reason: null,
      description: "Update Profile Preferences",
      result: "SUCCESS",
      error_code: null,
      before_data: null,
      after_data: { version: 7, changed_fields: ["theme", "accent"] },
    });
  }
  window.__iamRequests = [];
  window.__iamConflictNext = false;
  window.__iamFailRoles = new URLSearchParams(location.search).has("loadError");
  http.getPage = async (rawUrl, config) => {
    const url = new URL(rawUrl, location.origin);
    const params: Record<string, unknown> = {
      ...Object.fromEntries(url.searchParams),
      ...config?.params,
    };
    window.__iamRequests.push({ method: "GET", url: url.pathname, params });
    const pathname = url.pathname;
    if (
      ![
        "/users",
        "/roles",
        "/permissions",
        "/departments",
        "/warehouses",
        "/audit-logs",
        "/audit-logs/me",
      ].includes(pathname)
    ) {
      throw new Error(`Unexpected fixture paginated GET ${rawUrl}`);
    }
    if (pathname === "/roles" && window.__iamFailRoles)
      throw apiError(503, "Không tải được vai trò");
    let data: unknown[] =
      pathname === "/users"
        ? users
        : pathname === "/roles"
          ? roles
          : pathname === "/permissions"
            ? permissions
            : pathname === "/departments"
              ? departments
              : pathname === "/warehouses"
                ? [
                    {
                      warehouse_id: "warehouse-main",
                      id: "warehouse-main",
                      warehouse_code: "KHO-TONG-HN",
                      warehouse_name: "Kho tổng Hoa Nam",
                      name: "Kho tổng Hoa Nam",
                      status: "ACTIVE",
                    },
                  ]
                : pathname.startsWith("/audit-logs")
                  ? logs
                  : [];
    const keyword = String(
      params.keyword ?? params.q ?? "",
    ).toLocaleLowerCase();
    data = data.filter((row) => {
      const record = row as Record<string, unknown>;
      return (
        (!keyword ||
          (pathname.startsWith("/audit-logs")
            ? `${record.reason ?? ""} ${record.object_type ?? ""} ${record.object_id ?? ""}`
            : JSON.stringify(row)
          )
            .toLocaleLowerCase()
            .includes(keyword)) &&
        (!params.status || record.status === params.status) &&
        (!params.department_id ||
          record.department_id === params.department_id) &&
        (!params.action || record.action === params.action) &&
        (!params.module || record.module === params.module) &&
        (!params.user_id || record.actor_id === params.user_id) &&
        (!params.date_from ||
          Date.parse(String(record.created_at)) >=
            Date.parse(String(params.date_from))) &&
        (!params.date_to ||
          Date.parse(String(record.created_at)) <=
            Date.parse(String(params.date_to)))
      );
    });
    const page = Number(params.page ?? 1);
    const perPage = Number(params.per_page ?? 100);
    return {
      data: data.slice((page - 1) * perPage, page * perPage),
      meta: {
        total: data.length,
        current_page: page,
        per_page: perPage,
        last_page: Math.max(1, Math.ceil(data.length / perPage)),
      },
    } as never;
  };
  http.get = async (url) => {
    window.__iamRequests.push({ method: "GET", url });
    if (/^\/roles\//.test(url))
      return roles.find((role) => url.endsWith(role.role_id)) as never;
    if (/^\/users\/[^/]+\/permissions$/.test(url))
      return [
        {
          user_permission_id: "override-1",
          permission_id: "permission-17",
          permission_key: "report.export",
          permission_name: "Xuất báo cáo",
          granted_by: "Quản trị viên",
          granted_at: "2026-11-02T08:00:00+07:00",
        },
      ] as never;
    throw new Error(`Unexpected fixture GET ${url}`);
  };
  http.post = async (url, body, config) => {
    window.__iamRequests.push({
      method: "POST",
      url,
      payload: body,
      headers: config?.headers,
    });
    const payload = body as Record<string, unknown>;
    if (/^\/roles\/[^/]+\/permissions$/.test(url)) {
      if (window.__iamConflictNext) {
        window.__iamConflictNext = false;
        throw apiError(412, "Vai trò đã được cập nhật bởi người khác");
      }
      const role = roles.find((entry) => url.includes(entry.role_id))!;
      role.permissions = permissions.filter((permission) =>
        (payload.permission_ids as string[]).includes(permission.permission_id),
      );
      return { ...role } as never;
    }
    if (url === "/roles") {
      const role = {
        ...payload,
        role_id: "role-new",
        permissions: [],
      } as unknown as IamRole;
      roles.push(role);
      return role as never;
    }
    if (url === "/users") {
      const user = {
        ...payload,
        user_id: "user-new",
        username: "created.user",
        version: 1,
        roles: [],
      } as unknown as IamUser;
      users.push(user);
      return user as never;
    }
    if (/^\/users\/[^/]+\/roles$/.test(url)) {
      const user = users.find((entry) => url.includes(`/${entry.user_id}/`))!;
      user.roles = (payload.roles as { role_id: string }[]).map(
        (assignment) => ({
          ...roles.find((role) => role.role_id === assignment.role_id)!,
          pivot: assignment,
        }),
      );
      return { ...user } as never;
    }
    if (/^\/users\/[^/]+\/permissions$/.test(url)) return [] as never;
    throw new Error(`Unexpected fixture POST ${url}`);
  };
  http.patch = async (url, body, config) => {
    window.__iamRequests.push({
      method: "PATCH",
      url,
      payload: body,
      headers: config?.headers,
    });
    const entity = url.startsWith("/roles/")
      ? roles.find((role) => url.endsWith(role.role_id))
      : users.find((user) => url.endsWith(user.user_id));
    if (!entity) throw new Error(`Unexpected fixture PATCH ${url}`);
    Object.assign(entity, body);
    return { ...entity } as never;
  };
  http.delete = async (url, config) => {
    window.__iamRequests.push({ method: "DELETE", url, payload: config?.data });
    return [] as never;
  };
}
