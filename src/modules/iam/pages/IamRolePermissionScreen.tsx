import { useT, type TranslateFn } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
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

const PERMISSION_MODULE_KEYS: Record<string, MessageKey> = {
  iam: "iam.permissionModule.iam",
  sku: "iam.permissionModule.sku",
  catalog: "iam.permissionModule.catalog",
  inbound: "iam.permissionModule.inbound",
  outbound: "iam.permissionModule.outbound",
  inventory: "iam.permissionModule.inventory",
  warranty: "iam.permissionModule.warranty",
  report: "iam.permissionModule.report",
  reports: "iam.permissionModule.report",
  pv: "iam.permissionModule.pv",
  audit: "iam.permissionModule.audit",
  container: "iam.permissionModule.container",
  putaway: "iam.permissionModule.putaway",
  component: "iam.permissionModule.component",
  label: "iam.permissionModule.label",
  scan: "iam.permissionModule.scan",
  warehouse: "iam.permissionModule.warehouse",
  agency: "iam.permissionModule.agency",
  system: "iam.permissionModule.system",
};

/** RFID là từ viết tắt kỹ thuật — không dịch. */
const PERMISSION_MODULE_LITERALS: Record<string, string> = { rfid: "RFID" };

function permissionModuleLabel(
  module: string,
  t: TranslateFn,
): string | undefined {
  const key = PERMISSION_MODULE_KEYS[module];
  if (key) return t(key);
  return PERMISSION_MODULE_LITERALS[module];
}

