/**
 * WWHN-202 · DEV202-P1-05R2 — pin hợp đồng "Balance hỗ trợ" (HN-OUT-003) mà FE xác nhận.
 *
 * Register yêu cầu: "Pin exact approved OpenAPI/Postman revision on WWHN-202; FE confirms
 * balance/subledger/movement/reversible/reconcile usable; QA uses same contract."
 *
 * File này là **nửa FE** của yêu cầu đó. Nó không mô tả lại contract — nó ghim đúng ba thứ
 * mà một lời "FE confirm" bằng lời nói không chứng minh được:
 *
 *  1. **Revision nào** đã được xác nhận — sha256 của artifact BE, không phải số version.
 *     Số `2.0.0` có thể giữ nguyên trong khi nội dung đổi; hash thì không.
 *  2. **Đúng 5 bề mặt** (balance / subledger / movement / reversible / reconcile) — path và
 *     permission phải trùng khít bảng route BE, để QA1 và FE dùng chung một hợp đồng.
 *  3. **FE thật sự gọi được** — `wwhn-202-balance-contract-pin.test.ts` quét source và bắt
 *     buộc mỗi bề mặt có hàm service tương ứng. Một endpoint được khai trong `endpoints.ts`
 *     nhưng không hàm nào gọi thì **không** tính là "usable" (đúng lỗi của
 *     `INVENTORY_RECONCILIATION` trước phiên này).
 *
 * Nửa BE: `docs/evidence/WWHN-202/CONTRACT_PIN.json` +
 * `Wwhn202OutboundBalanceEvidenceTest::test_read_surface_permission_matrix_matches_the_registered_routes`
 * + `scripts/verify-wwhn-202-closure.mjs` (tự băm lại artifact, chống pin rot).
 */

export type Wwhn202ReadSurface = {
  /** Khoá nghiệp vụ trong register: balance / subledger / movement / reversible / reconcile. */
  readonly surface:
    | "balance"
    | "subledger"
    | "movement-list"
    | "movement-detail"
    | "movement-trace-source"
    | "movement-trace-by-code"
    | "reversible"
    | "reconcile";
  /** Khoá trong `API_ENDPOINTS` — nguồn sự thật duy nhất của path phía FE. */
  readonly endpointKey: string;
  /** Path tương đối base `/api/v1`, đúng như route BE đăng ký. */
  readonly path: string;
  /** Permission BE enforce (§8.1 "exact x-permission + data scope"). */
  readonly permission: string;
  /** Hàm service FE phải tồn tại và phải gọi đúng `endpointKey`. */
  readonly serviceExport: string;
  /** File chứa hàm service đó. */
  readonly serviceModule: string;
};

/**
 * Revision hợp đồng BE mà FE đã đọc và xác nhận.
 *
 * Ghim theo **slice** — bản trích 8 operation của output "Balance hỗ trợ" từ
 * `storage/api-docs/api-docs.json`, chuẩn hoá khoá rồi băm — chứ KHÔNG theo sha256 của cả
 * file. `api-docs.json` sinh tự động từ annotation toàn hệ thống nên mọi task khác cũng
 * làm đổi hash cả file; ghim cả file sẽ đỏ hằng ngày vì lý do không liên quan tới
 * WWHN-202, và một cổng đỏ vì nhiễu là cổng bị bỏ qua. Slice chỉ đổi khi chính hợp đồng
 * của 8 bề mặt này đổi — đúng lúc FE phải xác nhận lại.
 *
 * Bản slice và giá trị hash nằm ở repo BE:
 *   `docs/evidence/WWHN-202/openapi-wwhn202-slice.json`
 *   `docs/evidence/WWHN-202/CONTRACT_PIN.json` → `openApiSliceSha256`
 * `scripts/verify-wwhn-202-closure.mjs` check C3 so hằng số dưới đây với pin phía BE, nên
 * hai repo không thể trôi ra hai revision khác nhau mà cổng vẫn xanh.
 */
export const WWHN_202_CONTRACT_REVISION = {
  task: "WWHN-202",
  parentTask: "WWHN-47",
  qaTask: "WWHN-203",
  decisionRecord: "DEC-STK-202",
  openApiVersion: "2.0.0",
  openApiPath: "storage/api-docs/api-docs.json",
  openApiSlicePath: "docs/evidence/WWHN-202/openapi-wwhn202-slice.json",
  openApiSliceSha256:
    "b9821645638fdac8b3104c6a24bd59926a1bb3f88e35a86deb604c43ff54920a",
  postmanPath:
    "docs/postman/WMS_HoaNam API Contract - DEV.postman_collection.json",
  /** Số bề mặt WWHN-202 mà collection Postman phải phủ để QA1 retest được đủ. */
  postmanSurfaceCount: 8,
  apiBasePath: "/api/v1",
} as const;

