import { useState } from "react";
import type { IamPermission } from "../types/iam.types";
import { useT, type TranslateFn } from "@/shared/i18n/useT";
import type { MessageKey } from "@/shared/i18n/messages";
import { ActionIconButton } from "@/shared/components/actions";
import {
  buildPermissionMatrix,
  MATRIX_ACTIONS,
  permissionAction,
  type PermissionResource,
} from "./iam-role-matrix";

const MODULE_KEYS: Record<string, MessageKey> = {
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
  container: "iam.permissionModule.container",
  putaway: "iam.permissionModule.putaway",
  component: "iam.permissionModule.component",
  label: "iam.permissionModule.label",
  scan: "iam.permissionModule.scan",
  warehouse: "iam.permissionModule.warehouse",
  agency: "iam.permissionModule.agency",
  system: "iam.permissionModule.system",
  audit_log: "iam.permissionModule.audit",
};

function roleResourceLabel(resource: PermissionResource, t: TranslateFn) {
  if (resource.key === "iam.role") return t("iam.roleUi.title");
  if (resource.key === "iam.user") return t("iam.user.colUser");
  if (resource.key === "iam.permission")
    return t("iam.roleUi.resourcePermissions");
  const key = MODULE_KEYS[resource.key];
  return key
    ? t(key)
    : (resource.permissions[0]?.permission_name ??
        t("iam.role.fallbackModule"));
}

function roleGroupLabel(key: string, t: TranslateFn) {
  if (key === "operations") return t("iam.roleUi.groupOperations");
  if (key === "catalog") return t("iam.roleUi.groupCatalog");
  if (key === "system") return t("iam.roleUi.groupSystem");
  const moduleKey = MODULE_KEYS[key];
  return moduleKey ? t(moduleKey) : t("iam.role.otherGroup");
}

interface Props {
  permissions: IamPermission[];
  checkedIds: string[];
  originalIds: string[];
  editable: boolean;
  canChange: (permission: IamPermission) => boolean;
  onToggle: (permission: IamPermission, checked: boolean) => void;
  onGroup: (permissions: IamPermission[], checked: boolean) => void;
}

