import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Box,
  Stack,
  SEMANTIC_LIGHT as S,
  UiCard,
  UiSpinner,
  UiStateSurface,
  UiText,
  MenuItem,
  UiAlert,
  UiDrawer,
  UiPagination,
  UiStatusBadge,
  UiTextField,
  useUiConfirm,
} from "@/shared/ui";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import { useLanguageStore } from "@/shared/i18n/language.store";
import type { MessageKey } from "@/shared/i18n/messages";
import {
  IAM_ROLE_STATUS_LABELS,
  businessLabel,
} from "@/shared/constants/business-labels";
import { mvpRowNumber } from "@/shared/components/mvp/MvpSelectionCell";
import {
  ActionButton,
  ActionIconButton,
  RowActionButton,
  RowActionGroup,
} from "@/shared/components/actions";
import { ApiErrorAlert } from "@/shared/components/feedback/ApiErrorAlert";
import { normalizeError } from "@/shared/api/api-error";
import { useCan } from "@/shared/components/permission";
import { WMS_PERMISSION_CATALOG as P } from "@/shared/constants/wms-permissions";
import { useAuthStore } from "@/shared/store/auth.store";
import { resolveApiPagination } from "@/shared/components/mvp/mvp-pagination";
import { MvpPageSizeSelector } from "@/shared/components/mvp/MvpListPagination";
import {
  useCreateIamRole,
  useDeleteIamRole,
  useIamPermissions,
  useIamRolesPage,
  useIamUsers,
  useSyncIamRolePermissions,
  useUpdateIamRole,
} from "../hooks/use-iam";
import { getIamRole } from "../services/iam.service";
import type {
  IamPermission,
  IamRole,
  IamRolePayload,
  IamRoleScopeType,
  IamRoleStatus,
} from "../types/iam.types";
import {
  canChangePermission,
  changedPermissionIds,
  changeGroupPermissions,
} from "./iam-role-matrix";
import { IamRoleHistoryDrawer } from "./IamRoleHistoryDrawer";
import "./iam-users.css";
import "./iam-role-permission.css";

