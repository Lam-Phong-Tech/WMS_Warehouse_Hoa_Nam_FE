import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useT } from "@/shared/i18n/useT";
import {
  FILTER_WIDTH,
  UiAlert,
  UiAutocomplete,
  UiIcon,
  UiStatusBadge,
  UiSelect,
  UiPagination,
  UiTabs,
  UiTextField,
} from "@/shared/ui";
import { ActionButton } from "@/shared/components/actions";
import {
  useIamUsers,
  useIamRolesPage,
  useIamPermissions,
  useIamUserPermissionOverrides,
  useIamScopeWarehouses,
} from "@/modules/iam/hooks/use-iam";
import type {
  IamPermission,
  IamRole,
  IamUser,
} from "@/modules/iam/types/iam.types";
import {
  IAM_SCOPE_LABELS,
  IAM_USER_STATUS_LABELS,
} from "@/shared/constants/business-labels";
import { formatDateTime } from "@/shared/utils/format-date";
import { applicableIamRoles } from "./iam-user-permissions";
import "./iam-effective-permissions.css";

export interface IamEffectivePermissionsScreenProps {
  navigation?: ReactNode;
  onViewUser?: (user: IamUser) => void;
}

const activePermission = (permission: IamPermission) =>
  permission.status === "ACTIVE" && permission.is_enforced !== false;
// BaseRepository::paginate clamps catalog pages to 100, regardless of the request.
const CATALOG_PAGE_SIZE = 100;

