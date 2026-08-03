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
const taskDoc = read("docs/Task_docs_Jira/[FE1] Triển khai UI dữ liệu danh mục_SKU_import.md");

requirePattern(page, /<Button[^>]*disabled[^>]*>[\s\S]{0,120}Import SKU cũ/, "Import button must stay disabled");
requirePattern(page, /\/skus\/import-excel không có trong OpenAPI/i, "Import blocker must be visible");
requirePattern(service, /export async function importSkus[\s\S]*throw new Error/, "Import must fail closed");
requirePattern(service, /export async function getItems[\s\S]*throw new Error/, "Items must fail closed");
requirePattern(service, /export async function getPhysicalCodes[\s\S]*throw new Error/, "Physical codes must fail closed");
forbidPattern(service, /http\.(post|put|patch)\([^\n]*SKU_IMPORT_EXCEL/, "No import HTTP request");
forbidPattern(service, /http\.get(Page)?<[^>]*>\(API_ENDPOINTS\.ITEMS/, "No item HTTP request");
forbidPattern(service, /http\.get(Page)?<[^>]*>\(API_ENDPOINTS\.PHYSICAL_CODES/, "No physical-code HTTP request");

requirePattern(endpoints, /PRODUCTS:\s*"\/products"/, "Canonical Product endpoint");
requirePattern(page, /hasPermission\("sku\.manage"\)/, "SKU permission guard");
requirePattern(page, /hasPermission\("master\.manage"\)/, "Master permission guard");
requirePattern(page, /disabled={!canManageMasterData}/, "Actions must be guarded");
requirePattern(page, /normalized\.status === 403/, "Dedicated 403 state");
requirePattern(page, /Mã yêu cầu:/, "Request ID observability");
for (const field of ["product_code", "name", "uom_id", "list_price_net", "vat_rate", "status"]) {
  requirePattern(page, new RegExp(`name=["']${field}["']`), `SKU field ${field}`);
}
requirePattern(serviceTest, /not\.toHaveBeenCalled\(\)/, "Fail-closed unit test");

for (const token of ["loading", "empty", "error", "success", "disabled", "responsive", "accessibility", "WWHN-179", "HN-MC-001", "Backend authorization", "PR/CI trace"]) {
  requirePattern(taskDoc, new RegExp(token, "i"), `Task evidence token ${token}`);
}
requirePattern(taskDoc, /Không tự nhận QA2 sign-off/i, "QA evidence boundary");
requirePattern(taskDoc, /Không tự nhận BE authorization sign-off/i, "BE evidence boundary");

if (failures.length) {
  console.error("[master-sku-closure] FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("[master-sku-closure] PASS: contract, RBAC, validation, evidence and ownership gates enforced.");