/** Đúng 8 route tạo nên 5 bề mặt nghiệp vụ mà register liệt kê. */
export const WWHN_202_READ_SURFACES: readonly Wwhn202ReadSurface[] = [
  {
    surface: "balance",
    endpointKey: "INVENTORY_BALANCES",
    path: "/inventory/balances",
    permission: "inventory.view",
    serviceExport: "fetchInventoryBalances",
    serviceModule: "src/modules/inventory/services/inventoryService.ts",
  },
  {
    surface: "subledger",
    endpointKey: "INVENTORY_BALANCE_SUBLEDGER",
    path: "/inventory/balances/:id/subledger",
    permission: "inventory.view",
    serviceExport: "fetchBalanceSubledger",
    serviceModule: "src/modules/inventory/services/inventoryService.ts",
  },
  {
    surface: "movement-list",
    endpointKey: "STOCK_MOVEMENTS",
    path: "/stock-movements",
    permission: "inventory.view",
    serviceExport: "fetchStockMovements",
    serviceModule: "src/modules/inventory/services/inventoryService.ts",
  },
  {
    surface: "movement-detail",
    endpointKey: "STOCK_MOVEMENT",
    path: "/stock-movements/:id",
    permission: "inventory.view",
    serviceExport: "fetchStockMovement",
    serviceModule: "src/modules/inventory/services/inventoryService.ts",
  },
  {
    surface: "movement-trace-source",
    endpointKey: "STOCK_MOVEMENT_TRACE_SOURCE",
    path: "/stock-movements/:id/trace-source",
    permission: "inventory.trace",
    serviceExport: "traceStockMovementSource",
    serviceModule: "src/modules/inventory/services/inventoryService.ts",
  },
  {
    surface: "movement-trace-by-code",
    endpointKey: "STOCK_MOVEMENT_TRACE_BY_CODE",
    path: "/stock-movements/trace-by-code",
    permission: "inventory.trace",
    serviceExport: "traceByPhysicalCode",
    serviceModule: "src/modules/inventory/services/inventoryService.ts",
  },
  {
    surface: "reversible",
    endpointKey: "REVERSAL_MOVEMENT_LOOKUP",
    path: "/stock-movements/reversible",
    permission: "inventory.reversal.post",
    serviceExport: "fetchReversibleMovements",
    serviceModule: "src/modules/reverse/services/reversalService.ts",
  },
  {
    surface: "reconcile",
    endpointKey: "INVENTORY_RECONCILIATION",
    path: "/reports/inventory-reconciliation",
    // 07/09/2026: BE đổi từ `report.view` sang mã riêng của màn RPT-02 khi BA tách
    // quyền xem báo cáo theo từng màn (endpoint này chỉ phục vụ Tồn kho & đối soát).
    // Pin đối chiếu với Wwhn202OutboundBalanceEvidenceTest::READ_SURFACE_PERMISSIONS.
    permission: "report.stock_reconcile.view",
    serviceExport: "fetchInventoryReconciliation",
    serviceModule: "src/modules/inventory/services/inventoryService.ts",
  },
];

/**
 * Trường đối soát bắt buộc phải sống sót qua normalizer của FE. RPT-INV-01 (§13.10) quy
 * định cổng "Ledger=Balance=subledger; FAIL warning/block sign-off" — nếu FE nuốt mất một
 * trong các trường này thì cổng đó không quan sát được trên UI.
 */
export const WWHN_202_RECONCILIATION_FIELDS = [
  "reconciliation_status",
  "variance",
  "incident_id",
] as const;

/**
 * Phân lớp mã lỗi mà FE phải bám (DEC-STK-202 §D-1). FE đọc `error_code`, KHÔNG suy từ
 * `message` và KHÔNG giả định "409 = hết tồn".
 */
export const WWHN_202_ERROR_TAXONOMY = {
  missingIfMatch: { http: 428, errorCode: "PRECONDITION_REQUIRED" },
  staleIfMatch: { http: 412, errorCode: "STALE_VERSION" },
  idempotentReplay: { http: 200, errorCode: null },
  idempotencyPayloadDiffers: { http: 409, errorCode: "IDEMPOTENCY_CONFLICT" },
  duplicateStockEffect: { http: 409, errorCode: "DUPLICATE_STOCK_EFFECT" },
  insufficientStock: { http: 422, errorCode: "INSUFFICIENT_STOCK" },
  accessDenied: { http: 403, errorCode: "ACCESS_DENIED" },
  unauthenticated: { http: 401, errorCode: "UNAUTHENTICATED" },
  notFound: { http: 404, errorCode: "RESOURCE_NOT_FOUND" },
} as const;
