import type { IamPermission } from "../types/iam.types";

export const MATRIX_ACTIONS = [
  "view",
  "create",
  "update",
  "export",
  "manage",
  "other",
] as const;
export type MatrixAction = (typeof MATRIX_ACTIONS)[number];
export interface PermissionResource {
  key: string;
  permissions: IamPermission[];
}
export interface PermissionGroup {
  key: string;
  resources: PermissionResource[];
}

export function permissionAction(permission: IamPermission): MatrixAction {
  const action = permission.permission_key.split(".").at(-1);
  return MATRIX_ACTIONS.includes(action as MatrixAction)
    ? (action as MatrixAction)
    : "other";
}

function groupKey(resource: string) {
  const module = resource.split(".")[0];
  if (
    [
      "inbound",
      "outbound",
      "inventory",
      "warehouse",
      "putaway",
      "container",
      "import_batch",
      "item_instance",
      "physical_code",
      "label",
      "packing_label",
      "scan",
    ].includes(module)
  )
    return "operations";
  if (["catalog", "sku", "agency", "defect", "pv"].includes(module))
    return "catalog";
  if (["iam", "audit", "audit_log", "system"].includes(module)) return "system";
  return module;
}

export function buildPermissionMatrix(
  permissions: IamPermission[],
): PermissionGroup[] {
  const groups = new Map<string, Map<string, IamPermission[]>>();
  for (const permission of permissions) {
    if (permission.status !== "ACTIVE") continue;
    const parts = permission.permission_key.split(".");
    const resource =
      parts.length > 1
        ? parts.slice(0, -1).join(".")
        : permission.permission_key;
    const key = groupKey(resource);
    const resources = groups.get(key) ?? new Map<string, IamPermission[]>();
    resources.set(resource, [...(resources.get(resource) ?? []), permission]);
    groups.set(key, resources);
  }
  return [...groups].map(([key, resources]) => ({
    key,
    resources: [...resources].map(([resourceKey, items]) => ({
      key: resourceKey,
      permissions: items,
    })),
  }));
}

export function canChangePermission(
  permission: IamPermission,
  isSuperAdmin: boolean,
  ownPermissionKeys: readonly string[],
): boolean {
  return (
    permission.status === "ACTIVE" &&
    permission.is_enforced !== false &&
    (isSuperAdmin || ownPermissionKeys.includes(permission.permission_key))
  );
}

export function changeGroupPermissions(
  currentIds: string[],
  permissions: IamPermission[],
  checked: boolean,
  canChange: (permission: IamPermission) => boolean,
): string[] {
  const next = new Set(currentIds);
  for (const permission of permissions) {
    if (!canChange(permission)) continue;
    if (checked) next.add(permission.permission_id);
    else next.delete(permission.permission_id);
  }
  return [...next].sort();
}

export function changedPermissionIds(
  originalIds: readonly string[],
  currentIds: readonly string[],
): string[] {
  const original = new Set(originalIds);
  const current = new Set(currentIds);
  return [...new Set([...original, ...current])]
    .filter((id) => original.has(id) !== current.has(id))
    .sort();
}
