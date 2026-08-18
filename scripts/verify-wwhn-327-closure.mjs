#!/usr/bin/env node
/**
 * WWHN-327 fail-closed closure verifier.
 *
 * Gate này bảo vệ contract dashboard-quick trên FE. Nó không "chạy test hộ" — nó
 * chặn đúng những cách mà màn Dashboard đã từng sai và có thể sai lại trong im lặng:
 * đếm cảnh báo bằng độ dài mảng mẫu, bỏ nhãn data-scope, giấu ngoại lệ warranty
 * GLOBAL, tự bịa endpoint aggregate mới, hoặc mất bằng chứng viewport/RBAC.
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function fail(message) {
  console.error(`[WWHN-327] FAIL: ${message}`);
  process.exit(1);
}

function requireFile(path) {
  const absolute = join(root, path);
  if (!existsSync(absolute)) {
    fail(`Missing required task-specific artifact: ${path}`);
  }
  return readFileSync(absolute, "utf8");
}

function requireText(text, needle, context) {
  if (!text.includes(needle)) {
    fail(`${context} must contain ${JSON.stringify(needle)}`);
  }
}

/**
 * Prettier ngắt dòng JSX theo độ rộng in, nên một câu hiển thị có thể nằm trên ba dòng.
 * So khớp câu người dùng đọc phải bỏ qua cách xuống dòng, nếu không gate sẽ đỏ chỉ vì
 * format lại — và người sửa sẽ có xu hướng gỡ assertion thay vì giữ nội dung.
 */
function requirePhrase(text, phrase, context) {
  const flatten = (value) => value.replace(/\s+/g, " ").trim();
  if (!flatten(text).includes(flatten(phrase))) {
    fail(`${context} must render the phrase ${JSON.stringify(phrase)}`);
  }
}

function refuseText(text, needle, context, reason) {
  if (text.includes(needle)) {
    fail(`${context} must not contain ${JSON.stringify(needle)}: ${reason}`);
  }
}

const registerPath = "docs/evidence/WWHN-327/WWHN-327_CLOSURE_REGISTER.json";
const evidencePackPath = "docs/evidence/WWHN-327/FE_EVIDENCE_PACK.md";
const taskDocPath = "docs/Task_docs_Jira/WWHN-327.md";
const pagePath = "src/modules/dashboard/pages/DashboardPage.tsx";
const unitTestPath = "src/modules/dashboard/pages/DashboardPage.test.tsx";
const typesPath = "src/modules/dashboard/types/index.ts";
const servicePath = "src/modules/dashboard/services/dashboardService.ts";
const endpointsPath = "src/shared/api/endpoints.ts";
const permissionsPath = "src/shared/constants/wms-permissions.ts";
const e2ePath = "e2e/wwhn-327-dashboard-kpi.spec.ts";
const workflowPath = ".github/workflows/wwhn-327-fe-closure.yml";

const registerText = requireFile(registerPath);
const evidencePack = requireFile(evidencePackPath);
const taskDoc = requireFile(taskDocPath);
const page = requireFile(pagePath);
const unitTest = requireFile(unitTestPath);
const types = requireFile(typesPath);
const service = requireFile(servicePath);
const endpoints = requireFile(endpointsPath);
const permissions = requireFile(permissionsPath);
const e2e = requireFile(e2ePath);
const workflow = requireFile(workflowPath);
const packageJson = JSON.parse(requireFile("package.json"));

let register;
try {
  register = JSON.parse(registerText);
} catch (error) {
  fail(`Invalid JSON in ${registerPath}: ${error.message}`);
}

// ── Register shape ────────────────────────────────────────────
if (register.task !== "WWHN-327") {
  fail(`Closure register task must be WWHN-327, received ${register.task}`);
}
if (register.branch !== "m1") {
  fail(`Closure register branch must be m1, received ${register.branch}`);
}
if (register.pairedBackendTask !== "WWHN-328") {
  fail("Closure register must name WWHN-328 as the paired backend task");
}
if (register.independentQaTask !== "WWHN-329") {
  fail("Closure register must name WWHN-329 as the independent QA task");
}
for (const flag of [
  "failClosed",
  "noSelfSignForIndependentRoles",
  "controlledEvidenceIsNotUat",
  "noFabricatedDataOnApiError",
]) {
  if (register.evidencePolicy?.[flag] !== true) {
    fail(`Closure register must keep evidencePolicy.${flag}=true`);
  }
}
if (register.contract?.reusedNotNew !== true) {
  fail(
    "Closure register must record that the aggregate endpoint is reused, not newly created",
  );
}
if (register.contract?.permission !== "report.view") {
  fail("Closure register must pin the canonical permission report.view");
}

// ── Contract fields must exist in the FE type, not be invented ─
const declaredFields = register.contractFields ?? [];
if (declaredFields.length === 0) {
  fail("Closure register must list the aggregate contract fields");
}
for (const field of declaredFields) {
  requireText(types, field, typesPath);
}

