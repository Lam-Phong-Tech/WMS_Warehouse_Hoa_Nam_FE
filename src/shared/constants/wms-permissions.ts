export const WMS_PERMISSION_CATALOG = {
  DASHBOARD_VIEW: "report.dashboard.view",

  // IAM / foundation
  IAM_USER_VIEW: "iam.user.view",
  IAM_USER_MANAGE: "iam.user.manage",
  IAM_ROLE_VIEW: "iam.role.view",
  IAM_ROLE_MANAGE: "iam.role.manage",
  IAM_PERMISSION_VIEW: "iam.permission.view",
  CATALOG_VIEW: "catalog.view",
  CATALOG_MANAGE: "catalog.manage",
  MASTER_MANAGE: "master.manage",
  SKU_VIEW: "sku.view",
  SKU_MANAGE: "sku.manage",
  AGENCY_VIEW: "agency.view",
  AGENCY_MANAGE: "agency.manage",
  DEFECT_VIEW: "defect.view",
  DEFECT_MANAGE: "defect.manage",
  ITEM_INSTANCE_VIEW: "item_instance.view",
  ITEM_INSTANCE_MANAGE: "item_instance.manage",

  SCAN_CLASSIFY: "scan.classify",
  SCAN_INBOUND: "scan.inbound",
  SCAN_OUTBOUND: "outbound.scan",
  SCAN_WARRANTY: "scan.warranty",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_TRACE: "inventory.trace",
  INBOUND_VIEW: "inbound.view",
  INBOUND_CREATE: "inbound.create",
  INBOUND_SCAN: "inbound.scan",
  INBOUND_POST: "inbound.post",
  INBOUND_CANCEL: "inbound.cancel",
  CONTAINER_VIEW: "container.view",
  CONTAINER_MANAGE: "container.manage",
  OUTBOUND_VIEW: "outbound.view",
  OUTBOUND_CREATE: "outbound.create",
  OUTBOUND_SCAN: "outbound.scan",
  OUTBOUND_POST: "outbound.post",
  OUTBOUND_CANCEL: "outbound.cancel",
  OUTBOUND_IMPORT: "outbound.import",
  LABEL_PRINT: "label.print",
  LABEL_REPRINT: "label.reprint",
  PHYSICAL_CODE_ASSIGN_RFID: "physical_code.assign_rfid",
  STOCKTAKE_COUNT: "stocktake.count",
  STOCKTAKE_ADJUST: "stocktake.adjust",
  WARRANTY_MANAGE: "warranty.manage",
  WARRANTY_TEMP_ONLY: "warranty.temp_only",
  WARRANTY_COMPONENT_ISSUE: "warranty.component_issue",
  REVERSAL_POST: "inventory.reversal.post",
  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",
  AUDIT_LOG_VIEW: "AUDIT_LOG_VIEW",
} as const;

/** Compatibility is read-only. New code must use canonical BE permission codes above. */
export const WMS_PERMISSION_ALIASES: Readonly<Record<string, string>> = {
  SCAN_CLASSIFY: WMS_PERMISSION_CATALOG.SCAN_CLASSIFY,
  SCAN_INBOUND: WMS_PERMISSION_CATALOG.SCAN_INBOUND,
  SCAN_OUTBOUND: WMS_PERMISSION_CATALOG.OUTBOUND_SCAN,
  "scan.outbound": WMS_PERMISSION_CATALOG.OUTBOUND_SCAN,
  SCAN_WARRANTY: WMS_PERMISSION_CATALOG.SCAN_WARRANTY,
  "stocktake.apply": WMS_PERMISSION_CATALOG.STOCKTAKE_ADJUST,
  REPORT_EXPORT: WMS_PERMISSION_CATALOG.REPORT_EXPORT,
  WARRANTY_MANAGE: WMS_PERMISSION_CATALOG.WARRANTY_MANAGE,
  WARRANTY_TEMP_ONLY: WMS_PERMISSION_CATALOG.WARRANTY_TEMP_ONLY,
  // Old FE-only permission never existed in BE; canonical putaway uses container.manage.
  "putaway.manage": WMS_PERMISSION_CATALOG.CONTAINER_MANAGE,
} as const;

export const WMS_CANONICAL_PERMISSION_CODES = Object.freeze(
  Object.values(WMS_PERMISSION_CATALOG),
);

const WMS_CANONICAL_PERMISSION_SET = new Set<string>(WMS_CANONICAL_PERMISSION_CODES);

export function canonicalizeWmsPermission(code: string): string {
  return WMS_PERMISSION_ALIASES[code] ?? code;
}

export function isCanonicalWmsPermission(code: string): boolean {
  return WMS_CANONICAL_PERMISSION_SET.has(canonicalizeWmsPermission(code));
}

export function hasAnyWmsPermission(
  grantedCodes: readonly string[],
  requiredCodes: readonly string[],
  isSuperAdmin = false,
): boolean {
  if (isSuperAdmin) return true;
  const canonicalGranted = new Set(
    grantedCodes.map((code) => canonicalizeWmsPermission(code)),
  );
  return requiredCodes.some((code) =>
    canonicalGranted.has(canonicalizeWmsPermission(code)),
  );
}

export function resolveWmsPermissionAlternatives(
  codes: readonly string[],
): string[] {
  const canonical = codes.map(canonicalizeWmsPermission);
  return canonical.includes(WMS_PERMISSION_CATALOG.STOCKTAKE_ADJUST)
    ? canonical.filter((code) => code !== "stocktake.manage")
    : canonical;
}

export const WMS_ACTION_PERMISSIONS = {
  SCAN_CLASSIFY_GENERIC: [WMS_PERMISSION_CATALOG.SCAN_CLASSIFY],
  SCAN_INBOUND: [WMS_PERMISSION_CATALOG.INBOUND_SCAN],
  SCAN_OUTBOUND: [WMS_PERMISSION_CATALOG.OUTBOUND_SCAN],
  SCAN_WARRANTY: [WMS_PERMISSION_CATALOG.SCAN_WARRANTY],
  CREATE_INBOUND: [WMS_PERMISSION_CATALOG.INBOUND_CREATE],
  CANCEL_INBOUND: [WMS_PERMISSION_CATALOG.INBOUND_CANCEL],
  POST_RECEIPT: [WMS_PERMISSION_CATALOG.INBOUND_POST],
  PUTAWAY_CONTAINER: [WMS_PERMISSION_CATALOG.CONTAINER_MANAGE],
  POST_ISSUE: [WMS_PERMISSION_CATALOG.OUTBOUND_POST],
  APPLY_STOCKTAKE_ADJUSTMENT: [WMS_PERMISSION_CATALOG.STOCKTAKE_ADJUST],
  WARRANTY_TEMP_ONLY: [WMS_PERMISSION_CATALOG.WARRANTY_TEMP_ONLY],
  WARRANTY_COMPONENT_ISSUE: [WMS_PERMISSION_CATALOG.WARRANTY_COMPONENT_ISSUE],
  EXPORT_REPORT: [WMS_PERMISSION_CATALOG.REPORT_EXPORT],
  POST_REVERSAL: [WMS_PERMISSION_CATALOG.REVERSAL_POST],
} as const;

export type WmsPermissionCode =
  (typeof WMS_PERMISSION_CATALOG)[keyof typeof WMS_PERMISSION_CATALOG];
export type WmsActionPermissionKey = keyof typeof WMS_ACTION_PERMISSIONS;
