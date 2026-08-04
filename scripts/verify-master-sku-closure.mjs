#!/usr/bin/env node
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const failures = [];

function read(path) {
  const fullPath = join(root, path);
  if (!existsSync(fullPath)) {
    failures.push(`Missing required file: ${path}`);
    return "";
  }
  return readFileSync(fullPath, "utf8");
}

function requirePattern(content, pattern, label) {
  if (!pattern.test(content)) failures.push(`${label}: missing ${pattern}`);
}

function forbidPattern(content, pattern, label) {
  if (pattern.test(content)) failures.push(`${label}: forbidden ${pattern}`);
}

const page = read("src/modules/master-data/pages/MasterPage.tsx");
const service = read("src/modules/master-data/services/master-data.service.ts");
const serviceTest = read(
  "src/modules/master-data/services/master-data.service.test.ts",
);
const endpoints = read("src/shared/api/endpoints.ts");
const taskDoc = read(
  "docs/Task_docs_Jira/[FE1] Triển khai UI dữ liệu danh mục_SKU_import.md",
);

requirePattern(
  page,
  /<Button[\s\S]{0,240}?disabled[\s\S]{0,160}?Import SKU cũ/,
  "Import button must stay disabled",
);
requirePattern(
  page,
  /\/skus\/import-excel không có trong OpenAPI/i,
  "Import blocker must be visible",
);
requirePattern(
  service,
  /export async function importSkus[\s\S]*throw new Error/,
  "Import must fail closed",
);
requirePattern(
  service,
  /export async function getItems[\s\S]*throw new Error/,
  "Items must fail closed",
);
requirePattern(
  service,
  /export async function getPhysicalCodes[\s\S]*throw new Error/,
  "Physical codes must fail closed",
);
forbidPattern(
  service,
  /http\.(post|put|patch)\([^\n]*SKU_IMPORT_EXCEL/,
  "No import HTTP request",
);
forbidPattern(
  service,
  /http\.get(Page)?<[^>]*>\(API_ENDPOINTS\.ITEMS/,
  "No item HTTP request",
);
forbidPattern(
  service,
  /http\.get(Page)?<[^>]*>\(API_ENDPOINTS\.PHYSICAL_CODES/,
  "No physical-code HTTP request",
);

requirePattern(
  endpoints,
  /PRODUCTS:\s*"\/products"/,
  "Canonical Product endpoint",
);
requirePattern(
  page,
  /hasPermission\("sku\.manage"\)/,
  "SKU permission guard",
);
requirePattern(
  page,
  /hasPermission\("master\.manage"\)/,
  "Master permission guard",
);
requirePattern(
  page,
  /disabled={!canManageMasterData}/,
  "Actions must be guarded",
);
requirePattern(page, /normalized\.status === 403/, "Dedicated 403 state");
requirePattern(page, /Mã yêu cầu:/, "Request ID observability");
for (const field of [
  "product_code",
  "name",
  "uom_id",
  "list_price_net",
  "vat_rate",
  "status",
]) {
  requirePattern(
    page,
    new RegExp(`name=["']${field}["']`),
    `SKU field ${field}`,
  );
}
requirePattern(
  serviceTest,
  /not\.toHaveBeenCalled\(\)/,
  "Fail-closed unit test",
);

// UI-state evidence is verified from executable JSX; the task document must
// provide trace, ownership, and the independent sign-off boundary.
for (const [label, pattern] of [
  ["loading", /\bloading\b|isLoading|isFetching/i],
  ["empty", /emptyText|Không có|Chưa có/i],
  ["error", /isError|errorAlert|type="error"/i],
  ["success", /type=.*success|message\.success/i],
  ["disabled", /\bdisabled\b/i],
  ["responsive", /\bxs=|\bmd=|scroll=\{\{/i],
  ["accessibility", /Tooltip|title=|label=/i],
]) {
  requirePattern(page, pattern, `Executable UI state ${label}`);
}

for (const [label, pattern] of [
  ["WWHN-179", /WWHN-179/i],
  ["HN-MC-001", /HN-MC-001/i],
  [
    "Backend authorization",
    /Backend authorization|phân quyền Backend|bằng chứng 403\/data-scope/i,
  ],
  ["PR/CI trace", /Trace PR\s*\/\s*CI|PR\/CI/i],
  ["QA2 checklist", /Checklist thực thi QA2/i],
]) {
  requirePattern(taskDoc, pattern, `Task evidence ${label}`);
}
requirePattern(
  taskDoc,
  /không(?:\s+thể)?\s+tự nhận QA2 sign-off/i,
  "QA evidence boundary",
);
requirePattern(
  taskDoc,
  /không.*(?:tự nhận|coi).*(?:BE|backend).*(?:sign-off|bằng chứng)/is,
  "BE evidence boundary",
);

if (failures.length) {
  console.error("[master-sku-closure] FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  "[master-sku-closure] PASS: contract, RBAC, executable UI states, evidence and ownership gates enforced.",
);