export function IamEffectivePermissionsScreen({
  navigation,
  onViewUser,
}: IamEffectivePermissionsScreenProps) {
  const t = useT();
  const [userSearch, setUserSearch] = useState("");
  const [keyword, setKeyword] = useState("");
  const [selectedSnapshot, setSelectedUser] = useState<IamUser | null>(null);
  const [tab, setTab] = useState("effective");
  const [permissionSearch, setPermissionSearch] = useState("");
  const [page, setPage] = useState(1);
  // Mặc định 6 dòng, có thể chọn 6/9/16/30 như bảng lịch sử đăng nhập.
  const [pageSize, setPageSize] = useState(6);
  useEffect(() => {
    const timer = window.setTimeout(() => setKeyword(userSearch.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [userSearch]);
  const usersQuery = useIamUsers({
    keyword: keyword || undefined,
    page: 1,
    per_page: 20,
  });
  const users = usersQuery.data?.data ?? [];
  const currentUser = users.find(
    (user) => user.user_id === selectedSnapshot?.user_id,
  );
  const selectedUser = currentUser ?? selectedSnapshot;
  useEffect(() => {
    if (currentUser && currentUser !== selectedSnapshot) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Retain the refreshed server row while searching a different result page.
      setSelectedUser(currentUser);
    }
  }, [currentUser, selectedSnapshot]);
  const rolesQuery = useIamRolesPage({ per_page: CATALOG_PAGE_SIZE });
  const permissionsQuery = useIamPermissions({ per_page: CATALOG_PAGE_SIZE });
  const overridesQuery = useIamUserPermissionOverrides(selectedUser?.user_id);
  const warehousesQuery = useIamScopeWarehouses();
  const userTotal = Number(usersQuery.data?.meta?.total);
  const hasMoreUsers = Number.isFinite(userTotal) && userTotal > users.length;
  const roles = useMemo(
    () => rolesQuery.data?.data ?? [],
    [rolesQuery.data?.data],
  );
  const applicableRoles = useMemo(
    () => applicableIamRoles(selectedUser?.roles ?? [], roles),
    [selectedUser, roles],
  );
  const userOptions = [
    ...(selectedUser &&
    !users.some((user) => user.user_id === selectedUser.user_id)
      ? [selectedUser]
      : []),
    ...users,
  ];
  const rolePermissions = (role: IamRole) =>
    (
      roles.find((item) => item.role_id === role.role_id)?.permissions ??
      role.permissions ??
      []
    ).filter((permission) => {
      const currentDefinition = permissionsQuery.data?.find(
        (item) => item.permission_key === permission.permission_key,
      );
      return (
        activePermission(permission) &&
        (!currentDefinition || activePermission(currentDefinition))
      );
    });
  const scopeLabel = (role: IamRole) => {
    if (role.pivot?.scope_ref) {
      const warehouse = (warehousesQuery.data ?? []).find(
        (item) => String(item.id) === role.pivot?.scope_ref,
      );
      return String(
        warehouse?.name || warehouse?.code || t("iam.effectiveUi.scopeUnknown"),
      );
    }
    return role.scope_type
      ? IAM_SCOPE_LABELS[role.scope_type] || t("iam.effectiveUi.scopeUnknown")
      : t("iam.effectiveUi.scopeUnknown");
  };
  const overrides = (overridesQuery.data ?? []).filter((grant) => {
    const definition = permissionsQuery.data?.find(
      (permission) => permission.permission_key === grant.permission_key,
    );
    return !definition || activePermission(definition);
  });
  const missingRoleData =
    Boolean(selectedUser && !selectedUser.roles) ||
    (selectedUser?.roles ?? []).some(
      (role) =>
        !role.permissions &&
        !roles.find((item) => item.role_id === role.role_id)?.permissions,
    );
  const incomplete =
    rolesQuery.isError ||
    permissionsQuery.isError ||
    overridesQuery.isError ||
    missingRoleData;
  const loading =
    rolesQuery.isLoading ||
    permissionsQuery.isLoading ||
    Boolean(selectedUser && overridesQuery.isLoading);
  const catalogPartial =
    (permissionsQuery.data?.length ?? 0) >= CATALOG_PAGE_SIZE;
  const sources = (permissionKey: string) => [
    ...applicableRoles
      .filter((role) =>
        rolePermissions(role).some(
          (permission) => permission.permission_key === permissionKey,
        ),
      )
      .map((role) => ({
        id: role.role_id,
        name: role.role_name,
        scope: scopeLabel(role),
        direct: false,
      })),
    ...(overrides.some(
      (permission) => permission.permission_key === permissionKey,
    )
      ? [
          {
            id: "direct",
            name: t("iam.effectiveUi.directGrant"),
            scope: t("iam.effectiveUi.scopeUnknown"),
            direct: true,
          },
        ]
      : []),
  ];
  const permissionMap = new Map<
    string,
    Pick<IamPermission, "permission_id" | "permission_key" | "permission_name">
  >(
    (permissionsQuery.data ?? [])
      .filter(activePermission)
      .map((permission) => [permission.permission_key, permission]),
  );
  applicableRoles.forEach((role) =>
    rolePermissions(role).forEach((permission) =>
      permissionMap.set(permission.permission_key, permission),
    ),
  );
  overrides.forEach((permission) => {
    if (!permissionMap.has(permission.permission_key))
      permissionMap.set(permission.permission_key, permission);
  });
  const permissionRows = [...permissionMap.values()]
    .filter((permission) =>
      `${permission.permission_name} ${permission.permission_key}`
        .toLocaleLowerCase()
        .includes(permissionSearch.toLocaleLowerCase().trim()),
    )
    .sort((a, b) => a.permission_key.localeCompare(b.permission_key));
  // Phân trang phía client: catalog đã tải đầy đủ nên chỉ slice theo trang hiện tại.
  const totalRows = permissionRows.length;
  const lastPage = Math.max(1, Math.ceil(totalRows / pageSize));
  const safePage = Math.min(page, lastPage);
  const pageStart = (safePage - 1) * pageSize;
  const visibleRows = permissionRows.slice(pageStart, pageStart + pageSize);
  const correctingPage = page > lastPage;
  useEffect(() => {
    if (!correctingPage) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- Clamp the page when the filtered result shrinks.
    setPage(lastPage);
  }, [correctingPage, lastPage]);
  const sourceRows = [
    ...applicableRoles.map((role) => ({
      id: role.role_id,
      title: role.role_name,
      scope: scopeLabel(role),
      permissions: rolePermissions(role),
    })),
    ...(overrides.length
      ? [
          {
            id: "direct",
            title: t("iam.effectiveUi.directGrant"),
            scope: t("iam.effectiveUi.scopeUnknown"),
            permissions: overrides,
          },
        ]
      : []),
  ];
  const failedQueries = [rolesQuery, permissionsQuery, overridesQuery].filter(
    (query) => query.isError,
  );

  return (
    <div className="hn-mvp-source-screen hn-iam-screen hn-effective-screen">
      <header className="hn-iam-page-heading">
        <div>
          <h1>{t("iam.userUi.effectiveTitle")}</h1>
          <p>{t("iam.userUi.effectiveSubtitle")}</p>
        </div>
      </header>
      {navigation}
      <div className="hn-effective-user-picker">
        <UiAutocomplete
          aria-label={t("iam.effectiveUi.pickUser")}
          placeholder={t("iam.effectiveUi.pickUser")}
          filterMode="server"
          value={selectedUser?.user_id ?? null}
          onChange={(value) =>
            setSelectedUser(
              userOptions.find((user) => user.user_id === value) ?? null,
            )
          }
          onInputChange={setUserSearch}
          loading={usersQuery.isFetching}
          error={usersQuery.isError}
          helperText={
            usersQuery.isError ? t("iam.user.errLoadUsers") : undefined
          }
          options={userOptions.map((user) => ({
            value: user.user_id,
            // Tên + email là hai thứ người dùng dùng để tìm; username nội bộ
            // thường là UUID nên chỉ hiện khi tài khoản chưa có email.
            label: `${user.display_name} · ${user.email || user.username || ""}`,
          }))}
        />
        {usersQuery.isError ? (
          <ActionButton
            kind="refresh"
            onClick={() => void usersQuery.refetch()}
          >
            {t("iam.user.retry")}
          </ActionButton>
        ) : null}
        {hasMoreUsers ? (
          <small>{t("iam.effectiveUi.userSearchPartial")}</small>
        ) : null}
      </div>
      {!selectedUser ? (
        <div className="hn-effective-empty">
          <UiIcon name="user" />
          <p>{t("iam.effectiveUi.noUser")}</p>
        </div>
      ) : (
        <>
          <section
            className="hn-effective-identity"
            aria-label={t("iam.user.sectionAccount")}
          >
            <div className="hn-effective-person">
              <span className="hn-effective-avatar" aria-hidden="true">
                {selectedUser.display_name
                  .trim()
                  .split(/\s+/)
                  .slice(-2)
                  .map((part) => part[0])
                  .join("")
                  .toLocaleUpperCase()}
              </span>
              <div>
                <h2>{selectedUser.display_name}</h2>
                <p>{selectedUser.email || selectedUser.username}</p>
                <UiStatusBadge
                  tone={
                    selectedUser.status === "ACTIVE"
                      ? "success"
                      : selectedUser.status === "LOCKED"
                        ? "error"
                        : "neutral"
                  }
                  label={IAM_USER_STATUS_LABELS[selectedUser.status]}
                />
              </div>
            </div>
            <dl>
              <div>
                <dt>{t("iam.user.colDepartment")}</dt>
                <dd>
                  {selectedUser.department?.department_name ||
                    (selectedUser.department_id
                      ? t("iam.effectiveUi.unknown")
                      : t("iam.user.noDepartment"))}
                </dd>
              </div>
              <div>
                <dt>{t("iam.user.colRole")}</dt>
                <dd>
                  {(selectedUser.roles ?? [])
                    .map((role) => role.role_name)
                    .join(" · ") || t("iam.user.noRoles")}
                </dd>
              </div>
              <div>
                <dt>{t("iam.effectiveUi.scope")}</dt>
                <dd>
                  {applicableRoles
                    .map((role) => `${role.role_name}: ${scopeLabel(role)}`)
                    .join(" · ") || t("iam.effectiveUi.scopeUnknown")}
                </dd>
              </div>
              <div>
                <dt>{t("iam.user.colLastLogin")}</dt>
                <dd>
                  {selectedUser.last_login_at
                    ? formatDateTime(selectedUser.last_login_at)
                    : "—"}
                </dd>
              </div>
            </dl>
          </section>
          <UiTabs
            value={tab}
            onChange={setTab}
            items={[
              { key: "effective", label: t("iam.userUi.effectiveTitle") },
              { key: "sources", label: t("iam.effectiveUi.sources") },
            ]}
          />
          {loading ? <p role="status">{t("iam.user.loadingData")}</p> : null}
          {incomplete ? (
            <UiAlert
              tone="warning"
              action={
                failedQueries.length ? (
                  <ActionButton
                    kind="refresh"
                    onClick={() => {
                      failedQueries.forEach((query) => void query.refetch());
                    }}
                  >
                    {t("iam.user.retry")}
                  </ActionButton>
                ) : undefined
              }
            >
              {t("iam.effectiveUi.incomplete")}
            </UiAlert>
          ) : null}
          {catalogPartial ? (
            <UiAlert tone="info">{t("iam.effectiveUi.catalogPartial")}</UiAlert>
          ) : null}
          <section className="hn-effective-permissions">
            <p className="hn-effective-note">
              <UiIcon name="info" size="sm" />
              <span>{t("iam.effectiveUi.previewNotice")}</span>
            </p>
            {tab === "effective" ? (
              <>
                <UiTextField
                  fullWidth
                  slotProps={{
                    htmlInput: {
                      "aria-label": t("iam.effectiveUi.permissionSearch"),
                    },
                  }}
                  placeholder={t("iam.effectiveUi.permissionSearch")}
                  value={permissionSearch}
                  onChange={(event) => {
                    setPermissionSearch(event.target.value);
                    setPage(1);
                  }}
                />
                <div
                  className="hn-effective-table-wrap"
                  role="region"
                  aria-label={t("iam.userUi.effectiveTitle")}
                  tabIndex={0}
                >
                  <table className="hn-effective-table">
                    <thead>
                      <tr>
                        <th className="stt-col">{t("shared.table.rowNumber")}</th>
                        <th>{t("iam.effectiveUi.permission")}</th>
                        <th>{t("iam.user.colStatus")}</th>
                        <th>{t("iam.effectiveUi.source")}</th>
                        <th>{t("iam.effectiveUi.scope")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleRows.map((permission, index) => {
                        const stt = pageStart + index + 1;
                        const entries = sources(permission.permission_key);
                        const unknown =
                          !entries.length && (loading || incomplete);
                        return (
                          <tr key={permission.permission_key}>
                            <td className="stt-col">{stt}</td>
                            <td data-label={t("iam.effectiveUi.permission")}>
                              <strong>{permission.permission_name}</strong>
                            </td>
                            <td data-label={t("iam.user.colStatus")}>
                              <UiStatusBadge
                                tone={entries.length ? "success" : "neutral"}
                                label={
                                  entries.length
                                    ? t("iam.effectiveUi.granted")
                                    : unknown
                                      ? t("iam.effectiveUi.unknown")
                                      : t("iam.effectiveUi.notGranted")
                                }
                              />
                            </td>
                            <td data-label={t("iam.effectiveUi.source")}>
                              {entries.length
                                ? entries.map((source) => (
                                    <div
                                      key={source.id}
                                      className="hn-effective-source-line"
                                    >
                                      <UiIcon
                                        name={
                                          source.direct ? "add" : "users-alt"
                                        }
                                        size="sm"
                                      />
                                      <span>{source.name}</span>
                                    </div>
                                  ))
                                : unknown
                                  ? t("iam.effectiveUi.unknown")
                                  : t("iam.effectiveUi.notGranted")}
                            </td>
                            <td data-label={t("iam.effectiveUi.scope")}>
                              {entries.length
                                ? entries.map((source) => (
                                    <div
                                      key={source.id}
                                      className="hn-effective-scope-line"
                                    >
                                      <small>
                                        {entries.length > 1
                                          ? source.name
                                          : null}
                                      </small>
                                      <span>{source.scope}</span>
                                    </div>
                                  ))
                                : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!permissionRows.length && !loading ? (
                    <p className="hn-effective-empty">
                      {t("shared.table.empty")}
                    </p>
                  ) : null}
                </div>
                <div className="hn-effective-pagination">
                  <div className="hn-effective-summary">
                    <span>
                      {t("inventory.rangeLabel", {
                        from: totalRows ? pageStart + 1 : 0,
                        to: Math.min(pageStart + pageSize, totalRows),
                        total: totalRows,
                      })}
                    </span>
                    <UiSelect
                      aria-label={t("shared.table.rowsPerPageAria")}
                      value={pageSize}
                      minWidth={FILTER_WIDTH.pageSize}
                      options={[6, 9, 16, 30].map((size) => ({
                        value: size,
                        label: t("shared.table.perPage", { size }),
                      }))}
                      onChange={(value) => {
                        setPageSize(Number(value));
                        setPage(1);
                      }}
                    />
                  </div>
                  <UiPagination
                    page={safePage}
                    pageSize={pageSize}
                    total={totalRows}
                    showTotal={false}
                    onPageChange={setPage}
                  />
                </div>
              </>
            ) : (
              <div className="hn-effective-source-list">
                {sourceRows.map((source) => (
                  <article key={source.id}>
                    <header>
                      <h3>{source.title}</h3>
                      <span>{source.scope}</span>
                    </header>
                    <ul>
                      {source.permissions.map((permission) => (
                        <li key={permission.permission_key}>
                          <strong>{permission.permission_name}</strong>
                        </li>
                      ))}
                    </ul>
                    {!source.permissions.length ? (
                      <p>{t("iam.user.noEffective")}</p>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
            {onViewUser ? (
              <footer>
                <ActionButton
                  kind="view"
                  appearance="flat"
                  onClick={() => onViewUser(selectedUser)}
                >
                  {t("iam.effectiveUi.viewUser")}
                </ActionButton>
              </footer>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
