export const WMS_PERMISSION_CATALOG = {
  DASHBOARD_VIEW: "report.dashboard.view",
  MASTER_MANAGE: "master.manage",
  SKU_MANAGE: "sku.manage",
  SCAN_CLASSIFY: "scan.classify",
  SCAN_INBOUND: "scan.inbound",
  SCAN_OUTBOUND: "scan.outbound",
  SCAN_WARRANTY: "scan.warranty",
  INVENTORY_VIEW: "inventory.view",
  INVENTORY_TRACE: "inventory.trace",
  INBOUND_CREATE: "inbound.create",
  INBOUND_POST: "inbound.post",
  PUTAWAY_MANAGE: "putaway.manage",
  OUTBOUND_CREATE: "outbound.create",
  OUTBOUND_POST: "outbound.post",
  STOCKTAKE_COUNT: "stocktake.count",
  STOCKTAKE_ADJUST: "stocktake.adjust",
  WARRANTY_MANAGE: "warranty.manage",
  WARRANTY_TEMP_ONLY: "warranty.temp_only",
  REVERSAL_POST: "inventory.reversal.post",
  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",
  AUDIT_LOG_VIEW: "AUDIT_LOG_VIEW",
} as const;

/**
 * Alias chỉ dùng để tương thích contract cũ đã xuất hiện trong FE.
 * Mọi phép kiểm tra đều chuẩn hóa về code canonical phía trên; không alias
 * quyền rộng như `stocktake.manage` sang quyền điều chỉnh tồn kho.
 */
export const WMS_PERMISSION_ALIASES: Readonly<Record<string, string>> = {
  SCAN_CLASSIFY: WMS_PERMISSION_CATALOG.SCAN_CLASSIFY,
  SCAN_INBOUND: WMS_PERMISSION_CATALOG.SCAN_INBOUND,
  SCAN_OUTBOUND: WMS_PERMISSION_CATALOG.SCAN_OUTBOUND,
  SCAN_WARRANTY: WMS_PERMISSION_CATALOG.SCAN_WARRANTY,
  "stocktake.apply": WMS_PERMISSION_CATALOG.STOCKTAKE_ADJUST,
  REPORT_EXPORT: WMS_PERMISSION_CATALOG.REPORT_EXPORT,
  WARRANTY_MANAGE: WMS_PERMISSION_CATALOG.WARRANTY_MANAGE,
  WARRANTY_TEMP_ONLY: WMS_PERMISSION_CATALOG.WARRANTY_TEMP_ONLY,
} as const;

export function canonicalizeWmsPermission(code: string): string {
  return WMS_PERMISSION_ALIASES[code] ?? code;
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

/**
 * Permission groups for action-level guards. These groups are intentionally
 * separate from route access: entering a page must not implicitly authorize a
 * stock-changing, export, TEMP_ONLY, or context-specific scan action.
 *
 * Backend remains the RBAC authority. BE/BA must approve these codes against
 * the runtime permission catalog before production final sign-off.
 */
export const WMS_ACTION_PERMISSIONS = {
  SCAN_CLASSIFY_GENERIC: [
    WMS_PERMISSION_CATALOG.INVENTORY_TRACE,
    WMS_PERMISSION_CATALOG.SCAN_CLASSIFY,
  ],
  SCAN_INBOUND: [WMS_PERMISSION_CATALOG.SCAN_INBOUND],
  SCAN_OUTBOUND: [WMS_PERMISSION_CATALOG.SCAN_OUTBOUND],
  SCAN_WARRANTY: [WMS_PERMISSION_CATALOG.SCAN_WARRANTY],
  POST_RECEIPT: [WMS_PERMISSION_CATALOG.INBOUND_POST],
  POST_ISSUE: [WMS_PERMISSION_CATALOG.OUTBOUND_POST],
  APPLY_STOCKTAKE_ADJUSTMENT: [WMS_PERMISSION_CATALOG.STOCKTAKE_ADJUST],
  WARRANTY_TEMP_ONLY: [WMS_PERMISSION_CATALOG.WARRANTY_TEMP_ONLY],
  EXPORT_REPORT: [WMS_PERMISSION_CATALOG.REPORT_EXPORT],
  POST_REVERSAL: [WMS_PERMISSION_CATALOG.REVERSAL_POST],
} as const;

export type WmsPermissionCode =
  (typeof WMS_PERMISSION_CATALOG)[keyof typeof WMS_PERMISSION_CATALOG];

export type WmsActionPermissionKey = keyof typeof WMS_ACTION_PERMISSIONS;
