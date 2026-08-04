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

export const WMS_CANONICAL_PERMISSION_CODES = Object.freeze(
  Object.values(WMS_PERMISSION_CATALOG),
);

const WMS_CANONICAL_PERMISSION_SET = new Set<string>(
  WMS_CANONICAL_PERMISSION_CODES,
);

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

/**
 * Remove only explicitly rejected broad fallbacks from OR permission groups.
 * `stocktake.manage` may grant page/session administration, but it must never
 * authorize the stock-changing `stocktake.adjust` action.
 */
export function resolveWmsPermissionAlternatives(
  codes: readonly string[],
): string[] {
  const canonical = codes.map(canonicalizeWmsPermission);
  return canonical.includes(WMS_PERMISSION_CATALOG.STOCKTAKE_ADJUST)
    ? canonical.filter((code) => code !== "stocktake.manage")
    : canonical;
}

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
