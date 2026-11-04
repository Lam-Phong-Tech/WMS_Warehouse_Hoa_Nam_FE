import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  MenuItem,
  UiAlert,
  UiDrawer,
  UiPagination,
  UiStatusBadge,
  UiTextField,
  useUiConfirm,
} from "@/shared/ui";
import { useT } from "@/shared/i18n/useT";
import {
  ActionButton,
  ActionIconButton,
  RowActionButton,
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
import { IamRoleMatrix } from "./IamRoleMatrix";
import { IamRoleHistoryDrawer } from "./IamRoleHistoryDrawer";
import "./iam-role-permission.css";

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
          !permissionSearch.trim() ||
          [permission.permission_name, permission.permission_key]
            .join(" ")
            .toLocaleLowerCase()
            .includes(permissionSearch.trim().toLocaleLowerCase()),
      ),
    [permissionSearch, permissions],
  );
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
      <div className="hn-iam-role-workspace">
        <aside className="hn-iam-role-rail">
          <h2>{t("iam.role.listTitle")}</h2>
          <UiTextField
            fullWidth
            type="search"
            placeholder={t("iam.role.searchPlaceholder")}
            value={keyword}
            slotProps={{
              htmlInput: { "aria-label": t("iam.role.searchAria") },
            }}
            onChange={(event) => {
              const value = event.target.value;
              void discardBefore(() => {
                setKeyword(value);
                setRolePage(1);
              });
            }}
          />
          {rolesQuery.isError ? (
            <ApiErrorAlert
              error={rolesQuery.error}
              title={t("iam.roleUi.listLoadError")}
              onRetry={() => void rolesQuery.refetch()}
            />
          ) : rolesQuery.isLoading ? (
            <p role="status">{t("common.loadingData")}</p>
          ) : (
            <>
              <select
                className="hn-iam-role-compact-select"
                aria-label={t("iam.roleUi.chooseRole")}
                value={selectedRole?.role_id ?? ""}
                onChange={(event) => {
                  const id = event.target.value;
                  void discardBefore(() => setSelectedRoleId(id));
                }}
              >
                {!roles.length ? (
                  <option value="">{t("iam.roleUi.roleSearchEmpty")}</option>
                ) : (
                  roles.map((role) => (
                    <option key={role.role_id} value={role.role_id}>
                      {role.role_name}
                    </option>
                  ))
                )}
              </select>
              <ul className="hn-iam-role-list">
                {roles.map((role) => (
                  <li key={role.role_id}>
                    <button
                      type="button"
                      aria-pressed={selectedRole?.role_id === role.role_id}
                      onClick={() => {
                        if (selectedRole?.role_id !== role.role_id)
                          void discardBefore(() =>
                            setSelectedRoleId(role.role_id),
                          );
                      }}
                    >
                      <span className="hn-iam-role-avatar" aria-hidden="true">
                        {role.role_name
                          .split(/\s+/)
                          .slice(0, 2)
                          .map((part) => part[0])
                          .join("")}
                      </span>
                      <span>
                        <strong>{role.role_name}</strong>
                        <small>{membersLabel(role)}</small>
                        {role.status === "INACTIVE" ? (
                          <small className="hn-iam-role-inactive">
                            {t("iam.role.statusInactive")}
                          </small>
                        ) : null}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {!roles.length ? (
                <p>
                  {t(
                    keyword
                      ? "iam.roleUi.roleSearchEmpty"
                      : "iam.role.listEmpty",
                  )}
                </p>
              ) : null}
            </>
          )}
          <footer className="hn-iam-role-rail-footer">
            <small>
              {t("iam.role.total", { count: rolePagination.total })}
            </small>
            <MvpPageSizeSelector
              menuClassName="hn-iam-menu"
              value={rolePerPage}
              onChange={(size) =>
                void discardBefore(() => {
                  setRolePerPage(size);
                  setRolePage(1);
                })
              }
            />
            {rolePagination.total > rolePerPage ? (
              <UiPagination
                page={rolePagination.current}
                pageSize={rolePerPage}
                total={rolePagination.total}
                showTotal={false}
                onPageChange={(page) =>
                  void discardBefore(() => setRolePage(page))
                }
              />
            ) : null}
          </footer>
        </aside>
        <section className="hn-iam-role-matrix-panel">
          {selectedRole ? (
            <header className="hn-iam-role-selected-header">
              <div>
                <h2>{selectedRole.role_name}</h2>
                <UiStatusBadge
                  tone="neutral"
                  label={t(
                    isSystemRole(selectedRole)
                      ? "iam.roleUi.roleTypeSystem"
                      : "iam.roleUi.roleTypeCustom",
                  )}
                />
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
            <p role="status">{t("common.loadingData")}</p>
          ) : !selectedRole ? (
            <p className="hn-iam-role-empty">{t("iam.role.pickRole")}</p>
          ) : (
            <>
              {isSystemRole(selectedRole) ? (
                <UiAlert tone="info">{t("iam.role.superAdminBody")}</UiAlert>
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
                  htmlInput: { "aria-label": t("iam.roleUi.searchPermission") },
                }}
              />
              <IamRoleMatrix
                permissions={visiblePermissions}
                checkedIds={checkedIds}
                originalIds={originalIds}
                editable={matrixEditable && !conflict && !remoteChanged}
                canChange={canChange}
                onToggle={(permission, checked) =>
                  changeChecked(
                    changeGroupPermissions(
                      checkedIds,
                      [permission],
                      checked,
                      canChange,
                    ),
                  )
                }
                onGroup={(items, checked) =>
                  changeChecked(
                    changeGroupPermissions(
                      checkedIds,
                      items,
                      checked,
                      canChange,
                    ),
                  )
                }
              />
              <footer className="hn-iam-role-save-bar">
                <span>
                  {dirty
                    ? t("iam.roleUi.changedCount", { count: changedIds.length })
                    : t("iam.roleUi.noChanges")}
                </span>
                {canManage && !isSystemRole(selectedRole) ? (
                  <div>
                    <ActionButton
                      kind="undo"
                      disabled={!dirty || syncPermissions.isPending}
                      onClick={() => void discardBefore(() => undefined)}
                    >
                      {t("iam.roleUi.reset")}
                    </ActionButton>
                    <ActionButton
                      kind="save"
                      className="hn-iam-primary"
                      disabled={!dirty || !matrixEditable}
                      onClick={() => {
                        setPermissionReason("");
                        setReasonError("");
                        setShowAllMembers(false);
                        setReviewOpen(true);
                      }}
                    >
                      {t("iam.roleUi.review")}
                    </ActionButton>
                  </div>
                ) : null}
              </footer>
            </>
          )}
        </section>
      </div>
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