export function IamRoleMatrix({
  permissions,
  checkedIds,
  originalIds,
  editable,
  canChange,
  onToggle,
  onGroup,
}: Props) {
  const t = useT();
  const [collapsed, setCollapsed] = useState<string[]>([]);
  const labels = [
    t("iam.permissionAction.view"),
    t("iam.permissionAction.create"),
    t("iam.permissionAction.update"),
    t("iam.permissionAction.export"),
    t("iam.permissionAction.manage"),
    t("iam.roleUi.otherActions"),
  ];
  const groups = buildPermissionMatrix(permissions);
  return (
    <div className="hn-iam-permission-matrix">
      {groups.map((group) => {
        const name = roleGroupLabel(group.key, t);
        const items = group.resources.flatMap(
          (resource) => resource.permissions,
        );
        const allowed = items.some(canChange);
        const isCollapsed = collapsed.includes(group.key);
        return (
          <section className="hn-iam-matrix-group" key={group.key}>
            <div className="hn-iam-matrix-group-heading">
              <button
                className="hn-iam-group-toggle"
                type="button"
                aria-expanded={!isCollapsed}
                onClick={() =>
                  setCollapsed((current) =>
                    isCollapsed
                      ? current.filter((key) => key !== group.key)
                      : [...current, group.key],
                  )
                }
              >
                <span aria-hidden="true">{isCollapsed ? "+" : "−"}</span>
                {name}
                <small>
                  {
                    items.filter((permission) =>
                      checkedIds.includes(permission.permission_id),
                    ).length
                  }
                  /{items.length}
                </small>
              </button>
              {editable ? (
                <div className="hn-iam-group-actions">
                  <button
                    type="button"
                    disabled={!allowed}
                    onClick={() => onGroup(items, true)}
                    aria-label={`${t("iam.roleUi.selectGroup")} ${name}`}
                  >
                    {t("iam.roleUi.selectGroup")}
                  </button>
                  <button
                    type="button"
                    disabled={!allowed}
                    onClick={() => onGroup(items, false)}
                    aria-label={`${t("iam.roleUi.clearGroup")} ${name}`}
                  >
                    {t("iam.roleUi.clearGroup")}
                  </button>
                </div>
              ) : null}
            </div>
            {!isCollapsed ? (
              <table className="hn-iam-matrix-table" aria-label={name}>
                <colgroup>
                  <col className="hn-iam-function-col" />
                  {MATRIX_ACTIONS.map((action) => (
                    <col
                      key={action}
                      className={
                        action === "other"
                          ? "hn-iam-other-col"
                          : "hn-iam-action-col"
                      }
                    />
                  ))}
                </colgroup>
                <thead>
                  <tr>
                    <th scope="col">{t("iam.roleUi.function")}</th>
                    {labels.map((label) => (
                      <th scope="col" key={label}>
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {group.resources.map((resource) => (
                    <tr key={resource.key}>
                      <th scope="row">{roleResourceLabel(resource, t)}</th>
                      {MATRIX_ACTIONS.map((action, index) => {
                        const cellPermissions = resource.permissions.filter(
                          (permission) =>
                            permissionAction(permission) === action,
                        );
                        return (
                          <td key={action} data-action={action}>
                            <span className="hn-iam-action-caption">
                              {labels[index]}
                            </span>
                            {cellPermissions.length ? (
                              <div className="hn-iam-permission-options">
                                {cellPermissions.map((permission) => {
                                  const checked = checkedIds.includes(
                                    permission.permission_id,
                                  );
                                  const dirty =
                                    originalIds.includes(
                                      permission.permission_id,
                                    ) !== checked;
                                  const retired =
                                    permission.is_enforced === false;
                                  const reason = retired
                                    ? t("iam.role.legacyHint")
                                    : !canChange(permission) && editable
                                      ? t("iam.role.noSelfGrantHint")
                                      : undefined;
                                  return (
                                    <div
                                      className="hn-iam-permission-option"
                                      key={permission.permission_id}
                                      data-changed={dirty}
                                    >
                                      <label
                                        title={
                                          reason ?? permission.permission_name
                                        }
                                        className={
                                          retired ? "is-retired" : undefined
                                        }
                                      >
                                        <input
                                          type="checkbox"
                                          checked={checked}
                                          disabled={
                                            !editable || !canChange(permission)
                                          }
                                          aria-label={t(
                                            "iam.roleUi.selectPermission",
                                            {
                                              name: permission.permission_name,
                                              key: permission.permission_key,
                                            },
                                          )}
                                          onChange={(event) =>
                                            onToggle(
                                              permission,
                                              event.target.checked,
                                            )
                                          }
                                        />
                                        {action === "other" ? (
                                          <span>
                                            {permission.permission_name}
                                          </span>
                                        ) : null}
                                        {retired ? (
                                          <small>
                                            {t("iam.role.deprecated")}
                                          </small>
                                        ) : null}
                                      </label>
                                      <details className="hn-iam-permission-help">
                                        <summary
                                          aria-label={
                                            permission.permission_name
                                          }
                                        >
                                          i
                                        </summary>
                                        <div>
                                          <strong>
                                            {permission.permission_name}
                                          </strong>
                                          <code>
                                            {permission.permission_key}
                                          </code>
                                          {permission.replaced_by ? (
                                            <span>
                                              {t("iam.role.deprecatedWith", {
                                                replacement:
                                                  permission.replaced_by,
                                              })}
                                            </span>
                                          ) : null}
                                          {reason ? (
                                            <span>{reason}</span>
                                          ) : null}
                                          <ActionIconButton
                                            kind="copy"
                                            label={t("iam.role.copyKeyAria", {
                                              key: permission.permission_key,
                                            })}
                                            onClick={() =>
                                              void navigator.clipboard?.writeText(
                                                permission.permission_key,
                                              )
                                            }
                                          />
                                        </div>
                                      </details>
                                    </div>
                                  );
                                })}
                              </div>
                            ) : (
                              <span
                                className="hn-iam-not-applicable"
                                aria-label={t("iam.roleUi.notApplicable")}
                              >
                                —
                              </span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : null}
          </section>
        );
      })}
      {!groups.length ? (
        <p className="hn-iam-role-empty">{t("iam.roleUi.permissionsEmpty")}</p>
      ) : null}
      <div className="hn-iam-matrix-legend">
        <span>
          <i aria-hidden="true">✓</i>
          {t("iam.roleUi.granted")}
        </span>
        <span>— {t("iam.roleUi.notApplicable")}</span>
      </div>
    </div>
  );
}