const PERMISSION_MODULE_KEYS: Record<string, MessageKey> = {
  iam: "iam.permissionModule.iam",
  sku: "iam.permissionModule.sku",
  catalog: "iam.permissionModule.catalog",
  supplier: "iam.permissionModule.supplier",
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

/**
 * Nhãn tiếng Việt cho các mã có tên BE trùng nhau hoặc tên kỹ thuật quá ngắn.
 *
 * `permission_name` là nguồn chính (xem hàm bên dưới), nhưng các mã alias
 * `scan.*` / `warranty.*` / `outbound.request.*` thường mang tên cũ giống nhau
 * nên ma trận IAM không phân biệt được chức năng. Override đúng các nhóm này;
 * mã mới thêm chỉ cần đặt `permission_name` rõ nghĩa là đủ.
 */
const PERMISSION_LABEL_OVERRIDES_VI: Record<string, string> = {
  "scan.inbound": "Quét mã nhập kho",
  "scan.outbound": "Quét mã xuất kho",
  "scan.warranty": "Quét mã bảo hành",
  "scan.classify": "Phân loại lượt quét",
  "scan.execute": "Phân loại lô quét",
  "warranty.manage": "Quản lý case bảo hành",
  "warranty.view": "Xem case bảo hành",
  "warranty.component_issue": "Xuất linh kiện bảo hành",
  "warranty.temp_only": "Tiếp nhận tạm thời bảo hành",
  "warranty.pii.view": "Xem PII bảo hành",
  "warranty.pii.export": "Xuất PII bảo hành",
  "outbound.view": "Xem chứng từ xuất kho",
  "outbound.import": "Nhập yêu cầu xuất từ Excel",
  "outbound.scan": "Quét mã xuất kho",
  "outbound.post": "Hoàn tất xuất kho",
  "outbound.cancel": "Hủy phiếu xuất nháp",
  "outbound.request.import": "Nhập yêu cầu xuất (Annex C)",
  "outbound.request.confirm": "Xác nhận yêu cầu xuất",
  "outbound.request.manual_create": "Tạo yêu cầu xuất thủ công",
  "report.view": "Xem dữ liệu báo cáo",
  "report.export": "Xuất dữ liệu báo cáo",
  "report.inventory_flow.view": "Xem báo cáo nhập kho (RPT-01)",
  "report.outbound_flow.view": "Xem báo cáo xuất kho (RPT-01B)",
  "report.stock_reconcile.view": "Xem báo cáo tồn kho & đối soát (RPT-02)",
  "report.traceability.view": "Xem báo cáo truy vết hàng hóa (RPT-03)",
  "report.import_quality.view":
    "Xem báo cáo nhập dữ liệu / đối chiếu & lỗi dữ liệu (RPT-04)",
  "report.packing_label.view": "Xem báo cáo nhãn đóng gói (RPT-05)",
  "report.warranty.view": "Xem báo cáo bảo hành & linh kiện (RPT-06)",
  "report.recipient.view": "Xem báo cáo xuất theo người nhận / đại lý (RPT-07)",
  "report.io_history.view": "Xem báo cáo lịch sử nhập – xuất kho (RPT-08)",
};

/** Kiểu chữ "mã" (thay antd Typography.Text code) — viền + nền nhẹ từ token. */
const CODE_SX = {
  fontFamily: "var(--wms-font-family)",
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

function permissionLabel(
  permission: IamPermission,
  t: TranslateFn,
  language: "vi" | "en" | "zh",
): string {
  if (language === "vi") {
    const override = PERMISSION_LABEL_OVERRIDES_VI[permission.permission_key];
    if (override) return override;
    // Tên BE là nguồn mô tả đầy đủ nhất; chỉ bỏ qua khi nó là nhãn rỗng/chung
    // chung để không lặp lại đúng câu "Nghiệp vụ" cho nhiều quyền.
    const canonical = permission.permission_name.trim();
    if (
      canonical &&
      !/^(nghiệp vụ|chức năng|quyền|quét mã|báo cáo)$/i.test(canonical)
    ) {
      return canonical;
    }
  }
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

interface RoleForm {
  role_code: string;
  role_name: string;
  scope_type: IamRoleScopeType;
  status: IamRoleStatus;
}
interface PermissionDraft {
  roleId: string;
  originalIds: string[];
  checkedIds: string[];
}
const EMPTY_FORM: RoleForm = {
  role_code: "",
  role_name: "",
  scope_type: "FUNCTION",
  status: "ACTIVE",
};
const idsOf = (role?: IamRole) =>
  role?.permissions?.map((permission) => permission.permission_id) ?? [];
const isSystemRole = (role?: IamRole) => role?.role_code === "SUPER_ADMIN";
export interface IamRolePermissionScreenProps {
  onViewUsers?: (roleId: string) => void;
  navigation?: ReactNode;
  onDirtyChange?: (dirty: boolean) => void;
}

export function IamRolePermissionScreen({
  onViewUsers,
  navigation,
  onDirtyChange,
}: IamRolePermissionScreenProps = {}) {
  const t = useT();
  const language = useLanguageStore((state) => state.language);
  const canManage = useCan(P.IAM_ROLE_MANAGE);
  const canViewPermissions = useCan(P.IAM_PERMISSION_VIEW);
  const canViewAudit = useCan(P.AUDIT_LOG_VIEW);
  const isSuperAdmin = useAuthStore((state) => state.isSuperAdmin);
  const ownPermissions = useAuthStore((state) => state.permissionCodes);
  const { confirm, confirmDialog } = useUiConfirm();
  const [keyword, setKeyword] = useState("");
  const [rolePage, setRolePage] = useState(1);
  const [rolePerPage, setRolePerPage] = useState(10);
  const [selectedRoleId, setSelectedRoleId] = useState<string>();
  const [draft, setDraft] = useState<PermissionDraft>();
  const [permissionSearch, setPermissionSearch] = useState("");
  const [reviewOpen, setReviewOpen] = useState(false);
  const [showAllMembers, setShowAllMembers] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [roleFormOpen, setRoleFormOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<IamRole>();
  const [roleForm, setRoleForm] = useState<RoleForm>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<{
    code?: string;
    name?: string;
  }>({});
  const [metadataError, setMetadataError] = useState<unknown>();
  const [permissionReason, setPermissionReason] = useState("");
  const [reasonError, setReasonError] = useState("");
  const [saveError, setSaveError] = useState<unknown>();
  const [conflict, setConflict] = useState(false);
  const [freshRole, setFreshRole] = useState<IamRole>();
  const [loadingLatest, setLoadingLatest] = useState(false);
  const rolesQuery = useIamRolesPage({
    keyword: keyword || undefined,
    page: rolePage,
    per_page: rolePerPage,
  });
  const permissionsQuery = useIamPermissions({ per_page: 100 });
  const usersQuery = useIamUsers({ per_page: 100 });
  const createRole = useCreateIamRole();
  const updateRole = useUpdateIamRole();
  const deleteRole = useDeleteIamRole();
  const syncPermissions = useSyncIamRolePermissions();
  const roles = rolesQuery.data?.data ?? [];
  const permissions = useMemo(
    () => permissionsQuery.data ?? [],
    [permissionsQuery.data],
  );
  const selectedRole =
    roles.find((role) => role.role_id === selectedRoleId) ?? roles[0];
  const currentDraft =
    selectedRole && draft?.roleId === selectedRole.role_id ? draft : undefined;
  const originalIds = currentDraft?.originalIds ?? idsOf(selectedRole);
  const checkedIds = currentDraft?.checkedIds ?? idsOf(selectedRole);
  const changedIds = changedPermissionIds(originalIds, checkedIds);
  const dirty = changedIds.length > 0;
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  const rolePagination = resolveApiPagination(rolesQuery.data?.meta, {
    page: rolePage,
    pageSize: rolePerPage,
    rowCount: roles.length,
  });
  const allUsers = usersQuery.data?.data ?? [];
  const usersTotal = Number(usersQuery.data?.meta?.total);
  const usersComplete =
    Number.isFinite(usersTotal) && usersTotal <= allUsers.length;
  const members = allUsers.filter((user) =>
    user.roles?.some((role) => role.role_id === selectedRole?.role_id),
  );
  const memberCount = (role: IamRole) =>
    allUsers.filter((user) =>
      user.roles?.some((assigned) => assigned.role_id === role.role_id),
    ).length;
  const membersLabel = (role: IamRole) =>
    usersQuery.isLoading ||
    usersQuery.isError ||
    (!usersComplete && !memberCount(role))
      ? t("iam.roleUi.membersUnknown")
      : t(usersComplete ? "iam.roleUi.members" : "iam.roleUi.membersPartial", {
          count: memberCount(role),
        });
  const canChange = (permission: IamPermission) =>
    canChangePermission(permission, isSuperAdmin, ownPermissions);
  const matrixEditable =
    canManage &&
    canViewPermissions &&
    Boolean(selectedRole) &&
    !isSystemRole(selectedRole) &&
    !permissionsQuery.isError &&
    !rolesQuery.isError &&
    !syncPermissions.isPending;
  const remoteChanged = Boolean(
    currentDraft &&
    changedPermissionIds(currentDraft.originalIds, idsOf(selectedRole)).length,
  );
  const visiblePermissions = useMemo(
    () =>
      permissions.filter(
        (permission) =>
          permission.is_enforced !== false &&
          (!permissionSearch.trim() ||
            [permission.permission_name, permission.permission_key]
              .join(" ")
              .toLocaleLowerCase()
              .includes(permissionSearch.trim().toLocaleLowerCase())),
      ),
    [permissionSearch, permissions],
  );
  const groupedPermissions = useMemo(() => {
    const groups = new Map<string, IamPermission[]>();
    visiblePermissions
      .filter((permission) => permission.status === "ACTIVE")
      .forEach((permission) => {
        const group = permissionGroup(permission, t);
        groups.set(group, [...(groups.get(group) ?? []), permission]);
      });
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b, "vi"));
  }, [visiblePermissions, t]);
  const permissionName = (id: string) =>
    permissions.find((permission) => permission.permission_id === id)
      ?.permission_name ??
    selectedRole?.permissions?.find(
      (permission) => permission.permission_id === id,
    )?.permission_name ??
    t("iam.role.fallbackModule");

  async function discardBefore(action: () => void) {
    if (syncPermissions.isPending) return;
    if (
      dirty &&
      !(await confirm({
        title: t("iam.roleUi.discardTitle"),
        content: t("iam.roleUi.discardBody"),
        confirmText: t("iam.roleUi.discard"),
        cancelText: t("iam.roleUi.keepEditing"),
        tone: "danger",
      }))
    )
      return;
    setDraft(undefined);
    setConflict(false);
    setFreshRole(undefined);
    setSaveError(undefined);
    action();
  }
  function changeChecked(next: string[]) {
    if (!selectedRole || !matrixEditable) return;
    setDraft({
      roleId: selectedRole.role_id,
      originalIds: currentDraft?.originalIds ?? idsOf(selectedRole),
      checkedIds: next,
    });
  }
  function openRoleForm(role?: IamRole) {
    setEditingRole(role);
    setRoleForm(
      role
        ? {
            role_code: role.role_code,
            role_name: role.role_name,
            scope_type: role.scope_type ?? "FUNCTION",
            status: role.status,
          }
        : EMPTY_FORM,
    );
    setFormErrors({});
    setMetadataError(undefined);
    setRoleFormOpen(true);
  }
  async function saveRole() {
    if (
      !canManage ||
      isSystemRole(editingRole) ||
      createRole.isPending ||
      updateRole.isPending
    )
      return;
    const roleCode = roleForm.role_code.trim();
    const errors = {
      code: !roleCode
        ? t("iam.role.errCode")
        : !/^[A-Za-z0-9_.-]+$/.test(roleCode)
          ? t("iam.role.errCodeFormat")
          : undefined,
      name: !roleForm.role_name.trim() ? t("iam.role.errName") : undefined,
    };
    setFormErrors(errors);
    if (errors.code || errors.name) return;
    const payload: IamRolePayload = {
      role_code: roleCode.toUpperCase(),
      role_name: roleForm.role_name.trim(),
      scope_type: roleForm.scope_type,
      status: roleForm.status,
    };
    try {
      if (editingRole)
        await updateRole.mutateAsync({ roleId: editingRole.role_id, payload });
      else {
        const created = await createRole.mutateAsync(payload);
        if (created?.role_id) {
          setKeyword(created.role_code);
          setRolePage(1);
          setSelectedRoleId(created.role_id);
        }
      }
      setRoleFormOpen(false);
    } catch (error) {
      setMetadataError(error);
    }
  }
  async function toggleRoleStatus(role: IamRole) {
    if (!canManage || isSystemRole(role) || updateRole.isPending) return;
    const active = role.status === "ACTIVE";
    if (
      !(await confirm({
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
      }))
    )
      return;
    try {
      await updateRole.mutateAsync({
        roleId: role.role_id,
        payload: {
          role_code: role.role_code,
          role_name: role.role_name,
          scope_type: role.scope_type ?? "FUNCTION",
          status: active ? "INACTIVE" : "ACTIVE",
        },
      });
      setRoleFormOpen(false);
    } catch (error) {
      setMetadataError(error);
    }
  }
  async function removeRole(role: IamRole) {
    if (!canManage || isSystemRole(role) || deleteRole.isPending) return;
    if (
      !(await confirm({
        title: t("iam.role.deleteTitle"),
        content: t("iam.role.deleteBody"),
        confirmText: t("iam.role.deleteConfirm"),
        cancelText: t("iam.role.cancel"),
        tone: "danger",
      }))
    )
      return;
    try {
      await deleteRole.mutateAsync(role.role_id);
      setDraft(undefined);
      setRoleFormOpen(false);
    } catch (error) {
      setMetadataError(error);
    }
  }
  async function savePermissions() {
    if (
      !selectedRole ||
      !matrixEditable ||
      !dirty ||
      syncPermissions.isPending ||
      conflict ||
      remoteChanged
    )
      return;
    if (
      permissionReason.trim().length < 5 ||
      permissionReason.trim().length > 2000
    ) {
      setReasonError(
        t(
          permissionReason.trim().length > 2000
            ? "iam.roleUi.reasonTooLong"
            : "iam.role.errReason",
        ),
      );
      return;
    }
    if (
      changedIds.some((id) => {
        const permission = permissions.find(
          (item) => item.permission_id === id,
        );
        return !permission || !canChange(permission);
      })
    ) {
      setReasonError(t("iam.roleUi.cannotChange"));
      return;
    }
    try {
      await syncPermissions.mutateAsync({
        roleId: selectedRole.role_id,
        permissionIds: [...new Set(checkedIds)].sort(),
        reason: permissionReason.trim(),
      });
      await rolesQuery.refetch();
      setDraft(undefined);
      setReviewOpen(false);
      setSaveError(undefined);
    } catch (error) {
      setSaveError(error);
      if ([409, 412, 428].includes(normalizeError(error).status ?? 0))
        setConflict(true);
    }
  }
  async function loadLatest() {
    if (!selectedRole || loadingLatest) return;
    setLoadingLatest(true);
    try {
      setFreshRole(await getIamRole(selectedRole.role_id));
    } catch (error) {
      setSaveError(error);
    } finally {
      setLoadingLatest(false);
    }
  }
  async function adoptLatest() {
    if (!freshRole) return;
    await rolesQuery.refetch();
    setDraft({
      roleId: freshRole.role_id,
      originalIds: idsOf(freshRole),
      checkedIds: idsOf(freshRole),
    });
    setConflict(false);
    setFreshRole(undefined);
    setReviewOpen(false);
    setSaveError(undefined);
  }
  const metadataBusy = createRole.isPending || updateRole.isPending;
  const metadataReadonly = !canManage || isSystemRole(editingRole);
  const drawerTitle = (label: string, close: () => void, busy: boolean) => (
    <span className="hn-iam-role-drawer-title">
      <span>{label}</span>
      <ActionIconButton
        kind="close"
        disabled={busy}
        label={t("common.close")}
        onClick={close}
      />
    </span>
  );
  const renderRoleCard = (role: IamRole, index: number) => {
    const selected = role.role_id === selectedRole?.role_id;
    const active = role.status === "ACTIVE";
    // STT theo trang hiện tại — giúp đối chiếu vị trí vai trò khi danh sách dài/phân trang.
    const stt = mvpRowNumber(rolePage, rolePerPage, index);
    return (
      <Box
        key={role.role_id}
        className="hn-iam-role-card"
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={() => {
          if (!selected)
            void discardBefore(() => setSelectedRoleId(role.role_id));
        }}
        onKeyDown={(event) => {
          if (
            event.target === event.currentTarget &&
            (event.key === "Enter" || event.key === " ")
          ) {
            event.preventDefault();
            if (!selected)
              void discardBefore(() => setSelectedRoleId(role.role_id));
          }
        }}
        sx={{
          border: `1px solid ${selected ? S.primary : S.border}`,
          backgroundColor: selected ? S.primarySoft : S.bgSurface,
          borderRadius: "var(--ops-radius-card)",
          padding: "10px 12px",
          marginBottom: 1,
          cursor: "pointer",
          display: "flex",
          justifyContent: "space-between",
          gap: 1,
        }}
      >
        <Stack
          spacing={0.25}
          sx={{ flex: 1, minWidth: 0, alignItems: "flex-start" }}
        >
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
          <Box
            component="span"
            sx={{
              width: "100%",
              fontSize: 12,
              color: S.textMedium,
              overflowWrap: "anywhere",
            }}
          >
            <Box
              component="code"
              sx={{ ...CODE_SX, fontSize: 11, overflowWrap: "anywhere" }}
            >
              {role.role_code}
            </Box>{" "}
            {membersLabel(role)}
          </Box>
        </Stack>
        {canManage && !isSystemRole(role) && (
          <RowActionGroup sx={{ flexShrink: 0, alignItems: "flex-start" }}>
            <RowActionButton
              kind="edit"
              disabled={
                metadataBusy ||
                deleteRole.isPending ||
                syncPermissions.isPending
              }
              label={t("iam.role.editAria", { name: role.role_name })}
              onClick={(event) => {
                event.stopPropagation();
                openRoleForm(role);
              }}
            />
            <RowActionButton
              kind={active ? "deactivate" : "activate"}
              disabled={
                metadataBusy ||
                deleteRole.isPending ||
                syncPermissions.isPending
              }
              label={
                active
                  ? t("iam.role.disableAria", { name: role.role_name })
                  : t("iam.role.enableAria", { name: role.role_name })
              }
              onClick={(event) => {
                event.stopPropagation();
                void toggleRoleStatus(role);
              }}
            />
            <RowActionButton
              kind="delete"
              disabled={
                metadataBusy ||
                deleteRole.isPending ||
                syncPermissions.isPending
              }
              label={t("iam.role.deleteAria", { name: role.role_name })}
              onClick={(event) => {
                event.stopPropagation();
                void discardBefore(() => void removeRole(role));
              }}
            />
          </RowActionGroup>
        )}
      </Box>
    );
  };

  const renderPermissionCell = (permission: IamPermission) => {
    const checked = checkedIds.includes(permission.permission_id);
    const delegatable = canChange(permission);
    // `is_enforced` do BE tính từ chính bảng route lúc chạy
    // (PermissionEnforcementMap). Khi thiếu trường này — BE cũ hơn — coi như
    // còn hiệu lực để không bôi đỏ oan.
    const retired = permission.is_enforced === false;
    const disabled =
      !matrixEditable || !delegatable || retired || conflict || remoteChanged;
    const tooltip = retired
      ? t("iam.role.legacyHint")
      : !delegatable
        ? t("iam.role.noSelfGrantHint")
        : undefined;
    return (
      <Box
        key={permission.permission_id}
        className="hn-iam-permission-cell"
        data-checked={checked}
        sx={{
          border: `1px solid ${checked ? S.primaryLight : S.border}`,
          backgroundColor: checked ? S.primarySoft : S.bgSurface,
          borderRadius: "var(--ops-radius-card)",
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
            aria-label={t("iam.roleUi.selectPermission", {
              name: permission.permission_name,
              key: permission.permission_key,
            })}
            disabled={disabled}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              changeChecked(
                changeGroupPermissions(
                  checkedIds,
                  [permission],
                  event.target.checked,
                  canChange,
                ),
              );
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
              {permissionLabel(permission, t, language)}
            </Box>
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
    <div className="hn-iam-roles">
      <header className="hn-iam-role-page-header">
        <div>
          <h1>{t("iam.roleUi.title")}</h1>
          <p>{t("iam.roleUi.subtitle")}</p>
        </div>
        <div className="hn-iam-role-page-actions">
          <ActionButton
            kind="history"
            disabled={!selectedRole}
            onClick={() => setHistoryOpen(true)}
          >
            {t("iam.roleUi.history")}
          </ActionButton>
          {canManage ? (
            <ActionButton
              kind="create"
              className="hn-iam-primary"
              onClick={() => void discardBefore(() => openRoleForm())}
            >
              {t("iam.roleUi.create")}
            </ActionButton>
          ) : null}
        </div>
      </header>
      {navigation}
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
                const value = event.target.value;
                void discardBefore(() => {
                  setKeyword(value);
                  setRolePage(1);
                });
              }}
            />
            {/* Một hàng duy nhất dưới ô tìm kiếm: số dòng mỗi trang · tổng số ·
             * điều hướng trang (thay vì tách rời thành nhiều hàng). */}
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: 1,
              }}
            >
              <MvpPageSizeSelector
                menuClassName="hn-iam-menu"
                value={rolePerPage}
                onChange={(value) => {
                  void discardBefore(() => {
                    setRolePerPage(value);
                    setRolePage(1);
                  });
                }}
              />
              <UiText variant="secondary">
                {t("iam.role.total", { count: rolePagination.total })}
              </UiText>
              <Box sx={{ marginLeft: "auto" }}>
                <UiPagination
                  page={rolePagination.current}
                  pageSize={rolePerPage}
                  total={rolePagination.total}
                  showTotal={false}
                  onPageChange={(page) =>
                    void discardBefore(() => setRolePage(page))
                  }
                />
              </Box>
            </Box>
            {rolesQuery.isError ? (
              <ApiErrorAlert
                error={rolesQuery.error}
                title={t("iam.roleUi.listLoadError")}
                onRetry={() => void rolesQuery.refetch()}
              />
            ) : rolesQuery.isLoading ? (
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
            canManage &&
            canViewPermissions &&
            selectedRole &&
            !isSystemRole(selectedRole) ? (
              <Stack
                direction="row"
                spacing={1}
                sx={{ flexWrap: "wrap", rowGap: 1 }}
              >
                <ActionButton
                  kind="undo"
                  disabled={
                    !dirty || !matrixEditable || syncPermissions.isPending
                  }
                  onClick={() => void discardBefore(() => undefined)}
                >
                  {t("iam.roleUi.reset")}
                </ActionButton>
                <ActionButton
                  kind="save"
                  className="hn-iam-primary"
                  disabled={
                    !dirty || !matrixEditable || syncPermissions.isPending
                  }
                  loading={syncPermissions.isPending}
                  onClick={() => {
                    setPermissionReason("");
                    setReasonError("");
                    setShowAllMembers(false);
                    setReviewOpen(true);
                  }}
                >
                  {t("iam.roleUi.review")}
                </ActionButton>
              </Stack>
            ) : null
          }
        >
          <Stack spacing={2} sx={{ width: "100%" }}>
            {selectedRole ? (
              <header className="hn-iam-role-selected-header">
                <div>
                  <h2>{selectedRole.role_name}</h2>
                  {isSystemRole(selectedRole) ? (
                    <UiStatusBadge
                      tone="neutral"
                      label={t("iam.roleUi.roleTypeSystem")}
                    />
                  ) : null}
                  <button
                    className="hn-iam-role-member-link"
                    type="button"
                    disabled={!onViewUsers}
                    title={
                      !usersComplete
                        ? t("iam.roleUi.membersPartialHint")
                        : undefined
                    }
                    onClick={() =>
                      void discardBefore(() =>
                        onViewUsers?.(selectedRole.role_id),
                      )
                    }
                  >
                    {membersLabel(selectedRole)}
                  </button>
                </div>
                <RowActionButton
                  kind="view"
                  label={t("iam.roleUi.roleInfo")}
                  onClick={() => openRoleForm(selectedRole)}
                />
              </header>
            ) : null}
            {saveError && !reviewOpen ? (
              <ApiErrorAlert error={saveError} />
            ) : null}
            {!canViewPermissions ? (
              <UiAlert tone="warning">{t("iam.role.noViewPermission")}</UiAlert>
            ) : permissionsQuery.isError || rolesQuery.isError ? (
              <ApiErrorAlert
                error={permissionsQuery.error || rolesQuery.error}
                title={t("iam.roleUi.loadError")}
                onRetry={() => {
                  void rolesQuery.refetch();
                  void permissionsQuery.refetch();
                }}
              />
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
                ) : null}
                {dirty ? (
                  <span className="hn-iam-role-dirty" role="status">
                    {t("iam.roleUi.changes", { count: changedIds.length })}
                  </span>
                ) : null}
                {remoteChanged || conflict ? (
                  <UiAlert tone="warning" title={t("iam.roleUi.conflictTitle")}>
                    {t("iam.roleUi.conflictBody")}
                  </UiAlert>
                ) : null}
                <UiTextField
                  type="search"
                  className="hn-iam-permission-search"
                  fullWidth
                  value={permissionSearch}
                  onChange={(event) => setPermissionSearch(event.target.value)}
                  placeholder={t("iam.roleUi.searchPermission")}
                  slotProps={{
                    htmlInput: {
                      "aria-label": t("iam.roleUi.searchPermission"),
                    },
                  }}
                />
                {groupedPermissions.map(([group, items]) => {
                  const ids = items.map(
                    (permission) => permission.permission_id,
                  );
                  const checkedCount = ids.filter((id) =>
                    checkedIds.includes(id),
                  ).length;
                  const editableItems = items.filter(canChange);
                  const editableCheckedCount = editableItems.filter(
                    (permission) =>
                      checkedIds.includes(permission.permission_id),
                  ).length;
                  const allChecked =
                    editableItems.length > 0 &&
                    editableCheckedCount === editableItems.length;
                  const indeterminate = editableCheckedCount > 0 && !allChecked;
                  return (
                    <Box
                      key={group}
                      className="hn-iam-permission-group"
                      sx={{
                        border: `1px solid ${S.border}`,
                        borderRadius: "var(--ops-radius-card)",
                        overflow: "hidden",
                      }}
                    >
                      <Box
                        className="hn-iam-permission-group-header"
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
                            <input
                              type="checkbox"
                              style={{
                                width: 18,
                                height: 18,
                                margin: 4,
                                accentColor: S.primary,
                              }}
                              checked={allChecked}
                              ref={(element) => {
                                if (element)
                                  element.indeterminate = indeterminate;
                              }}
                              aria-label={t("iam.role.selectGroupAria", {
                                group,
                              })}
                              aria-checked={
                                indeterminate ? "mixed" : allChecked
                              }
                              disabled={
                                !editableItems.length ||
                                conflict ||
                                remoteChanged
                              }
                              onChange={(event) =>
                                changeChecked(
                                  changeGroupPermissions(
                                    checkedIds,
                                    items,
                                    event.target.checked,
                                    canChange,
                                  ),
                                )
                              }
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
          </Stack>
        </UiCard>
      </Box>

      <UiDrawer
        open={roleFormOpen}
        width={640}
        className="hn-iam-dialog hn-iam-role-drawer"
        onClose={() => {
          if (!metadataBusy) setRoleFormOpen(false);
        }}
        title={drawerTitle(
          editingRole ? t("iam.role.editTitle") : t("iam.roleUi.create"),
          () => setRoleFormOpen(false),
          metadataBusy,
        )}
        actions={
          <div className="hn-iam-role-drawer-actions">
            <ActionButton
              kind="cancel"
              disabled={metadataBusy}
              onClick={() => setRoleFormOpen(false)}
            >
              {t("iam.role.cancel")}
            </ActionButton>
            {!metadataReadonly ? (
              <ActionButton
                kind="save"
                className="hn-iam-primary"
                loading={metadataBusy}
                onClick={() => void saveRole()}
              >
                {editingRole ? t("iam.role.saveRole") : t("iam.roleUi.create")}
              </ActionButton>
            ) : null}
          </div>
        }
      >
        <div className="hn-iam-role-drawer-body">
          <p>
            {t(
              editingRole ? "iam.roleUi.metadataHint" : "iam.roleUi.createHint",
            )}
          </p>
          {metadataReadonly && isSystemRole(editingRole) ? (
            <UiAlert tone="info">{t("iam.role.superAdminBody")}</UiAlert>
          ) : null}
          {metadataError ? (
            <ApiErrorAlert
              error={metadataError}
              title={t("iam.roleUi.metadataError")}
            />
          ) : null}
          <UiTextField
            required
            fullWidth
            label={t("iam.role.fieldCode")}
            value={roleForm.role_code}
            disabled={metadataReadonly || metadataBusy}
            onChange={(event) =>
              setRoleForm((form) => ({
                ...form,
                role_code: event.target.value,
              }))
            }
            error={Boolean(formErrors.code)}
            helperText={formErrors.code}
            autoFocus
          />
          <UiTextField
            required
            fullWidth
            label={t("iam.role.fieldName")}
            value={roleForm.role_name}
            disabled={metadataReadonly || metadataBusy}
            onChange={(event) =>
              setRoleForm((form) => ({
                ...form,
                role_name: event.target.value,
              }))
            }
            error={Boolean(formErrors.name)}
            helperText={formErrors.name}
          />
          <div className="hn-iam-role-form-grid">
            <UiTextField
              select
              fullWidth
              label={t("iam.role.fieldScope")}
              value={roleForm.scope_type}
              disabled={metadataReadonly || metadataBusy}
              onChange={(event) =>
                setRoleForm((form) => ({
                  ...form,
                  scope_type: event.target.value as IamRoleScopeType,
                }))
              }
            >
              <MenuItem value="SYSTEM">{t("iam.role.scopeSystem")}</MenuItem>
              <MenuItem value="WAREHOUSE">
                {t("iam.permissionModule.warehouse")}
              </MenuItem>
              <MenuItem value="FUNCTION">
                {t("iam.role.scopeFunction")}
              </MenuItem>
            </UiTextField>
            <UiTextField
              select
              fullWidth
              label={t("iam.role.fieldStatus")}
              value={roleForm.status}
              disabled={metadataReadonly || metadataBusy}
              onChange={(event) =>
                setRoleForm((form) => ({
                  ...form,
                  status: event.target.value as IamRoleStatus,
                }))
              }
            >
              <MenuItem value="ACTIVE">{t("iam.role.statusActive")}</MenuItem>
              <MenuItem value="INACTIVE">
                {t("iam.role.statusInactive")}
              </MenuItem>
            </UiTextField>
          </div>
          {editingRole && canManage && !isSystemRole(editingRole) ? (
            <div className="hn-iam-role-metadata-actions">
              <ActionButton
                kind={
                  editingRole.status === "ACTIVE" ? "deactivate" : "activate"
                }
                disabled={metadataBusy}
                onClick={() => void toggleRoleStatus(editingRole)}
              >
                {t(
                  editingRole.status === "ACTIVE"
                    ? "iam.role.confirmDisable"
                    : "iam.role.confirmEnable",
                )}
              </ActionButton>
              <ActionButton
                kind="delete"
                disabled={metadataBusy || deleteRole.isPending}
                onClick={() => void removeRole(editingRole)}
              >
                {t("iam.role.deleteConfirm")}
              </ActionButton>
            </div>
          ) : null}
        </div>
      </UiDrawer>
      {selectedRole ? (
        <UiDrawer
          open={reviewOpen}
          width={800}
          className="hn-iam-dialog hn-iam-role-drawer"
          onClose={() => {
            if (!syncPermissions.isPending) setReviewOpen(false);
          }}
          title={drawerTitle(
            t("iam.roleUi.reviewTitle"),
            () => setReviewOpen(false),
            syncPermissions.isPending,
          )}
          actions={
            <div className="hn-iam-role-drawer-actions">
              <ActionButton
                kind="cancel"
                disabled={syncPermissions.isPending}
                onClick={() => setReviewOpen(false)}
              >
                {t("iam.roleUi.backEdit")}
              </ActionButton>
              {freshRole ? (
                <ActionButton
                  kind="refresh"
                  className="hn-iam-primary"
                  onClick={() => void adoptLatest()}
                >
                  {t("iam.roleUi.useLatest")}
                </ActionButton>
              ) : (
                <ActionButton
                  kind="save"
                  className="hn-iam-primary"
                  loading={syncPermissions.isPending}
                  disabled={
                    conflict || remoteChanged || !matrixEditable || !dirty
                  }
                  onClick={() => void savePermissions()}
                >
                  {t("iam.roleUi.confirmSave")}
                </ActionButton>
              )}
            </div>
          }
        >
          <div className="hn-iam-role-drawer-body">
            <div className="hn-iam-role-context">
              <strong>{selectedRole.role_name}</strong>
              <span>{membersLabel(selectedRole)}</span>
            </div>
            {conflict || remoteChanged ? (
              <UiAlert tone="warning" title={t("iam.roleUi.conflictTitle")}>
                {t("iam.roleUi.conflictBody")}
                <ActionButton
                  kind="refresh"
                  loading={loadingLatest}
                  onClick={() => void loadLatest()}
                >
                  {t("iam.roleUi.loadLatest")}
                </ActionButton>
              </UiAlert>
            ) : null}
            {saveError ? <ApiErrorAlert error={saveError} /> : null}
            <div className="hn-iam-role-review-table">
              <div className="hn-iam-role-review-head">
                <span>{t("iam.roleUi.function")}</span>
                <span>{t("iam.roleUi.before")}</span>
                <span>{t("iam.roleUi.after")}</span>
              </div>
              {changedIds.map((id) => (
                <div className="hn-iam-role-review-row" key={id}>
                  <strong>{permissionName(id)}</strong>
                  <span>
                    {t(
                      originalIds.includes(id)
                        ? "iam.roleUi.granted"
                        : "iam.roleUi.notGranted",
                    )}
                  </span>
                  <span
                    className={
                      checkedIds.includes(id) ? "is-granted" : "is-revoked"
                    }
                  >
                    {t(
                      checkedIds.includes(id)
                        ? "iam.roleUi.granted"
                        : "iam.roleUi.notGranted",
                    )}
                  </span>
                </div>
              ))}
            </div>
            {freshRole ? (
              <section>
                <h3>{t("iam.roleUi.latest")}</h3>
                <ul className="hn-iam-role-latest">
                  {changedIds.map((id) => (
                    <li key={id}>
                      <span>{permissionName(id)}</span>
                      <strong>
                        {t(
                          idsOf(freshRole).includes(id)
                            ? "iam.roleUi.granted"
                            : "iam.roleUi.notGranted",
                        )}
                      </strong>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
            <UiAlert tone="warning">{t("iam.roleUi.impact")}</UiAlert>
            <section>
              <h3>{t("iam.roleUi.affectedUsers")}</h3>
              {usersQuery.isError ? (
                <ApiErrorAlert
                  error={usersQuery.error}
                  title={t("iam.roleUi.loadMembersError")}
                  onRetry={() => void usersQuery.refetch()}
                />
              ) : usersQuery.isLoading ? (
                <p role="status">{t("common.loadingData")}</p>
              ) : (
                <ul className="hn-iam-role-members">
                  {(showAllMembers ? members : members.slice(0, 3)).map(
                    (user) => (
                      <li key={user.user_id}>
                        <span className="hn-iam-role-avatar" aria-hidden="true">
                          {user.display_name
                            .split(/\s+/)
                            .slice(-2)
                            .map((part) => part[0])
                            .join("")}
                        </span>
                        <span>
                          {user.display_name}
                          <small>{user.username}</small>
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              )}
              {!usersComplete ? (
                <p className="hn-iam-role-muted">
                  {t("iam.roleUi.membersPartialHint")}
                </p>
              ) : null}
              {members.length > 3 && !showAllMembers ? (
                <ActionButton
                  kind="view"
                  onClick={() => setShowAllMembers(true)}
                >
                  {t("iam.roleUi.viewAllUsers")}
                </ActionButton>
              ) : null}
            </section>
            <UiTextField
              required
              fullWidth
              multiline
              minRows={3}
              label={t("iam.roleUi.reason")}
              value={permissionReason}
              disabled={syncPermissions.isPending || conflict || remoteChanged}
              onChange={(event) => {
                setPermissionReason(event.target.value);
                setReasonError("");
              }}
              error={Boolean(reasonError)}
              helperText={reasonError || t("iam.role.errReason")}
              slotProps={{ htmlInput: { maxLength: 2000 } }}
            />
          </div>
        </UiDrawer>
      ) : null}
      {historyOpen && selectedRole ? (
        <IamRoleHistoryDrawer
          role={selectedRole}
          permissions={permissions}
          allowed={canViewAudit}
          onClose={() => setHistoryOpen(false)}
        />
      ) : null}
      {confirmDialog}
    </div>
  );
}