// ── The endpoint is reused, never re-invented ─────────────────
requireText(endpoints, '"/reports/dashboard-quick"', endpointsPath);
requireText(service, "API_ENDPOINTS.DASHBOARD_KPI", servicePath);
refuseText(
  service,
  "/reports/dashboard",
  servicePath,
  "the service must go through API_ENDPOINTS, never a hard-coded aggregate path",
);

// ── Data-scope must be rendered, warranty exception must be declared ──
requireText(page, "data.data_scope", pagePath);
requireText(page, "scope_warehouse_ids", pagePath);
requireText(page, "reconciliation_warning_count", pagePath);
requireText(page, 'role="note"', pagePath);
requirePhrase(page, "số liệu bảo hành vẫn là toàn hệ thống", pagePath);
requirePhrase(page, "warranty_case không gắn kho trong ERD", pagePath);
refuseText(
  page,
  "reconciliation_warnings.length",
  pagePath,
  "the sample array is capped by the backend, so its length is not the warning total",
);

// ── report.view is the only gate; no phantom permission code ──
requireText(page, '"report.view"', pagePath);
// Chặn giá trị được khai (có ngoặc kép), không chặn nhắc tới trong comment — comment
// giải thích tại sao mã ma đó bị loại là thứ nên giữ, không phải thứ nên xoá.
refuseText(
  permissions,
  '"report.dashboard.view"',
  permissionsPath,
  "that permission code does not exist in the backend seeder and would fail closed forever",
);
requireText(permissions, 'DASHBOARD_VIEW: "report.view"', permissionsPath);

// ── Unit + E2E must keep the regression-critical assertions ───
requireText(unitTest, "WAREHOUSE_SCOPED", unitTestPath);
requireText(unitTest, "137 cảnh báo", unitTestPath);
requireText(unitTest, 'findByRole("note")', unitTestPath);

for (const viewport of register.requiredViewports ?? []) {
  const [width, height] = viewport.split("x");
  requireText(e2e, `width: ${width}, height: ${height}`, e2ePath);
}
requireText(e2e, "FE_CONTROLLED_NOT_UAT", e2ePath);
requireText(e2e, "truthBoundary", e2ePath);
requireText(e2e, "hasHorizontalOverflow", e2ePath);
requireText(e2e, "dashboardCalls", e2ePath);

// ── Independent roles must not be self-signed by FE ───────────
const items = register.items ?? [];
if (items.length === 0) {
  fail("Closure register must list the P0/P1/P2 items");
}
const feOwned = items.filter((item) => item.owner === "FE");
if (feOwned.length === 0) {
  fail("Closure register must contain at least one FE-owned item");
}
for (const item of items) {
  if (!item.id || !item.severity || !item.owner || !item.status) {
    fail(`Closure register item is incomplete: ${JSON.stringify(item)}`);
  }
  if (item.owner === "FE" && item.status !== "FIXED") {
    fail(
      `FE-owned item ${item.id} is still ${item.status}; FE may not sign off with an open FE item`,
    );
  }
  if (item.owner !== "FE" && item.status === "FIXED") {
    fail(
      `Item ${item.id} is owned by ${item.owner} but marked FIXED by FE; independent roles must sign their own items`,
    );
  }
}

// ── Evidence pack and task doc must carry the truth boundary ──
for (const [text, path] of [
  [evidencePack, evidencePackPath],
  [taskDoc, taskDocPath],
]) {
  requireText(text, "WWHN-327", path);
  requireText(text, "WWHN-329", path);
}
requireText(
  evidencePack,
  "GET /api/v1/reports/dashboard-quick",
  evidencePackPath,
);
for (const boundary of register.truthBoundary ?? []) {
  if (boundary.length < 10) {
    fail("Truth-boundary entries must be meaningful sentences");
  }
}
if ((register.truthBoundary ?? []).length < 4) {
  fail("Closure register must keep the full truth-boundary list");
}

// ── Verdict placeholders are how earlier sign-offs failed ─────
for (const [text, path] of [
  [evidencePack, evidencePackPath],
  [taskDoc, taskDocPath],
]) {
  for (const placeholder of [
    "VERIFIED PASS / CHANGES REQUIRED",
    "[GLOBAL / WAREHOUSE-SCOPED]",
    "TBD",
  ]) {
    refuseText(
      text,
      placeholder,
      path,
      "a dual verdict or placeholder reads as an unsigned sign-off",
    );
  }
}

// ── The gate must be runnable from package.json ───────────────
const script = packageJson.scripts?.["verify:wwhn-327"];
if (!script || !script.includes("verify-wwhn-327-closure.mjs")) {
  fail("package.json must expose verify:wwhn-327 running this verifier");
}
requireText(workflow, "verify:wwhn-327", workflowPath);
requireText(workflow, "wwhn-327-dashboard-kpi.spec.ts", workflowPath);

console.log("[WWHN-327] PASS: FE-owned dashboard closure contract is intact.");
