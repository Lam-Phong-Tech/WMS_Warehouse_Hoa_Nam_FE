export const WMS_PERMISSION_CATALOG = {
  /**
   * WWHN-327: dashboard dùng đúng `report.view`. `report.dashboard.view` chưa từng
   * tồn tại trong AuthDatabaseSeeder nên mọi gate dựa vào nó sẽ fail-closed vĩnh viễn
   * và ẩn màn Dashboard khỏi cả role hợp lệ. Giữ tên hằng, trỏ về mã BE canonical.
   */
  DASHBOARD_VIEW: "report.view",

  // IAM / foundation
  IAM_USER_VIEW: "iam.user.view",
  IAM_USER_MANAGE: "iam.user.manage",
  IAM_ROLE_VIEW: "iam.role.view",
  IAM_ROLE_MANAGE: "iam.role.manage",
  IAM_PERMISSION_VIEW: "iam.permission.view",
  CATALOG_VIEW: "catalog.view",
  CATALOG_MANAGE: "catalog.manage",
  WAREHOUSE_VIEW: "warehouse.view",
  WAREHOUSE_MANAGE: "warehouse.manage",
  MASTER_MANAGE: "master.manage",
  SKU_VIEW: "sku.view",
  SKU_MANAGE: "sku.manage",
  AGENCY_VIEW: "agency.view",
  AGENCY_MANAGE: "agency.manage",
  DEFECT_VIEW: "defect.view",
  DEFECT_MANAGE: "defect.manage",
  /** SRS §3: publish App PV tách khỏi sku.manage (REQ-SRS-020). */
  PV_PUBLISH: "pv.publish",
  PV_MASTER_MANAGE: "pv.master.manage",
  ITEM_INSTANCE_VIEW: "item_instance.view",
  ITEM_INSTANCE_MANAGE: "item_instance.manage",

  SCAN_CLASSIFY: "scan.classify",
  /**
   * Annex C alias của scan.classify; route BE /scan-batches/classify nhận
   * `scan.execute|scan.classify`. WAREHOUSE_STAFF được seed scan.execute (không có
   * scan.classify) nên FE bắt buộc phải nhận cả hai.
   */
  SCAN_EXECUTE: "scan.execute",
  // Legacy compatibility values retained for older evidence/service shims.
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
  /** SRS v1.12 / BE canonical putaway permissions. */
  PUTAWAY_VIEW: "putaway.view",
  PUTAWAY_MANAGE: "putaway.manage",
  OUTBOUND_VIEW: "outbound.view",
  OUTBOUND_CREATE: "outbound.create",
  OUTBOUND_SCAN: "outbound.scan",
  OUTBOUND_POST: "outbound.post",
  OUTBOUND_CANCEL: "outbound.cancel",
  OUTBOUND_IMPORT: "outbound.import",
  OUTBOUND_REQUEST_IMPORT: "outbound.request.import",
  OUTBOUND_REQUEST_CONFIRM: "outbound.request.confirm",
  OUTBOUND_REQUEST_MANUAL_CREATE: "outbound.request.manual_create",
  LABEL_PRINT: "label.print",
  LABEL_REPRINT: "label.reprint",
  PACKING_LABEL_PREVIEW: "packing_label.preview",
  PACKING_LABEL_READY: "packing_label.ready",
  PACKING_LABEL_PRINT: "packing_label.print",
  PACKING_LABEL_REPRINT: "packing_label.reprint",
  PHYSICAL_CODE_ASSIGN_RFID: "physical_code.assign_rfid",
  /** Phát hành Item_Instance mới kèm Physical_Code mới (QR/Barcode) — POST /skus/{id}/items. */
  PHYSICAL_CODE_CREATE: "physical_code.create",
  // REQ-SRS-037 (Must; nhãn `DEC-NO-STOCKTAKE-001` CHƯA có formal approval — xem
  // ghi chú thẩm quyền ở src/shared/constants/routes.ts): MVP không có permission
  // kiểm kê hay sửa tồn trực tiếp. Sửa sai sau Post chỉ đi qua REVERSAL_POST bên dưới.
  /** Annex C listWarrantyCases — quyền đọc SCR-WAR-01, tách khỏi warranty.manage. */
  WARRANTY_VIEW: "warranty.view",
  WARRANTY_MANAGE: "warranty.manage",
  WARRANTY_TEMP_ONLY: "warranty.temp_only",
  WARRANTY_COMPONENT_ISSUE: "warranty.component_issue",
  WARRANTY_PII_VIEW: "warranty.pii.view",
  /** §13.8: export PII bảo hành cần quyền riêng, mọi lần export đều audit. */
  WARRANTY_PII_EXPORT: "warranty.pii.export",
  REVERSAL_POST: "inventory.reversal.post",
  REPORT_VIEW: "report.view",
  REPORT_EXPORT: "report.export",
  /** BE canonical seed dùng lowercase `audit_log.view`. */
  AUDIT_LOG_VIEW: "audit_log.view",
} as const;

