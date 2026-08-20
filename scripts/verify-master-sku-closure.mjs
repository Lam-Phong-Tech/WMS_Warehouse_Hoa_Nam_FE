#!/usr/bin/env node
/**
 * WWHN-178 closure gate — R2 (2026-08-20).
 *
 * R1 của gate này forbid call-site bằng regex một-dòng
 * (`/http\.post\([^\n]*SKU_IMPORT_EXCEL/`). Prettier xuống dòng sau `(` nên
 * regex không bao giờ match — guard PASS trong khi /skus/import-excel đã được
 * gọi thật (WWHN-331). R2 đổi cơ chế: một capability master/SKU chỉ hợp lệ khi
 * path của nó TỒN TẠI trong OpenAPI đã pin (swagger-api.json ↔
 * docs/api-evidence/BE_CONTRACT_PIN.json — hash được check:api-mapping xác
 * minh). Không còn dựa vào hình dạng call-site, nên refactor/format không thể
 * làm guard câm lặng.
 */
import { existsSync, globSync, readFileSync } from "node:fs";
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

function readJson(path) {
  const raw = read(path);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (error) {
    failures.push(`${path}: invalid JSON (${error.message})`);
    return null;
  }
}

function readSurface(patterns, label) {
  const files = patterns.flatMap((pattern) =>
    globSync(pattern, { cwd: root }).sort(),
  );
  if (!files.length) {
    failures.push(
      `${label}: no source file matched ${patterns.join(", ")} — the guarded surface disappeared`,
    );
    return { content: "", files: [] };
  }
  const content = files
    .map((file) => readFileSync(join(root, file), "utf8"))
    .join("\n");
  return { content, files };
}

function requirePattern(content, pattern, label) {
  if (!pattern.test(content)) failures.push(`${label}: missing ${pattern}`);
}

function forbidPattern(content, pattern, label) {
  if (pattern.test(content)) failures.push(`${label}: forbidden ${pattern}`);
}

// ---------------------------------------------------------------------------
// 1. Contract-pin gate: bề mặt master/SKU FE dùng phải nằm trong spec đã pin.
// ---------------------------------------------------------------------------
const contractPin = readJson("docs/api-evidence/BE_CONTRACT_PIN.json");
const spec = readJson("swagger-api.json");
const specPaths = new Set(Object.keys(spec?.paths ?? {}));

if (contractPin) {
  for (const field of ["be_sha", "spec_sha256", "openapi_version"]) {
    if (!contractPin[field])
      failures.push(`BE_CONTRACT_PIN.json missing field ${field}`);
  }
}

/**
 * Capability chính thức của WWHN-178 (R2). `:param` trong endpoints.ts tương
 * đương `{param}` trong OpenAPI — so khớp theo số đoạn path và đoạn tĩnh.
 */
const APPROVED_MASTER_SURFACE = [
  ["PRODUCT_LIST_CREATE", "/api/v1/products"],
  ["PRODUCT_DETAIL_UPDATE", "/api/v1/products/{id}"],
  ["PRODUCT_ENABLE", "/api/v1/products/{id}/enable"],
  ["PRODUCT_DISABLE", "/api/v1/products/{id}/disable"],
  ["PRODUCT_CATEGORIES", "/api/v1/product-categories"],
  ["BRANDS", "/api/v1/brands"],
  ["PRODUCT_MODELS", "/api/v1/product-models"],
  ["POWER_SOURCES", "/api/v1/power-sources"],
  ["PACKAGE_VARIANTS", "/api/v1/package-variants"],
  ["SKU_IMPORT_TEMPLATE", "/api/v1/skus/import-template"],
  ["SKU_IMPORT_EXCEL", "/api/v1/skus/import-excel"],
  ["SKU_IMPORT_REPORTS", "/api/v1/skus/import-reports"],
  ["SKU_IMPORT_REPORT", "/api/v1/skus/import-reports/{id}"],
  ["SKU_IMPORT_REPORT_ERROR_FILE", "/api/v1/skus/import-reports/{id}/error-file"],
  ["ITEM_INSTANCES", "/api/v1/item-instances"],
  ["PHYSICAL_CODES", "/api/v1/physical-codes"],
];

