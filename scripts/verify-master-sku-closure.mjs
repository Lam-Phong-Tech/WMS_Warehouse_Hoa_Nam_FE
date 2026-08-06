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
const taskDoc = read("docs/Task_docs_Jira/WWHN-178.md");
const registerPath = "docs/evidence/wwhn-178/WWHN-178_CLOSURE_REGISTER.json";
const registerRaw = read(registerPath);
let register;
try {
  register = JSON.parse(registerRaw);
} catch (error) {
  failures.push(`${registerPath}: invalid JSON (${error.message})`);
}

requirePattern(page, /<Button[\s\S]{0,240}?disabled[\s\S]{0,160}?Import SKU cũ/, "Import button must stay disabled");
requirePattern(page, /\/skus\/import-excel không có trong OpenAPI/i, "Import blocker must be visible");
requirePattern(service, /export async function importSkus[\s\S]*assertMasterDataContractApproved\("SKU_IMPORT"\)/, "Import must fail closed through contract gate");
requirePattern(service, /export async function getItems[\s\S]*assertMasterDataContractApproved\("ITEM_LIST"\)/, "Items must fail closed through contract gate");
requirePattern(service, /export async function getPhysicalCodes[\s\S]*assertMasterDataContractApproved\("PHYSICAL_CODE_LIST"\)/, "Physical codes must fail closed through contract gate");
forbidPattern(service, /http\.(post|put|patch)\([^\n]*SKU_IMPORT_EXCEL/, "No import HTTP request");
forbidPattern(service, /http\.get(Page)?<[^>]*>\(API_ENDPOINTS\.ITEMS/, "No item HTTP request");
forbidPattern(service, /http\.get(Page)?<[^>]*>\(API_ENDPOINTS\.PHYSICAL_CODES/, "No physical-code HTTP request");
requirePattern(endpoints, /PRODUCTS:\s*"\/products"/, "Canonical Product endpoint");
requirePattern(page, /hasPermission\("sku\.manage"\)/, "SKU permission guard");
requirePattern(page, /hasPermission\("master\.manage"\)/, "Master permission guard");
requirePattern(page, /disabled={!canManageMasterData}/, "Actions must be guarded");
requirePattern(page, /normalized\.status === 403/, "Dedicated 403 state");
requirePattern(page, /Mã yêu cầu:/, "Request ID observability");
requirePattern(serviceTest, /not\.toHaveBeenCalled\(\)/, "Fail-closed unit test");

for (const [label, pattern] of [
  ["loading", /\bloading\b|isLoading|isFetching/i],
  ["empty", /emptyText|Không có|Chưa có/i],
  ["error", /isError|errorAlert|type="error"/i],
  ["success", /type=.*success|message\.success/i],
  ["disabled", /\bdisabled\b/i],
  ["responsive", /\bxs=|\bmd=|scroll=\{\{/i],
  ["accessibility", /Tooltip|title=|label=/i],
]) requirePattern(page, pattern, `Executable UI state ${label}`);

for (const [label, pattern] of [
  ["WWHN-179", /WWHN-179/i],
  ["HN-MC-001", /HN-MC-001/i],
  ["Backend authorization", /Backend authorization|direct API 403|data-scope/i],
  ["dynamic CI provenance", /CURRENT_SUCCESSFUL_PUSH_RUN_FOR_EXACT_SOURCE_SHA/],
  ["parent closure matrix", /Parent closure matrix|WWHN-39/i],
]) requirePattern(taskDoc, pattern, `Task evidence ${label}`);

requirePattern(taskDoc, /không(?:\s+thể)?\s+tự nhận QA2 sign-off/i, "QA evidence boundary");
requirePattern(taskDoc, /không.*(?:tự nhận|coi).*(?:BE|backend).*(?:sign-off|bằng chứng)/is, "BE evidence boundary");
forbidPattern(taskDoc, /overall(?:\s+result)?\s*[:=-]?\s*100%|100%\s+toàn\s+luồng/i, "No false overall 100% claim");

if (register) {
  if (register.schemaVersion !== "2.0.0") failures.push("Closure register schemaVersion must be 2.0.0");
  if (register.task !== "WWHN-178" || register.parent !== "WWHN-39") failures.push("Closure register task/parent mismatch");
  if (register.branch !== "m1") failures.push("Closure register must target m1 only");
  if (register.acceptancePolicy?.feOwnedResult !== "COMPLETE") failures.push("FE-owned result must be COMPLETE");
  if (register.acceptancePolicy?.overallResult !== "BLOCKED_BY_INDEPENDENT_OWNER_GATES") failures.push("Overall result must remain blocked until independent owner gates pass");
  if (register.acceptancePolicy?.runSelectionRule !== "CURRENT_SUCCESSFUL_PUSH_RUN_FOR_EXACT_SOURCE_SHA") failures.push("CI run selection must be exact-SHA dynamic rule");
  if (register.acceptancePolicy?.hardCodedAcceptanceRunId !== null) failures.push("Hard-coded acceptance run ID is forbidden");
  const superseded = register.acceptancePolicy?.supersededRunIds ?? [];
  for (const id of [30987735727, 30987738397]) if (!superseded.includes(id)) failures.push(`Historical run ${id} must be explicitly superseded`);
  const ownerGates = register.independentOwnerGates ?? [];
  const requiredGates = ["QA2-WWHN-179", "HN-MC-001-BASELINE", "BE-OFFICIAL-CONTRACT", "BE-QA-LIVE-AUTHORIZATION"];
  for (const id of requiredGates) {
    const gate = ownerGates.find((item) => item.id === id);
    if (!gate) failures.push(`Missing independent owner gate ${id}`);
    else if (gate.acceptanceStatus !== "PENDING") failures.push(`${id} must remain PENDING until owner evidence exists`);
  }
  const matrix = register.parentClosureMatrix ?? [];
  for (const issue of ["WWHN-178", "WWHN-179", "WWHN-39"]) {
    const row = matrix.find((item) => item.issue === issue);
    if (!row) failures.push(`Parent closure matrix missing ${issue}`);
    else if (!row.statusObserved || !row.deliveryStatus || !row.evidence?.length || !row.remainingBlocker) failures.push(`Parent closure matrix row ${issue} is incomplete`);
  }
}

if (failures.length) {
  console.error("[master-sku-closure] FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log("[master-sku-closure] PASS: runtime contract, RBAC, UI states, exact-SHA CI provenance and independent owner boundaries enforced.");
