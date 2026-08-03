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
const serviceTest = read("src/modules/master-data/services/master-data.service.test.ts");
const endpoints = read("src/shared/api/endpoints.ts");
const taskDoc = read(
  "docs/Task_docs_Jira/[FE1] Triển khai UI dữ liệu danh mục_SKU_import.md",
);

// P0: no runtime request may be sent to an endpoint absent from the approved contract.
requirePattern(page, /Import SKU cũ[\s\S]{0,300}disabled/, "Import button must stay disabled");
requirePattern(
  page,
  /\/skus\/import-excel không có trong OpenAPI/i,
  "Import blocker must be visible to users",
);
requirePattern(service, /export async function importSkus[\s\S]*throw new Error/, "Import service must fail closed");
requirePattern(service, /export async function getItems[\s\S]*throw new Error/, "Item service must fail closed");
requirePattern(
  service,
  /export async function getPhysicalCodes[\s\S]*throw new Error/,
  "Physical-code service must fail closed",
);
forbidPattern(service, /http\.(post|put|patch)\([^\n]*SKU_IMPORT_EXCEL/, "No import HTTP request");
forbidPattern(service, /http\.get(Page)?<[^>]*>\(API_ENDPOINTS\.ITEMS/, "No item HTTP request");
forbidPattern(
  service,
  /http\.get(Page)?<[^>]*>\(API_ENDPOINTS\.PHYSICAL_CODES/,
  "No physical-code HTTP request",
);

// P1: approved Product contract, validation, RBAC and error observability.
requirePattern(endpoints, /PRODUCTS:\s*"\/products"/, "Canonical Product endpoint");
requirePattern(page, /hasPermission\("sku\.manage"\)/, "SKU permission guard");
requirePattern(page, /hasPermission\("master\.manage"\)/, "Master permission guard");
requirePattern(page, /disabled={!canManageMasterData}/, "Create/status actions must be guarded");
requirePattern(page, /normalized\.status === 403/, "403 must have a dedicated UI state");
requirePattern(page, /Mã yêu cầu:/, "Request ID must be rendered for diagnosis");
for (const field of ["product_code", "name", "uom_id", "list_price_net", "vat_rate", "status"]) {
  requirePattern(page, new RegExp(`name=["']${field}["']`), `Required SKU field ${field}`);
}
requirePattern(page, /vat_rate:[\s\S]*8/, "VAT default must be explicit");
requirePattern(serviceTest, /not\.toHaveBeenCalled\(\)/, "Fail-closed behavior must be unit tested");

// P2 and auditability: the exact Jira handoff document must expose states and external owners.
for (const token of [
  "loading",
  "empty",
  "error",
  "success",
  "disabled",
  "responsive",
  "accessibility",
  "WWHN-179",
  "HN-MC-001",
  "Backend authorization",
  "PR/CI trace",
]) {
  requirePattern(taskDoc, new RegExp(token, "i"), `Task evidence token ${token}`);
}
requirePattern(taskDoc, /Không tự nhận QA2 sign-off/i, "QA evidence must not be fabricated");
requirePattern(taskDoc, /Không tự nhận BE authorization sign-off/i, "BE evidence must not be fabricated");

if (failures.length > 0) {
  console.error("[master-sku-closure] FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  "[master-sku-closure] PASS: fail-closed API contract, Product validation/RBAC/error handling, UI-state evidence requirements, and ownership boundaries are enforced.",
);
