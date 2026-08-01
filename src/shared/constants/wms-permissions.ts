export const WMS_PERMISSION_CATALOG = {
  DASHBOARD_VIEW: "report.dashboard.view",
  MASTER_MANAGE: "master.manage",
  SKU_MANAGE: "sku.manage",
  SCAN_CLASSIFY: "scan.classify",
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
  REVERSAL_POST: "inventory.reversal.post",
  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",
  AUDIT_LOG_VIEW: "AUDIT_LOG_VIEW",
} as const;

export type WmsPermissionCode =
  (typeof WMS_PERMISSION_CATALOG)[keyof typeof WMS_PERMISSION_CATALOG];