for (const [capability, path] of APPROVED_MASTER_SURFACE) {
  if (!specPaths.has(path)) {
    failures.push(
      `Capability ${capability}: path ${path} is NOT in the pinned OpenAPI — capability must fail closed`,
    );
  }
}

// Phantom endpoint: có controller BE nhưng không route/spec/bảng → FE gọi sẽ
// 404. Cấm cả định nghĩa lẫn call-site (chuỗi literal, không phụ thuộc format).
const srcSurface = readSurface(
  ["src/**/*.ts", "src/**/*.tsx"],
  "Application source surface",
);
for (const phantom of ['"/uoms"', '"/suppliers"', "'/uoms'", "'/suppliers'"]) {
  if (srcSurface.content.includes(phantom)) {
    failures.push(
      `Phantom endpoint ${phantom} referenced in src/ — no BE route/spec exists (404 RESOURCE_NOT_FOUND)`,
    );
  }
}

const endpoints = read("src/shared/api/endpoints.ts");
requirePattern(endpoints, /PRODUCTS:\s*"\/products"/, "Canonical Product endpoint");
requirePattern(
  endpoints,
  /SKU_IMPORT_EXCEL:\s*"\/skus\/import-excel"/,
  "Contract-pinned SKU import endpoint",
);

// ---------------------------------------------------------------------------
// 2. UI-state + permission guard trên bề mặt master-data hiện tại.
// ---------------------------------------------------------------------------
const pageSurface = readSurface(
  ["src/modules/master-data/pages/*.tsx"],
  "Master-data page surface",
);
const serviceSurface = readSurface(
  ["src/modules/master-data/services/*.ts"],
  "Master-data service surface",
);
const page = pageSurface.content;
const serviceTest = serviceSurface.files
  .filter((file) => /\.test\.tsx?$/.test(file))
  .map((file) => readFileSync(join(root, file), "utf8"))
  .join("\n");

requirePattern(page, /useCanManage\("sku\.manage"\)/, "SKU permission guard");
requirePattern(page, /useCanManage\("agency\.manage"\)/, "Agency permission guard");
requirePattern(serviceTest, /not\.toHaveBeenCalled\(\)|toThrow|rejects/, "Fail-closed unit test");

