import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Box,
  UiSpinner,
  MenuItem,
  SEMANTIC_LIGHT as S,
  Stack,
  UiAlert,
  UiCard,
  UiDialog,
  UiPagination,
  UiStateSurface,
  UiStatusBadge,
  UiText,
  UiTextField,
  useUiConfirm,
} from "@/shared/ui";
import {
  useDeleteIamRole,
  useIamPermissions,
  useIamRolesPage,
  useIamUsers,
  useSyncIamRolePermissions,
  useUpdateIamRole,
} from "@/modules/iam/hooks/use-iam";
import type {
  IamPermission,
  IamRole,
  IamRolePayload,
  IamRoleScopeType,
  IamRoleStatus,
} from "@/modules/iam/types/iam.types";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import {
  MvpSelectionCheckbox,
  mvpRowNumber,
} from "@/shared/components/mvp/MvpSelectionCell";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import {
  IAM_ROLE_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { ActionButton, ActionIconButton } from "@/shared/components/actions";

interface RoleFormValues {
  role_code: string;
  role_name: string;
  scope_type: IamRoleScopeType;
  status: IamRoleStatus;
}

const EMPTY_ROLE_FORM: RoleFormValues = {
  role_code: "",
  role_name: "",
  scope_type: "FUNCTION",
  status: "ACTIVE",
};

const PERMISSION_MODULE_LABELS: Record<string, string> = {
  iam: "Người dùng & phân quyền",
  sku: "SKU & sản phẩm",
  catalog: "Danh mục",
  inbound: "Nhập kho",
  outbound: "Xuất kho",
  inventory: "Tồn kho",
  warranty: "Bảo hành",
  report: "Báo cáo",
  reports: "Báo cáo",
  pv: "Ứng dụng phân vùng",
  audit: "Nhật ký hệ thống",
  container: "Vật chứa",
  putaway: "Xếp khay",
  component: "Linh kiện",
  rfid: "RFID",
  label: "Nhãn đóng gói",
  scan: "Quét mã",
  warehouse: "Kho",
  agency: "Đối tượng nhận hàng",
  system: "Hệ thống",
};

const PERMISSION_ACTION_LABELS: Record<string, string> = {
  view: "Xem",
  manage: "Quản lý",
  create: "Tạo mới",
  update: "Cập nhật",
  delete: "Xóa",
  scan: "Quét mã",
  post: "Hoàn tất",
  cancel: "Hủy",
  import: "Nhập dữ liệu",
  export: "Xuất dữ liệu",
  trace: "Truy vết",
  publish: "Đưa lên ứng dụng",
  issue: "Xuất",
  approve: "Phê duyệt",
  pii: "Xem thông tin cá nhân",
};

/** Kiểu chữ "mã" (thay antd Typography.Text code) — viền + nền nhẹ từ token. */
const CODE_SX = {
  fontFamily: "monospace",
  fontSize: "0.85em",
  border: `1px solid ${S.border}`,
  borderRadius: "4px",
  backgroundColor: S.bgSubtle,
  padding: "0 4px",
} as const;

function permissionGroup(permission: IamPermission): string {
  if (permission.permission_name.toLowerCase().startsWith("legacy")) {
    return "Tương thích dữ liệu cũ";
  }
  const [module] = permission.permission_key.split(".");
  return PERMISSION_MODULE_LABELS[module] ?? "Quyền hệ thống khác";
}

function permissionLabel(permission: IamPermission): string {
  const parts = permission.permission_key.split(".").filter(Boolean);
  const module = PERMISSION_MODULE_LABELS[parts[0]] ?? "Chức năng";
  const action =
    [...parts]
      .reverse()
      .map((part) => PERMISSION_ACTION_LABELS[part])
      .find(Boolean) ?? "Thực hiện";
  return `${action} · ${module}`;
}

function isSystemRole(role?: IamRole): boolean {
  return role?.role_code === "SUPER_ADMIN";
}

export function IamRolePermissionScreen() {
  const [keyword, setKeyword] = useState("");
  const [rolePage, setRolePage] = useState(1);
  const [rolePerPage, setRolePerPage] = useState(15);
  const [selectedRoleId, setSelectedRoleId] = useState<string>();
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<IamRole>();
  // Form sửa vai trò — state cục bộ (không RHF; trước đây là antd Form.useForm).
  const [roleForm, setRoleForm] = useState<RoleFormValues>(EMPTY_ROLE_FORM);
  const [roleFormErrors, setRoleFormErrors] = useState<
    Partial<Record<"role_code" | "role_name", string>>
  >({});

  const canManageRoles = useCan(P.IAM_ROLE_MANAGE);
  const canViewPermissions = useCan(P.IAM_PERMISSION_VIEW);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const ownPermissionCodes = useAuthStore((state) => state.permissionCodes);

  // Thay antd Popconfirm — confirmDialog PHẢI render trong cây bên dưới.
  const { confirm, confirmDialog } = useUiConfirm();

  const rolesQuery = useIamRolesPage({
    keyword: keyword || undefined,
    page: rolePage,
    per_page: rolePerPage,
  });
  const permissionsQuery = useIamPermissions({ per_page: 100 });
  const usersQuery = useIamUsers({ per_page: 100 });
  const updateRole = useUpdateIamRole();
  const deleteRole = useDeleteIamRole();
  const syncPermissions = useSyncIamRolePermissions();

  const roles = rolesQuery.data?.data ?? [];
  const permissions = permissionsQuery.data ?? [];
  const rolePagination = resolveApiPagination(rolesQuery.data?.meta, {
    page: rolePage,
    pageSize: rolePerPage,
    rowCount: roles.length,
  });
  const selectedRole = roles.find((role) => role.role_id === selectedRoleId);

  const memberCountByRole = useMemo(() => {
    const map = new Map<string, number>();
    (usersQuery.data?.data ?? []).forEach((user) =>
      (user.roles ?? []).forEach((role) =>
        map.set(role.role_id, (map.get(role.role_id) ?? 0) + 1),
      ),
    );
    return map;
  }, [usersQuery.data]);

  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].role_id);
    } else if (
      selectedRoleId &&
      !roles.some((role) => role.role_id === selectedRoleId)
    ) {
      setSelectedRoleId(roles[0]?.role_id);
    }
  }, [roles, selectedRoleId]);

  useEffect(() => {
    setCheckedIds(
      selectedRole?.permissions?.map(
        (permission) => permission.permission_id,
      ) ?? [],
    );
  }, [selectedRole]);

  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, IamPermission[]>();
    permissions
      // Quyền đã thu hồi (status=INACTIVE) không còn gán được — BE trả 422 nếu cố
      // gán (AssignRolePermissionRequest kiểm status). Bày chúng ra ma trận chỉ
      // làm nhiễu và mời người dùng tick vào một ô không có tác dụng. Mã ngừng
      // hiệu lực nhưng vẫn ACTIVE theo hợp đồng WWHN-180 thì VẪN hiện, kèm nhãn
      // "Ngừng hiệu lực" và ô tick bị khoá.
      .filter((permission) => permission.status === "ACTIVE")
      .forEach((permission) => {
        const group = permissionGroup(permission);
        groups.set(group, [...(groups.get(group) ?? []), permission]);
      });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "vi"));
  }, [permissions]);

  const openEdit = (role: IamRole) => {
    if (isSystemRole(role)) {
      toast.warning(
        "Vai trò Quản trị cao nhất là vai trò hệ thống và không được chỉnh sửa.",
      );
      return;
    }
    setEditingRole(role);
    setRoleForm({
      role_code: role.role_code,
      role_name: role.role_name,
      scope_type: role.scope_type ?? "FUNCTION",
      status: role.status,
    });
    setRoleFormErrors({});
    setRoleModalOpen(true);
  };

  const saveRole = async () => {
    if (!editingRole) return;
    // Luật kiểm tra giữ nguyên từ antd Form.rules cũ.
    const errors: Partial<Record<"role_code" | "role_name", string>> = {};
    const roleCode = roleForm.role_code.trim();
    if (!roleCode) {
      errors.role_code = "Nhập mã vai trò";
    } else if (!/^[A-Za-z0-9_.-]+$/.test(roleCode)) {
      errors.role_code = "Chỉ dùng chữ, số, dấu _, . hoặc -";
    }
    if (!roleForm.role_name.trim()) {
      errors.role_name = "Nhập tên vai trò";
    }
    setRoleFormErrors(errors);
    if (Object.keys(errors).length > 0) return;

    const payload: IamRolePayload = {
      role_code: roleCode.toUpperCase(),
      role_name: roleForm.role_name.trim(),
      scope_type: roleForm.scope_type,
      status: roleForm.status,
    };
    try {
      await updateRole.mutateAsync({ roleId: editingRole.role_id, payload });
      toast.success("Đã cập nhật vai trò.");
      setRoleModalOpen(false);
    } catch {
      // Lỗi đã được hook useUpdateIamRole toast — giữ modal mở để sửa tiếp.
    }
  };

  const toggleRoleStatus = async (role: IamRole) => {
    if (isSystemRole(role)) {
      toast.warning(
        "Vai trò Quản trị cao nhất là vai trò hệ thống và không được vô hiệu hóa.",
      );
      return;
    }
    const nextStatus: IamRoleStatus =
      role.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    await updateRole.mutateAsync({
      roleId: role.role_id,
      payload: {
        role_code: role.role_code,
        role_name: role.role_name,
        scope_type: role.scope_type ?? "FUNCTION",
        status: nextStatus,
      },
    });
    toast.success(
      nextStatus === "ACTIVE"
        ? "Đã kích hoạt lại vai trò."
        : "Đã vô hiệu hóa vai trò.",
    );
  };

  const confirmToggleStatus = async (role: IamRole) => {
    const active = role.status === "ACTIVE";
    const accepted = await confirm({
      title: active ? "Vô hiệu hóa vai trò?" : "Kích hoạt lại vai trò?",
      content: active
        ? "Người dùng mang vai trò này sẽ không còn dùng được các quyền tương ứng."
        : "Vai trò sẽ hoạt động trở lại và có thể gán cho người dùng.",
      confirmText: active ? "Vô hiệu hóa" : "Kích hoạt",
      cancelText: "Hủy",
      tone: active ? "danger" : "primary",
    });
    if (!accepted) return;
    try {
      await toggleRoleStatus(role);
    } catch {
      // Lỗi đã được hook useUpdateIamRole toast.
    }
  };

  const confirmDeleteRole = async (role: IamRole) => {
    const accepted = await confirm({
      title: "Xóa vai trò?",
      content:
        "Không thể xóa vai trò nếu vai trò vẫn đang được gán cho người dùng.",
      confirmText: "Xóa",
      cancelText: "Hủy",
      tone: "danger",
    });
    if (!accepted) return;
    try {
      await deleteRole.mutateAsync(role.role_id);
    } catch {
      // Lỗi đã được hook useDeleteIamRole toast.
    }
  };

  const [isReasonModalOpen, setIsReasonModalOpen] = useState(false);
  const [permissionReason, setPermissionReason] = useState("");
  const [permissionReasonError, setPermissionReasonError] = useState("");

  const requestSavePermissions = () => {
    if (!selectedRole) return;
    if (isSystemRole(selectedRole)) {
      toast.warning(
        "Vai trò Quản trị cao nhất có toàn quyền hệ thống và không cho phép sửa ma trận quyền.",
      );
      return;
    }
    setPermissionReason("");
    setPermissionReasonError("");
    setIsReasonModalOpen(true);
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    if (permissionReason.trim().length < 5) {
      setPermissionReasonError("Vui lòng nhập lý do (tối thiểu 5 ký tự).");
      return;
    }
    try {
      await syncPermissions.mutateAsync({
        roleId: selectedRole.role_id,
        permissionIds: [...new Set(checkedIds)].sort(),
        reason: permissionReason.trim(),
      });
      toast.success("Đã cập nhật ma trận quyền cho vai trò.");
      setIsReasonModalOpen(false);
    } catch {
      // Lỗi đã được hook useSyncIamRolePermissions toast — giữ modal mở.
    }
  };

  const resetMatrix = () => {
    setCheckedIds(
      selectedRole?.permissions?.map(
        (permission) => permission.permission_id,
      ) ?? [],
    );
  };

  const toggleGroup = (items: IamPermission[], checked: boolean) => {
    const ids = new Set(checkedIds);
    items.forEach((permission) => {
      if (checked) ids.add(permission.permission_id);
      else ids.delete(permission.permission_id);
    });
    setCheckedIds([...ids]);
  };

  const permissionsChanged = useMemo(() => {
    const original = new Set(
      selectedRole?.permissions?.map(
        (permission) => permission.permission_id,
      ) ?? [],
    );
    const current = new Set(checkedIds);
    return (
      original.size !== current.size ||
      [...original].some((id) => !current.has(id))
    );
  }, [checkedIds, selectedRole]);

  const matrixEditable =
    canManageRoles && Boolean(selectedRole) && !isSystemRole(selectedRole);

  /**
   * SCR-IAM-02 — không khuếch đại đặc quyền: BE chỉ cho cấp/thu hồi những quyền
   * mà chính người thao tác đang có (PermissionDelegation). Nếu UI vẫn cho tick
   * mọi ô rồi mới nhận 403 khi bấm Lưu, người dùng không hiểu vì sao — và tệ hơn,
   * cả lần lưu hợp lệ cũng hỏng theo vì request là "thay thế toàn bộ tập quyền".
   * Khoá đúng những ô nằm ngoài phạm vi ngay tại đây để hai bên nói cùng một luật.
   */
  const delegatablePermissionKeys = useMemo(
    () => new Set(isSuperAdmin ? [] : ownPermissionCodes),
    [isSuperAdmin, ownPermissionCodes],
  );
  const canDelegate = (permissionKey: string): boolean =>
    isSuperAdmin || delegatablePermissionKeys.has(permissionKey);

  const renderRoleCard = (role: IamRole, index: number) => {
    const selected = role.role_id === selectedRoleId;
    const memberCount = memberCountByRole.get(role.role_id) ?? 0;
    const active = role.status === "ACTIVE";
    // STT theo trang hiện tại — giúp đối chiếu vị trí vai trò khi danh sách dài/phân trang.
    const stt = mvpRowNumber(rolePage, rolePerPage, index);
    return (
      <Box
        key={role.role_id}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={() => setSelectedRoleId(role.role_id)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setSelectedRoleId(role.role_id);
          }
        }}
        sx={{
          border: `1px solid ${selected ? S.primary : S.border}`,
          backgroundColor: selected ? S.primarySoft : S.bgSurface,
          borderRadius: "12px",
          padding: "10px 12px",
          marginBottom: 1,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Stack spacing={0.25} sx={{ minWidth: 0, alignItems: "flex-start" }}>
          <Box component="span" sx={{ fontWeight: 600, color: S.textHigh }}>
            <Box
              component="span"
              sx={{ color: S.textMedium, marginRight: "6px" }}
            >
              {stt}.
            </Box>
            {role.role_name}
          </Box>
          <UiStatusBadge
            tone={active ? "success" : "warning"}
            label={businessLabel(
              IAM_ROLE_STATUS_LABELS,
              role.status,
              "Trạng thái khác",
            )}
          />
          <Box component="span" sx={{ fontSize: 12, color: S.textMedium }}>
            <Box component="code" sx={{ ...CODE_SX, fontSize: 11 }}>
              {role.role_code}
            </Box>{" "}
            · {memberCount > 0 ? `${memberCount} nhân viên` : "— nhân viên"}
          </Box>
        </Stack>
        {canManageRoles && !isSystemRole(role) && (
          <Stack
            direction="row"
            spacing={0.25}
            sx={{ alignItems: "flex-start" }}
          >
            <ActionIconButton
              kind="edit"
              label={`Sửa ${role.role_name}`}
              onClick={(event) => {
                event.stopPropagation();
                openEdit(role);
              }}
            />
            <ActionIconButton
              kind={active ? "deactivate" : "activate"}
              label={
                active
                  ? `Vô hiệu hóa ${role.role_name}`
                  : `Kích hoạt ${role.role_name}`
              }
              onClick={(event) => {
                event.stopPropagation();
                void confirmToggleStatus(role);
              }}
            />
            <ActionIconButton
              kind="delete"
              label={`Xóa ${role.role_name}`}
              onClick={(event) => {
                event.stopPropagation();
                void confirmDeleteRole(role);
              }}
            />
          </Stack>
        )}
      </Box>
    );
  };

  const renderPermissionCell = (permission: IamPermission) => {
    const checked = checkedIds.includes(permission.permission_id);
    const delegatable = canDelegate(permission.permission_key);
    // `is_enforced` do BE tính từ chính bảng route lúc chạy
    // (PermissionEnforcementMap). Khi thiếu trường này — BE cũ hơn — coi như
    // còn hiệu lực để không bôi đỏ oan.
    const retired = permission.is_enforced === false;
    const disabled = !matrixEditable || !delegatable || retired;
    const tooltip = retired
      ? "Mã quyền cũ, không còn cổng nào đọc tới — tick vào không cấp thêm gì."
      : !delegatable
        ? "Bạn không thể cấp hoặc thu hồi quyền mà chính bạn không có."
        : undefined;
    return (
      <Box
        key={permission.permission_id}
        sx={{
          border: `1px solid ${checked ? S.primaryLight : S.border}`,
          backgroundColor: checked ? S.primarySoft : S.bgSurface,
          borderRadius: "10px",
          padding: "8px 10px",
          height: "100%",
        }}
      >
        <Box
          component="label"
          title={tooltip}
          sx={{
            display: "flex",
            alignItems: "flex-start",
            gap: 1,
            cursor: disabled ? "not-allowed" : "pointer",
          }}
        >
          <Box
            component="input"
            type="checkbox"
            checked={checked}
            disabled={disabled}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              const next = new Set(checkedIds);
              if (event.target.checked) next.add(permission.permission_id);
              else next.delete(permission.permission_id);
              setCheckedIds([...next]);
            }}
            sx={{ marginTop: "3px", accentColor: S.primary, flexShrink: 0 }}
          />
          <Stack spacing={0} sx={{ minWidth: 0 }}>
            <Box
              component="span"
              sx={{
                textDecoration: retired ? "line-through" : "none",
                color: retired ? S.textMedium : S.textHigh,
              }}
            >
              {permissionLabel(permission)}
            </Box>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <Box component="span" sx={{ fontSize: 11, color: S.textMedium }}>
                {permission.permission_key}
              </Box>
              <ActionIconButton
                kind="copy"
                label={`Sao chép mã quyền ${permission.permission_key}`}
                sx={{ padding: "2px" }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void navigator.clipboard?.writeText(
                    permission.permission_key,
                  );
                  toast.success("Đã sao chép mã quyền.");
                }}
              />
            </Stack>
            {retired ? (
              <Box component="span" sx={{ fontSize: 11, color: S.warningText }}>
                {permission.replaced_by
                  ? `Ngừng hiệu lực — dùng ${permission.replaced_by}`
                  : "Ngừng hiệu lực"}
              </Box>
            ) : null}
          </Stack>
        </Box>
      </Box>
    );
  };

  return (
    <Stack spacing={2} sx={{ width: "100%" }}>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          alignItems: "stretch",
          gridTemplateColumns: {
            xs: "1fr",
            xl: "minmax(0, 9fr) minmax(0, 15fr)",
          },
        }}
      >
        <UiCard title="Danh sách vai trò">
          <Stack spacing={1.5} sx={{ width: "100%" }}>
            <UiTextField
              type="search"
              fullWidth
              placeholder="Tìm vai trò..."
              slotProps={{ htmlInput: { "aria-label": "Tìm vai trò" } }}
              value={keyword}
              onChange={(event) => {
                setKeyword(event.target.value);
                setRolePage(1);
              }}
            />
            <MvpPageSizeSelector
              value={rolePerPage}
              onChange={(value) => {
                setRolePerPage(value);
                setRolePage(1);
              }}
            />
            {/* Tổng số + điều hướng trang đặt ngay cạnh ô tìm kiếm/số dòng mỗi
             * trang (thay vì tách rời xuống dưới danh sách vai trò dài) để dễ tìm. */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <UiText variant="secondary">
                Tổng {rolePagination.total} vai trò
              </UiText>
              <UiPagination
                page={rolePagination.current}
                pageSize={rolePerPage}
                total={rolePagination.total}
                showTotal={false}
                onPageChange={setRolePage}
              />
            </Box>
            {rolesQuery.isLoading ? (
              <Box sx={{ textAlign: "center", padding: 4 }}>
                <UiSpinner size={28} />
              </Box>
            ) : roles.length === 0 ? (
              <UiStateSurface kind="empty" title="Chưa có vai trò nào." />
            ) : (
              <div>
                {roles.map((role, index) => renderRoleCard(role, index))}
              </div>
            )}
          </Stack>
        </UiCard>

        <UiCard
          title={
            <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <span>Ma trận quyền hạn chi tiết</span>
              <UiStatusBadge
                tone="info"
                label={`${checkedIds.length}/${permissions.length} quyền`}
              />
            </Stack>
          }
          action={
            matrixEditable ? (
              <Stack direction="row" spacing={1}>
                <ActionButton
                  kind="undo"
                  disabled={!permissionsChanged}
                  onClick={resetMatrix}
                >
                  Hoàn tác
                </ActionButton>
                <ActionButton
                  kind="save"
                  disabled={!permissionsChanged}
                  loading={syncPermissions.isPending}
                  onClick={requestSavePermissions}
                >
                  Lưu ma trận
                </ActionButton>
              </Stack>
            ) : null
          }
        >
          {!canViewPermissions ? (
            <UiAlert tone="warning">
              Tài khoản không có quyền xem danh sách phân quyền.
            </UiAlert>
          ) : permissionsQuery.isLoading ? (
            <Box sx={{ textAlign: "center", padding: 6 }}>
              <UiSpinner size={28} />
            </Box>
          ) : !selectedRole ? (
            <UiStateSurface
              kind="empty"
              title="Chọn một vai trò để xem ma trận quyền"
            />
          ) : (
            <Stack spacing={2} sx={{ width: "100%" }}>
              {isSystemRole(selectedRole) ? (
                <UiAlert
                  tone="warning"
                  title="Đây là vai trò Quản trị cao nhất"
                >
                  Vai trò hệ thống luôn có toàn quyền; không cho phép đổi mã,
                  xóa hoặc thay ma trận quyền.
                </UiAlert>
              ) : (
                <UiAlert tone="info">
                  Đang thiết lập quyền cho vai trò:{" "}
                  <strong>{selectedRole.role_name}</strong> (Mã:{" "}
                  <Box component="code" sx={CODE_SX}>
                    {selectedRole.role_code}
                  </Box>
                  ). Tích chọn các quyền chi tiết bên dưới và bấm{" "}
                  <strong>Lưu ma trận</strong> để cập nhật.
                </UiAlert>
              )}
              {groupedPermissions.map(([group, items]) => {
                const ids = items.map((permission) => permission.permission_id);
                const checkedCount = ids.filter((id) =>
                  checkedIds.includes(id),
                ).length;
                const allChecked =
                  ids.length > 0 && checkedCount === ids.length;
                const indeterminate = checkedCount > 0 && !allChecked;
                return (
                  <Box
                    key={group}
                    sx={{
                      border: `1px solid ${S.border}`,
                      borderRadius: "10px",
                      overflow: "hidden",
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 1,
                        px: 1.5,
                        py: 1,
                        borderBottom: `1px solid ${S.border}`,
                        backgroundColor: S.bgSubtle,
                      }}
                    >
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: "center" }}
                      >
                        {matrixEditable ? (
                          <MvpSelectionCheckbox
                            checked={allChecked}
                            indeterminate={indeterminate}
                            ariaLabel={`Chọn tất cả quyền nhóm ${group}`}
                            onChange={(checked) => toggleGroup(items, checked)}
                          />
                        ) : null}
                        <Box component="span" sx={{ fontWeight: 600 }}>
                          {group}
                        </Box>
                      </Stack>
                      <UiStatusBadge
                        tone={checkedCount > 0 ? "info" : "neutral"}
                        label={`${checkedCount}/${items.length} quyền`}
                      />
                    </Box>
                    <Box
                      sx={{
                        display: "grid",
                        gap: "10px",
                        p: 1.5,
                        gridTemplateColumns: {
                          xs: "1fr",
                          md: "repeat(2, minmax(0, 1fr))",
                          xl: "repeat(3, minmax(0, 1fr))",
                        },
                      }}
                    >
                      {items.map((permission) =>
                        renderPermissionCell(permission),
                      )}
                    </Box>
                  </Box>
                );
              })}
            </Stack>
          )}
        </UiCard>
      </Box>

      <UiDialog
        title="Sửa vai trò"
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        actions={
          <>
            <ActionButton
              kind="cancel"
              onClick={() => setRoleModalOpen(false)}
              disabled={updateRole.isPending}
            >
              Hủy
            </ActionButton>
            <ActionButton
              kind="save"
              loading={updateRole.isPending}
              onClick={() => void saveRole()}
            >
              Lưu vai trò
            </ActionButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <UiTextField
            label="Mã vai trò"
            required
            fullWidth
            value={roleForm.role_code}
            onChange={(event) => {
              setRoleForm((form) => ({
                ...form,
                role_code: event.target.value,
              }));
              setRoleFormErrors((errors) => ({
                ...errors,
                role_code: undefined,
              }));
            }}
            placeholder="Ví dụ: KIEM_SOAT_KHO"
            autoComplete="off"
            error={Boolean(roleFormErrors.role_code)}
            helperText={roleFormErrors.role_code}
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
          <UiTextField
            label="Tên vai trò"
            required
            fullWidth
            value={roleForm.role_name}
            onChange={(event) => {
              setRoleForm((form) => ({
                ...form,
                role_name: event.target.value,
              }));
              setRoleFormErrors((errors) => ({
                ...errors,
                role_name: undefined,
              }));
            }}
            placeholder="Ví dụ: Kiểm soát kho"
            error={Boolean(roleFormErrors.role_name)}
            helperText={roleFormErrors.role_name}
            slotProps={{ htmlInput: { maxLength: 255 } }}
          />
          <UiTextField
            select
            label="Phạm vi áp dụng"
            required
            fullWidth
            value={roleForm.scope_type}
            onChange={(event) =>
              setRoleForm((form) => ({
                ...form,
                scope_type: event.target.value as IamRoleScopeType,
              }))
            }
          >
            <MenuItem value="SYSTEM">Toàn hệ thống</MenuItem>
            <MenuItem value="WAREHOUSE">Theo kho</MenuItem>
            <MenuItem value="FUNCTION">Theo chức năng</MenuItem>
          </UiTextField>
          <UiTextField
            select
            label="Trạng thái"
            required
            fullWidth
            value={roleForm.status}
            onChange={(event) =>
              setRoleForm((form) => ({
                ...form,
                status: event.target.value as IamRoleStatus,
              }))
            }
          >
            <MenuItem value="ACTIVE">Đang sử dụng</MenuItem>
            <MenuItem value="INACTIVE">Ngừng sử dụng</MenuItem>
          </UiTextField>
        </Stack>
      </UiDialog>

      <UiDialog
        title="Xác nhận thay đổi ma trận quyền"
        open={isReasonModalOpen}
        onClose={() => setIsReasonModalOpen(false)}
        actions={
          <>
            <ActionButton
              kind="cancel"
              onClick={() => setIsReasonModalOpen(false)}
              disabled={syncPermissions.isPending}
            >
              Hủy
            </ActionButton>
            <ActionButton
              kind="save"
              loading={syncPermissions.isPending}
              onClick={() => void savePermissions()}
            >
              Lưu ma trận
            </ActionButton>
          </>
        }
      >
        <Stack spacing={1.5}>
          <UiText variant="body">
            Vui lòng nhập lý do thay đổi ma trận quyền của vai trò{" "}
            <strong>{selectedRole?.role_name}</strong> để lưu vết audit.
          </UiText>
          <UiTextField
            multiline
            minRows={3}
            fullWidth
            value={permissionReason}
            onChange={(event) => {
              setPermissionReason(event.target.value);
              setPermissionReasonError("");
            }}
            placeholder="Vd: Bổ sung quyền theo yêu cầu nghiệp vụ phòng Kho"
            error={Boolean(permissionReasonError)}
            helperText={permissionReasonError || undefined}
          />
        </Stack>
      </UiDialog>

      {confirmDialog}
    </Stack>
  );
}