const PERMISSION_ACTION_KEYS: Record<string, MessageKey> = {
  view: "iam.permissionAction.view",
  manage: "iam.permissionAction.manage",
  create: "iam.permissionAction.create",
  update: "iam.permissionAction.update",
  delete: "iam.permissionAction.remove",
  scan: "iam.permissionAction.scan",
  post: "iam.permissionAction.post",
  cancel: "iam.permissionAction.cancel",
  import: "iam.permissionAction.import",
  export: "iam.permissionAction.export",
  trace: "iam.permissionAction.trace",
  publish: "iam.permissionAction.publish",
  issue: "iam.permissionAction.issue",
  approve: "iam.permissionAction.approve",
  pii: "iam.permissionAction.pii",
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

function permissionGroup(permission: IamPermission, t: TranslateFn): string {
  if (permission.permission_name.toLowerCase().startsWith("legacy")) {
    return t("iam.role.legacyGroup");
  }
  const [module] = permission.permission_key.split(".");
  return permissionModuleLabel(module, t) ?? t("iam.role.otherGroup");
}

function permissionLabel(permission: IamPermission, t: TranslateFn): string {
  const parts = permission.permission_key.split(".").filter(Boolean);
  const module =
    permissionModuleLabel(parts[0], t) ?? t("iam.role.fallbackModule");
  const actionKey = [...parts]
    .reverse()
    .map((part) => PERMISSION_ACTION_KEYS[part])
    .find(Boolean);
  const action = actionKey ? t(actionKey) : t("iam.role.fallbackAction");
  return t("iam.role.permissionLabel", { action, module });
}

function isSystemRole(role?: IamRole): boolean {
  return role?.role_code === "SUPER_ADMIN";
}

export function IamRolePermissionScreen() {
  const t = useT();
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
        const group = permissionGroup(permission, t);
        groups.set(group, [...(groups.get(group) ?? []), permission]);
      });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "vi"));
  }, [permissions]);

  const openEdit = (role: IamRole) => {
    if (isSystemRole(role)) {
      toast.warning(t("iam.role.superAdminLocked"));
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
      errors.role_code = t("iam.role.errCode");
    } else if (!/^[A-Za-z0-9_.-]+$/.test(roleCode)) {
      errors.role_code = t("iam.role.errCodeFormat");
    }
    if (!roleForm.role_name.trim()) {
      errors.role_name = t("iam.role.errName");
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
      toast.success(t("iam.role.updated"));
      setRoleModalOpen(false);
    } catch {
      // Lỗi đã được hook useUpdateIamRole toast — giữ modal mở để sửa tiếp.
    }
  };

  const toggleRoleStatus = async (role: IamRole) => {
    if (isSystemRole(role)) {
      toast.warning(t("iam.role.superAdminNoDisable"));
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
        ? t("iam.role.reactivated")
        : t("iam.role.deactivated"),
    );
  };

  const confirmToggleStatus = async (role: IamRole) => {
    const active = role.status === "ACTIVE";
    const accepted = await confirm({
      title: active
        ? t("iam.role.confirmDisableTitle")
        : t("iam.role.confirmEnableTitle"),
      content: active
        ? t("iam.role.confirmDisableBody")
        : t("iam.role.confirmEnableBody"),
      confirmText: active
        ? t("iam.role.confirmDisable")
        : t("iam.role.confirmEnable"),
      cancelText: t("iam.role.cancel"),
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
      title: t("iam.role.deleteTitle"),
      content: t("iam.role.deleteBody"),
      confirmText: t("iam.role.deleteConfirm"),
      cancelText: t("iam.role.cancel"),
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
      toast.warning(t("iam.role.superAdminNoMatrix"));
      return;
    }
    setPermissionReason("");
    setPermissionReasonError("");
    setIsReasonModalOpen(true);
  };

  const savePermissions = async () => {
    if (!selectedRole) return;
    if (permissionReason.trim().length < 5) {
      setPermissionReasonError(t("iam.role.errReason"));
      return;
    }
    try {
      await syncPermissions.mutateAsync({
        roleId: selectedRole.role_id,
        permissionIds: [...new Set(checkedIds)].sort(),
        reason: permissionReason.trim(),
      });
      toast.success(t("iam.role.matrixUpdated"));
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
              t("iam.role.statusOther"),
            )}
          />
          <Box component="span" sx={{ fontSize: 12, color: S.textMedium }}>
            <Box component="code" sx={{ ...CODE_SX, fontSize: 11 }}>
              {role.role_code}
            </Box>{" "}
            {memberCount > 0
              ? t("iam.role.memberCount", { count: memberCount })
              : t("iam.role.memberNone")}
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
              label={t("iam.role.editAria", { name: role.role_name })}
              onClick={(event) => {
                event.stopPropagation();
                openEdit(role);
              }}
            />
            <ActionIconButton
              kind={active ? "deactivate" : "activate"}
              label={
                active
                  ? t("iam.role.disableAria", { name: role.role_name })
                  : t("iam.role.enableAria", { name: role.role_name })
              }
              onClick={(event) => {
                event.stopPropagation();
                void confirmToggleStatus(role);
              }}
            />
            <ActionIconButton
              kind="delete"
              label={t("iam.role.deleteAria", { name: role.role_name })}
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
      ? t("iam.role.legacyHint")
      : !delegatable
        ? t("iam.role.noSelfGrantHint")
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
              {permissionLabel(permission, t)}
            </Box>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
              <Box component="span" sx={{ fontSize: 11, color: S.textMedium }}>
                {permission.permission_key}
              </Box>
              <ActionIconButton
                kind="copy"
                label={t("iam.role.copyKeyAria", {
                  key: permission.permission_key,
                })}
                sx={{ padding: "2px" }}
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void navigator.clipboard?.writeText(
                    permission.permission_key,
                  );
                  toast.success(t("iam.role.keyCopied"));
                }}
              />
            </Stack>
            {retired ? (
              <Box component="span" sx={{ fontSize: 11, color: S.warningText }}>
                {permission.replaced_by
                  ? t("iam.role.deprecatedWith", {
                      replacement: permission.replaced_by,
                    })
                  : t("iam.role.deprecated")}
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
        <UiCard title={t("iam.role.listTitle")}>
          <Stack spacing={1.5} sx={{ width: "100%" }}>
            <UiTextField
              type="search"
              fullWidth
              placeholder={t("iam.role.searchPlaceholder")}
              slotProps={{
                htmlInput: { "aria-label": t("iam.role.searchAria") },
              }}
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
                {t("iam.role.total", { count: rolePagination.total })}
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
              <UiStateSurface kind="empty" title={t("iam.role.listEmpty")} />
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
              <span>{t("iam.role.matrixTitle")}</span>
              <UiStatusBadge
                tone="info"
                label={t("iam.role.matrixCount", {
                  checked: checkedIds.length,
                  total: permissions.length,
                })}
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
                  {t("iam.role.undo")}
                </ActionButton>
                <ActionButton
                  kind="save"
                  disabled={!permissionsChanged}
                  loading={syncPermissions.isPending}
                  onClick={requestSavePermissions}
                >
                  {t("iam.role.saveMatrix")}
                </ActionButton>
              </Stack>
            ) : null
          }
        >
          {!canViewPermissions ? (
            <UiAlert tone="warning">{t("iam.role.noViewPermission")}</UiAlert>
          ) : permissionsQuery.isLoading ? (
            <Box sx={{ textAlign: "center", padding: 6 }}>
              <UiSpinner size={28} />
            </Box>
          ) : !selectedRole ? (
            <UiStateSurface kind="empty" title={t("iam.role.pickRole")} />
          ) : (
            <Stack spacing={2} sx={{ width: "100%" }}>
              {isSystemRole(selectedRole) ? (
                <UiAlert tone="warning" title={t("iam.role.superAdminTitle")}>
                  {t("iam.role.superAdminBody")}
                </UiAlert>
              ) : (
                <UiAlert tone="info">
                  {t("iam.role.settingForA")}{" "}
                  <strong>{selectedRole.role_name}</strong>{" "}
                  {t("iam.role.settingForB")}{" "}
                  <Box component="code" sx={CODE_SX}>
                    {selectedRole.role_code}
                  </Box>
                  {t("iam.role.settingForC")}{" "}
                  <strong>{t("iam.role.saveMatrix")}</strong>{" "}
                  {t("iam.role.settingForD")}
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
                            ariaLabel={t("iam.role.selectGroupAria", { group })}
                            onChange={(checked) => toggleGroup(items, checked)}
                          />
                        ) : null}
                        <Box component="span" sx={{ fontWeight: 600 }}>
                          {group}
                        </Box>
                      </Stack>
                      <UiStatusBadge
                        tone={checkedCount > 0 ? "info" : "neutral"}
                        label={t("iam.role.groupCount", {
                          checked: checkedCount,
                          total: items.length,
                        })}
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
        title={t("iam.role.editTitle")}
        open={roleModalOpen}
        onClose={() => setRoleModalOpen(false)}
        actions={
          <>
            <ActionButton
              kind="cancel"
              onClick={() => setRoleModalOpen(false)}
              disabled={updateRole.isPending}
            >
              {t("iam.role.cancel")}
            </ActionButton>
            <ActionButton
              kind="save"
              loading={updateRole.isPending}
              onClick={() => void saveRole()}
            >
              {t("iam.role.saveRole")}
            </ActionButton>
          </>
        }
      >
        <Stack spacing={2} sx={{ mt: 0.5 }}>
          <UiTextField
            label={t("iam.role.fieldCode")}
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
            placeholder={t("iam.role.codePlaceholder")}
            autoComplete="off"
            error={Boolean(roleFormErrors.role_code)}
            helperText={roleFormErrors.role_code}
            slotProps={{ htmlInput: { maxLength: 100 } }}
          />
          <UiTextField
            label={t("iam.role.fieldName")}
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
            placeholder={t("iam.role.namePlaceholder")}
            error={Boolean(roleFormErrors.role_name)}
            helperText={roleFormErrors.role_name}
            slotProps={{ htmlInput: { maxLength: 255 } }}
          />
          <UiTextField
            select
            label={t("iam.role.fieldScope")}
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
            <MenuItem value="SYSTEM">{t("iam.role.scopeSystem")}</MenuItem>
            <MenuItem value="WAREHOUSE">Theo kho</MenuItem>
            <MenuItem value="FUNCTION">{t("iam.role.scopeFunction")}</MenuItem>
          </UiTextField>
          <UiTextField
            select
            label={t("iam.role.fieldStatus")}
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
            <MenuItem value="ACTIVE">{t("iam.role.statusActive")}</MenuItem>
            <MenuItem value="INACTIVE">{t("iam.role.statusInactive")}</MenuItem>
          </UiTextField>
        </Stack>
      </UiDialog>

      <UiDialog
        title={t("iam.role.reasonTitle")}
        open={isReasonModalOpen}
        onClose={() => setIsReasonModalOpen(false)}
        actions={
          <>
            <ActionButton
              kind="cancel"
              onClick={() => setIsReasonModalOpen(false)}
              disabled={syncPermissions.isPending}
            >
              {t("iam.role.cancel")}
            </ActionButton>
            <ActionButton
              kind="save"
              loading={syncPermissions.isPending}
              onClick={() => void savePermissions()}
            >
              {t("iam.role.saveMatrix")}
            </ActionButton>
          </>
        }
      >
        <Stack spacing={1.5}>
          <UiText variant="body">
            {t("iam.role.reasonBodyA")}{" "}
            <strong>{selectedRole?.role_name}</strong>{" "}
            {t("iam.role.reasonBodyB")}
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
            placeholder={t("iam.role.reasonPlaceholder")}
            error={Boolean(permissionReasonError)}
            helperText={permissionReasonError || undefined}
            // BE AssignRolePermissionRequest: reason max:2000.
            slotProps={{ htmlInput: { maxLength: 2000 } }}
          />
        </Stack>
      </UiDialog>

      {confirmDialog}
    </Stack>
  );
}
