import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ĐÃ RÚT theo 3822d45: docs/evidence/WWHN-211/fe-contract-lock.json (manifest
// pin) và bước ghi evidence/wwhn-211/fe-contract-evidence.json không còn —
// hợp đồng 6 endpoint được NHÚNG THẲNG vào script này (chép nguyên trạng từ
// manifest lịch sử, git show 3822d45^) để các kiểm tra mã nguồn sống tiếp tục
// hiệu lực mà không phụ thuộc kho tài liệu đã gỡ.
const CONTRACT_ENDPOINTS = [
  { constant: "INVENTORY_BALANCES", path: "/inventory/balances", function: "fetchInventoryBalances" },
  { constant: "INVENTORY_BALANCE_SUBLEDGER", path: "/inventory/balances/:id/subledger", function: "fetchBalanceSubledger" },
  { constant: "STOCK_MOVEMENTS", path: "/stock-movements", function: "fetchStockMovements" },
  { constant: "STOCK_MOVEMENT", path: "/stock-movements/:id", function: "fetchStockMovement" },
  { constant: "STOCK_MOVEMENT_TRACE_SOURCE", path: "/stock-movements/:id/trace-source", function: "traceStockMovementSource" },
  { constant: "STOCK_MOVEMENT_TRACE_BY_CODE", path: "/stock-movements/trace-by-code", function: "traceByPhysicalCode" },
];

const root = resolve(import.meta.dirname, "..");
const servicePath = resolve(root, "src/modules/inventory/services/inventoryService.ts");
const testPath = resolve(root, "src/modules/inventory/services/inventoryService.test.ts");
const endpointsPath = resolve(root, "src/shared/api/endpoints.ts");
const accessPath = resolve(root, "src/app/router/access.ts");
const pagePath = resolve(root, "src/modules/inventory/pages/InventoryPage.tsx");

const fail = (message) => {
  console.error(`[WWHN-211] ${message}`);
  process.exit(1);
};

const text = (path) => readFileSync(path, "utf8");
const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const service = text(servicePath);
const tests = text(testPath);
const endpoints = text(endpointsPath);
const access = text(accessPath);
const page = text(pagePath);

for (const endpoint of CONTRACT_ENDPOINTS) {
  const constantPattern = new RegExp(
    `${endpoint.constant}\\s*:\\s*["']${escapeRegExp(endpoint.path)}["']`,
  );
  if (!constantPattern.test(endpoints)) {
    fail(`Endpoint constant mismatch: ${endpoint.constant} -> ${endpoint.path}`);
  }

  const functionPattern = new RegExp(
    `export\\s+async\\s+function\\s+${endpoint.function}\\s*\\(`,
  );
  if (!functionPattern.test(service)) {
    fail(`Missing inventory service function: ${endpoint.function}`);
  }
  if (!service.includes(`API_ENDPOINTS.${endpoint.constant}`)) {
    fail(`Service function is not mapped to ${endpoint.constant}`);
  }
  if (!tests.includes(endpoint.function)) {
    fail(`Unit evidence does not cover ${endpoint.function}`);
  }
}

const forbiddenInventoryScope = [
  "SafeStockConfigPayload",
  "fetchSafeStockAlerts",
  "fetchSafeStockConfigs",
  "createSafeStockConfig",
  "fetchScanBatches",
  "createScanBatch",
  "fetchScanEvents",
  "API_ENDPOINTS.SAFE_STOCK",
  "API_ENDPOINTS.SCAN_",
];
for (const token of forbiddenInventoryScope) {
  if (service.includes(token) || tests.includes(token)) {
    fail(`P2 scope leak/dead code remains in WWHN-211 inventory service: ${token}`);
  }
}

if (!access.includes("[ROUTES.INVENTORY]: [P.INVENTORY_VIEW]")) {
  fail("Inventory route is not fail-closed behind inventory.view.");
}
if (!page.includes("useCanAny([P.INVENTORY_TRACE])")) {
  fail("Inventory trace action is not guarded by inventory.trace.");
}
if (!page.includes("disabled={!canTrace || !row.id}")) {
  fail("Movement trace action does not fail closed when inventory.trace is missing.");
}
if (!page.includes("ApiErrorAlert") || !page.includes("onRetry={() => balanceQuery.refetch()}")) {
  fail("Inventory page is missing standardized API error/retry behavior.");
}

console.log(
  `WWHN-211 FE contract verified: endpoints=${CONTRACT_ENDPOINTS.length} (contract inlined; manifest/evidence files retired by 3822d45)`,
);
