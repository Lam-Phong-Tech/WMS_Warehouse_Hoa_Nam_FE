export const API_ENDPOINTS = {
  LOGIN: "/auth/login",
  LOGOUT: "/auth/logout",
  ME: "/auth/me",
  SWITCH_CONTEXT: "/auth/switch-context",
  REFRESH: "/auth/refresh",
  CHANGE_PASSWORD: "/auth/change-password",
  FORGOT_PASSWORD: "/auth/forgot-password",
  VERIFY_OTP: "/auth/verify-otp",
  RESET_PASSWORD: "/auth/reset-password",
  USERS: "/users",
  ROLES: "/roles",
  PERMISSIONS: "/permissions",
  EMPLOYEES: "/employees",
  EMPLOYEE_STATUS_HISTORIES: "/employee-status-histories",
  EMPLOYEES_ASSIGNABLE: "/employees/assignable-employees",
  POSITIONS: "/positions",
  ORG_UNITS: "/org_units",
  ORG_UNITS_GENERATE_TMP: "/org_units/generate-tmp-code",
  ORG_UNITS_GENERATE_CODE: "/org_units/generate-code",
  ORG_UNITS_CHECK_TAX_CODE: "/org_units/check-tax-code",
  ORG_UNITS_COMPANIES: "/org_units/companies",
  DEPARTMENTS: "/departments",
  ORG_UNITS_EXPORT: "/org_units/export-excel",
  ORG_UNITS_EXPORT_PDF: "/org_units/export-pdf",
  ORG_UNITS_CHART_EXPORT_PDF: "/org_units/chart/export-pdf",
  DEPARTMENTS_EXPORT: "/departments/export-excel",
  DEPARTMENTS_EXPORT_PDF: "/departments/export-pdf",
  EMPLOYEES_EXPORT: "/employees/export-excel",
  EMPLOYEES_EXPORT_PDF: "/employees/export-pdf",
  EMPLOYEES_IMPORT_TEMPLATE: "/employees/import-template",
  EMPLOYEES_IMPORT_EXCEL: "/employees/import-excel",
  POSITIONS_EXPORT: "/positions/export-excel",
  POSITIONS_EXPORT_PDF: "/positions/export-pdf",
  POSITIONS_TRASHED: "/positions/trashed",
  EMPLOYEES_TRASHED: "/employees/trashed",
  USER_ROLE_SCOPES: "/user-role-scopes",
  USER_DATA_SCOPES: "/user-data-scopes",
  TASKS: "/tasks",

  WAREHOUSES: "/warehouses",
  WEBHOOKS_M2_ORDER_PROCESSING: "/webhooks/m2/order-processing",
  DASHBOARD: "/reports/dashboard-quick",
  DASHBOARD_KPI: "/reports/dashboard-quick",
  /** Màn Dashboard tổng quan — một payload cho cả màn hình. */
  REPORTS_DASHBOARD_OVERVIEW: "/reports/dashboard-overview",
  DASHBOARD_RECENT_DOCUMENTS: "/document-status-history",
  DASHBOARD_RECONCILE_HEALTH: "/inventory-snapshots",
  DASHBOARD_ALERTS: "/safe-stock-alerts",

  INBOUND_DOCUMENTS: "/inbound-documents",
  INBOUND_DOCUMENT: "/inbound-documents/:id",
  INBOUND_LINES: "/inbound-documents/:id",
  INBOUND_CANCEL: "/inbound-documents/:id/cancel",
  INBOUND_BOXES: "/inbound-documents/:id/boxes",
  /** GĐ1: materialize dòng COMPONENT theo Box (không nhập số lượng dự kiến). */
  INBOUND_COMPONENT_LINES: "/inbound-documents/:id/component-lines",
  INBOUND_POST_RECEIPT: "/inbound-documents/:id/post-receipt",
  // Path chuẩn theo SRS v1.12 §8.1 + Annex C (scanInboundDocument /
  // postReceiptReversal). Route số ít /scan, /reverse chỉ là legacy của BE.
  INBOUND_SCAN: "/inbound-documents/:id/scans",
  INBOUND_REVERSE: "/inbound-documents/:id/reversals",
  /** ERD bảng 28: gỡ mã quét sai trước Post (status ACTIVE -> REMOVED). */
  INBOUND_UNSCAN: "/inbound-documents/:id/unscan",
  /** Annex D SCR-IN-01: đọc lại bảng mã đã quét sau khi tải lại trang. */
  INBOUND_SCAN_ENTRIES: "/inbound-documents/:id/scan-entries",
  /**
   * Inbound Carton Scan v1.0 §3.3: mốc "Đã quét xong thùng" — audit-only,
   * stock-neutral, không đổi container.status, không bump document version.
   */
  INBOUND_CARTON_COMPLETE_SCAN:
    "/inbound-documents/:id/cartons/:containerId/complete-scan",

  // Annex C: scanOutboundDocument = /scans, confirmOutboundRequestImport = /confirm,
  // assignItemRfid = PUT /outbound-documents/{id}/items/{item_id}/rfid,
  // packing label lifecycle nằm dưới /outbound-documents/{id}/packing-labels/{label_id}.
  OUTBOUND_DOCUMENTS: "/outbound-documents",
  OUTBOUND_DOCUMENT: "/outbound-documents/:id",
  OUTBOUND_LINES: "/outbound-documents/:id",
  OUTBOUND_CANCEL: "/outbound-documents/:id/cancel",
  OUTBOUND_POST_ISSUE: "/outbound-documents/:id/post-issue",
  OUTBOUND_SCAN: "/outbound-documents/:id/scans",
  OUTBOUND_UNMATCH: "/outbound-documents/:id/unmatch",
  OUTBOUND_REVERSE: "/outbound-documents/:id/reversals",
  OUTBOUND_ITEM_RFID: "/outbound-documents/:id/items/:itemId/rfid",
  OUTBOUND_PACKING_LABEL_PREVIEW:
    "/outbound-documents/:id/packing-labels/:labelId/preview",
  OUTBOUND_PACKING_LABEL_READY:
    "/outbound-documents/:id/packing-labels/:labelId/ready",
  OUTBOUND_PACKING_LABEL_PRINT:
    "/outbound-documents/:id/packing-labels/:labelId/print",
  OUTBOUND_PACKING_LABEL_REPRINT:
    "/outbound-documents/:id/packing-labels/:labelId/reprint",
  OUTBOUND_REQUEST_IMPORTS: "/outbound-request-imports",
  OUTBOUND_REQUEST_IMPORT: "/outbound-request-imports/:id",
  OUTBOUND_REQUEST_IMPORT_CONFIRM: "/outbound-request-imports/:id/confirm",

  LABEL_SNAPSHOTS: "/label-snapshots",
  LABEL_SNAPSHOT: "/label-snapshots/:id",
  LABEL_SNAPSHOT_APPLY: "/label-snapshots/:id/apply",
  /** Nhật ký in nhãn — MỘT dòng cho MỖI lần Print/Reprint (ERD bảng 44). */
  LABEL_PRINT_EVENTS: "/label-print-events",
  PRINTER_CONFIGS: "/printer-configs",

  // Annex C listPutawayTasks / createPutawayTask / confirmPutawayTask /
  // cancelPutawayTask dùng path /putaway-tasks với permission putaway.manage.
  // Path legacy /putaway/tasks vẫn tồn tại ở BE nhưng không phải contract.
  PUTAWAY_TASKS: "/putaway-tasks",
  PUTAWAY_TASK: "/putaway-tasks/:id",
  PUTAWAY_CONFIRM: "/putaway-tasks/:id/confirm",
  PUTAWAY_CANCEL: "/putaway-tasks/:id/cancel",
  // History không nằm trong Annex C; giữ path hiện hành của BE.
  PUTAWAY_HISTORY: "/putaway/history",
  CONTAINERS: "/containers",
  CONTAINER: "/containers/:id",

  REPORTS_HUB: "/reports/hub",
  REPORTS_XNT: "/reports/inventory-xnt",
  REPORTS_XNT_EXPORT_EXCEL: "/reports/inventory-xnt/export-excel",
  REPORTS_XNT_ENHANCED: "/reports/inventory-xnt-enhanced",
  REPORTS_XNT_ENHANCED_EXPORT_EXCEL:
    "/reports/inventory-xnt-enhanced/export-excel",
  REPORTS_INVENTORY_BALANCE: "/reports/inventory-balance",
  REPORTS_INVENTORY_BALANCE_EXPORT_EXCEL:
    "/reports/inventory-balance/export-excel",
  REPORTS_DOCUMENT_HISTORY: "/reports/document-history",
  REPORTS_DOCUMENT_HISTORY_EXPORT_EXCEL:
    "/reports/document-history/export-excel",
  REPORTS_IMPORT_MATCH: "/reports/import-match",
  REPORTS_IMPORT_MATCH_EXPORT_EXCEL: "/reports/import-match/export-excel",
  REPORTS_LABEL_LOG: "/reports/label-log",
  REPORTS_LABEL_LOG_EXPORT_EXCEL: "/reports/label-log/export-excel",
  REPORTS_OUTBOUND_BY_AGENCY: "/reports/outbound-by-agency",
  REPORTS_OUTBOUND_BY_AGENCY_EXPORT_EXCEL:
    "/reports/outbound-by-agency/export-excel",
  REPORTS_WARRANTY_DEFECTS: "/reports/warranty-defects",
  REPORTS_WARRANTY_DEFECTS_EXPORT_EXCEL:
    "/reports/warranty-defects/export-excel",
  REPORTS_MOVEMENT_TRACE: "/reports/movement-trace",
  REPORTS_MOVEMENT_TRACE_EXPORT_EXCEL: "/reports/movement-trace/export-excel",
  // Annex C REQ-SRS-031/032: sổ ledger, dispatcher theo report_code và job export.
  REPORTS_INVENTORY_LEDGER: "/reports/inventory-ledger",
  REPORTS_BY_CODE: "/reports/:report_code",
  REPORTS_EXPORT: "/reports/export",
  INVENTORY_RECONCILIATION: "/reports/inventory-reconciliation",
  INVENTORY_BALANCES: "/inventory/balances",
  INVENTORY_BALANCE_SUBLEDGER: "/inventory/balances/:id/subledger",
  STOCK_MOVEMENTS: "/stock-movements",
  STOCK_MOVEMENT: "/stock-movements/:id",
  STOCK_MOVEMENT_TRACE_SOURCE: "/stock-movements/:id/trace-source",
  STOCK_MOVEMENT_TRACE_BY_CODE: "/stock-movements/trace-by-code",
  SAFE_STOCK_ALERTS: "/safe-stock-alerts",
  SAFE_STOCK_CONFIGS: "/safe-stock-configs",
  SAFE_STOCK_CONFIG: "/safe-stock-configs/:id",

  // Canonical foundation/master routes from BE m1.
  PRODUCTS: "/products",
  PRODUCT: "/products/:id",
  PRODUCT_MASTERS: "/product-masters",
  PRODUCT_CATEGORIES: "/product-categories",
  PRODUCT_CATEGORY: "/product-categories/:id",
  BRANDS: "/brands",
  BRAND: "/brands/:id",
  PRODUCT_MODELS: "/product-models",
  PRODUCT_MODEL: "/product-models/:id",
  POWER_SOURCES: "/power-sources",
  POWER_SOURCE: "/power-sources/:id",
  PACKAGE_VARIANTS: "/package-variants",
  PACKAGE_VARIANT: "/package-variants/:id",
  AGENCIES: "/agencies",
  // Annex C listDefects/createDefect/updateDefect — path chuẩn §8.1 Master.
  DEFECT_CATALOGS: "/defects",
  /** Annex C publishPvProduct — quyền pv.publish tách khỏi sku.manage (§3). */
  PV_PRODUCT_PUBLISH: "/pv/products/:id/publish",
  ITEMS: "/item-instances",
  PHYSICAL_CODES: "/physical-codes",
  // Compatibility names point to canonical routes; never issue /skus or /items.
  SKUS: "/products",
  SKU: "/products/:id",
  // WWHN-331/WWHN-224/WWHN-330: bulk SKU import qua Excel — path thật theo
  // Modules/Warehouse/routes/import.php + ImportController/ImportReportController
  // (BE), KHÔNG phải /import-batches (đó là resource ImportBatch/ERD item_instance
  // hoàn toàn khác, dùng permission import_batch.view/manage riêng). Giá trị cũ ở
  // đây trỏ sai path nhưng không có nơi nào trong FE dùng nó nên sửa an toàn.
  SKU_IMPORT_TEMPLATE: "/skus/import-template",
  SKU_IMPORT_EXCEL: "/skus/import-excel",
  SKU_IMPORT_REPORTS: "/skus/import-reports",
  SKU_IMPORT_REPORT: "/skus/import-reports/:id",
  // WWHN-330 P1-01: route GET .../{id}/error-file ĐÃ được khai thật ở BE
  // (Modules/Warehouse/routes/import.php → ImportReportController::downloadErrorFile,
  // permission sku.manage) và trả CSV do ImportErrorFileService sinh ra, lưu tại
  // storage/app/import-error-files. BE trả 404 THỐNG NHẤT cho cả 3 ca "report không có
  // file lỗi" / "file đã hết hạn" / "không tìm thấy" (cố ý, tránh lộ existence), nên FE
  // bật/tắt nút tải theo `error_file_available` — boolean do BE tính ở server, đúng bằng
  // điều kiện endpoint này dùng để trả 200 hay 404 (xem SkuImportModal). Đường dẫn lưu
  // trữ nội bộ `error_file_path` không được BE trả ra ngoài.
  SKU_IMPORT_REPORT_ERROR_FILE: "/skus/import-reports/:id/error-file",
  /**
   * ERD bảng 20/21 — phát hành Item_Instance mới kèm Physical_Code mới
   * (QR/Barcode) cho SKU PRODUCT serial-tracked, stock-neutral. Permission
   * physical_code.create (Modules/Warehouse/routes/governance.php).
   */
  SKU_ITEM_ISSUE: "/skus/:id/items",
  /** @deprecated ERD bảng import_batch (item_instance traceability) — không phải SKU import. */
  IMPORT_BATCHES: "/import-batches",

  SCAN_BATCHES: "/scan/batches",
  SCAN_BATCHES_CLASSIFY: "/scan/classify",
  SCAN_EVENTS: "/scan/events",
  DOCUMENT_STATUS_HISTORY: "/document-status-history",

  // REQ-SRS-037 (Must; nhãn `DEC-NO-STOCKTAKE-001` CHƯA có formal approval — xem
  // ghi chú thẩm quyền ở src/shared/constants/routes.ts): MVP không có
  // Stocktake/Variance/Snapshot ở bất kỳ lớp nào (entity, API, permission, menu,
  // report). Mọi sửa sai sau Post dùng Reversal append-only bên dưới.
  REVERSAL_DOCUMENTS: "/reversal-documents",
  REVERSAL_DOCUMENT: "/reversal-documents/:id",
  REVERSAL_DOCUMENT_LINES: "/reversal-documents/:id/lines",
  REVERSAL_CREATE: "/reversal-documents",
  REVERSAL_CONFIRM: "/reversal-documents/:id/confirm",
  REVERSAL_POST: "/reversal-documents/:id/post",
  REVERSAL_CANCEL: "/reversal-documents/:id/cancel",
  REVERSAL_MOVEMENT_LOOKUP: "/stock-movements/reversible",

  // "Chứng từ nhập/xuất/hoàn trả": ảnh/scan/PDF đính kèm phiếu nhập, phiếu xuất,
  // hoàn trả/điều chỉnh (Modules\Warehouse\Http\Controllers\DocumentAttachmentController,
  // bảng document_attachments dùng chung cho cả 3 loại — cùng khuôn warranty
  // attachments bên dưới).
  INBOUND_DOCUMENT_ATTACHMENTS: "/inbound-documents/:id/attachments",
  OUTBOUND_DOCUMENT_ATTACHMENTS: "/outbound-documents/:id/attachments",
  REVERSAL_DOCUMENT_ATTACHMENTS: "/reversal-documents/:id/attachments",
  DOCUMENT_ATTACHMENT_DOWNLOAD: "/document-attachments/:id/download",
  DOCUMENT_ATTACHMENT: "/document-attachments/:id",
  DOCUMENT_ATTACHMENT_PENDING_EVIDENCE:
    "/document-attachments/pending-evidence",

  WARRANTY_CASES: "/warranty-cases",
  WARRANTY_CASE: "/warranty-cases/:id",
  // Annex C transitionWarrantyStatus. PATCH /warranty-cases/{id} vẫn tồn tại ở BE cho
  // client cũ nhưng không nằm trong 67 operation của OpenAPI v1.7.
  WARRANTY_CASE_STATUS: "/warranty-cases/:id/status",
  WARRANTY_CASE_EVENTS: "/warranty-cases/:caseId/events",
  WARRANTY_CASE_ATTACHMENTS: "/warranty-cases/:caseId/attachments",
  WARRANTY_ATTACHMENT: "/warranty-attachments/:id",
  WARRANTY_ATTACHMENT_DOWNLOAD: "/warranty-attachments/:id/download",
  // Annex C createComponentIssue/scanComponentIssue/cancelComponentIssue/
  // postComponentIssue — path chuẩn là /warranty-component-issues + /{id}/scans.
  COMPONENT_ISSUE_DOCUMENTS: "/warranty-component-issues",
  COMPONENT_ISSUE_DOCUMENT: "/warranty-component-issues/:id",
  COMPONENT_ISSUE_SCAN: "/warranty-component-issues/:id/scans",
  COMPONENT_ISSUE_CANCEL: "/warranty-component-issues/:id/cancel",
  COMPONENT_ISSUE_POST: "/warranty-component-issues/:id/post",

  AUDIT_LOGS: "/audit-logs",

  NOTIFICATIONS: "/notifications",
  NOTIFICATIONS_UNREAD_COUNT: "/notifications/unread-count",
  NOTIFICATION_MARK_READ: "/notifications/:id/read",
  NOTIFICATIONS_READ_ALL: "/notifications/read-all",
} as const;