for (const [label, pattern] of [
  ["loading", /Đang tải dữ liệu từ API|isLoading|isFetching/i],
  ["empty", /Không có SKU phù hợp bộ lọc|emptyText|Chưa có/i],
  ["error", /ApiErrorAlert|isError|type="error"/i],
  ["success", /toast\.success|message\.success/i],
  ["disabled", /\bdisabled\b/i],
  ["responsive", /table-wrap|\bxs=|\bmd=|scroll=\{\{/i],
  ["accessibility", /aria-label|Tooltip|title=/i],
]) requirePattern(page, pattern, `Executable UI state ${label}`);

// ---------------------------------------------------------------------------
// 3. Task doc + closure register: boundary vai trò và provenance exact-SHA.
// ---------------------------------------------------------------------------
const taskDoc = read("docs/Task_docs_Jira/WWHN-178.md");
for (const [label, pattern] of [
  ["WWHN-179", /WWHN-179/i],
  ["HN-MC-001", /HN-MC-001/i],
  ["Backend authorization", /Backend authorization|direct API 403|data-scope/i],
  ["local exact-SHA provenance", /DEC-178-CI-LOCAL-01/],
  ["parent closure matrix", /Parent closure matrix|WWHN-39/i],
]) requirePattern(taskDoc, pattern, `Task evidence ${label}`);

requirePattern(taskDoc, /không(?:\s+thể)?\s+tự nhận QA2 sign-off/i, "QA evidence boundary");
requirePattern(taskDoc, /không.*(?:tự nhận|coi).*(?:BE|backend).*(?:sign-off|bằng chứng)/is, "BE evidence boundary");
forbidPattern(taskDoc, /overall(?:\s+result)?\s*[:=-]?\s*100%|100%\s+toàn\s+luồng/i, "No false overall 100% claim");

const registerPath = "docs/evidence/wwhn-178/WWHN-178_CLOSURE_REGISTER.json";
const register = readJson(registerPath);

if (register) {
  if (register.schemaVersion !== "2.1.0")
    failures.push("Closure register schemaVersion must be 2.1.0");
  if (register.task !== "WWHN-178" || register.parent !== "WWHN-39")
    failures.push("Closure register task/parent mismatch");
  if (register.branch !== "m1")
    failures.push("Closure register must target m1 only");
  if (register.acceptancePolicy?.feOwnedResult !== "COMPLETE")
    failures.push("FE-owned result must be COMPLETE");
  if (register.acceptancePolicy?.overallResult !== "BLOCKED_BY_INDEPENDENT_OWNER_GATES")
    failures.push("Overall result must remain blocked until independent owner gates pass");
  if (register.acceptancePolicy?.runSelectionRule !== "LOCAL_EXACT_SHA_EVIDENCE_GATE")
    failures.push("Acceptance must use the local exact-SHA evidence gate rule");
  if (register.acceptancePolicy?.ciSubstitutionDecision !== "DEC-178-CI-LOCAL-01")
    failures.push("Local gate must be justified by DEC-178-CI-LOCAL-01");
  if (register.acceptancePolicy?.hardCodedAcceptanceRunId !== null)
    failures.push("Hard-coded acceptance run ID is forbidden");
  const superseded = register.acceptancePolicy?.supersededRunIds ?? [];
  for (const id of [30987735727, 30987738397])
    if (!superseded.includes(id))
      failures.push(`Historical run ${id} must be explicitly superseded`);

  // Contract pin trong register phải khớp pin thật — chống register rot.
  const pinned = register.beContractPin ?? {};
  if (contractPin) {
    if (pinned.be_sha !== contractPin.be_sha)
      failures.push("Register beContractPin.be_sha differs from BE_CONTRACT_PIN.json");
    if (pinned.spec_sha256 !== contractPin.spec_sha256)
      failures.push("Register beContractPin.spec_sha256 differs from BE_CONTRACT_PIN.json");
  }

  const ownerGates = register.independentOwnerGates ?? [];
  const requiredGates = {
    "QA2-WWHN-179": ["PENDING", "EVIDENCED_PENDING_SIGNOFF"],
    "HN-MC-001-BASELINE": ["PENDING"],
    "BE-OFFICIAL-CONTRACT": ["PENDING", "EVIDENCED_PENDING_SIGNOFF"],
    "BE-QA-LIVE-AUTHORIZATION": ["PENDING", "EVIDENCED_PENDING_SIGNOFF"],
  };
  for (const [id, allowedStatuses] of Object.entries(requiredGates)) {
    const gate = ownerGates.find((item) => item.id === id);
    if (!gate) failures.push(`Missing independent owner gate ${id}`);
    else if (!allowedStatuses.includes(gate.acceptanceStatus))
      failures.push(
        `${id} acceptanceStatus must be one of ${allowedStatuses.join("/")} until the owner signs off in Jira`,
      );
  }

  const matrix = register.parentClosureMatrix ?? [];
  for (const issue of ["WWHN-178", "WWHN-179", "WWHN-39"]) {
    const row = matrix.find((item) => item.issue === issue);
    if (!row) failures.push(`Parent closure matrix missing ${issue}`);
    else if (!row.statusObserved || !row.deliveryStatus || !row.evidence?.length || !row.remainingBlocker)
      failures.push(`Parent closure matrix row ${issue} is incomplete`);
  }
}

if (failures.length) {
  console.error("[master-sku-closure] FAILED");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}
console.log(
  "[master-sku-closure] PASS: pinned-contract surface, phantom-endpoint ban, RBAC/UI states, local exact-SHA provenance and independent owner boundaries enforced.",
);
