import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const manifestPath = resolve(root, "docs/evidence/WWHN-211/fe-contract-lock.json");
const servicePath = resolve(root, "src/modules/inventory/services/inventoryService.ts");
const testPath = resolve(root, "src/modules/inventory/services/inventoryService.test.ts");
const endpointsPath = resolve(root, "src/shared/api/endpoints.ts");
const accessPath = resolve(root, "src/app/router/access.ts");
const pagePath = resolve(root, "src/modules/inventory/pages/InventoryPage.tsx");
const evidencePath = resolve(root, "evidence/wwhn-211/fe-contract-evidence.json");

const fail = (message) => {
  console.error(`[WWHN-211] ${message}`);
  process.exit(1);
};

const text = (path) => readFileSync(path, "utf8");
const sha256 = (path) =>
  createHash("sha256").update(readFileSync(path)).digest("hex");
const escapeRegExp = (value) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const manifest = JSON.parse(text(manifestPath));
const service = text(servicePath);
const tests = text(testPath);
const endpoints = text(endpointsPath);
const access = text(accessPath);
const page = text(pagePath);

if (!Array.isArray(manifest.endpoints) || manifest.endpoints.length !== 6) {
  fail("FE contract must contain exactly six WWHN-211 endpoints.");
}

for (const endpoint of manifest.endpoints) {
  const constantPattern = new RegExp(
    `${endpoint.constant}\\s*:\\s*[\"']${escapeRegExp(endpoint.path)}[\"']`,
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

mkdirSync(dirname(evidencePath), { recursive: true });
const files = {
  manifest: manifestPath,
  inventory_service: servicePath,
  inventory_service_test: testPath,
  endpoint_catalog: endpointsPath,
  route_access: accessPath,
  inventory_page: pagePath,
};
const hashes = Object.fromEntries(
  Object.entries(files).map(([name, path]) => [name, sha256(path)]),
);
const evidence = {
  contract_id: manifest.contract_id,
  contract_version: manifest.version,
  generated_at: new Date().toISOString(),
  git_sha: process.env.GITHUB_SHA ?? "LOCAL",
  endpoint_count: manifest.endpoints.length,
  endpoints: manifest.endpoints,
  route: manifest.route,
  route_permission: manifest.route_permission,
  trace_permission: manifest.trace_permission,
  code_scope: manifest.scope,
  sha256: hashes,
  p2_dead_inventory_service_scope: "REMOVED",
  open_p0_p1_code_blockers: 0,
  external_gates: manifest.external_gates,
};
writeFileSync(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(
  `WWHN-211 FE contract verified: endpoints=${manifest.endpoints.length} evidence=${evidencePath}`,
);