/** Compatibility is read-only. New code must use canonical BE permission codes above. */
export const WMS_PERMISSION_ALIASES: Readonly<Record<string, string>> = {
  SCAN_CLASSIFY: WMS_PERMISSION_CATALOG.SCAN_CLASSIFY,
  SCAN_INBOUND: WMS_PERMISSION_CATALOG.SCAN_INBOUND,
  SCAN_OUTBOUND: WMS_PERMISSION_CATALOG.OUTBOUND_SCAN,
  "scan.outbound": WMS_PERMISSION_CATALOG.OUTBOUND_SCAN,
  SCAN_WARRANTY: WMS_PERMISSION_CATALOG.SCAN_WARRANTY,
  REPORT_EXPORT: WMS_PERMISSION_CATALOG.REPORT_EXPORT,
  WARRANTY_MANAGE: WMS_PERMISSION_CATALOG.WARRANTY_MANAGE,
  WARRANTY_TEMP_ONLY: WMS_PERMISSION_CATALOG.WARRANTY_TEMP_ONLY,
  // Backward compatibility for older FE fixture/doc spelling only.
  AUDIT_LOG_VIEW: WMS_PERMISSION_CATALOG.AUDIT_LOG_VIEW,
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

export function resolveWmsPermissionAlternatives(
  codes: readonly string[],
): string[] {
  return codes.map(canonicalizeWmsPermission);
}

export const WMS_ACTION_PERMISSIONS = {
  // Khớp route BE: permission:scan.execute|scan.classify.
  SCAN_CLASSIFY_GENERIC: [
    WMS_PERMISSION_CATALOG.SCAN_EXECUTE,
    WMS_PERMISSION_CATALOG.SCAN_CLASSIFY,
  ],
  SCAN_INBOUND: [WMS_PERMISSION_CATALOG.INBOUND_SCAN],
  SCAN_OUTBOUND: [WMS_PERMISSION_CATALOG.OUTBOUND_SCAN],
  SCAN_WARRANTY: [WMS_PERMISSION_CATALOG.SCAN_WARRANTY],
  CREATE_INBOUND: [WMS_PERMISSION_CATALOG.INBOUND_CREATE],
  // Route BE nhận `permission:inbound.cancel|inbound.create`.
  CANCEL_INBOUND: [
    WMS_PERMISSION_CATALOG.INBOUND_CANCEL,
    WMS_PERMISSION_CATALOG.INBOUND_CREATE,
  ],
  POST_RECEIPT: [WMS_PERMISSION_CATALOG.INBOUND_POST],
  // Route BE nhận `putaway.manage|container.manage`; FE gate phải khớp đúng bộ đó.
  PUTAWAY_CONTAINER: [
    WMS_PERMISSION_CATALOG.PUTAWAY_MANAGE,
    WMS_PERMISSION_CATALOG.CONTAINER_MANAGE,
  ],
  PUTAWAY_VIEW: [
    WMS_PERMISSION_CATALOG.PUTAWAY_VIEW,
    WMS_PERMISSION_CATALOG.PUTAWAY_MANAGE,
    WMS_PERMISSION_CATALOG.CONTAINER_VIEW,
  ],
  OUTBOUND_REQUEST_IMPORT: [
    WMS_PERMISSION_CATALOG.OUTBOUND_REQUEST_IMPORT,
    WMS_PERMISSION_CATALOG.OUTBOUND_IMPORT,
  ],
  OUTBOUND_REQUEST_CONFIRM: [WMS_PERMISSION_CATALOG.OUTBOUND_REQUEST_CONFIRM],
  OUTBOUND_REQUEST_MANUAL_CREATE: [
    WMS_PERMISSION_CATALOG.OUTBOUND_REQUEST_MANUAL_CREATE,
  ],
  PACKING_LABEL_PREVIEW: [WMS_PERMISSION_CATALOG.PACKING_LABEL_PREVIEW],
  PACKING_LABEL_READY: [WMS_PERMISSION_CATALOG.PACKING_LABEL_READY],
  PACKING_LABEL_PRINT: [
    WMS_PERMISSION_CATALOG.PACKING_LABEL_PRINT,
    WMS_PERMISSION_CATALOG.LABEL_PRINT,
  ],
  PACKING_LABEL_REPRINT: [
    WMS_PERMISSION_CATALOG.PACKING_LABEL_REPRINT,
    WMS_PERMISSION_CATALOG.LABEL_REPRINT,
  ],
  POST_ISSUE: [WMS_PERMISSION_CATALOG.OUTBOUND_POST],
  VIEW_INVENTORY: [WMS_PERMISSION_CATALOG.INVENTORY_VIEW],
  TRACE_INVENTORY: [WMS_PERMISSION_CATALOG.INVENTORY_TRACE],
  WARRANTY_TEMP_ONLY: [WMS_PERMISSION_CATALOG.WARRANTY_TEMP_ONLY],
  WARRANTY_COMPONENT_ISSUE: [WMS_PERMISSION_CATALOG.WARRANTY_COMPONENT_ISSUE],
  EXPORT_REPORT: [WMS_PERMISSION_CATALOG.REPORT_EXPORT],
  POST_REVERSAL: [WMS_PERMISSION_CATALOG.REVERSAL_POST],
  PHYSICAL_CODE_CREATE: [WMS_PERMISSION_CATALOG.PHYSICAL_CODE_CREATE],
} as const;

export type WmsPermissionCode =
  (typeof WMS_PERMISSION_CATALOG)[keyof typeof WMS_PERMISSION_CATALOG];
export type WmsActionPermissionKey = keyof typeof WMS_ACTION_PERMISSIONS;
